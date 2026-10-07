// What `mise run signin:token` runs (with --live: --remote): the one token that makes a machine a
// full user of an EmDash site, with no browser.
//
// EmDash accepts an API token before any other sign-in — under Cloudflare Access too — and its own
// development sign-in can mint one (`dev-bypass?token=1`), but only in development mode. This does
// the same thing for a production build, the way that code does it: an administrator, the three
// "set up" options, and the token's SHA-256 hash, written to the site's D1 database with wrangler.
// A DEV-SITE TOOL: whoever can write to the database can do this, and that is the point.
//
//   node token.mjs <site address> <site folder> --local | --remote
//
// The token is saved in ~/.config/emdash-run/tokens/<host>.json, readable by this user only.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { hostname as machineName } from "node:os";
import { dirname, join, resolve } from "node:path";

const args = process.argv.slice(2);
const where = args.includes("--remote") ? "--remote" : "--local";
const [url, siteDir] = args.filter((a) => !a.startsWith("--"));
if (!url || !URL.canParse(url) || !siteDir) {
	console.error("usage: node token.mjs <site address> <site folder> --local | --remote");
	process.exit(1);
}
const { host, origin } = new URL(url);
// One name per site for what this machine saves. A deployed site: its host. A site on this
// machine: host and port are not enough — two projects can use the same port — so the site's
// folder is part of it.
const savedName = (url, siteDir) => {
	const { host, hostname } = new URL(url);
	const safe = host.replace(/[^a-zA-Z0-9.-]/g, "_");
	const local = ["localhost", "127.0.0.1", "[::1]"].includes(hostname) || hostname.endsWith(".localhost");
	return local ? `${safe}_${createHash("sha256").update(resolve(siteDir)).digest("hex").slice(0, 10)}` : safe;
};
// One token per machine, named after it, so a second developer or CI does not replace this one.
const tokenName = `emdash-run:${machineName().replace(/[^a-zA-Z0-9.-]/g, "-")}`;
const email = process.env.ADMIN_EMAIL || "agent@emdash.local";
const name = process.env.ADMIN_NAME || "Site Admin";

const LOCAL_HINT = where === "--local"
	? `Nothing is answering at ${origin}. The sign-in tasks work on the production build: start it with  mise run site:preview  — then run this again.`
	: `Nothing is answering at ${origin}. Is the site deployed? mise run live:ship`;
// Is the site there at all? Say so in one line when it is not.
try {
	await fetch(new URL(url).origin, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
} catch {
	console.error(LOCAL_HINT);
	process.exit(1);
}

// As EmDash makes one: ec_pat_ + 32 random bytes, base64url; stored as the base64url SHA-256.
const raw = "ec_pat_" + randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(raw).digest("base64url");
const q = (v) => "'" + String(v).replaceAll("'", "''") + "'";
const id = () => randomUUID().replaceAll("-", "").toUpperCase().slice(0, 26);
const now = new Date().toISOString();
const sql = [
	`INSERT INTO users (id, email, name, role, email_verified, created_at, updated_at) SELECT ${q(id())}, ${q(email)}, ${q(name)}, 50, 1, ${q(now)}, ${q(now)} WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = ${q(email)})`,
	`INSERT INTO options (name, value) VALUES ('emdash:site_title', ${q(JSON.stringify("My Site"))}) ON CONFLICT(name) DO NOTHING`,
	`INSERT INTO options (name, value) VALUES ('emdash:site_url', ${q(JSON.stringify(origin))}) ON CONFLICT(name) DO UPDATE SET value = excluded.value`,
	`INSERT INTO options (name, value) VALUES ('emdash:setup_complete', 'true') ON CONFLICT(name) DO UPDATE SET value = excluded.value`,
	`DELETE FROM _emdash_api_tokens WHERE name = ${q(tokenName)}`,
	`INSERT INTO _emdash_api_tokens (id, name, token_hash, prefix, user_id, scopes) SELECT ${q(id())}, ${q(tokenName)}, ${q(hash)}, ${q(raw.slice(0, 11))}, id, ${q(JSON.stringify(["admin"]))} FROM users WHERE email = ${q(email)}`,
].join("; ");

try {
	execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "DB", where, "--yes", "--command", sql], {
		cwd: siteDir,
		stdio: ["ignore", "ignore", "pipe"],
		shell: process.platform === "win32",
	});
} catch (error) {
	console.error(`token: the database refused it. Has the site answered a request yet? EmDash makes its tables on the first one.\n${String(error.stderr || error.message).slice(0, 600)}`);
	process.exit(1);
}
const file = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "emdash-run", "tokens", `${savedName(url, siteDir)}.json`);
mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
writeFileSync(file, JSON.stringify({ url: origin, token: raw }), { mode: 0o600 });
chmodSync(file, 0o600);

// OPTION A (being tried, 2026-10-07) — deployed sites only: also put the token, and the Cloudflare
// Access pass if this machine has one, into EmDash's OWN sign-in store, as `emdash login` would.
// Then every command finds both by itself. `emdash whoami` needs this: it takes extra headers
// only from a stored sign-in, never from EMDASH_HEADERS, so with the token in the environment it
// was sent to Cloudflare's login page. The file's format is EmDash's (cli/credentials.ts), not ours.
// Not for this machine's sites: those are stored per project folder, and a stale one breaks the
// dev CLI when the local database is emptied.
let stored = false;
if (where === "--remote") {
	const config = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
	const authFile = join(config, "emdash", "auth.json");
	const accessFile = join(config, "emdash-run", "access", `${host}.json`);
	const store = existsSync(authFile) ? JSON.parse(readFileSync(authFile, "utf8")) : {};
	const pass = existsSync(accessFile) ? JSON.parse(readFileSync(accessFile, "utf8")) : null;
	store[origin] = {
		accessToken: raw,
		refreshToken: "",
		expiresAt: new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString(),
		...(pass ? { customHeaders: { "CF-Access-Client-Id": pass.id, "CF-Access-Client-Secret": pass.secret } } : {}),
		user: { email, role: "admin" },
	};
	mkdirSync(dirname(authFile), { recursive: true, mode: 0o700 });
	writeFileSync(authFile, JSON.stringify(store, null, 2), { mode: 0o600 });
	chmodSync(authFile, 0o600);
	stored = true;
	writeFileSync(file, JSON.stringify({ url: origin, token: raw, stored }), { mode: 0o600 });
}
console.log(`token: ${email} is an administrator of ${origin}, and its API token is saved on this machine${stored ? " — and in EmDash's own sign-in store" : ""}`);
