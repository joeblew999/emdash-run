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
	if (token && !env.EMDASH_TOKEN) env.EMDASH_TOKEN = token.token;
	const access = read("access");
	if (access && !env.EMDASH_HEADERS) env.EMDASH_HEADERS = `CF-Access-Client-Id: ${access.id}\nCF-Access-Client-Secret: ${access.secret}`;
}
const r = spawnSync("pnpm", ["exec", "emdash", ...rest], { cwd: siteDir, env, stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
