// What the `emdash` task runs: EmDash's CLI, with whatever this machine has saved for the site it
// is pointed at — so no task has to carry a token.
//
//   main([<default site address> <site folder> [anything for the CLI…]])   (scripts/core/tasks.mjs calls it)
//
// The site is the CLI's own --url (or -u) when given, else the default. For that site's host:
//   ~/.config/emdash-run/tokens/<host>.json  → EMDASH_TOKEN    (signin:token)
//   ~/.config/emdash-run/access/<host>.json  → EMDASH_HEADERS  (signin:access; Cloudflare Access)
// A value already in the environment wins. Nothing is printed.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { Exit } from "./core/calls.mjs";

/** @param {string[]} argv */
export async function main(argv) {
	// One name per site for what this machine saves. A deployed site: its host. A site on this
	// machine: host and port are not enough — two projects can use the same port — so the site's
	// folder is part of it.
	const savedName = (/** @type {string} */ url, /** @type {string} */ siteDir) => {
		const { host, hostname } = new URL(url);
		const safe = host.replace(/[^a-zA-Z0-9.-]/g, "_");
		const local = ["localhost", "127.0.0.1", "[::1]"].includes(hostname) || hostname.endsWith(".localhost");
		return local ? `${safe}_${createHash("sha256").update(resolve(siteDir)).digest("hex").slice(0, 10)}` : safe;
	};


	const [fallback, siteDir, ...given] = argv;
	// A program one of the site's packages installs, as [node, its script]: run with Node itself, with
	// no shell in between, so an argument with spaces or quotes arrives whole on every OS. (`pnpm exec`
	// on Windows is a .cmd file and needs a shell, which takes such an argument apart.)
	const siteBin = (/** @type {string} */ pkg, /** @type {string} */ name) => {
		const dir = join(siteDir, "node_modules", pkg);
		const bin = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).bin;
		return join(dir, typeof bin === "string" ? bin : bin[name]);
	};

	// One way to say where, the same as every other task: nothing = this machine's dev site;
	// --live = the deployed site (LIVE_URL); --preview = this machine's built site (PREVIEW_PORT).
	// Each becomes the CLI's own --url. An explicit --url still works and wins.
	const rest = [];
	for (const arg of given) {
		if (arg === "--live") {
			if (!process.env.LIVE_URL) {
				console.error("--live needs the address of the deployed site. Set LIVE_URL in the [env] block of mise.toml.");
				throw new Exit(1);
			}
			// LIVE_PREVIEW=<name>: the deployed site meant is that preview of it (wrangler-config.mjs)
			rest.push("--url", (await import("./wrangler-config.mjs")).deployedAddress(process.env.LIVE_URL));
		} else if (arg === "--preview") {
			rest.push("--url", `http://localhost:${process.env.PREVIEW_PORT || "4322"}`);
		} else {
			rest.push(arg);
		}
	}
	const i = rest.findIndex((a) => a === "--url" || a === "-u");
	const inline = rest.find((a) => a.startsWith("--url="));
	const url = inline ? inline.slice(6) : i >= 0 ? rest[i + 1] : fallback;

	// Say where this is acting, before doing anything. (On stderr, so piped output stays clean.)
	const whereIs = (/** @type {string} */ u) => {
		if (!URL.canParse(u)) return u;
		const { origin, port, hostname } = new URL(u);
		const here = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
		if (!here) return `DEPLOYED site: ${origin}`;
		return `this machine, ${port === (process.env.PREVIEW_PORT || "4322") ? "built site (site:preview)" : "dev site (site:start)"}: ${origin}`;
	};
	console.error(`-> ${whereIs(url)}`);
	/** @type {NodeJS.ProcessEnv} */
	const env = { ...process.env, EMDASH_URL: url };
	if (URL.canParse(url)) {
		const host = savedName(url, siteDir);
		const dir = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "emdash-run");
		const read = (/** @type {string} */ kind) => {
			const f = join(dir, kind, `${host}.json`);
			return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
		};
		const token = read("tokens");
		// Option A: when the token is in EmDash's own sign-in store, the CLI finds it and the Access
		// pass by itself — and putting them in the environment as well is what breaks `whoami`.
		const inStore = token?.stored === true;
		if (token && !inStore && !env.EMDASH_TOKEN) env.EMDASH_TOKEN = token.token;
		// A dev site set to sign in with Cloudflare Access (`auth: access(…)`, which signin:access asks
		// for) has no /_emdash/api/auth/dev-bypass — EmDash leaves its own sign-in routes out — and that
		// is the address the CLI signs in at on localhost: "Not authenticated". The setup route's dev
		// sign-in is still there and hands out a token (?token=1): take that one, and keep it.
		// Upstream: emdash-cms/emdash#3993 (when fixed: take this block out, and the `dev` tokens it saves)
		if (!env.EMDASH_TOKEN || token?.dev) {
			const { hostname, origin } = new URL(url);
			if (["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
				try {
					/** @type {RequestInit} */
					const quick = { redirect: "manual", signal: AbortSignal.timeout(20_000) };
					const good = token?.dev && (await fetch(new URL("/_emdash/api/auth/me", origin), { ...quick, headers: { Authorization: `Bearer ${token.token}` } })).ok;
					if (token?.dev && !good) delete env.EMDASH_TOKEN;
					if (!good && (await fetch(new URL("/_emdash/api/auth/dev-bypass", origin), quick)).status === 404) {
						const res = await fetch(new URL("/_emdash/api/setup/dev-bypass?token=1", origin), { method: "POST", signal: AbortSignal.timeout(120_000) });
						const minted = res.ok ? ((await res.json())?.data?.token ?? null) : null;
						if (minted) {
							env.EMDASH_TOKEN = minted;
							const f = join(dir, "tokens", `${host}.json`);
							mkdirSync(join(dir, "tokens"), { recursive: true, mode: 0o700 });
							writeFileSync(f, JSON.stringify({ url: origin, token: minted, dev: true }), { mode: 0o600 });
						}
					}
				} catch {}
			}
		}
		// a preview of the Worker is behind the live site's Access application: the same pass
		const { previewOf } = await import("./wrangler-config.mjs");
		const preview = previewOf(url, siteDir);
		const access = read("access") ?? (preview && existsSync(join(dir, "access", `${preview.liveHost}.json`)) ? JSON.parse(readFileSync(join(dir, "access", `${preview.liveHost}.json`), "utf8")) : null);
		if (access && !inStore && !env.EMDASH_HEADERS) env.EMDASH_HEADERS = `CF-Access-Client-Id: ${access.id}\nCF-Access-Client-Secret: ${access.secret}`;
	}
	// Upstream: emdash-cms/emdash#3994 (when fixed: take out option B here and option A in signin-token.mjs)
	// OPTION B (being tried, 2026-10-07, alongside A): `whoami` with the token in the environment.
	// EmDash's `whoami` sends the token but not EMDASH_HEADERS, so behind Cloudflare Access it gets
	// the login page. Here the same question is asked with both — the request `whoami` itself makes,
	// GET /_emdash/api/auth/me — and answered in its words. Only when there are headers to add;
	// otherwise EmDash's own `whoami` runs, as for everything else.
	if (rest[0] === "whoami" && env.EMDASH_TOKEN && env.EMDASH_HEADERS && URL.canParse(url)) {
		/** @type {Record<string, string>} */
		const headers = { Authorization: `Bearer ${env.EMDASH_TOKEN}` };
		for (const line of env.EMDASH_HEADERS.split("\n")) {
			const at = line.indexOf(":");
			if (at > 0) headers[line.slice(0, at).trim()] = line.slice(at + 1).trim();
		}
		const res = await fetch(new URL("/_emdash/api/auth/me", url), { headers, redirect: "manual" });
		if (res.status === 401) {
			console.error("Token is invalid or expired.");
			throw new Exit(1);
		}
		if (!res.ok) {
			console.error(`Failed to fetch user info: ${res.status}${res.status === 302 ? " — sent to a login page: the Access pass was not accepted" : ""}`);
			throw new Exit(1);
		}
		const me = (await res.json()).data ?? {};
		// EmDash's role levels, by name (auth/src/types.ts).
		/** @type {Record<string, string>} */
		const roles = { 50: "admin", 40: "editor", 30: "author", 20: "contributor", 10: "subscriber" };
		me.role = roles[me.role] ?? me.role;
		if (rest.includes("--json")) {
			console.log(JSON.stringify({ ...me, authMethod: "token" }));
		} else {
			console.log(`Email: ${me.email}\nName:  ${me.name ?? ""}\nRole:  ${me.role}\nAuth:  token (asked by emdash-run: EmDash's whoami does not send EMDASH_HEADERS)`);
		}
		throw new Exit(0);
	}
	const r = spawnSync(process.execPath, [siteBin("emdash", "emdash"), ...rest], { cwd: siteDir, env, stdio: "inherit" });
	throw new Exit(r.status ?? 1);
}
