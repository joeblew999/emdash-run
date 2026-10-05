#!/usr/bin/env node
/**
 * `mise run apply` — the daily command. Restarts the site daemon and refreshes the MCP
 * token. Dependencies (config:apply, plugins:link, skills:sync:emdash) are declared in
 * mise.toml; this does the restart-and-verify part.
 *
 * Stops ONLY the site: optional daemons (registry, plugins-site) must survive, because
 * the site's plugin discovery points at the local registry while it is running.
 */
import { rmSync } from "node:fs";

import { env, run, sh } from "./lib/exec.mjs";

const SITE_DIR = env("SITE_DIR");

sh("pitchfork stop emdash || true");
// The Vite optimizer re-hashes chunks whenever the dependency graph changes (a plugin's
// admin module, a production build in the same dir), leaving the server serving stale
// `deps_ssr/*?v=…` URLs and returning 500s.
rmSync(`${SITE_DIR}/node_modules/.vite`, { recursive: true, force: true });

// pitchfork waits for ready_http (pitchfork.toml) before returning, so the site is
// already serving by the time we get here.
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
