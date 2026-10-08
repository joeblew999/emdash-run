// What the plugin tasks run where EmDash has no command: a registry plugin is installed in the
// admin only, and a plugin from npm leaves two lines of astro.config.mjs to the developer.
//
//   node plugins.mjs sandbox <site folder>                       plugin:sandbox
//   node plugins.mjs leftover <site folder>                      site:stop — a Node site's sandbox process, left running
//   node plugins.mjs config  <site folder> <package>             plugin:add, plugin:new — the lines in astro.config.mjs
//   node plugins.mjs install <site address> <site folder> [--deployed] <publisher>/<slug>…
//                                                                plugin:install, plugin:favourites
//   node plugins.mjs remove  <site address> <site folder> [--deployed] <publisher>/<slug>…
//                                                                plugin:remove
//   node plugins.mjs works   <site address> <site folder> [name…] plugin:works
//
// INSTALL sends the two requests EmDash's admin sends when a person presses Install and agrees
// (admin/src/lib/api/registry.ts): POST …/admin/plugins/registry/verify, then …/registry/install
// with what verify answered as the acknowledgement. The publisher's DID comes from where the admin
// gets it: the registry's aggregator, whose address the site gives (resolvePackage). Not from
// `emdash-plugin info`: that looks the handle up at the publisher's own host first, and fails
// when that host is down (docs/upstream.md). It signs in with the API token `signin:token` saved;
// the token is never printed.
//
// A registry plugin always runs in the sandbox, so the site needs a sandbox runner (EmDash docs:
// deployment/plugin-sandbox). SANDBOX makes the edits those docs give, and changes nothing when
// they are already made:
//   Cloudflare  astro.config.mjs: sandboxRunner: sandbox()   wrangler.jsonc: the worker_loaders line
//   Node        astro.config.mjs: sandboxRunner: "@emdash-cms/sandbox-workerd/sandbox"
//               and the packages @emdash-cms/sandbox-workerd and workerd
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [what, ...argv] = process.argv.slice(2);
const flags = argv.filter((a) => a.startsWith("--"));
const args = argv.filter((a) => !a.startsWith("--"));
const win = process.platform === "win32";
const here = dirname(fileURLToPath(import.meta.url));
const projectDir = process.env.MISE_PROJECT_ROOT || process.env.MISE_CONFIG_ROOT || process.cwd();
const fail = (message) => {
	console.error(message);
	process.exit(1);
};

// ── the site's files ─────────────────────────────────────────────────────────────────────────

const configFile = (siteDir) => ["astro.config.mjs", "astro.config.ts", "astro.config.js"].map((f) => join(siteDir, f)).find(existsSync);
const isCloudflare = (siteDir) => ["wrangler.jsonc", "wrangler.json", "wrangler.toml"].some((f) => existsSync(join(siteDir, f)));
const sitePackages = (siteDir) => {
	const p = JSON.parse(readFileSync(join(siteDir, "package.json"), "utf8"));
	return { ...p.dependencies, ...p.devDependencies };
};

