#!/usr/bin/env node
/**
 * `mise run repo:init | repo:apply | repo:urls` — repo-level lifecycle.
 *
 *   init   one-time after site:setup; the real work is in `depends` (plugin:install-all,
 *          skills:add-all), which mise runs first
 *   apply  the daily command: restart the site and refresh the MCP token
 *   urls   print every URL this project serves
 */
import { rmSync } from "node:fs";

import { env, run, sh } from "./lib/exec.mjs";

const SITE_DIR = env("SITE_DIR");
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
	console.log("⏳ waiting for the site to be ready...");
	for (let i = 0; i < 60; i++) {
		const res = await fetch("http://localhost:4321/_emdash/api/setup/dev-bypass", { method: "POST" }).catch(() => null);
		if (res?.status === 200) break;
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	run("mise", ["run", "mcp:token-admin"]);
	console.log("→ admin:  http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin");
	console.log("→ mcp:    http://localhost:4321/_emdash/api/mcp (Bearer: run/token-admin.txt)");
	console.log("✓ apply done");
} else if (sub === "urls") {
	const registryUrl = process.env.REGISTRY_URL ?? "http://localhost:8788";
	const pluginsSiteUrl = process.env.PLUGINS_SITE_URL ?? "http://localhost:4330";
	console.log(`Host site
  admin      http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
  mcp        http://localhost:4321/_emdash/api/mcp   (Bearer: run/token-admin.txt)

Optional daemons — start with: mise run registry:up / mise run plugins-site:up
  registry   ${registryUrl}/health   (JSON API under /xrpc/com.emdashcms.experimental.aggregator.*)
             note: / 308-redirects to https://plugins.emdashcms.com/ — there is no local page
  plugins UI ${pluginsSiteUrl}/

Live         https://emdash-run.gedw99.workers.dev`);
} else {
	console.error(`repo: unknown subcommand "${sub}" (init|apply|urls)`);
	process.exit(1);
}
