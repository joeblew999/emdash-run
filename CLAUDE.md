# emdash-run

**`mise.toml` is the source of truth** for tasks and workflow: read its QUICK REFERENCE
block at the top, and use `mise tasks ls` for the full list. Never keep a second copy of
the task list anywhere — duplicated lists drift from the tasks they describe. README.md
is orientation only.

## Rules

- **Prefer mise tasks over raw commands.** If a task exists for what you are doing, use it
  (`mise run …`) instead of re-deriving the steps by hand. Raw commands are fine for what
  no task covers — `git`, ad-hoc inspection, one-off probes.
- **Daemons are pitchfork's job** (`pitchfork.toml`). The task pitchfork runs is
  `site:dev`; keep it in sync with the daemon definition.
- **Dogfood: run it and read the output.** Reasoning about a change is not validation.
  Never call something done without executing it and looking at the result.
- **After a change, `mise run apply`.** It is the quick end-to-end check — re-applies
  config, relinks plugins, restarts the site, mints the MCP token. It is *not* proof of
  correctness: for user-facing changes, also verify the actual behaviour (admin UI, MCP
  call, HTTP response).
- Read `docs/adr/` before structural changes.
- EmDash API questions (hooks, schema, seed, CLI, plugin authoring): read the skills
  shipped with the site at `.claude/skills/emdash/` — `building-emdash-site`,
  `creating-plugins`, `emdash-cli`. The site is an official template, not the monorepo.

## Tasks and scripts

`mise.toml` is the interface; `scripts/*.mjs` are the implementation. Every script in
`scripts/` is called by a task — so:

- run the task, never the script directly;
- don't inline non-trivial logic into `mise.toml`; put it in `scripts/` and call it from
  a task;
- the mapping is discoverable: `grep -o 'scripts/[^"]*' mise.toml`.

## Layout

Paths and what is generated are mapped in `README.md` (§ "Where things are").

`.src/emdash/` is an **optional** shallow clone of the emdash monorepo
(`mise run src:clone:emdash`) — read EmDash's own source when the published types/docs are
not enough. It is not part of the default flow and is not installed.

The one rule that matters: **never edit anything under `.src/`** — it is generated from
`config/` and the template, and gets overwritten by `config:apply` / `site:sync`. Change
`config/` and re-run `mise run apply`.

## Tools

**MCP servers** — use these instead of shelling out where they apply:
- `mise` — run tasks, inspect tools/env/config. Registered in `.claude/settings.json`.
- `emdash` — read/write content, schema, media, taxonomy (see `.mcp.json`).
- `playwright` — drive the admin UI in a real browser.

**Skills** load from `.claude/skills/`:
- `.claude/skills/emdash` — symlink to the site's shipped EmDash skills, refreshed by
  `mise run skills:sync:emdash` (which `apply` runs).
- On a fresh clone: `mise run skills:add:all` restores skills from `skills-lock.json`.

**Schema references:** https://mise.jdx.dev/schema/mise.json · https://pitchfork.jdx.dev/schema.json
