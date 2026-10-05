# What We Are Exploring

## Open questions

### 1. Does the MCP server expose useful tools?

We need to see what tools EmDash ships out of the box.
That determines whether agents can manage projects/assemblies/parts through it,
or whether we need to add custom MCP tools on top.

Status: **resolved** — 33 tools available (content, schema, media, taxonomy, menus, revisions).
Run `mise run mcp:token-admin` to generate the token.
`scripts/get-mcp-token.mjs` handles the dev-bypass session auth via Node fetch.

### 2. Does the plugin field widget wire up?

`plugins/plat-trunk/src/admin/index.tsx` provides a geometry panel
(`contentEditorPanels`), rendered in the Parts editor sidebar.
`config/site.astro.config.mjs` registers it via `platTrunkPlugin()`.

Status: **resolved** — native plugin + content editor panel verified in the admin
(Part number / Material shown for a seeded part). `fieldWidgets` itself is
undocumented in emdash 1.1.0, so the documented editor-panel surface is used.

### 3. Can the two MCP surfaces unify?

EmDash content tools + geometry tools as one agent tool surface.
This is the key architectural question for the RICOS integration and for Claude Code.

Status: **not started** — depends on question 2

## What is working

- EmDash runs locally via `mise run server:start` (or `mise run pitchfork:start` for daemon mode)
- CAD collections seeded from `config/cad.seed.json` (merged into the site seed, auto-applied on first request)
- Admin UI accessible at http://localhost:4321/_emdash/admin/
- Schema builder works — collections visible in sidebar
- Revision history, draft/publish, media library all functional
- MCP auth working: `mise run mcp:token-admin` → `run/token-admin.txt` + `run/token-admin.env`

## What is broken or messy

- Plugin registered — geometry panel renders in the Parts editor
