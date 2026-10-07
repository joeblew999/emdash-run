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
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const where = args.includes("--remote") ? "--remote" : "--local";
const [url, siteDir] = args.filter((a) => !a.startsWith("--"));
if (!url || !URL.canParse(url) || !siteDir) {
	console.error("usage: node token.mjs <site address> <site folder> --local | --remote");
	process.exit(1);
}
const { host, origin } = new URL(url);
const email = process.env.ADMIN_EMAIL || "agent@emdash.local";
const name = process.env.ADMIN_NAME || "Site Admin";

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
	`DELETE FROM _emdash_api_tokens WHERE name = 'emdash-run'`,
	`INSERT INTO _emdash_api_tokens (id, name, token_hash, prefix, user_id, scopes) SELECT ${q(id())}, 'emdash-run', ${q(hash)}, ${q(raw.slice(0, 11))}, id, ${q(JSON.stringify(["admin"]))} FROM users WHERE email = ${q(email)}`,
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
const file = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "emdash-run", "tokens", `${host.replace(/[^a-zA-Z0-9.-]/g, "_")}.json`);
mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
writeFileSync(file, JSON.stringify({ url: origin, token: raw }), { mode: 0o600 });
chmodSync(file, 0o600);
console.log(`token: ${email} is an administrator of ${origin}, and its API token is saved on this machine`);
