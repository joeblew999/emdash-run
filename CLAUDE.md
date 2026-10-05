# emdash-run

**Read README.md first.** It is the source of truth for all mise commands — boot
strap, daily workflow, and recovery. Do not guess commands; look them up there.

## Rules

- **All tasks run via mise.** Never use raw CLI commands (curl, bash, pnpm, etc.)
  directly — always use a mise task. This ensures Claude and all devs do things
  the same way.
- Use pitchfork to manage daemons. Keep mise tasks and pitchfork in sync.
- Dogfood everything — **actually run it via mise and verify the output**. Reasoning
  about it is not validation. Never declare something done without executing it.
- **After every change, run `mise run apply`.** If it exits cleanly, the system
  is working. Do not add extra validation steps.
- Read `docs/adr/` before making structural changes.
- Read `.src/site/.claude/CLAUDE.md` for EmDash-specific guidance (hooks, schema,
  MCP) once the site is built. The site is an official template, not the monorepo.

## Layout (see ADR-0007)

- `.src/templates/` — clone of `emdash-cms/templates`
- `.src/site/` — the host site (copy of `starter-cloudflare`); runs on `:4321`
  (`.src/` is gitignored; rebuild with mise tasks, never edit by hand)
- `config/` — our overrides, written into `.src/site` by `config:apply`
- `plugins/` — local plugins, symlinked into `.src/site/node_modules` by `plugins:link`

Do **not** edit files under `.src/site` directly — they are overwritten by
`config:apply` / `site:sync`. Change `config/` instead.

## Tools

**MCP — use these to run mise tasks and interact with services. Never shell out
directly:**
- mise MCP: run tasks, inspect tools/env/config (`mise mcp` — registered in `.claude/settings.json`)
- EmDash MCP: read/write content, schema, media, taxonomy
- Playwright MCP: validate the admin UI in the browser

**Skills** — automatically loaded from `.claude/skills/`:
- On a fresh clone: `mise run skills:add:all` (restores skills from `skills-lock.json` + symlinks the site's EmDash skills)
- To see all available tasks: `mise tasks ls` — always up to date. Do not maintain a static task list.
- Task ordering matters. The correct sequence is:
  1. **Once:** `mise run server:build` → `mise run init` → `mise run apply`
  2. **Every change:** `mise run apply`

**Schema references:**
- https://mise.jdx.dev/schema/mise.json
- https://pitchfork.jdx.dev/schema.json
