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

`plugin/src/admin.tsx` is the geometry preview widget.
`config/site.astro.config.mjs` does not yet import or register it.
The widget renders geometry metadata inline in the Parts editor.

Status: **not started**

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

- Plugin not wired into `config/site.astro.config.mjs` yet