// The emdash({ … }) call in the site's config: where its options start, and how they are indented.
const emdashOptions = (text) => {
	const m = /\bemdash\(\s*\{[ \t]*\r?\n/.exec(text);
	if (!m) return null;
	const at = m.index + m[0].length;
	return { at, indent: /^[ \t]*/.exec(text.slice(at))[0] || "\t\t\t" };
};
// One import line, after the imports that are there. Nothing when the text already has it.
const addImport = (text, line) => {
	if (text.includes(line)) return text;
	const imports = [...text.matchAll(/^import\b[^;]*;[ \t]*\r?\n/gm)];
	const at = imports.length ? imports.at(-1).index + imports.at(-1)[0].length : 0;
	return text.slice(0, at) + line + "\n" + text.slice(at);
};
// One option inside emdash({ … }), as its first line. Nothing when the option is already set.
const addOption = (text, name, value) => {
	const o = emdashOptions(text);
	if (!o || new RegExp(`^\\s*${name}\\s*:`, "m").test(text.slice(o.at))) return text;
	return text.slice(0, o.at) + `${o.indent}${name}: ${value},\n` + text.slice(o.at);
};
// One name in a list option inside emdash({ … }) — `sandboxed: [a]` or `plugins: [a()]`.
const addToList = (text, name, entry) => {
	const o = emdashOptions(text);
	if (!o) return text;
	const list = new RegExp(`^(\\s*${name}\\s*:\\s*\\[)([^\\]]*)\\]`, "m").exec(text.slice(o.at));
	if (!list) return addOption(text, name, `[${entry}]`);
	if (list[2].split(",").map((x) => x.trim()).includes(entry)) return text;
	const start = o.at + list.index + list[1].length;
	const inside = list[2];
	const joined = inside.trim() === "" ? entry : inside.replace(/,?\s*$/, "") + `, ${entry}` + (/\n\s*$/.test(inside) ? "," + /\n\s*$/.exec(inside)[0] : "");
	return text.slice(0, start) + joined + text.slice(start + inside.length);
};
// Write the config only when it changed, and only when Node can still read it; else put it back.
const writeConfig = (file, before, after) => {
	if (after === before) return false;
	writeFileSync(file, after);
	if (file.endsWith(".ts")) return true;
	const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
	if (check.status !== 0) {
		writeFileSync(file, before);
		fail(`The edit to ${file} did not leave a file Node can read, so it was put back as it was.\n${check.stderr}`);
	}
	return true;
};
const pnpm = (argsFor, cwd) => {
	const r = spawnSync("pnpm", argsFor, { cwd, stdio: "inherit", shell: win });
	if (r.status !== 0) process.exit(r.status ?? 1);
};
const mise = (task, quiet = true) => spawnSync("mise", ["run", ...task], { cwd: projectDir, stdio: quiet ? ["ignore", "ignore", "inherit"] : "inherit", shell: win });

// What a site needs before it can run a sandboxed plugin. Returns what it changed, as lines.
const sandbox = (siteDir) => {
	const file = configFile(siteDir);
	if (!file) fail(`There is no astro.config in ${siteDir}.`);
	const before = readFileSync(file, "utf8");
	if (!emdashOptions(before)) {
		fail(`${file} has no  emdash({ …  call laid out as EmDash's templates have it, so this cannot edit it. A sandboxed plugin needs, by hand: sandboxRunner in emdash({ … }) — EmDash docs: deployment/plugin-sandbox.`);
	}
	const changed = [];
	if (isCloudflare(siteDir)) {
		const after = /^\s*sandboxRunner\s*:/m.test(before) ? before : addOption(addImport(before, 'import { sandbox } from "@emdash-cms/cloudflare";'), "sandboxRunner", "sandbox()");
		if (writeConfig(file, before, after)) changed.push(`${file}: sandboxRunner: sandbox()`);
		// The Worker Loader binding, as create-emdash --sandboxed-plugins writes it.
		const w = join(siteDir, "wrangler.jsonc");
		if (!existsSync(w)) fail("This Cloudflare site has no wrangler.jsonc. Add a worker_loaders binding named LOADER to its wrangler config by hand.");
		const wBefore = readFileSync(w, "utf8");
		if (!/^\s*"worker_loaders"\s*:/m.test(wBefore)) {
			const commented = /^(\s*)\/\/\s*("worker_loaders"\s*:.*)$/m;
			const wAfter = commented.test(wBefore) ? wBefore.replace(commented, "$1$2") : wBefore.replace(/\{[ \t]*\r?\n/, (m) => `${m}\t"worker_loaders": [{ "binding": "LOADER" }],\n`);
			writeFileSync(w, wAfter);
			changed.push(`${w}: the worker_loaders binding LOADER — deploying it needs the Workers Paid plan`);
		}
	} else {
		const have = sitePackages(siteDir);
		const missing = ["@emdash-cms/sandbox-workerd", "workerd"].filter((p) => !have[p]);
		if (missing.length) {
			// packages change: the site is stopped first (a running site breaks on Windows otherwise)
			mise(["site:stop"]);
			pnpm(["add", ...missing], siteDir);
			changed.push(`package.json: ${missing.join(", ")}`);
		}
		if (writeConfig(file, before, addOption(before, "sandboxRunner", '"@emdash-cms/sandbox-workerd/sandbox"'))) changed.push(`${file}: sandboxRunner: "@emdash-cms/sandbox-workerd/sandbox"`);
	}
	return changed;
};

// ── the site's API, with what signin:token saved ─────────────────────────────────────────────

const savedName = (url, siteDir) => {
	const { host, hostname } = new URL(url);
	const safe = host.replace(/[^a-zA-Z0-9.-]/g, "_");
	const local = ["localhost", "127.0.0.1", "[::1]"].includes(hostname) || hostname.endsWith(".localhost");
	return local ? `${safe}_${createHash("sha256").update(resolve(siteDir)).digest("hex").slice(0, 10)}` : safe;
};
const whereIs = (u) => {
	const { origin, port, hostname } = new URL(u);
	if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return `DEPLOYED site: ${origin}`;
	return `this machine, ${port === (process.env.PREVIEW_PORT || "4322") ? "built site (site:preview)" : "dev site (site:start)"}: ${origin}`;
};
const { deployedAddress, previewOf } = await import("./site.mjs");
const saved = (kind, url, siteDir) => {
	const dir = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "emdash-run", kind);
	let f = join(dir, `${savedName(url, siteDir)}.json`);
	// a preview of the Worker is behind the live site's Access application: the same pass
	const preview = kind === "access" && !existsSync(f) ? previewOf(url, siteDir) : null;
	if (preview) f = join(dir, `${preview.liveHost}.json`);
	return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
};
// What the site said a registry plugin declares, kept when plugin:install installs it: EmDash has
// no request that lists an installed plugin's public routes (asking it to verify again answers
// 409 ALREADY_INSTALLED), and plugin:works wants to ask them.
const declared = (url, siteDir, key, value) => {
	const f = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "emdash-run", "plugins", `${savedName(url, siteDir)}.json`);
	const all = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
	if (value === undefined) return all[key] ?? null;
	all[key] = value;
	mkdirSync(dirname(f), { recursive: true, mode: 0o700 });
	writeFileSync(f, JSON.stringify(all, null, 1), { mode: 0o600 });
	chmodSync(f, 0o600);
};
const client = (url, siteDir) => async (method, path, body) => {
	const token = saved("tokens", url, siteDir);
	const pass = saved("access", url, siteDir);
	const headers = {
		...(token ? { Authorization: `Bearer ${token.token}` } : {}),
		...(pass ? { "CF-Access-Client-Id": pass.id, "CF-Access-Client-Secret": pass.secret } : {}),
		...(body ? { "Content-Type": "application/json" } : {}),
	};
	for (let attempt = 1; ; attempt++) try {
		const res = await fetch(new URL(path, url), { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "manual", signal: AbortSignal.timeout(120_000) });
		const text = await res.text();
		let json = null;
		try {
			json = JSON.parse(text);
		} catch {}
		return { status: res.status, ok: res.ok, text, data: json?.data, error: json?.error };
	} catch (error) {
		// Seen three times in one plugin:works run over 17 plugins on a local Cloudflare site, and not
		// explained: a GET that got no answer, and got one when asked again. A read is asked twice before it is called unanswered; a write never is.
		if (attempt === 1 && method === "GET") continue;
		return { status: 0, ok: false, text: `${error.message} ${error.cause?.code ?? ""} ${error.cause?.message ?? ""}`.trim(), data: undefined, error: undefined };
	}
};
const said = (r) => `${r.status || "no answer"} ${r.error ? `${r.error.code}: ${r.error.message}` : r.text.replace(/\s+/g, " ").slice(0, 300)}`;
const reference = (ref) => {
	const m = /^@?([^/\s]+)\/([a-zA-Z][a-zA-Z0-9_-]*)$/.exec(ref);
	if (!m) fail(`[${ref}] is not <publisher>/<slug> — as the search prints it, e.g. @netdollar.dev/forms`);
	return { publisher: m[1], slug: m[2], name: `@${m[1]}/${m[2]}` };
};
// <publisher>/<slug> → the registry's record of it (did, latestVersion), asked of the aggregator as
// the admin asks: resolvePackage for a handle, getPackage for a DID.
const lookUp = async (aggregatorUrl, w) => {
	const q = w.publisher.startsWith("did:") ? `getPackage?did=${encodeURIComponent(w.publisher)}` : `resolvePackage?handle=${encodeURIComponent(w.publisher)}`;
	try {
		const res = await fetch(`${aggregatorUrl.replace(/\/$/, "")}/xrpc/com.emdashcms.experimental.aggregator.${q}&slug=${encodeURIComponent(w.slug)}`, { signal: AbortSignal.timeout(60_000) });
		const json = await res.json().catch(() => ({}));
		return res.ok && json.did ? { pkg: json } : { why: `${res.status} ${json.error ?? ""}: ${json.message ?? ""}` };
	} catch (error) {
		return { why: `${aggregatorUrl} did not answer: ${error.cause?.code || error.message}` };
	}
};
// A Node site, after a plugin was installed or removed while it ran: EmDash restarts its sandbox
// process in place, the old one keeps the port, and from then on no sandboxed plugin answers
// ("bind(): Address already in use" — docs/upstream.md). Stopping and starting the site, with
// site:stop clearing the old process, is what gets them all running. A Cloudflare site needs none of it.
const restartNode = (siteDir) => {
	if (isCloudflare(siteDir)) return;
	console.log("A Node site: restarting it, so its sandbox process starts with the plugins it now has (mise run site:preview)…");
	mise(["site:preview"]);
};
// A site on this machine: built and serving what is on disk now, and a token for it. `rebuild`
// when something the build is made from was just changed.
const ready = async (url, siteDir, api, rebuild) => {
	if (rebuild || (await api("GET", "/")).status === 0) {
		console.log(`${rebuild ? "The site's config changed" : `Nothing is answering at ${new URL(url).origin}`}: building and starting it (mise run site:preview)…`);
		mise(["site:preview"]);
		// Seen once, in the full test, on one of two Cloudflare sites started in the same second: the
		// built site came up answering 500 "Error: listen EADDRINUSE: …" to everything. Started
		// again, it is fine — so once more, and say what it had said.
		const up = await api("GET", "/");
		if (up.status !== 200) {
			console.log(`The built site started but answers ${up.status || "nothing"}: ${up.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300)}\nStarting it once more (mise run site:preview)…`);
			mise(["site:preview"]);
		}
	}
	if ((await api("GET", "/_emdash/api/admin/plugins")).status !== 200) mise(["signin:token"]);
};

if (what === "leftover") {
	// A Node site runs its sandboxed plugins in a workerd process. EmDash starts it through the
	// workerd package's launcher and stops the launcher, not workerd itself — which then outlives
	// the site and keeps its port (18788…), so the next start cannot open it and every sandboxed
	// plugin is down (docs/upstream.md). This stops exactly that: a workerd run from THIS site's
	// own node_modules. Nothing by name, nothing by port, nothing of another site's.
	const [siteDir] = args;
	if (win || !existsSync(join(siteDir, "node_modules", "workerd"))) process.exit(0);
	const roots = [...new Set([resolve(siteDir), realpathSync(siteDir)])].map((r) => join(r, "node_modules") + "/");
	const ps = spawnSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" });
	for (const l of ps.stdout.split("\n")) {
		const m = /^\s*(\d+)\s+(\S+)\s+serve\s/.exec(l);
		if (!m || !/\/bin\/workerd$/.test(m[2]) || !roots.some((r) => m[2].startsWith(r))) continue;
		try {
			process.kill(Number(m[1]));
			console.log(`Stopped this site's sandbox process, which the stopped site had left running (workerd, pid ${m[1]}).`);
		} catch {}
	}
} else if (what === "sandbox") {
	const [siteDir] = args;
	console.error(`-> site folder: ${resolve(siteDir)}`);
	const changed = sandbox(siteDir);
	for (const line of changed) console.log(`sandbox: ${line}`);
	console.log(changed.length ? "sandbox: this site can now run sandboxed plugins. Build it again for that to take effect (mise run site:preview, or site:start)." : "sandbox: already set up — nothing changed.");
} else if (what === "config") {
	// plugin:add and plugin:new: the package is in the site; now its two lines in astro.config.mjs.
	const [siteDir, given] = args;
	// `pnpm add` takes a version or a folder too: the name is what is in package.json.
	const have = sitePackages(siteDir);
	const pkg = have[given] ? given : Object.keys(have).find((n) => have[n] === given || have[n] === `file:${given.replace(/^file:/, "")}` || given.startsWith(`${n}@`));
	if (!pkg) fail(`[${given}] is not in the site's package.json, so there is nothing to add to astro.config.mjs.`);
	const meta = JSON.parse(readFileSync(join(siteDir, "node_modules", pkg, "package.json"), "utf8"));
	const file = configFile(siteDir);
	const before = readFileSync(file, "utf8");
	const local = pkg.replace(/^@[^/]+\//, "").replace(/^(emdash-)?plugin-/, "").replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : "")).replace(/^[^a-zA-Z]+/, "") || "plugin";
	const how = (lines) => fail(`${file} was not changed: ${lines}`);
	if (!emdashOptions(before)) how(`it has no  emdash({ …  call laid out as EmDash's templates have it. Add [${pkg}] to it by hand.`);
	if (new RegExp(`from\\s+["']${pkg.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}["']`).test(before)) {
		console.log(`config: [${pkg}] is already in ${file} — nothing changed.`);
	} else if (meta.exports?.["./sandbox"]) {
		// What `emdash-plugin build` makes: a descriptor as the default export, for sandboxed: [ … ].
		const changed = sandbox(siteDir);
		for (const line of changed) console.log(`sandbox: ${line}`);
		const now = readFileSync(file, "utf8");
		writeConfig(file, now, addToList(addImport(now, `import ${local} from "${pkg}";`), "sandboxed", local));
		console.log(`config: ${file}: import ${local} from "${pkg}"  and  sandboxed: [${local}]`);
	} else {
		// A native plugin exports a function that makes it; EmDash's own are all named <something>Plugin.
		const entry = typeof meta.exports?.["."] === "string" ? meta.exports["."] : meta.exports?.["."]?.import ?? meta.exports?.["."]?.default ?? meta.module ?? meta.main ?? "index.js";
		const source = existsSync(join(siteDir, "node_modules", pkg, entry)) ? readFileSync(join(siteDir, "node_modules", pkg, entry), "utf8") : "";
		const makers = [...new Set([...source.matchAll(/export\s+(?:function|const)\s+(\w+Plugin)\b/g), ...source.matchAll(/export\s*\{[^}]*?\b(?:\w+\s+as\s+)?(\w+Plugin)\b[^}]*\}/g)].map((m) => m[1]))].filter((n) => n !== "createPlugin");
		if (makers.length !== 1) how(`[${pkg}] is a native plugin and this cannot tell what it exports to make it (found: ${makers.join(", ") || "nothing named …Plugin"}). Its README says; the lines are  import { thePlugin } from "${pkg}"  and, inside emdash({ … }),  plugins: [thePlugin()].`);
		writeConfig(file, before, addToList(addImport(before, `import { ${makers[0]} } from "${pkg}";`), "plugins", `${makers[0]}()`));
		console.log(`config: ${file}: import { ${makers[0]} } from "${pkg}"  and  plugins: [${makers[0]}()]  — a native plugin: it runs in the site itself, not in the sandbox`);
	}
} else if (what === "install") {
	const [given, siteDir, ...refs] = args;
	// LIVE_PREVIEW=<name>: the deployed site meant is that preview of it (site.mjs)
	const url = flags.includes("--deployed") ? deployedAddress(given) : given;
	const deployed = flags.includes("--deployed");
	if (!url || !URL.canParse(url)) fail("This needs the address of the deployed site. Set LIVE_URL in the [env] block of mise.toml.");
	if (!refs.length) fail("Which plugin? mise run plugin:install -- <publisher>/<slug> — find one with: mise run plugin:search -- forms");
	const wanted = refs.flatMap((r) => r.split(/[\s,]+/)).filter(Boolean).map(reference);
	console.error(`-> ${whereIs(url)}`);
	const api = client(url, siteDir);
	if (!deployed) {
		const changed = sandbox(siteDir);
		for (const line of changed) console.log(`sandbox: ${line}`);
		await ready(url, siteDir, api, changed.length > 0);
	}
	const manifest = await api("GET", "/_emdash/api/manifest");
	if (manifest.status !== 200) {
		fail(`The site did not accept this machine's sign-in: GET /_emdash/api/manifest answered ${said(manifest)}\nSign in first: mise run signin:token${deployed ? " -- --live" : ""}`);
	}
	if (!manifest.data.sandboxEnabled || !manifest.data.registry) {
		fail(`This site cannot install a registry plugin: it says sandboxEnabled=${manifest.data.sandboxEnabled}, registry=${JSON.stringify(manifest.data.registry ?? null)}.\n${deployed ? "On the deployed site that takes: mise run plugin:sandbox, then mise run live:ship (the Worker Loader binding needs the Workers Paid plan)." : "mise run plugin:sandbox makes the edits; then mise run site:preview. EmDash docs: deployment/plugin-sandbox."}`);
	}
	let failed = 0;
	let installed = 0;
	for (const w of wanted) {
		const { pkg, why } = await lookUp(manifest.data.registry.aggregatorUrl, w);
		if (!pkg) {
			console.log(`FAIL ${w.name}: the registry does not have it — ${why}`);
			failed++;
			continue;
		}
		const list = await api("GET", "/_emdash/api/admin/plugins");
		const there = list.data?.items?.find((p) => p.source === "registry" && p.registryPublisherDid === pkg.did && p.registrySlug === w.slug);
		if (there) {
			console.log(`ok   ${w.name}: already installed — ${there.version}, ${there.status}, id ${there.id}${pkg.latestVersion && pkg.latestVersion !== there.version ? ` (the registry has ${pkg.latestVersion}: update it in the admin, Plugins)` : ""}`);
			continue;
		}
		// 1. what the admin's consent dialog shows: the site reads the publisher's signed records
		const verify = await api("POST", "/_emdash/api/admin/plugins/registry/verify", { did: pkg.did, slug: w.slug });
		if (!verify.ok) {
			console.log(`FAIL ${w.name}: the site would not verify it — ${said(verify)}`);
			failed++;
			continue;
		}
		const v = verify.data;
		console.log(`     ${w.name} ${v.version} asks for: ${v.capabilities.join(", ") || "nothing"}; public routes: ${v.publicRoutes.join(", ") || "none"}; MCP tools: ${v.mcpTools.length}`);
		// 2. the install, agreeing to exactly what was shown
		const install = await api("POST", "/_emdash/api/admin/plugins/registry/install", {
			did: pkg.did,
			slug: w.slug,
			version: v.version,
			acknowledgedDeclaredAccess: v.capabilities,
			acknowledgedMcpTools: v.mcpTools,
			acknowledgedPublicRoutes: v.publicRoutes,
			acknowledgedProfileCid: v.verification.profileCid,
			acknowledgedReleaseCid: v.verification.releaseCid,
		});
		if (!install.ok) {
			console.log(`FAIL ${w.name}: the site would not install it — ${said(install)}`);
			failed++;
			continue;
		}
		installed++;
		declared(url, siteDir, `${pkg.did}/${w.slug}`, { version: v.version, capabilities: v.capabilities, publicRoutes: v.publicRoutes });
		console.log(`ok   ${w.name}: installed — ${install.data.version}, id ${install.data.pluginId}`);
	}
	if (!deployed && installed) restartNode(siteDir);
	if (!deployed) console.log(`The plugins are in the site's database and storage, which the dev site (site:start) shares. Check them: mise run plugin:works`);
	process.exit(failed ? 1 : 0);
} else if (what === "remove") {
	// The admin's Uninstall, for a registry plugin. Its stored data is kept, as the admin keeps it
	// by default. One that is not installed is nothing to remove.
	const [given, siteDir, ...refs] = args;
	// LIVE_PREVIEW=<name>: the deployed site meant is that preview of it (site.mjs)
	const url = flags.includes("--deployed") ? deployedAddress(given) : given;
	const deployed = flags.includes("--deployed");
	if (!url || !URL.canParse(url)) fail("This needs the address of the deployed site. Set LIVE_URL in the [env] block of mise.toml.");
	if (!refs.length) fail("Which plugin? mise run plugin:remove -- <publisher>/<slug>");
	console.error(`-> ${whereIs(url)}`);
	const api = client(url, siteDir);
	if (!deployed) await ready(url, siteDir, api, false);
	const manifest = await api("GET", "/_emdash/api/manifest");
	if (manifest.status !== 200) fail(`The site did not accept this machine's sign-in: GET /_emdash/api/manifest answered ${said(manifest)}\nSign in first: mise run signin:token${deployed ? " -- --live" : ""}`);
	let failed = 0;
	let removed = 0;
	for (const w of refs.map(reference)) {
		const items = (await api("GET", "/_emdash/api/admin/plugins")).data?.items ?? [];
		const { pkg } = manifest.data.registry ? await lookUp(manifest.data.registry.aggregatorUrl, w) : {};
		const there = items.find((p) => p.source === "registry" && p.registrySlug === w.slug && (!pkg || p.registryPublisherDid === pkg.did));
		if (!there) {
			console.log(`ok   ${w.name}: not installed — nothing to remove`);
			continue;
		}
		const gone = await api("POST", `/_emdash/api/admin/plugins/registry/${encodeURIComponent(there.id)}/uninstall`, { deleteData: false });
		if (!gone.ok) failed++;
		else removed++;
		console.log(gone.ok ? `ok   ${w.name}: removed (${there.version}, id ${there.id}); what it stored is kept` : `FAIL ${w.name}: the site would not remove it — ${said(gone)}`);
	}
	if (!deployed && removed) restartNode(siteDir);
	process.exit(failed ? 1 : 0);
} else if (what === "works") {
	// "It works", as one line per check. This machine only: it builds the site. No name: every
	// plugin the site has.
	const [given, siteDir, ...names] = args;
	// LIVE_PREVIEW=<name>: the deployed site meant is that preview of it (site.mjs)
	const url = flags.includes("--deployed") ? deployedAddress(given) : given;
	console.error(`-> ${whereIs(url)}`);
	const api = client(url, siteDir);
	let failed = 0;
	const line = (state, check, detail) => {
		if (state === "FAIL") failed++;
		console.log(`${state.padEnd(4)} ${check}: ${detail}`);
	};
	const run = (task) => {
		const r = spawnSync("mise", ["run", ...task], { cwd: projectDir, encoding: "utf8", shell: win });
		return { ok: r.status === 0, tail: `${r.stdout}${r.stderr}`.replace(/\x1b\[[0-9;]*m/g, "").trim().split("\n").slice(-4).join(" | ").slice(0, 400) };
	};
	// 1. the site, with its plugins in it, still passes its checks
	const check = run(["site:check"]);
	line(check.ok ? "ok" : "FAIL", "builds", check.ok ? "seed valid, types check, site builds (mise run site:check)" : check.tail);
	// 2. it starts — from stopped, so every plugin is loaded the way a deploy or a restart loads it
	const start = run(["site:preview"]);
	const up = await api("GET", "/");
	line(start.ok && up.status === 200 ? "ok" : "FAIL", "starts", start.ok ? `the built site answers ${up.status} after a restart` : start.tail);
	if (up.status !== 200) process.exit(1);
	if ((await api("GET", "/_emdash/api/admin/plugins")).status !== 200) mise(["signin:token"]);
	const list = await api("GET", "/_emdash/api/admin/plugins");
	if (list.status !== 200) fail(`FAIL listed: GET /_emdash/api/admin/plugins answered ${said(list)}`);
	const items = list.data.items;
	const manifest = (await api("GET", "/_emdash/api/manifest")).data ?? {};
	const called = (p) => (p.source === "registry" ? p.registrySlug : p.id);
	// The built site's log so far; each plugin is judged on the lines written while it was asked.
	const readLog = () => {
		const r = spawnSync(process.execPath, [siteBin(siteDir, "astro", "astro"), "preview", "logs"], { cwd: siteDir, encoding: "utf8" });
		return `${r.stdout}${r.stderr}`.replace(/\x1b\[[0-9;]*m/g, "").split("\n");
	};
	let read = 0;
	const wanted = [];
	for (const name of names.length ? names : items.map((p) => p.id)) {
		const ref = name.includes("/") ? reference(name) : null;
		let plugin = items.find((p) => p.id === name || (!ref && (p.registrySlug === name || p.name === name)));
		if (ref) {
			// two publishers can use one slug: the registry says whose this is
			const { pkg } = manifest.registry ? await lookUp(manifest.registry.aggregatorUrl, ref) : {};
			plugin = items.find((p) => p.registrySlug === ref.slug && (!pkg || p.registryPublisherDid === pkg.did));
		}
		if (plugin) wanted.push(plugin);
		else line("FAIL", `${name} listed`, `the site has no such plugin. It has: ${items.map(called).join(", ") || "none"}`);
	}
	if (!wanted.length && !names.length) console.log("This site has no plugins.");
	for (const plugin of wanted) {
		const n = called(plugin);
		const before = failed;
		// 3. the site lists it as active
		const inAdmin = manifest.plugins?.[plugin.id];
		const active = plugin.enabled && plugin.status === "active" && inAdmin?.enabled;
		line(active ? "ok" : "FAIL", `${n} listed`, `${plugin.name} ${plugin.version}, id ${plugin.id}, from ${plugin.source}: ${plugin.status}${inAdmin ? `, ${inAdmin.sandboxed ? "sandboxed" : "in the site's own process"}` : ", NOT in the admin's manifest"}`);
		// 4. its declared routes answer. A registry plugin: the public routes the site read from the
		// signed release when plugin:install installed it, and the routes behind the MCP tools the
		// site lists. One from the site's own packages: the manifest `emdash-plugin build` wrote.
		let routes = [];
		if (plugin.source === "registry") {
			const kept = declared(url, siteDir, `${plugin.registryPublisherDid}/${plugin.registrySlug}`);
			routes = [...(kept?.publicRoutes ?? []).map((r) => ({ r, open: true })), ...(plugin.mcpTools ?? []).map((t) => ({ r: t.route, open: false }))];
			if (!kept) line("skip", `${n} public routes`, "not known: this machine did not install it with plugin:install, and EmDash has no request that lists them");
		} else {
			for (const p of Object.keys(sitePackages(siteDir))) {
				const f = join(siteDir, "node_modules", p, "dist", "manifest.json");
				if (existsSync(f) && JSON.parse(readFileSync(f, "utf8")).id === plugin.id) routes = (JSON.parse(readFileSync(f, "utf8")).routes ?? []).map((r) => ({ r: typeof r === "string" ? r : r.name, open: false }));
			}
		}
		const seen = new Set();
		const answers = [];
		for (const { r, open } of routes.filter((x) => !seen.has(x.r) && seen.add(x.r))) {
			// a public route is asked with no sign-in, as a visitor would
			const res = open ? await client(url, join(siteDir, "nobody"))("GET", `/_emdash/api/plugins/${plugin.id}/${r}`) : await api("GET", `/_emdash/api/plugins/${plugin.id}/${r}`);
			// Not there: no answer, a 5xx, EmDash's own "Plugin route not found", a plugin that could not be
			// started, or a sign-in refused. A 400, 404 or 405 in the plugin's own words is the route answering.
			const gone = res.error?.code === "NOT_FOUND" || /Failed to start Worker|No such module|sandbox unavailable|workerd (failed|crashed|exited)/i.test(res.error?.message ?? "");
			const shut = open ? res.error?.code === "UNAUTHORIZED" : res.status === 401 || res.status === 403;
			answers.push({ r, status: res.status, why: res.error?.message ?? res.text, bad: res.status === 0 || res.status >= 500 || gone || shut });
		}
		if (answers.length) line(answers.some((a) => a.bad) ? "FAIL" : "ok", `${n} routes`, `${answers.length} declared, each asked with a GET: ${answers.map((a) => `${a.r} ${a.status || "no answer"}${a.bad ? ` (${String(a.why).replace(/\s+/g, " ").slice(0, 120)})` : ""}`).join(", ")}${answers.some((a) => !a.bad && a.status >= 400) ? " (a 400, 404 or 405 is the route itself refusing a bare GET: it is there)" : ""}`);
		else line("skip", `${n} routes`, "it declares none that can be listed");
		// 5. its admin pages load, in a real browser, signed in with the saved token (the one Playwright script)
		const pages = inAdmin?.adminPages ?? [];
		if (!pages.length) line("skip", `${n} admin page`, "it has none");
		else {
			const r = spawnSync(process.execPath, [join(here, "first-admin.mjs"), url, siteDir, ...(inAdmin.sandboxed && inAdmin.adminMode === "blocks" ? ["--blocks"] : []), ...pages.map((p) => `--check=/_emdash/admin/plugins/${plugin.id}${p.path}`)], { cwd: projectDir, encoding: "utf8" });
			const lines = r.stdout.trim().split("\n").filter((l) => /^(ok|FAIL)/.test(l));
			for (const l of lines) console.log(l.replace("admin page:", `${n} admin page:`));
			failed += lines.filter((l) => l.startsWith("FAIL")).length;
			// the browser script stopped before it had a line for every page: say what it said
			if (lines.length < pages.length) line("FAIL", `${n} admin page`, `${pages.length - lines.length} of ${pages.length} pages were not checked — ${r.stderr.replace(/\s+/g, " ").slice(-300) || `the browser script ended with ${r.status ?? r.signal}`}`);
		}
		// 6 and 7. what the site wrote in its log meanwhile: EmDash's own "Loaded registry plugin …"
		// line from when the site started, and no line saying one failed.
		const log = readLog();
		const fresh = log.slice(wanted.indexOf(plugin) === 0 ? 0 : read);
		read = log.length;
		const notLoaded = fresh.filter((l) => /Failed to load|not found in R2|sandbox is configured but not available|Sandboxed plugins are disabled|Plugin sandbox unavailable|workerd (failed|crashed|exited)|Uncaught \w*Error/i.test(l) && (l.includes(plugin.id) || /sandbox|workerd/i.test(l)));
		const loaded = log.find((l) => /Loaded \w+ plugin /.test(l) && l.includes(plugin.id));
		line(notLoaded.length ? "FAIL" : "ok", `${n} log`, notLoaded.length ? notLoaded.slice(0, 3).join(" | ").slice(0, 400) : loaded ? `the built site's log says: ${loaded.trim().slice(0, 160)}` : "the built site's log has no line saying it failed to load (EmDash writes 'Loaded … plugin' for a registry plugin, and nothing for one from the site's config)");
		const refused = fresh.filter((l) => /Missing capability|Host not allowed|exceeded wall-time limit|Sandboxed plugin route error|Route handler failed/i.test(l));
		line(refused.length ? "FAIL" : "ok", `${n} sandbox`, refused.length ? refused.slice(0, 3).join(" | ").slice(0, 400) : "nothing was refused while its routes and pages were asked (a refusal the plugin catches itself leaves no trace)");
		console.log(failed > before ? `     ${n}: DOES NOT WORK — ${failed - before} check${failed - before > 1 ? "s" : ""} failed` : `     ${n}: works`);
	}
	process.exit(failed ? 1 : 0);
} else {
	fail("usage: node plugins.mjs sandbox|config|install|remove|works …");
}

// A program one of the site's packages installs, run with Node itself (see admin/emdash.mjs).
function siteBin(siteDir, pkg, name) {
	const dir = join(siteDir, "node_modules", pkg);
	const bin = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).bin;
	return join(dir, typeof bin === "string" ? bin : bin[name]);
}
