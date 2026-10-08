// What `mise run live:preview` runs: the site as it is in this folder, deployed as a PREVIEW —
// under an address of its own, with a database, bucket and session store of its own, beside the
// live site and without touching it. Cloudflare's Worker Previews (`wrangler preview`), which
// needs three things no command does for an EmDash site, so this does them, each only if missing:
//
//   1. a `previews` block in wrangler.jsonc. A preview gets none of the live site's bindings,
//      and Cloudflare does not make a preview's resources for it: they are made here
//      (<worker>-preview, <worker>-preview-media, <worker>-preview-session) and written in.
//   2. preview addresses switched on for the Worker ("preview_urls": true) — in the file, and on
//      Cloudflare now, since otherwise that waits for the next live:ship.
//   3. `wrangler preview`, with the site's secrets (.env).
//
//   node live-preview.mjs <site folder> [name] [--delete]
//
// The name defaults to the git branch. Run again: the same preview, updated.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonc, wranglerConfig, wranglerFile } from "./wrangler-config.mjs";

const args = process.argv.slice(2);
const remove = args.includes("--delete");
const [siteDir, given] = args.filter((a) => !a.startsWith("--"));
const file = siteDir && wranglerFile(siteDir);
if (!file) {
	console.error("live:preview is for a site on Cloudflare: no wrangler.jsonc in the site folder.");
	process.exit(1);
}
const wranglerBin = () => {
	const dir = join(siteDir, "node_modules", "wrangler");
	const bin = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).bin;
	return join(dir, typeof bin === "string" ? bin : bin.wrangler);
};
// wrangler, run by Node itself (no shell): its output, or its error as the reason.
const wrangler = (...a) => {
	const r = spawnSync(process.execPath, [wranglerBin(), ...a], { cwd: siteDir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" } });
	return { ok: r.status === 0, out: `${r.stdout || ""}`, err: `${r.stdout || ""}${r.stderr || ""}` };
};
const fail = (what, r) => {
	// wrangler's own words, without its table of every file it uploaded
	const said = r.err.replace(/\x1b\[[0-9;]*m/g, "").split("\n").filter((l) => l.trim() && !/^[│├┌└╭╰]/.test(l.trim()) && !l.includes("Logs were written")).slice(-10).join("\n");
	console.error(`live:preview: ${what}\n${said}`);
	process.exit(1);
};
const branch = () => {
	try {
		return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: siteDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
	} catch {
		return "";
	}
};
// Cloudflare takes letters, digits and dashes in a preview's name; the name is part of an address.
const name = (given || branch() || "preview").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "preview";
let config = wranglerConfig(siteDir);
const worker = config.name;
let changed = false; // this run changed wrangler.jsonc: what was built before it is out of date

if (remove) {
	const r = wrangler("preview", "delete", "--name", name);
	if (!r.ok && !/not found|does not exist|no preview/i.test(r.err)) fail(`could not delete the preview "${name}".`, r);
	console.log(r.ok ? `preview: "${name}" of ${worker} is deleted. Its database, bucket and session store are kept — the next preview uses them.` : `preview: no preview "${name}" of ${worker}: nothing to delete`);
	process.exit(0);
}

// 1. the previews block, and what it names
if (!config.previews) {
	const want = { db: `${worker}-preview`, bucket: `${worker}-preview-media`, kv: `${worker}-preview-session` };
	const json = (r) => parseJsonc(r.out.slice(r.out.search(/[[{]/)));
	// the database
	let r = wrangler("d1", "list", "--json");
	if (!r.ok) fail("could not list this account's databases. Signed in? pnpm exec wrangler login", r);
	let db = json(r).find((d) => d.name === want.db);
	if (!db) {
		r = wrangler("d1", "create", want.db);
		if (!r.ok) fail(`could not make the database ${want.db}.`, r);
		db = { uuid: (r.err.match(/"database_id":\s*"([^"]+)"/) || [])[1] };
		console.log(`preview: made the database ${want.db}`);
	}
	const dbId = db.uuid || db.database_id;
	// the bucket ("already exists" is fine)
	r = wrangler("r2", "bucket", "create", want.bucket);
	if (r.ok) console.log(`preview: made the bucket ${want.bucket}`);
	else if (!/already exists|10004/i.test(r.err)) fail(`could not make the bucket ${want.bucket}.`, r);
	// the session store
	r = wrangler("kv", "namespace", "list");
	if (!r.ok) fail("could not list this account's KV namespaces.", r);
	let kv = json(r).find((n) => n.title === want.kv);
	if (!kv) {
		r = wrangler("kv", "namespace", "create", want.kv);
		if (!r.ok) fail(`could not make the session store ${want.kv}.`, r);
		kv = { id: (r.err.match(/"id":\s*"([^"]+)"/) || [])[1] };
		console.log(`preview: made the session store ${want.kv}`);
	}
	if (!dbId || !kv.id) fail("made the preview's database or session store but could not read its id back.", { err: "" });
	// everything else the live site is given, a preview is given too (it inherits nothing)
	const block = {
		...(config.vars ? { vars: config.vars } : {}),
		d1_databases: [{ binding: config.d1_databases?.[0]?.binding || "DB", database_name: want.db, database_id: dbId }],
		r2_buckets: [{ binding: config.r2_buckets?.[0]?.binding || "MEDIA", bucket_name: want.bucket }],
		kv_namespaces: [{ binding: "SESSION", id: kv.id }],
		...(config.worker_loaders ? { worker_loaders: config.worker_loaders } : {}),
	};
	const text = readFileSync(file, "utf8");
	const end = text.lastIndexOf("}");
	const before = text.slice(0, end).replace(/\s+$/, "");
	const lines = JSON.stringify(block, null, "\t").split("\n").map((l, i) => (i ? `\t${l}` : l)).join("\n");
	writeFileSync(file, `${before}${before.endsWith(",") || before.endsWith("{") ? "" : ","}\n\t// A preview (mise run live:preview) gets none of the live site's bindings: these are its own.\n\t// Every preview of this site shares them. Written by emdash-run; yours to change.\n\t"previews": ${lines},\n}\n`);
	console.log(`preview: wrote the "previews" block into ${file.split(/[\\/]/).pop()} — commit it`);
	changed = true;
	config = wranglerConfig(siteDir);
}

// A preview inherits nothing, so what the live site is given after the block was written has to be
// given to the previews too: the plugin sandbox's binding (mise run plugin:sandbox), and vars.
for (const key of ["worker_loaders", "vars"]) {
	if (config[key] && !config.previews[key]) {
		const text = readFileSync(file, "utf8");
		const at = text.search(/"previews"\s*:\s*\{/);
		const open = text.indexOf("{", at);
		writeFileSync(file, `${text.slice(0, open + 1)}\n\t\t${JSON.stringify(key)}: ${JSON.stringify(config[key])},${text.slice(open + 1)}`);
		console.log(`preview: the previews block now has "${key}", as the live site does`);
		changed = true;
		config = wranglerConfig(siteDir);
	}
}

// 2. preview addresses on
if (config.preview_urls !== true) {
	let text = readFileSync(file, "utf8");
	if (/"preview_urls"\s*:\s*false/.test(text)) text = text.replace(/"preview_urls"\s*:\s*false/, '"preview_urls": true');
	else text = text.replace(/("name"\s*:\s*"[^"]*",?\n)/, `$1\t"preview_urls": true,\n`);
	writeFileSync(file, text);
	console.log('preview: "preview_urls" is now true in the file (a preview has no address without it)');
	changed = true;
}

// The task built the site before this ran. If this run then changed wrangler.jsonc, that build
// carries the old settings (Astro's adapter copies them into dist/): build again.
if (changed) {
	console.log("preview: building again, with the new settings");
	const r = spawnSync("pnpm", ["exec", "astro", "build"], { cwd: siteDir, stdio: ["ignore", "ignore", "inherit"], shell: process.platform === "win32" });
	if (r.status !== 0) process.exit(r.status || 1);
}

// 3. the preview
const secrets = existsSync(join(siteDir, ".env")) ? ["--secrets-file", ".env"] : [];
const r = wrangler("preview", "--name", name, ...secrets, "--message", `live:preview ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, "--json");
if (!r.ok) fail(`wrangler could not deploy the preview "${name}".`, r);
const start = r.out.indexOf('{\n');
const made = parseJsonc(r.out.slice(start < 0 ? r.out.indexOf("{") : start));
let url = made.preview?.urls?.[0];
if (!url) {
	// No address: preview addresses are off on Cloudflare (the file alone changes that only at the
	// next live:ship). Switch them on now, with wrangler's own sign-in.
	try {
		const token = process.env.CLOUDFLARE_API_TOKEN || JSON.parse(wrangler("auth", "token", "--json").out).token;
		const who = JSON.parse(wrangler("whoami", "--json").out);
		const account = process.env.CLOUDFLARE_ACCOUNT_ID || who.accounts?.[0]?.id;
		const api = `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${worker}/subdomain`;
		const res = await fetch(api, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ enabled: config.workers_dev !== false, previews_enabled: true }) });
		const sub = (await (await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/subdomain`, { headers: { Authorization: `Bearer ${token}` } })).json()).result?.subdomain;
		if (res.ok && sub) url = `https://${name}-${worker}.${sub}.workers.dev`;
		if (res.ok) console.log("preview: preview addresses switched on for this Worker");
	} catch {}
}
if (!url) {
	console.error(`preview: "${name}" is deployed, but Cloudflare gave it no address: preview addresses are off for ${worker}. Run  mise run live:ship  once ("preview_urls": true is in the file now), then this again.`);
	process.exit(1);
}
console.log("");
console.log(`-> PREVIEW "${name}" of ${worker}: ${url}`);
console.log("   Its own database, bucket and sessions: the live site is not touched. A new preview starts with no content.");
console.log(`   To act on it, put LIVE_PREVIEW=${name} before any task that takes --live — or in mise.local.toml, and`);
console.log("   then this checkout's deployed site IS its preview:");
console.log(`     LIVE_PREVIEW=${name} mise run signin:token -- --live`);
console.log(`     LIVE_PREVIEW=${name} mise run emdash -- site import site.emdash --analyze --live`);
console.log("   The admin is behind sign-in once  mise run signin:access  has been run (again) for this site.");
console.log(`   Delete it:  mise run live:preview -- ${name} --delete`);
