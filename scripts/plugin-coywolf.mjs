// plugin:coywolf — Coywolf Pack (github.com/coywolf-llc/coywolf-pack, the package @coywolf/emdash)
// in a Cloudflare site, wired the way its README says. The pack is a NATIVE plugin: it runs in the
// site itself, reads D1 and R2 through their bindings, and has a middleware of its own, so it needs
// more than the two lines plugin:add prints:
//
//   package.json      the pack, from its release tarball (its README: a github: install is recorded
//                     as an SSH address, which a CI runner cannot fetch), and its peers the site lacks
//   astro.config.mjs  coywolfPlugin() in plugins: [ … ] of emdash({ … }); Vite told not to pre-bundle
//                     it; and, when the site has no route cache, Cloudflare's, with EmDash's
//                     Cloudflare guide's route rules (the pack's page cache sits on that cache)
//   src/middleware.ts coywolfPack() first: redirects, robots.txt, file downloads and the page cache's
//                     clears and warming are answered there
//   wrangler.jsonc    CF_VERSION_METADATA (a deploy clears the page cache; the usage card finds its
//                     Worker), SELF (cache warming and internal link checks call the Worker itself),
//                     Smart Placement (the Worker runs near its database) and Workers Logs
//
// Every one of the pack's modules starts off: installing it changes nothing a visitor sees until an
// administrator turns a feature on, under Plugins → Coywolf Pack. Nothing here is written when it is
// already there, and a file not of a shape it can edit safely is left alone, with the lines to add.
//
// The edits are functions from text to text, exported for tests/plugin/plugin-coywolf.test.mjs.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fail, win } from "./plugin-api.mjs";
import { CannotEdit, addConfigOption, addImport, addToList, configOptionText, hasConfigOption, imports, kinds } from "./plugin-astro-config.mjs";
import { isCloudflare, parseJsonc, wranglerFile } from "./wrangler-config.mjs";
import { Exit, task } from "./core/calls.mjs";

export const PACKAGE = "@coywolf/emdash";
// The release this was tried with. COYWOLF_VERSION (mise.toml [env]) holds a site to another.
export const VERSION = "v0.35.11";
export const tarball = (/** @type {string} */ version) => `https://codeload.github.com/coywolf-llc/coywolf-pack/tar.gz/refs/tags/${version}`;
// The pack's own floor: emdash >=1.2.0 in its peerDependencies.
export const EMDASH_AT_LEAST = [1, 2, 0];

// ── astro.config.mjs ───────────────────────────────────────────────────────────────────────────

const VITE = `{
	optimizeDeps: { exclude: ["${PACKAGE}"], include: ["@phosphor-icons/react", "@cloudflare/kumo"] },
	ssr: { optimizeDeps: { exclude: ["${PACKAGE}"] } },
}`;
const ROUTE_RULES = `{ "/": { maxAge: 3600, swr: 86400 }, "/[...path]": { maxAge: 3600, swr: 86400 } }`;
export const configLines = [
	`import { coywolfPlugin } from "${PACKAGE}";`,
	"plugins: [coywolfPlugin()],   // inside emdash({ … })",
	`vite: ${VITE.replace(/\n\s*/g, " ")},   // inside defineConfig({ … })`,
	'import { cacheCloudflare } from "@astrojs/cloudflare/cache";   // when the site has no cache: option',
	`cache: { provider: cacheCloudflare() }, routeRules: ${ROUTE_RULES},   // inside defineConfig({ … })`,
];

// Every edit, in one go: the text, and what was added, one line each.
export const editConfig = (/** @type {string} */ text) => {
	/** @type {string[]} */
	const added = [];
	let t = text;
	const plugin = addImport(t, { module: PACKAGE, named: "coywolfPlugin" });
	const withPlugin = addToList(plugin.text, "plugins", `${plugin.local}()`);
	if (withPlugin !== t) added.push(`${plugin.local}() in plugins: [ … ] of emdash({ … })`);
	t = withPlugin;
	const vite = configOptionText(t, "vite");
	if (vite === null) {
		t = addConfigOption(t, "vite", VITE);
		added.push(`vite: Vite does not pre-bundle ${PACKAGE}`);
	} else if (!vite.includes(PACKAGE)) {
		throw new CannotEdit(`it already has vite: { … }, and this does not edit inside it. Add ${PACKAGE} to optimizeDeps.exclude and ssr.optimizeDeps.exclude there, and @phosphor-icons/react and @cloudflare/kumo to optimizeDeps.include`);
	}
	if (!hasConfigOption(t, "cache")) {
		// each is put first among the options, so the rules go in before the cache they are for
		if (!hasConfigOption(t, "routeRules")) t = addConfigOption(t, "routeRules", ROUTE_RULES);
		const c = addImport(t, { module: "@astrojs/cloudflare/cache", named: "cacheCloudflare" });
		t = addConfigOption(c.text, "cache", `{ provider: ${c.local}() }`);
		added.push("cache: Cloudflare's route cache, with route rules for every page");
	}
	return { text: t, added };
};

