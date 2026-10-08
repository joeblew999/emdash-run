// What the plugin tasks do to the SITE'S FILES — its astro.config.mjs, wrangler.jsonc and packages —
// and to a sandbox process a stopped site left behind. Nothing here speaks to a running site.
// The edits to astro.config.mjs themselves are scripts/plugin-astro-config.mjs.
//
// A registry plugin always runs in the sandbox, so the site needs a sandbox runner (EmDash docs:
// deployment/plugin-sandbox). `sandbox` makes the edits those docs give, and changes nothing when
// they are already made:
//   Cloudflare  astro.config.mjs: sandboxRunner: sandbox()   wrangler.jsonc: the worker_loaders line
//   Node        astro.config.mjs: sandboxRunner: "@emdash-cms/sandbox-workerd/sandbox"
//               and the packages @emdash-cms/sandbox-workerd and workerd
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { fail, win } from "./plugin-api.mjs";
import { CannotEdit, addSandboxedPlugin, imports, sandboxRunnerLines, sandboxedPluginLines, setSandboxRunner } from "./plugin-astro-config.mjs";
import { isCloudflare, parseJsonc, wranglerFile } from "./wrangler-config.mjs";
import { Exit, task } from "./core/calls.mjs";

const configFile = (/** @type {string} */ siteDir) => ["astro.config.mjs", "astro.config.ts", "astro.config.js"].map((f) => join(siteDir, f)).find(existsSync);
export const sitePackages = (/** @type {string} */ siteDir) => {
	const p = JSON.parse(readFileSync(join(siteDir, "package.json"), "utf8"));
	return /** @type {Record<string, string>} */ ({ ...p.dependencies, ...p.devDependencies });
};

// The edits themselves are scripts/plugin-astro-config.mjs: text in, text out, inside emdash({ … })
// only. A config of a shape they cannot edit safely is left as it is, and the lines to add by hand
// are printed.
/** @param {string} file @param {string} before @param {(text: string) => string} change @param {string[]} byHand @returns {string} */
const edited = (file, before, change, byHand) => {
	try {
		return change(before);
	} catch (error) {
		if (!(error instanceof CannotEdit)) throw error;
		fail(`${file} was not changed: ${error.message}.\nAdd by hand:\n${byHand.map((/** @type {string} */ l) => `  ${l}`).join("\n")}`);
	}
};
// Write the config only when it changed, and only when Node can still read it; else put it back.
/** @param {string} file @param {string} before @param {string} after */
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
const pnpm = (/** @type {string[]} */ argsFor, /** @type {string} */ cwd) => {
	const r = spawnSync("pnpm", argsFor, { cwd, stdio: "inherit", shell: win });
	if (r.status !== 0) throw new Exit(r.status ?? 1);
};

// What a site needs before it can run a sandboxed plugin. Returns what it changed, as lines.
const LOADER = '"worker_loaders": [{ "binding": "LOADER" }],';
// allowBuilds: workerd: true in the site's pnpm-workspace.yaml. Returns the file when it changed it.
// A workaround, not filed upstream yet: docs/upstream.md, "the sandbox process outlives the site".
const allowWorkerdBuild = (/** @type {string} */ siteDir) => {
	const f = join(siteDir, "pnpm-workspace.yaml");
	const before = existsSync(f) ? readFileSync(f, "utf8") : "";
	if (/^[ \t]+workerd:[ \t]*true\b/m.test(before)) return null;
	let after;
	if (/^[ \t]+workerd:[ \t]*false\b.*$/m.test(before)) after = before.replace(/^([ \t]+workerd:[ \t]*)false\b/m, "$1true");
	else if (/^allowBuilds:[ \t]*\r?\n/m.test(before)) after = before.replace(/^allowBuilds:[ \t]*\r?\n/m, (m) => `${m}  workerd: true\n`);
	else after = `${before}${before && !before.endsWith("\n") ? "\n" : ""}allowBuilds:\n  workerd: true\n`;
	writeFileSync(f, after);
	return f;
};

