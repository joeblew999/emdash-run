// The test's stand-in for a developer: puts the lines `mise run signin:access` printed into the
// site's astro.config.mjs and wrangler.jsonc.   node tests/signin-access-lines.mjs <printed output> <site folder>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [printed, site] = process.argv.slice(2);
const lines = readFileSync(printed, "utf8").split("\n").map((l) => l.replace(/\x1b\[[0-9;]*m/g, "").replace(/^\[[^\]]*\]\s*/, "").trim()); // mise puts [task] before each line
const find = (/** @type {string} */ start) => {
	const line = lines.find((l) => l.startsWith(start));
	if (!line) throw new Error(`signin:access did not print a line starting ${start}`);
	return line;
};
const auth = find("auth: access(");
if (auth.includes("<")) throw new Error(`signin:access printed a placeholder, not the team's domain: ${auth}`);
const config = join(site, "astro.config.mjs");
let text = readFileSync(config, "utf8");
if (!text.includes("auth: access(")) {
	text = text.replace("import { d1, r2 }", "import { access, d1, r2 }").replace("emdash({", `emdash({\n\t\t\t${auth}`);
	writeFileSync(config, text);
}
const wrangler = join(site, "wrangler.jsonc");
text = readFileSync(wrangler, "utf8");
if (!text.includes("CF_ACCESS_AUDIENCE")) {
	text = text.replace(/("name":[^\n]*\n)/, `$1\t${find('"vars":')}\n\t${find('"preview_urls":')}\n`);
	writeFileSync(wrangler, text);
}
