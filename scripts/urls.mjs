#!/usr/bin/env node
/** `mise run urls` — print every URL this project serves. Addresses come from [env]. */
const REGISTRY_URL = process.env.REGISTRY_URL ?? "http://localhost:8788";
const PLUGINS_SITE_URL = process.env.PLUGINS_SITE_URL ?? "http://localhost:4330";

console.log(`Host site
  admin      http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
  mcp        http://localhost:4321/_emdash/api/mcp   (Bearer: run/token-admin.txt)

Optional daemons — start with: mise run registry:up / mise run plugins-site:up
  registry   ${REGISTRY_URL}/health   (JSON API under /xrpc/com.emdashcms.experimental.aggregator.*)
             note: / 308-redirects to https://plugins.emdashcms.com/ — there is no local page
  plugins UI ${PLUGINS_SITE_URL}/

Live         https://emdash-run.gedw99.workers.dev`);