export const sandbox = async (/** @type {string} */ siteDir) => {
	const file = configFile(siteDir);
	if (!file) fail(`There is no astro.config in ${siteDir}.`);
	const cloudflare = isCloudflare(siteDir);
	const before = readFileSync(file, "utf8");
	// worked out before anything is changed: a config that cannot be edited stops it here
	const after = edited(file, before, (t) => setSandboxRunner(t, cloudflare), sandboxRunnerLines(cloudflare));
	const changed = [];
	if (cloudflare) {
		if (writeConfig(file, before, after)) changed.push(`${file}: sandboxRunner: sandbox()`);
		// The Worker Loader binding, as create-emdash --sandboxed-plugins writes it.
		const w = wranglerFile(siteDir);
		const byHand = `Add a Worker Loader binding named LOADER to its wrangler config by hand:\n  ${LOADER}`;
		if (!w) fail(`This Cloudflare site has no wrangler.jsonc. ${byHand}`);
		const wBefore = readFileSync(w, "utf8");
		const loaders = (/** @type {string} */ text) => {
			try {
				return parseJsonc(text).worker_loaders ?? null;
			} catch {
				return undefined;
			}
		};
		const have = loaders(wBefore);
		if (have === undefined) fail(`${w} was not changed: it cannot be read as JSON with comments. ${byHand}`);
		if (!have?.some((/** @type {{ binding?: string }} */ l) => l.binding === "LOADER")) {
			if (have) fail(`${w} was not changed: it has worker_loaders, and none of them is named LOADER. ${byHand}`);
			const commented = /^([ \t]*)\/\/[ \t]*("worker_loaders"\s*:.*)$/m;
			// the root object's own brace: the first one that is not in a comment
			const root = /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*\{/.exec(wBefore);
			const eol = wBefore.includes("\r\n") ? "\r\n" : "\n";
			const wAfter = commented.test(wBefore) ? wBefore.replace(commented, "$1$2") : root ? wBefore.slice(0, root[0].length) + (/^[ \t]*\r?\n/.test(wBefore.slice(root[0].length)) ? `${eol}\t${LOADER}` : ` ${LOADER}`) + wBefore.slice(root[0].length) : wBefore;
			if (!loaders(wAfter)?.some((/** @type {{ binding?: string }} */ l) => l.binding === "LOADER")) fail(`${w} was not changed: it is not laid out as wrangler writes it. ${byHand}`);
			writeFileSync(w, wAfter);
			changed.push(`${w}: the worker_loaders binding LOADER — deploying it needs the Workers Paid plan`);
		}
	} else {
		const have = sitePackages(siteDir);
		const missing = ["@emdash-cms/sandbox-workerd", "workerd"].filter((p) => !have[p]);
		// workerd's install script, allowed — as EmDash's Cloudflare template allows it, and its Node
		// template does not. Without it node_modules/workerd/bin/workerd is a Node launcher that runs
		// the real program as its child; EmDash stops the launcher, the program lives on and keeps
		// port 18788, and the next sandbox process cannot open it: "bind(): Address already in use",
		// then "workerd failed to start within 10 seconds" from every sandboxed plugin. The script
		// puts the program itself at bin/workerd, so stopping it stops it. (On Windows the script
		// leaves the launcher: nothing changes there.)
		const allowed = allowWorkerdBuild(siteDir);
		// packages change: the site is stopped first (a running site breaks on Windows otherwise)
		if (missing.length || allowed) await task("site:stop");
		if (missing.length) {
			pnpm(["add", ...missing], siteDir);
			changed.push(`package.json: ${missing.join(", ")}`);
		} else if (allowed) {
			// already installed, with the script refused: run it now
			pnpm(["rebuild", "workerd"], siteDir);
		}
		if (allowed) changed.push(`${allowed}: workerd's install script is allowed (allowBuilds), so the sandbox process stops when EmDash stops it`);
		if (writeConfig(file, before, after)) changed.push(`${file}: sandboxRunner: "@emdash-cms/sandbox-workerd/sandbox"`);
	}
	return changed;
};

// plugin:add and plugin:new: the package is in the site; now its two lines in astro.config.mjs.
export const addToConfig = async (/** @type {string} */ siteDir, /** @type {string} */ given) => {
	// On Windows `pnpm add file:./plugins/x` writes the folder into package.json with a backslash and
	// into its lockfile with a slash. The two then disagree, and on a CI runner (a frozen lockfile)
	// every pnpm command after it refuses: ERR_PNPM_OUTDATED_LOCKFILE. A slash is right on every OS.
	const pkgFile = join(siteDir, "package.json");
	const pkgText = readFileSync(pkgFile, "utf8");
	const slashed = pkgText.replace(/"file:[^"]*"/g, (m) => m.replaceAll("\\\\", "/"));
	if (slashed !== pkgText) writeFileSync(pkgFile, slashed);
	// `pnpm add` takes a version or a folder too: the name is what is in package.json.
	const have = sitePackages(siteDir);
	const pkg = have[given] ? given : Object.keys(have).find((n) => have[n] === given || have[n] === `file:${given.replace(/^file:/, "")}` || given.startsWith(`${n}@`));
	if (!pkg) fail(`[${given}] is not in the site's package.json, so there is nothing to add to astro.config.mjs.`);
	const meta = JSON.parse(readFileSync(join(siteDir, "node_modules", pkg, "package.json"), "utf8"));
	const file = configFile(siteDir);
	if (!file) fail(`There is no astro.config in ${siteDir}.`);
	const before = readFileSync(file, "utf8");
	const local = pkg.replace(/^@[^/]+\//, "").replace(/^(emdash-)?plugin-/, "").replace(/[^a-zA-Z0-9]+(.)?/g, (/** @type {string} */ _, /** @type {string | undefined} */ c) => (c ? c.toUpperCase() : "")).replace(/^[^a-zA-Z]+/, "") || "plugin";
	if (meta.exports?.["./sandbox"]) {
		// What `emdash-plugin build` makes: a descriptor as the default export, for sandboxed: [ … ].
		// Worked out first: a config that cannot be edited stops this before the sandbox is set up.
		edited(file, before, (t) => addSandboxedPlugin(t, pkg, local), sandboxedPluginLines(pkg, local));
		const changed = await sandbox(siteDir);
		for (const line of changed) console.log(`sandbox: ${line}`);
		const now = readFileSync(file, "utf8");
		const wrote = writeConfig(file, now, edited(file, now, (t) => addSandboxedPlugin(t, pkg, local), sandboxedPluginLines(pkg, local)));
		console.log(wrote ? `config: ${file}: import ${local} from "${pkg}"  and  sandboxed: [${local}]` : `config: [${pkg}] is already in ${file} — nothing changed.`);
	} else {
		// A native plugin exports a function that makes it, under a name only its README gives:
		// nothing in the package says which export that is. EmDash's own are all named
		// <something>Plugin, so one such export is offered as the likely name — and not written.
		if (imports(before).some((i) => i.module === pkg)) {
			console.log(`config: [${pkg}] is already in ${file} — nothing changed.`);
		} else {
			const entry = typeof meta.exports?.["."] === "string" ? meta.exports["."] : meta.exports?.["."]?.import ?? meta.exports?.["."]?.default ?? meta.module ?? meta.main ?? "index.js";
			const source = existsSync(join(siteDir, "node_modules", pkg, entry)) ? readFileSync(join(siteDir, "node_modules", pkg, entry), "utf8") : "";
			const makers = [...new Set([...source.matchAll(/export\s+(?:function|const)\s+(\w+Plugin)\b/g), ...source.matchAll(/export\s*\{[^}]*?\b(?:\w+\s+as\s+)?(\w+Plugin)\b[^}]*\}/g)].map((m) => m[1]))].filter((n) => n !== "createPlugin");
			const name = makers.length === 1 ? makers[0] : "thePlugin";
			fail(
				`config: [${pkg}] is in package.json. ${file} was not changed: it is a native plugin (it runs in the site itself, not in the sandbox), and which of its exports makes the plugin is for its README to say — this does not guess.\n` +
					`Add by hand${makers.length === 1 ? ` (it exports ${name}: check that is the one)` : makers.length ? ` (it exports ${makers.join(", ")}: its README says which)` : " (thePlugin stands for the name its README gives)"}:\n` +
					`  import { ${name} } from "${pkg}";\n  plugins: [${name}()],   // inside emdash({ … })`,
			);
		}
	}
};

// site:stop, for a Node site.
