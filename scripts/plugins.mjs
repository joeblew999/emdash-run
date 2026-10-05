#!/usr/bin/env node
/**
 *   mise run plugin:install -- <name>          (one plugin)
 *   mise run plugins:install-all | plugins:link (all plugins)
 *   mise run plugin:validate|bundle|publish|login -- <name>
 *   mise run plugins:catalog | :catalog:dry | :catalog:full
 *
 * Singular = one plugin (takes a name); plural = all plugins.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { dirname } from "node:path";

import { env, run } from "./lib/exec.mjs";

const ROOT = env("ROOT");
const PLUGINS_DIR = env("PLUGINS_DIR");
const SITE_DIR = env("SITE_DIR");
const sub = process.argv[2];
const name = process.argv[3];

const pluginDirs = () =>
	readdirSync(PLUGINS_DIR, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && existsSync(`${PLUGINS_DIR}/${entry.name}/package.json`))
		.map((entry) => entry.name);

function requireName() {
	if (!name) {
		console.error(`plugin:${sub} needs a plugin name — e.g: mise run plugin:${sub} -- plat-trunk`);
		process.exit(1);
	}
}

switch (sub) {
	case "install":
		requireName();
		run("pnpm", ["install"], { cwd: `${PLUGINS_DIR}/${name}` });
		break;

	case "install-all":
		for (const dir of pluginDirs()) {
			console.log(`→ pnpm install in ${dir}`);
			run("pnpm", ["install"], { cwd: `${PLUGINS_DIR}/${dir}` });
		}
		break;

	case "link":
		// Plugins live in plugins/ but the site resolves them from its own node_modules;
		// symlinking keeps edits live.
		mkdirSync(`${SITE_DIR}/node_modules`, { recursive: true });
		for (const dir of pluginDirs()) {
			const pkg = JSON.parse(readFileSync(`${PLUGINS_DIR}/${dir}/package.json`, "utf8")).name;
			const target = `${SITE_DIR}/node_modules/${pkg}`;
			mkdirSync(dirname(target), { recursive: true });
			rmSync(target, { recursive: true, force: true });
			symlinkSync(`${PLUGINS_DIR}/${dir}`, target);
			console.log(`  ✓ linked ${pkg}`);
		}
		break;

	case "validate":
	case "bundle":
	case "publish":
	case "login":
		// Deliberately not implemented: these belong to the sandboxed-plugin flow
		// (`@emdash-cms/plugin-cli` / `emdash-plugin`, needs an emdash-plugin.jsonc).
		// plat-trunk is native, distributed as an npm package. See docs/plugin.md.
		console.error(`${sub}: not applicable — sandboxed plugins only (see docs/plugin.md)`);
		process.exit(1);

	case "catalog":
		run("node", [`${ROOT}/scripts/find-plugins.mjs`]);
		break;
	case "catalog-dry":
		run("node", [`${ROOT}/scripts/find-plugins.mjs`, "--dry"]);
		break;
	case "catalog-full":
		run("node", [`${ROOT}/scripts/find-plugins.mjs`, "--readmes"]);
		break;

	default:
		console.error(`plugins: unknown subcommand "${sub}"`);
		process.exit(1);
}
