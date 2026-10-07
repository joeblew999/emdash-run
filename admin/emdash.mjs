// What the `emdash` task runs: EmDash's CLI, with whatever this machine has saved for the site it
// is pointed at — so no task has to carry a token.
//
//   node emdash.mjs <default site address> <site folder> [anything for the CLI…]
//
// The site is the CLI's own --url (or -u) when given, else the default. For that site's host:
//   ~/.config/emdash-run/tokens/<host>.json  → EMDASH_TOKEN    (signin:token)
//   ~/.config/emdash-run/access/<host>.json  → EMDASH_HEADERS  (signin:access; Cloudflare Access)
// A value already in the environment wins. Nothing is printed.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const [fallback, siteDir, ...rest] = process.argv.slice(2);
const i = rest.findIndex((a) => a === "--url" || a === "-u");
const inline = rest.find((a) => a.startsWith("--url="));
const url = inline ? inline.slice(6) : i >= 0 ? rest[i + 1] : fallback;
const env = { ...process.env, EMDASH_URL: url };
if (URL.canParse(url)) {
	const host = new URL(url).host.replace(/[^a-zA-Z0-9.-]/g, "_");
	const dir = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "emdash-run");
	const read = (kind) => {
		const f = join(dir, kind, `${host}.json`);
		return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
	};
	const token = read("tokens");
	// Option A: when the token is in EmDash's own sign-in store, the CLI finds it and the Access
	// pass by itself — and putting them in the environment as well is what breaks `whoami`.
	const inStore = token?.stored === true;
	if (token && !inStore && !env.EMDASH_TOKEN) env.EMDASH_TOKEN = token.token;
	const access = read("access");
	if (access && !inStore && !env.EMDASH_HEADERS) env.EMDASH_HEADERS = `CF-Access-Client-Id: ${access.id}\nCF-Access-Client-Secret: ${access.secret}`;
}
// OPTION B (being tried, 2026-10-07, alongside A): `whoami` with the token in the environment.
// EmDash's `whoami` sends the token but not EMDASH_HEADERS, so behind Cloudflare Access it gets
// the login page. Here the same question is asked with both — the request `whoami` itself makes,
// GET /_emdash/api/auth/me — and answered in its words. Only when there are headers to add;
// otherwise EmDash's own `whoami` runs, as for everything else.
if (rest[0] === "whoami" && env.EMDASH_TOKEN && env.EMDASH_HEADERS && URL.canParse(url)) {
	const headers = { Authorization: `Bearer ${env.EMDASH_TOKEN}` };
	for (const line of env.EMDASH_HEADERS.split("\n")) {
		const at = line.indexOf(":");
		if (at > 0) headers[line.slice(0, at).trim()] = line.slice(at + 1).trim();
	}
	const res = await fetch(new URL("/_emdash/api/auth/me", url), { headers, redirect: "manual" });
	if (res.status === 401) {
		console.error("Token is invalid or expired.");
		process.exit(1);
	}
	if (!res.ok) {
		console.error(`Failed to fetch user info: ${res.status}${res.status === 302 ? " — sent to a login page: the Access pass was not accepted" : ""}`);
		process.exit(1);
	}
	const me = (await res.json()).data ?? {};
	// EmDash's role levels, by name (auth/src/types.ts).
	const roles = { 50: "admin", 40: "editor", 30: "author", 20: "contributor", 10: "subscriber" };
	me.role = roles[me.role] ?? me.role;
	if (rest.includes("--json")) {
		console.log(JSON.stringify({ ...me, authMethod: "token" }));
	} else {
		console.log(`Email: ${me.email}\nName:  ${me.name ?? ""}\nRole:  ${me.role}\nAuth:  token (asked by emdash-run: EmDash's whoami does not send EMDASH_HEADERS)`);
	}
	process.exit(0);
}
const r = spawnSync("pnpm", ["exec", "emdash", ...rest], { cwd: siteDir, env, stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