// ── src/middleware.ts ──────────────────────────────────────────────────────────────────────────

const MIDDLEWARE = "@coywolf/emdash/middleware";
export const middlewareLines = [`import { sequence } from "astro:middleware";`, `import { coywolfPack } from "${MIDDLEWARE}";`, "export const onRequest = sequence(coywolfPack(), /* the site's own */);"];
export const newMiddleware = () =>
	[
		"// Coywolf Pack's middleware (mise run plugin:coywolf wrote this file): its redirects, robots.txt,",
		"// file downloads, and the page cache's clears and warming are answered here. A middleware of the",
		"// site's own goes after it: sequence(coywolfPack(), yours).",
		...middlewareLines.slice(0, 2),
		"",
		"export const onRequest = sequence(coywolfPack());",
		"",
	].join("\n");

// The site's middleware with coywolfPack() first. Null when it is already there.
export const editMiddleware = (/** @type {string} */ text) => {
	const kind = kinds(text);
	const all = imports(text, kind);
	if (all.some((i) => i.module === MIDDLEWARE)) return null;
	const exportsAt = [...text.matchAll(/^export\s+const\s+onRequest\b(\s*:\s*[\w.$<>]+)?\s*=\s*/gm)].filter((m) => kind[m.index] === 0);
	if (exportsAt.length !== 1 || /\bexport\s+(?:async\s+)?function\s+onRequest\b|\bexport\s*\{[^}]*\bonRequest\b/.test(text))
		throw new CannotEdit("it does not export onRequest as one export const onRequest = …");
	const m = exportsAt[0];
	let t = text;
	const seq = /^sequence\s*\(/.exec(t.slice(m.index + m[0].length));
	if (seq && all.some((i) => i.module === "astro:middleware" && i.named.some((n) => n.imported === "sequence" && n.local === "sequence"))) {
		// export const onRequest = sequence(a, b): coywolfPack() goes first in it
		const at = m.index + m[0].length + seq[0].length;
		t = t.slice(0, at) + "coywolfPack(), " + t.slice(at);
	} else {
		// export const onRequest = <the site's>  →  const siteMiddleware = <the site's>, and the pack before it
		if (/\bsiteMiddleware\b/.test(t)) throw new CannotEdit("it already uses the name siteMiddleware");
		t = t.slice(0, m.index) + `const siteMiddleware${m[1] ?? ""} = ` + t.slice(m.index + m[0].length);
		t = `${t.replace(/\s*$/, "")}\n\n// Coywolf Pack's middleware first (mise run plugin:coywolf), then the site's own.\nexport const onRequest = sequence(coywolfPack(), siteMiddleware);\n`;
	}
	const s = addImport(t, { module: "astro:middleware", named: "sequence" });
	if (s.local !== "sequence") throw new CannotEdit("it imports sequence from astro:middleware under another name");
	return addImport(s.text, { module: MIDDLEWARE, named: "coywolfPack" }).text;
};

// ── wrangler.jsonc ─────────────────────────────────────────────────────────────────────────────

/** The keys the pack needs, as wrangler writes them. @param {string} worker */
export const wranglerKeys = (worker) => /** @type {const} */ ([
	["version_metadata", '{ "binding": "CF_VERSION_METADATA" }', "a deploy clears the page cache; the usage card finds this Worker"],
	["services", `[{ "binding": "SELF", "service": "${worker}" }]`, "cache warming and internal link checks call the Worker itself"],
	["placement", '{ "mode": "smart" }', "Smart Placement: the Worker runs near its database"],
	["observability", '{ "enabled": true }', "Workers Logs: the usage card's estimate of what warming costs"],
]);
export const wranglerLines = (/** @type {string} */ worker) => wranglerKeys(worker).map(([k, v]) => `"${k}": ${v},`);

// The config with each key the pack needs, at the top level. What it added, one line each.
export const editWrangler = (/** @type {string} */ text) => {
	let config;
	try {
		config = parseJsonc(text);
	} catch {
		throw new CannotEdit("it cannot be read as JSON with comments");
	}
	if (!config.name) throw new CannotEdit('it has no "name": SELF is a binding to the Worker of that name');
	/** @type {string[]} */
	const added = [];
	let t = text;
	for (const [key, value, why] of wranglerKeys(config.name)) {
		const have = config[key];
		if (key === "services" && have) {
			if (!Array.isArray(have)) throw new CannotEdit('its "services" is not a list');
			const self = have.find((/** @type {{ binding?: string }} */ s) => s.binding === "SELF");
			if (self && self.service !== config.name) throw new CannotEdit(`its SELF binding points at ${self.service}, not at this Worker (${config.name})`);
			if (!self) throw new CannotEdit('it has "services" already, and this does not add to a list in it');
			continue;
		}
		if (key === "observability" && have && have.enabled === false) throw new CannotEdit('it has "observability": { "enabled": false }, and this does not turn off what someone turned off');
		if (have !== undefined) continue;
		// at the end of the root object, before its closing brace: the last one that is not in a comment
		const kind = kinds(t);
		let close = t.length - 1;
		while (close >= 0 && !(t[close] === "}" && kind[close] === 0)) close--;
		let last = close - 1;
		while (last >= 0 && (kind[last] === 1 || /\s/.test(t[last]))) last--;
		if (close < 0 || last < 0) throw new CannotEdit("it is not laid out as wrangler writes it");
		const eol = t.includes("\r\n") ? "\r\n" : "\n";
		const comma = t[last] === "," || t[last] === "{" ? "" : ",";
		const lineStart = t.lastIndexOf("\n", close - 1) + 1;
		const before = t.slice(lineStart, close).trim() === "" ? lineStart : close;
		t = t.slice(0, last + 1) + comma + t.slice(last + 1, before) + `\t// ${why} (Coywolf Pack)${eol}\t"${key}": ${value},${eol}` + t.slice(before);
		added.push(`"${key}": ${value}`);
	}
	try {
		const after = parseJsonc(t);
		for (const [key] of wranglerKeys(config.name)) if (after[key] === undefined) throw new Error(key);
	} catch {
		throw new CannotEdit("it is not laid out as wrangler writes it");
	}
	return { text: t, added };
};

// ── the site ───────────────────────────────────────────────────────────────────────────────────

const atLeast = (/** @type {string} */ v, /** @type {number[]} */ floor) => {
	const parts = v.replace(/^[^\d]*/, "").split(/[.-]/).map(Number);
	for (let i = 0; i < floor.length; i++) if ((parts[i] ?? 0) !== floor[i]) return (parts[i] ?? 0) > floor[i];
	return true;
};
const readJson = (/** @type {string} */ f) => JSON.parse(readFileSync(f, "utf8"));
const pnpm = (/** @type {string[]} */ args, /** @type {string} */ cwd) => {
	const r = spawnSync("pnpm", args, { cwd, stdio: "inherit", shell: win });
	if (r.status !== 0) throw new Exit(r.status ?? 1);
};
/** @param {string} file @param {string} before @param {() => string} change @param {string[]} byHand */
const editOrSay = (file, before, change, byHand) => {
	try {
		return change();
	} catch (error) {
		if (!(error instanceof CannotEdit)) throw error;
		fail(`${file} was not changed: ${error.message}.\nAdd by hand:\n${byHand.map((l) => `  ${l}`).join("\n")}`);
	}
	return before;
};

/** @param {string[]} argv  [the site's folder] */
export async function main(argv) {
	const [siteDir] = argv;
	const version = process.env.COYWOLF_VERSION || VERSION;
	if (!isCloudflare(siteDir)) fail("Coywolf Pack is for a site on EmDash's Cloudflare adapter, and this one has no wrangler config. Nothing was changed.");
	const emdashPkg = join(siteDir, "node_modules", "emdash", "package.json");
	if (!existsSync(emdashPkg)) fail(`EmDash is not installed in ${siteDir}: mise run site:check installs it. Nothing was changed.`);
	const emdash = readJson(emdashPkg).version;
	if (!atLeast(emdash, EMDASH_AT_LEAST)) fail(`Coywolf Pack needs EmDash ${EMDASH_AT_LEAST.join(".")} or newer, and the site has ${emdash}: mise run emdash:update first. Nothing was changed.`);
	console.log(`site: ${siteDir}, EmDash ${emdash}; Coywolf Pack ${process.env.COYWOLF_SOURCE ? `from ${process.env.COYWOLF_SOURCE}` : version}`);

	// Every file is worked out before anything is changed: one that cannot be edited stops it here.
	const configFile = ["astro.config.mjs", "astro.config.js"].map((f) => join(siteDir, f)).find(existsSync);
	if (!configFile) fail(`There is no astro.config.mjs in ${siteDir}.`);
	const configBefore = readFileSync(configFile, "utf8");
	const config = editOrSay(configFile, configBefore, () => editConfig(configBefore).text, configLines);
	const mwFile = ["src/middleware.ts", "src/middleware.js"].map((f) => join(siteDir, f)).find(existsSync) ?? join(siteDir, "src", "middleware.ts");
	if (existsSync(join(siteDir, "src", "middleware")) && !existsSync(mwFile)) fail(`The site's middleware is a folder (src/middleware/), and this edits only src/middleware.ts.\nAdd by hand:\n${middlewareLines.map((l) => `  ${l}`).join("\n")}`);
	const mwBefore = existsSync(mwFile) ? readFileSync(mwFile, "utf8") : null;
	const mw = mwBefore === null ? newMiddleware() : editOrSay(mwFile, mwBefore, () => editMiddleware(mwBefore) ?? mwBefore, middlewareLines);
	const wFile = wranglerFile(siteDir);
	if (!wFile) fail(`This site's wrangler config is not wrangler.jsonc or wrangler.json.\nAdd by hand:\n${wranglerLines("<the Worker's name>").map((l) => `  ${l}`).join("\n")}`);
	const wBefore = readFileSync(wFile, "utf8");
	const wName = (() => {
		try {
			return parseJsonc(wBefore).name ?? "<the Worker's name>";
		} catch {
			return "<the Worker's name>";
		}
	})();
	const w = editOrSay(wFile, wBefore, () => editWrangler(wBefore).text, wranglerLines(wName));

	// The packages: the pack at the release asked for, then the peers it names that the site lacks.
	const pkgFile = join(siteDir, "package.json");
	// COYWOLF_SOURCE: anything `pnpm add` takes in its place — a fork's tarball, a local checkout of
	// the pack, or the same release's tarball as a file where codeload.github.com cannot be reached
	const want = process.env.COYWOLF_SOURCE || tarball(version);
	const deps = () => ({ ...readJson(pkgFile).dependencies, ...readJson(pkgFile).devDependencies });
	let changedPackages = false;
	if (deps()[PACKAGE] !== want) {
		await task("site:stop");
		pnpm(["add", want], siteDir);
		changedPackages = true;
		console.log(`package.json: ${PACKAGE} from ${want}`);
	}
	const meta = readJson(join(siteDir, "node_modules", PACKAGE, "package.json"));
	const optional = meta.peerDependenciesMeta ?? {};
	const missing = Object.entries(meta.peerDependencies ?? {}).filter(([n]) => !optional[n]?.optional && !deps()[n]).map(([n, range]) => `${n}@${range}`);
	if (missing.length) {
		if (!changedPackages) await task("site:stop");
		pnpm(["add", ...missing], siteDir);
		changedPackages = true;
		console.log(`package.json: the pack's peers the site lacked: ${missing.join(", ")}`);
	}

	const wrote = [];
	if (config !== configBefore) {
		writeFileSync(configFile, config);
		const check = spawnSync(process.execPath, ["--check", configFile], { encoding: "utf8" });
		if (check.status !== 0) {
			writeFileSync(configFile, configBefore);
			fail(`The edit to ${configFile} did not leave a file Node can read, so it was put back as it was.\n${check.stderr}`);
		}
		wrote.push(...editConfig(configBefore).added.map((a) => `${configFile}: ${a}`));
	}
	if (mw !== mwBefore) {
		writeFileSync(mwFile, mw);
		wrote.push(`${mwFile}: coywolfPack() first${mwBefore === null ? " (a new file)" : ""}`);
	}
	if (w !== wBefore) {
		writeFileSync(wFile, w);
		wrote.push(...editWrangler(wBefore).added.map((a) => `${wFile}: ${a}`));
	}
	for (const line of wrote) console.log(`config: ${line}`);
	if (!wrote.length && !changedPackages) console.log(`Coywolf Pack ${version} is already in the site, wired: nothing changed.`);
	else {
		console.log("Every module of the pack starts off. Turn on what you want in the admin: Plugins → Coywolf Pack → Features; the page cache's lifetimes and warming are under Plugins → Performance.");
		console.log("The page cache works on the deployed site only: on this machine there is no cache in front of the Worker. Deploy: mise run live:ship");
	}
	throw new Exit(0);
}
