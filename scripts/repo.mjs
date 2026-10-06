#!/usr/bin/env node
/**
 * `mise run repo:init | repo:apply | repo:urls` — repo-level lifecycle.
 *
 *   init   one-time after site:setup; the real work is in `depends` (plugin:install-all,
 *          skills:add-all), which mise runs first
 *   apply  the daily command: restart the site and refresh the MCP token
 *   verify assert the RUNNING site matches what this repo claims (content, the model_id
 *          join, and snapshot drift against the real objects in R2)
 *   check  lint + formatting over scripts/ and the plugins
 *   test   unit-test the repo's own scripts (tests/*.test.mjs)
 *   format apply formatting (the fix for a failing `check`)
 *   urls   print every URL this project serves
 */
import { rmSync } from "node:fs";

import { env, run, sh } from "./lib/exec.mjs";

const SITE_DIR = env("SITE_DIR");
const SITE_URL = env("SITE_URL");
const sub = process.argv[2];

if (sub === "init") {
	console.log("✓ init done — run: mise run repo:apply");
} else if (sub === "apply") {
	// Stop ONLY the site: optional daemons (registry, plugins-site) must survive, because
	// the site's plugin discovery points at the local registry while it is running.
	sh("pitchfork stop emdash || true");
	// The Vite optimizer re-hashes chunks whenever the dependency graph changes (a plugin's
	// admin module, a production build in the same dir), leaving the server serving stale
	// `deps_ssr/*?v=…` URLs and returning 500s.
	rmSync(`${SITE_DIR}/node_modules/.vite`, { recursive: true, force: true });

	// pitchfork waits for ready_http (pitchfork.toml) before returning.
	run("pitchfork", ["start", "emdash"]);

	// dev-bypass also runs migrations, so poll it until it answers before seeding or minting the
	// MCP token. It applies the seed itself, but with skip-on-conflict — an entry that already
	// exists is left alone — so it picks up NEW seed content and never EDITS to existing content.
	// `seed:apply` below is what makes edits land, using the official
	// `emdash seed --on-conflict=update`.
	console.log("⏳ waiting for the site to be ready...");
	for (let i = 0; i < 60; i++) {
		const res = await fetch(`${SITE_URL}/_emdash/api/setup/dev-bypass`, { method: "POST" }).catch(
			() => null,
		);
		if (res?.status === 200) break;
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	// Make seed EDITS land, not just new entries. The official command updates in place.
	run("mise", ["run", "seed:apply"]);

	run("mise", ["run", "mcp:token-admin"]);
	console.log(`→ admin:  ${SITE_URL}/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`);
	console.log(`→ mcp:    ${SITE_URL}/_emdash/api/mcp (Bearer: run/token-admin.txt)`);
	console.log("✓ apply done");
} else if (sub === "urls") {
	const registryUrl = process.env.REGISTRY_URL ?? "http://localhost:8788";
	const pluginsSiteUrl = process.env.PLUGINS_SITE_URL ?? "http://localhost:4330";
	console.log(`Host site
  admin      ${SITE_URL}/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
  mcp        ${SITE_URL}/_emdash/api/mcp   (Bearer: run/token-admin.txt)

Optional daemons — start with: mise run registry:up / mise run plugins-site:up
  registry   ${registryUrl}/health   (JSON API under /xrpc/com.emdashcms.experimental.aggregator.*)
             note: / 308-redirects to https://plugins.emdashcms.com/ — there is no local page
  plugins UI ${pluginsSiteUrl}/

Live         https://emdash-run.gedw99.workers.dev`);
} else if (sub === "verify") {
	// Helpers are imported lazily, on purpose. A static import means a syntax error in ANY
	// helper stops EVERY subcommand at module load — so a typo in verify.mjs would make
	// `repo:apply` refuse to restart the site, with a raw Node stack rather than a lint
	// message. Loading them here keeps the blast radius to the one subcommand that uses it.
	const { verify } = await import("./lib/verify.mjs");
	await verify();
} else if (sub === "check") {
	const { check } = await import("./lib/check.mjs");
	check();
} else if (sub === "test") {
	run("vitest", ["run"]);
} else if (sub === "format") {
	const { format } = await import("./lib/check.mjs");
	format();
} else {
	console.error(`repo: unknown subcommand "${sub}" (init|apply|verify|check|test|format|urls)`);
	process.exit(1);
}
