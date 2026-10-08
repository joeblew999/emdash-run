// plugin:works — does a plugin load and answer? One line per check. EmDash has no command that
// says so: `emdash-plugin` checks a plugin's own folder, not a plugin in a running site.
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { client, declared, fail, lookUp, projectDir, reference, said, siteAddress, whereIs, win } from "./plugin-api.mjs";
import { sitePackages } from "./plugin-sandbox.mjs";
import { Exit, task } from "./core/calls.mjs";

const here = dirname(fileURLToPath(import.meta.url));

export const works = async (/** @type {string[]} */ args, /** @type {string[]} */ flags) => {
	// One line per check. No name: every plugin the site has.
	//   this machine     builds, starts, listed, routes, admin page, log, sandbox
	//   a deployed site  answers, listed, routes, admin page — it is not built, restarted or signed in
	//                    to from here, and its log is not kept anywhere this can read it afterwards
	const [given, siteDir, ...names] = args;
	const deployed = flags.includes("--deployed");
	const url = siteAddress(given, deployed);
	console.error(`-> ${whereIs(url)}`);
	const api = client(url, siteDir);
	const visitor = client(url, siteDir, true);
	let failed = 0;
	const line = (/** @type {string} */ state, /** @type {string} */ check, /** @type {string} */ detail) => {
		if (state === "FAIL") failed++;
		console.log(`${state.padEnd(4)} ${check}: ${detail}`);
	};
	const run = (/** @type {string[]} */ task) => {
		// Its output goes to a file, not a pipe: site:preview leaves the site running, and on Windows
		// that site keeps the pipe it inherited open — reading to the pipe's end then never returns
		// (plugin:works did not end on a Windows CI runner, twice).
		const dir = mkdtempSync(join(tmpdir(), "emdash-run-"));
		const out = openSync(join(dir, "out.txt"), "w");
		const r = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), "core", "cli.mjs"), ...task], { cwd: projectDir, stdio: ["ignore", out, out] });
		closeSync(out);
		const told = readFileSync(join(dir, "out.txt"), "utf8");
		try { rmSync(dir, { recursive: true, force: true }); } catch {}
		return { ok: r.status === 0, tail: told.replace(/\x1b\[[0-9;]*m/g, "").trim().split("\n").slice(-4).join(" | ").slice(0, 400) };
	};
	if (deployed) {
		line("skip", "builds", "a deployed site is not built from here: what is deployed is not this folder's files (mise run live:check rehearses a deploy of them)");
		line("skip", "starts", "a deployed site is not restarted from here");
		const up = await visitor("GET", "/");
		line(up.status > 0 && up.status < 400 ? "ok" : "FAIL", "answers", `the deployed site answers a visitor ${up.status || `nothing — ${up.text}`}`);
		if (up.status === 0) throw new Exit(1);
		if ((await api("GET", "/_emdash/api/admin/plugins")).status !== 200) fail(`FAIL listed: the deployed site did not accept this machine's sign-in — GET /_emdash/api/admin/plugins answered ${said(await api("GET", "/_emdash/api/admin/plugins"))}\nSign in first: mise run signin:token -- --live`);
	} else {
		// Already built from the code that is here now, and answering? Then the checks and the restart
		// were made when it was built and started: not made again (they took a minute of every call).
		// A plugin from the registry lives in the database, and needs neither. --fresh makes both.
		const newest = (/** @type {string} */ dir, depth = 0) => {
			let t = 0;
			if (!existsSync(dir)) return t;
			for (const e of readdirSync(dir, { withFileTypes: true })) {
				if (["node_modules", "dist", ".wrangler", ".astro", ".git", "backups", "uploads"].includes(e.name)) continue;
				const p = join(dir, e.name);
				t = Math.max(t, e.isDirectory() ? (depth < 8 ? newest(p, depth + 1) : 0) : statSync(p).mtimeMs);
			}
			return t;
		};
		const builtAt = existsSync(join(siteDir, "dist", "server")) ? newest(join(siteDir, "dist", "server"), 7) || statSync(join(siteDir, "dist", "server")).mtimeMs : 0;
		const changedAt = Math.max(newest(join(siteDir, "src")), newest(join(siteDir, "plugins")), newest(join(siteDir, "seed")), ...["astro.config.mjs", "package.json", "wrangler.jsonc"].map((f) => (existsSync(join(siteDir, f)) ? statSync(join(siteDir, f)).mtimeMs : 0)));
		const already = !flags.includes("--fresh") && builtAt > changedAt && (await api("GET", "/")).status === 200;
		if (already) {
			line("skip", "builds", "the built site is from the code that is here now: not checked and built again (--fresh does)");
			line("skip", "starts", "it is already answering: not restarted (--fresh does)");
		} else {
			// 1. the site, with its plugins in it, still passes its checks
			const check = run(["site:check"]);
			line(check.ok ? "ok" : "FAIL", "builds", check.ok ? "seed valid, types check, site builds (mise run site:check)" : check.tail);
			// 2. it starts — from stopped, so every plugin is loaded the way a deploy or a restart loads it
			const start = run(["site:preview"]);
			const up = await api("GET", "/");
			line(start.ok && up.status === 200 ? "ok" : "FAIL", "starts", start.ok ? `the built site answers ${up.status} after a restart` : start.tail);
			if (up.status !== 200) throw new Exit(1);
		}
		if ((await api("GET", "/_emdash/api/admin/plugins")).status !== 200) await task("signin:token");
	}
	const list = await api("GET", "/_emdash/api/admin/plugins");
	if (list.status !== 200) fail(`FAIL listed: GET /_emdash/api/admin/plugins answered ${said(list)}`);
	const items = list.data.items;
	const manifest = (await api("GET", "/_emdash/api/manifest")).data ?? {};
	const called = (/** @type {any} */ p) => (p.source === "registry" ? p.registrySlug : p.id);
	// The built site's log so far; each plugin is judged on the lines written while it was asked.
	const readLog = () => {
		const r = spawnSync(process.execPath, [siteBin(siteDir, "astro", "astro"), "preview", "logs"], { cwd: siteDir, encoding: "utf8" });
		return `${r.stdout}${r.stderr}`.replace(/\x1b\[[0-9;]*m/g, "").split("\n");
	};
	let read = 0;
	const wanted = [];
	for (const name of names.length ? names : items.map((/** @type {any} */ p) => p.id)) {
		const ref = name.includes("/") ? reference(name) : null;
		let plugin = items.find((/** @type {any} */ p) => p.id === name || (!ref && (p.registrySlug === name || p.name === name)));
		if (ref) {
			// two publishers can use one slug: the registry says whose this is
			const { pkg } = manifest.registry ? await lookUp(manifest.registry.aggregatorUrl, ref) : {};
			plugin = items.find((/** @type {any} */ p) => p.registrySlug === ref.slug && (!pkg || p.registryPublisherDid === pkg.did));
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
			routes = [...(kept?.publicRoutes ?? []).map((/** @type {any} */ r) => ({ r, open: true })), ...(plugin.mcpTools ?? []).map((/** @type {any} */ t) => ({ r: t.route, open: false }))];
			if (!kept) line("skip", `${n} public routes`, "not known: this machine did not install it with plugin:install, and EmDash has no request that lists them");
		} else {
			for (const p of Object.keys(sitePackages(siteDir))) {
				const f = join(siteDir, "node_modules", p, "dist", "manifest.json");
				if (existsSync(f) && JSON.parse(readFileSync(f, "utf8")).id === plugin.id) routes = (JSON.parse(readFileSync(f, "utf8")).routes ?? []).map((/** @type {any} */ r) => ({ r: typeof r === "string" ? r : r.name, open: false }));
			}
		}
		const seen = new Set();
		const answers = [];
		for (const { r, open } of routes.filter((/** @type {any} */ x) => !seen.has(x.r) && seen.add(x.r))) {
			// a public route is asked with no sign-in, as a visitor would
			const res = await (open ? visitor : api)("GET", `/_emdash/api/plugins/${plugin.id}/${r}`);
			// Not there: no answer, a 5xx, EmDash's own "Plugin route not found", a plugin that could not be
			// started, or a sign-in refused. A 400, 404 or 405 in the plugin's own words is the route answering.
			const gone = res.error?.code === "NOT_FOUND" || /Failed to start Worker|No such module|sandbox unavailable|workerd (failed|crashed|exited)/i.test(res.error?.message ?? "");
			// (a visitor sent to a sign-in page — Cloudflare Access in front of the route — is shut out too)
			const shut = open ? res.error?.code === "UNAUTHORIZED" || (res.status >= 300 && res.status < 400 && /cloudflareaccess\.com|\/login/.test(res.location ?? "")) : res.status === 401 || res.status === 403;
			answers.push({ r, open, status: res.status, why: res.error?.message ?? (res.location ? `sent to ${res.location.split("?")[0]}` : res.text), bad: res.status === 0 || res.status >= 500 || gone || shut });
		}
		if (answers.length) line(answers.some((a) => a.bad) ? "FAIL" : "ok", `${n} routes`, `${answers.length} declared, each asked with a GET${answers.some((a) => a.open) ? ` (${answers.filter((a) => a.open).length} open to visitors, asked with no sign-in)` : ""}: ${answers.map((a) => `${a.r} ${a.status || "no answer"}${a.bad ? ` (${String(a.why).replace(/\s+/g, " ").slice(0, 120)})` : ""}`).join(", ")}${answers.some((a) => !a.bad && a.status >= 400) ? " (a 400, 404 or 405 is the route itself refusing a bare GET: it is there)" : ""}`);
		else line("skip", `${n} routes`, "it declares none that can be listed");
		// 5. its admin pages load, in a real browser, signed in with the saved token (the one Playwright script)
		const pages = inAdmin?.adminPages ?? [];
		if (!pages.length) line("skip", `${n} admin page`, "it has none");
		else {
			const r = spawnSync(process.execPath, [join(here, "signin-browser.mjs"), url, siteDir, ...(deployed ? ["--deployed"] : []), ...(inAdmin.sandboxed && inAdmin.adminMode === "blocks" ? ["--blocks"] : []), ...pages.map((/** @type {any} */ p) => `--check=/_emdash/admin/plugins/${plugin.id}${p.path}`)], { cwd: projectDir, encoding: "utf8" });
			const lines = r.stdout.trim().split("\n").filter((l) => /^(ok|FAIL)/.test(l));
			for (const l of lines) console.log(l.replace("admin page:", `${n} admin page:`));
			failed += lines.filter((l) => l.startsWith("FAIL")).length;
			// the browser script stopped before it had a line for every page: say what it said
			if (lines.length < pages.length) line("FAIL", `${n} admin page`, `${pages.length - lines.length} of ${pages.length} pages were not checked — ${r.stderr.replace(/\s+/g, " ").slice(-300) || `the browser script ended with ${r.status ?? r.signal}`}`);
		}
		if (deployed) {
			line("skip", `${n} log`, "a deployed site's log is not kept where this can read it: mise run live:logs follows it while you ask");
			line("skip", `${n} sandbox`, "the same: a refusal would be in that log");
		} else {
			// 6 and 7. what the site wrote in its log meanwhile: EmDash's own "Loaded registry plugin …"
			// line from when the site started, and no line saying one failed.
			const log = readLog();
			const fresh = log.slice(wanted.indexOf(plugin) === 0 ? 0 : read);
			read = log.length;
			const notLoaded = fresh.filter((l) => /Failed to load|not found in R2|sandbox is configured but not available|Sandboxed plugins are disabled|Plugin sandbox unavailable|workerd (failed|crashed|exited)|Address already in use|Uncaught \w*Error/i.test(l) && (l.includes(plugin.id) || /sandbox|workerd/i.test(l)));
			const loaded = log.find((l) => /Loaded \w+ plugin /.test(l) && l.includes(plugin.id));
			line(notLoaded.length ? "FAIL" : "ok", `${n} log`, notLoaded.length ? notLoaded.slice(0, 3).join(" | ").slice(0, 400) : loaded ? `the built site's log says: ${loaded.trim().slice(0, 160)}` : "the built site's log has no line saying it failed to load (EmDash writes 'Loaded … plugin' for a registry plugin, and nothing for one from the site's config)");
			const refused = fresh.filter((l) => /Missing capability|Host not allowed|exceeded wall-time limit|Sandboxed plugin route error|Route handler failed/i.test(l));
			line(refused.length ? "FAIL" : "ok", `${n} sandbox`, refused.length ? refused.slice(0, 3).join(" | ").slice(0, 400) : "nothing was refused while its routes and pages were asked (a refusal the plugin catches itself leaves no trace)");
		}
		console.log(failed > before ? `     ${n}: DOES NOT WORK — ${failed - before} check${failed - before > 1 ? "s" : ""} failed` : `     ${n}: loads and answers (its pages and routes; what a form's submit or a hook does is not tried)`);
	}
	throw new Exit(failed ? 1 : 0);
};

// A program one of the site's packages installs, run with Node itself (see scripts/emdash.mjs).
function siteBin(/** @type {string} */ siteDir, /** @type {string} */ pkg, /** @type {string} */ name) {
	const dir = join(siteDir, "node_modules", pkg);
	const bin = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).bin;
	return join(dir, typeof bin === "string" ? bin : bin[name]);
}
