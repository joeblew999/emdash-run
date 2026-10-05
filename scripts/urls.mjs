#!/usr/bin/env node
/** `mise run urls` — print every URL this project serves. */
console.log(`Host site
  admin      http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
  mcp        http://localhost:4321/_emdash/api/mcp   (Bearer: run/token-admin.txt)

Optional daemons — start with: mise run registry:up / mise run plugins-site:up
  registry   http://localhost:8788/health   (JSON API under /xrpc/com.emdashcms.experimental.aggregator.*)
             note: / 308-redirects to https://plugins.emdashcms.com/ — there is no local page
  plugins UI http://localhost:4330/

Live         https://emdash-run.gedw99.workers.dev`);
