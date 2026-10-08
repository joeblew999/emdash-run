// Signing a machine in, as nodes of the graph (graph.mjs).
//
// signin:token is the one token that makes a machine a full user of an EmDash site, with no
// browser. EmDash accepts an API token before any other sign-in — under Cloudflare Access too — and
// its own development sign-in can mint one, but only in development mode. This does the same for a
// production build, the way that code does it: an administrator, the three "set up" options, and
// the token's SHA-256 hash, written to the site's database. A DEV-SITE TOOL: whoever can write to
// the database can do this, and that is the point.
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

import { deployedAddress, previewOf } from "../wrangler-config.mjs";

/** @typedef {import("./graph.mjs").Graph} Graph @typedef {import("./graph.mjs").Ctx} Ctx */

const q = (/** @type {unknown} */ v) => "'" + String(v).replaceAll("'", "''") + "'";

/**
 * The SQL that makes the administrator and their token, safe to run again.
 * @param {{ email: string, name: string, origin: string, tokenName: string, hash: string, prefix: string, ids: [string, string], now: string }} t
 */
export const tokenSql = (t) =>
	[
		`INSERT INTO users (id, email, name, role, email_verified, created_at, updated_at) SELECT ${q(t.ids[0])}, ${q(t.email)}, ${q(t.name)}, 50, 1, ${q(t.now)}, ${q(t.now)} WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = ${q(t.email)})`,
		`INSERT INTO options (name, value) VALUES ('emdash:site_title', ${q(JSON.stringify("My Site"))}) ON CONFLICT(name) DO NOTHING`,
		`INSERT INTO options (name, value) VALUES ('emdash:site_url', ${q(JSON.stringify(t.origin))}) ON CONFLICT(name) DO UPDATE SET value = excluded.value`,
		`INSERT INTO options (name, value) VALUES ('emdash:setup_complete', 'true') ON CONFLICT(name) DO UPDATE SET value = excluded.value`,
		`DELETE FROM _emdash_api_tokens WHERE name = ${q(t.tokenName)}`,
		`INSERT INTO _emdash_api_tokens (id, name, token_hash, prefix, user_id, scopes) SELECT ${q(t.ids[1])}, ${q(t.tokenName)}, ${q(t.hash)}, ${q(t.prefix)}, id, ${q(JSON.stringify(["admin"]))} FROM users WHERE email = ${q(t.email)}`,
	].join("; ");

/**
 * One name per site for what this machine saves. A deployed site: its host. A site on this machine:
 * host and port are not enough — two projects can use the same port — so the site's folder is part of it.
 * @param {string} url @param {string} siteDir
 */
export const savedName = (url, siteDir) => {
	const { host, hostname } = new URL(url);
	const safe = host.replace(/[^a-zA-Z0-9.-]/g, "_");
	const local = ["localhost", "127.0.0.1", "[::1]"].includes(hostname) || hostname.endsWith(".localhost");
	return local ? `${safe}_${createHash("sha256").update(resolve(siteDir)).digest("hex").slice(0, 10)}` : safe;
};

/** A program one of the site's packages installs, run by Node itself: an argument with spaces arrives whole on every OS. */
const siteBin = (/** @type {Ctx} */ { world, project }, /** @type {string} */ pkg, /** @type {string} */ name) => {
	const dir = join(project.site, "node_modules", pkg);
	const bin = JSON.parse(world.read(join(dir, "package.json"))).bin;
	return join(dir, typeof bin === "string" ? bin : bin[name]);
};

