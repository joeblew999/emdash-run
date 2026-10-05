#!/usr/bin/env node
/**
 * `mise run repo:init | repo:apply | repo:urls` — repo-level lifecycle.
 *
 *   init   one-time after site:setup; the real work is in `depends` (plugin:install-all,
 *          skills:add-all), which mise runs first
 *   apply  the daily command: restart the site and refresh the MCP token
 *   verify assert the RUNNING site matches what this repo claims (content, the model_id
 *          join, and snapshot drift against the real objects in R2)
 *   urls   print every URL this project serves
 */
import { rmSync } from "node:fs";

import { env, run, sh } from "./lib/exec.mjs";
import { verify } from "./lib/verify.mjs";

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

	// dev-bypass also runs migrations and applies the seed on the first request, so poll it
	// until it answers before minting the MCP token.
	//
	// Note it applies with skip-on-conflict: an entry that already exists is left alone. So
	// this picks up NEW seed content but never EDITS to existing content — for those you
	// have to empty the D1 first (`mise run seed:apply`).
	console.log("⏳ waiting for the site to be ready...");
	for (let i = 0; i < 60; i++) {
		const res = await fetch(`${SITE_URL}/_emdash/api/setup/dev-bypass`, { method: "POST" }).catch(() => null);
		if (res?.status === 200) break;
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

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
	await verify();
} else {
	console.error(`repo: unknown subcommand "${sub}" (init|apply|verify|urls)`);
	process.exit(1);
}
