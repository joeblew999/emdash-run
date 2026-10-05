#!/usr/bin/env node
/**
 * The host site (an official template copied into .src/site, runs on :4321).
 *
 *   mise run site:sync | site:install | site:dev | site:logs | site:open
 *   mise run site:reset | site:clean | site:regen
 *
 * `site:sync` is destructive (rm -rf + copy) and only runs from site:setup / site:clean.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

import { env, run, sh } from "./lib/exec.mjs";

const ROOT = env("ROOT");
const SITE_DIR = env("SITE_DIR");
const sub = process.argv[2];

function sync() {
	const templatesDir = env("TEMPLATES_DIR");
	const template = env("TEMPLATE");
	const src = `${templatesDir}/${template}`;
	if (!existsSync(src)) {
		const available = readdirSync(templatesDir).filter((name) => !name.startsWith("."));
		console.error(`✗ Template '${template}' not found in ${templatesDir}`);
		console.error(`  Available: ${available.join(" ")}`);
		process.exit(1);
	}
	rmSync(SITE_DIR, { recursive: true, force: true });
	mkdirSync(SITE_DIR, { recursive: true });
	cpSync(src, SITE_DIR, { recursive: true });
	// The template pins pnpm via packageManager; mise already provides that pnpm, so drop
	// the pin and let pnpm stop trying to self-manage a second copy.
	const pkgPath = `${SITE_DIR}/package.json`;
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
	delete pkg.packageManager;
	writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);
	console.log(`  ✓ site ← ${template}`);
}

function install() {
	const version = env("EMDASH_VERSION");
	run("pnpm", ["install"], { cwd: SITE_DIR });
	// Pin the CMS exactly — the template ships floating ranges (emdash: ^1.0.1) that would
	// otherwise drift on every install. `pnpm add --save-exact` still writes a caret here,
	// so set the versions directly.
	const pkgPath = `${SITE_DIR}/package.json`;
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
	pkg.dependencies.emdash = version;
	pkg.dependencies["@emdash-cms/cloudflare"] = version;
	writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);
	// First-party plugins the site config registers — declared here rather than hand-edited
	// into the template, so template updates stay clean.
	run("pnpm", ["add", "@emdash-cms/plugin-forms", "@emdash-cms/plugin-webhook-notifier"], { cwd: SITE_DIR });
	// The template's tsconfig declares `types: ["node"]` but never depends on @types/node,
	// so a strict (pnpm) install leaves the editor reporting "Cannot find type definition
	// file for 'node'".
	run("pnpm", ["add", "-D", "@types/node"], { cwd: SITE_DIR });
	console.log(`  ✓ site deps installed (emdash@${version})`);
}

switch (sub) {
	case "sync":
		sync();
		break;
	case "install":
		install();
		break;
	case "dev":
		run("pnpm", ["dev"], { cwd: SITE_DIR });
		break;
	case "logs":
		run("pitchfork", ["logs", "emdash", "--follow"]);
		break;
	case "open":
		sh(`open 'http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin'`);
		break;
	case "reset":
		rmSync(`${SITE_DIR}/.wrangler/state`, { recursive: true, force: true });
		console.log("Done — run: mise run apply");
		break;
	case "clean":
		sh("pitchfork stop emdash || true");
		rmSync(SITE_DIR, { recursive: true, force: true });
		console.log("✓ Wiped .src/site — run: mise run site:setup");
		break;
	case "regen":
		sh("pitchfork stop -a || true");
		rmSync(env("SRC_DIR"), { recursive: true, force: true });
		run("mise", ["run", "src:clone:templates"]);
		console.log("✓ Wiped .src — run: mise run site:setup → init → apply");
		break;
	default:
		console.error(`site: unknown subcommand "${sub}" (sync|install|dev|logs|open|reset|clean|regen)`);
		process.exit(1);
}