/** @type {Graph} */
export const signin = {
	// The deployed site answers. Only reported: nothing here can bring a deployed site up.
	"live:answers": {
		needs: () => ["site:exists"],
		work: async ({ world, project }) => {
			if (!project.live) throw new Error("LIVE_URL is not set: say where the deployed site is, in the project's mise.toml ([env] LIVE_URL).");
			const url = deployedAddress(project.live);
			if ((await world.ask(new URL(url).origin, { seconds: 15 })).status === 0) throw new Error(`Nothing is answering at ${new URL(url).origin}. Is the site deployed? mise run live:ship`);
		},
	},
	"signin:token": {
		// this machine's built site, running — or, with --live, the deployed one, answering
		needs: (flags) => (flags.live ? ["live:answers"] : ["site:built-running"]),
		work: async (ctx) => {
			const { world, project, flags, env } = ctx;
			const live = !!flags.live;
			const url = live ? deployedAddress(project.live) : `http://localhost:${project.builtPort}`;
			const { origin, host } = new URL(url);
			world.say(live ? `-> DEPLOYED site: ${origin}` : `-> this machine, built site (site:preview): ${origin}`);
			const email = env.ADMIN_EMAIL || "agent@emdash.local";
			// one token per machine, named after it, so a second developer or CI does not replace this one
			const tokenName = `emdash-run:${world.machine.replace(/[^a-zA-Z0-9.-]/g, "-")}`;
			const minted = world.mint();
			const sql = tokenSql({ email, name: env.ADMIN_NAME || "Site Admin", origin, tokenName, hash: minted.hash, prefix: minted.raw.slice(0, 11), ids: minted.ids, now: minted.now });

			// A preview (mise run live:preview) has a database of its own, named in the `previews` block.
			const preview = live ? previewOf(url, project.site) : null;
			if (preview && !preview.database) throw new Error(`token: ${host} is a preview of this Worker, but wrangler.jsonc has no "previews" block naming its database. Run: mise run live:preview`);
			if (preview) world.say(`-> the PREVIEW "${preview.name}": its own database, ${preview.database}`);

			// A Cloudflare site's database is D1, written with wrangler. A Node site's is a SQLite file.
			const cloudflare = ["wrangler.jsonc", "wrangler.json", "wrangler.toml"].some((f) => world.exists(join(project.site, f)));
			const refused = (/** @type {string} */ why) => new Error(`token: the database refused it. Has the site answered a request yet? EmDash makes its tables on the first one.\n${why.slice(0, 600)}`);
			if (cloudflare) {
				// EmDash makes its tables while answering its first request, and a site that has just been
				// started or deployed may still be at it: "no such table" is asked again for half a minute.
				for (let attempt = 1; ; attempt++) {
					const r = world.exec(process.execPath, [siteBin(ctx, "wrangler", "wrangler"), "d1", "execute", preview ? preview.database : "DB", live ? "--remote" : "--local", "--yes", "--command", sql], project.site);
					if (r.code === 0) break;
					if (attempt >= 6 || !/no such table/i.test(r.err + r.out)) throw refused(r.err || r.out);
					await world.ask(`${origin}/_emdash/api/setup/status`, { seconds: 60 });
					await world.sleep(5);
				}
			} else if (live) {
				throw refused("this is a Node site: its deployed database is wherever you host it, which this task cannot reach. Run signin:token on the server, without --live.");
			} else {
				try {
					world.sqlite(join(project.site, env.SITE_DATABASE || "data.db"), sql);
				} catch (e) {
					throw refused(e instanceof Error ? e.message : String(e));
				}
			}
			const file = join(world.config, "emdash-run", "tokens", `${savedName(url, project.site)}.json`);
			world.keep(file, JSON.stringify({ url: origin, token: minted.raw }));

			// Deployed sites only: the token, and the Cloudflare Access pass if this machine has one, also
			// go into EmDash's OWN sign-in store, as `emdash login` would put them — `emdash whoami` takes
			// extra headers only from there. Not for this machine's sites: those are stored per project
			// folder, and a stale one breaks the dev CLI when the local database is emptied.
			const passFile = join(world.config, "emdash-run", "access", `${preview ? preview.liveHost : host}.json`);
			const pass = world.exists(passFile) ? JSON.parse(world.read(passFile)) : null;
			const headers = pass ? { "CF-Access-Client-Id": pass.id, "CF-Access-Client-Secret": pass.secret } : {};
			if (live) {
				const authFile = join(world.config, "emdash", "auth.json");
				const store = world.exists(authFile) ? JSON.parse(world.read(authFile)) : {};
				store[origin] = { accessToken: minted.raw, refreshToken: "", expiresAt: new Date(Date.parse(minted.now) + 10 * 365 * 24 * 3600 * 1000).toISOString(), ...(pass ? { customHeaders: headers } : {}), user: { email, role: "admin" } };
				world.keep(authFile, JSON.stringify(store, null, 2));
				world.keep(file, JSON.stringify({ url: origin, token: minted.raw, stored: true }));
			}
			// EmDash's welcome dialog, closed for this user the way its own button does it
			await world.ask(`${origin}/_emdash/api/auth/me`, { method: "POST", headers: { ...headers, Authorization: `Bearer ${minted.raw}`, "Content-Type": "application/json", "X-EmDash-Request": "1" }, body: JSON.stringify({ action: "dismissWelcome" }) });
			world.say(`token: ${env.ADMIN_EMAIL ? "the address in ADMIN_EMAIL" : email} is an administrator of ${origin}, and its API token is saved on this machine${live ? " — and in EmDash's own sign-in store" : ""}`);
		},
	},
};
