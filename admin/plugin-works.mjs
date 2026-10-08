// plugin:works — does a plugin load and answer? One line per check. EmDash has no command that
// says so: `emdash-plugin` checks a plugin's own folder, not a plugin in a running site.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { client, declared, fail, lookUp, mise, projectDir, reference, said, siteAddress, whereIs, win } from "./plugin-client.mjs";
import { sitePackages } from "./plugin-site.mjs";

const here = dirname(fileURLToPath(import.meta.url));

export const works = async (args, flags) => {
	// "It works", as one line per check. This machine only: it builds the site. No name: every
	// plugin the site has.
	const [given, siteDir, ...names] = args;
	const url = siteAddress(given, flags.includes("--deployed"));
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
		console.log(failed > before ? `     ${n}: DOES NOT WORK — ${failed - before} check${failed - before > 1 ? "s" : ""} failed` : `     ${n}: loads and answers (its pages and routes; what a form's submit or a hook does is not tried)`);
	}
	process.exit(failed ? 1 : 0);
};

// A program one of the site's packages installs, run with Node itself (see admin/emdash.mjs).
function siteBin(siteDir, pkg, name) {
	const dir = join(siteDir, "node_modules", pkg);
	const bin = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).bin;
	return join(dir, typeof bin === "string" ? bin : bin[name]);
}
