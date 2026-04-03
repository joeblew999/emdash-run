# emdash-run

README.md is the source of truth for setup order, daily workflow, and recovery steps.

## Rules

- Use mise for all tasks. Use pitchfork to manage daemons. Keep them in sync.
- Dogfood everything — run it yourself and verify it works before declaring done.
- Read `docs/adr/` before making structural changes.
- Read `emdash/.claude/CLAUDE.md` for EmDash-specific guidance (hooks, schema, MCP).

## Tools

**MCP — prefer these over CLI:**
- EmDash MCP: read/write content, schema, media, taxonomy
- Playwright MCP: validate the admin UI in the browser

**Skills** — automatically loaded from `.claude/skills/`:
- On a fresh clone: `mise run skills:add:all` (restores marketplace skills + symlinks emdash skills)

**Schema references:**
- https://mise.jdx.dev/schema/mise.json
- https://pitchfork.jdx.dev/schema.json
