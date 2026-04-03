# What We Are Exploring

## Open questions

### 1. Does the MCP server expose useful tools?

We need to see what tools EmDash ships out of the box.
That determines whether agents can manage projects/assemblies/parts through it,
or whether we need to add custom MCP tools on top.

Status: **resolved** — 33 tools available (content, schema, media, taxonomy, menus, revisions).
Run `mise run mcp:token-admin` to generate the token, then `mise run claude:gen-permissions`
to write all tool names into `.claude/settings.local.json`.
`scripts/get-mcp-token.mjs` handles the dev-bypass session auth via Node fetch.

### 2. Does the plugin field widget wire up?

`plugin/src/admin.tsx` is the geometry preview widget.
`config/astro.config.mjs` does not yet import or register it.
The widget renders geometry metadata inline in the Parts editor.

Status: **not started**

### 3. Can the two MCP surfaces unify?

EmDash content tools + geometry tools as one agent tool surface.
This is the key architectural question for the RICOS integration and for Claude Code.

Status: **not started** — depends on question 2

## What is working

- EmDash runs locally via `mise run server:start` (or `mise run pitchfork:start` for daemon mode)
- CAD collections created via `mise run server:setup` (projects, assemblies, parts)
- Admin UI accessible at http://localhost:4321/_emdash/admin/
- Schema builder works — collections visible in sidebar
- Revision history, draft/publish, media library all functional
- MCP auth working: `mise run mcp:token-admin` → `run/token-admin.txt` + `run/token-admin.env`
- Playwright auth working: `mise run playwright:auth` → `run/cookies-playwright.txt`
- Claude Code permissions auto-generated: `mise run claude:gen-permissions` → `.claude/settings.local.json`

## What is broken or messy

- Plugin not wired into `config/astro.config.mjs` yet
