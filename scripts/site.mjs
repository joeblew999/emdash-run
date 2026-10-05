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

function build(mode) {
	// A production build must use the HOSTED registry, so drop the dev override set in
	// mise.toml's [env].
	delete process.env.EMDASH_REGISTRY_URL;
	let rc = 0;
	try {
		if (mode === "build") {
			run("pnpm", ["build"], { cwd: SITE_DIR });
		} else if (mode === "deploy-dry") {
			run("pnpm", ["build"], { cwd: SITE_DIR });
			run("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--outdir", "dist"], { cwd: SITE_DIR });
		} else {
			// Cloudflare creds come from fnox (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID).
			run("fnox", ["exec", "--", "pnpm", "run", "deploy"], { cwd: SITE_DIR });
		}
	} catch (error) {
		rc = 1;
		console.error(error instanceof Error ? error.message : String(error));
	} finally {
		// A production build leaves .vite/.astro in a state `astro dev` cannot reuse
		// (stale deps_ssr URLs → 500s), so clean up either way.
		rmSync(`${SITE_DIR}/node_modules/.vite`, { recursive: true, force: true });
		rmSync(`${SITE_DIR}/.astro`, { recursive: true, force: true });
	}
	if (rc === 0) console.log("→ dev server needs a restart: mise run repo:apply");
	process.exit(rc);
}

switch (sub) {
	case "build":
	case "deploy-dry":
	case "deploy":
		build(sub);
		break;
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
		sh(`open '${env("SITE_URL")}/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin'`);
		break;
	case "reset":
		rmSync(`${SITE_DIR}/.wrangler/state`, { recursive: true, force: true });
		console.log("Done — run: mise run repo:apply");
		break;
	case "clean":
		sh("pitchfork stop emdash || true");
		rmSync(SITE_DIR, { recursive: true, force: true });
		console.log("✓ Wiped .src/site — run: mise run site:setup");
		break;
	case "regen":
		sh("pitchfork stop -a || true");
		rmSync(env("SRC_DIR"), { recursive: true, force: true });
		run("mise", ["run", "src:clone-templates"]);
		console.log("✓ Wiped .src — run: mise run site:setup → init → apply");
		break;
	default:
		console.error(`site: unknown subcommand "${sub}" (sync|install|dev|logs|open|reset|clean|regen)`);
		process.exit(1);
}
