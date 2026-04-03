# emdash-run

**Read README.md first.** It is the source of truth for all mise commands — bootstrap, daily workflow, and recovery. Do not guess commands; look them up there.

## Rules

- **All tasks run via mise.** Never use raw CLI commands (curl, bash, pnpm, etc.) directly — always use a mise task. This ensures Claude and all devs do things the same way.
- Use pitchfork to manage daemons. Keep mise tasks and pitchfork in sync.
- Dogfood everything — **actually run it via mise and verify the output**. Reasoning about it is not validation. Never declare something done without executing it.
- **After every change, run `mise run apply`.** If it exits cleanly, the system is working. Do not add extra validation steps.
- Read `docs/adr/` before making structural changes.
- Read `emdash/.claude/CLAUDE.md` for EmDash-specific guidance (hooks, schema, MCP).

## Tools

**MCP — use these to run mise tasks and interact with services. Never shell out directly:**
- mise MCP: run tasks, inspect tools/env/config (`mise mcp` — registered in `.claude/settings.json`)
- EmDash MCP: read/write content, schema, media, taxonomy
- Playwright MCP: validate the admin UI in the browser

**Skills** — automatically loaded from `.claude/skills/`:
- On a fresh clone: `mise run skills:add:all` (restores marketplace skills + symlinks emdash skills)
- To see all available tasks: `mise tasks ls` — always up to date. Do not maintain a static task list.
- Task ordering matters. The correct sequence is:
  1. **Once:** `mise run server:build` → `mise run init` → `mise run apply`
  2. **Every change:** `mise run apply`

**Schema references:**
- https://mise.jdx.dev/schema/mise.json
- https://pitchfork.jdx.dev/schema.json
