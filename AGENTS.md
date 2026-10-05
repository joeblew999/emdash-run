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
- **After a change, `mise run repo:apply`.** It is the quick end-to-end check — re-applies
  config, relinks plugins, restarts the site, mints the MCP token. It is *not* proof of
  correctness: for user-facing changes, also verify the actual behaviour (admin UI, MCP
  call, HTTP response).
- Read `docs/plans/` before structural changes (closed plans in `docs/plans/done/`, including the former ADRs).
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
(`mise run src:clone-emdash`) — read EmDash's own source when the published types/docs are
not enough. It is not part of the default flow and is not installed.

The one rule that matters: **never edit anything under `.src/`** — it is generated from
`config/` and the template, and gets overwritten by `config:apply` / `site:sync`. Change
`config/` and re-run `mise run repo:apply`.

## Tools

**MCP servers** — use these instead of shelling out where they apply:
- `mise` — run tasks, inspect tools/env/config. Registered in `.claude/settings.json`.
- `emdash` — read/write content, schema, media, taxonomy (see `.mcp.json`).
- `playwright` — drive the admin UI in a real browser.

**Skills** — the EmDash ones are essential, and they are **vendored, committed files** at
`.github/skills/` (`building-emdash-site`, `creating-plugins`, `emdash-cli`, each with a
`references/` tree). Read them before working on EmDash; they cover the CLI, the seed and
export formats, the database layout, and the plugin model.

- They are vendored rather than symlinked because **skills are discovered when a session
  starts**. A symlink lives in `.claude/skills/`, which is gitignored, so on a fresh clone it
  does not exist yet — and an agent that starts before anyone runs `skills:sync` has *no*
  EmDash knowledge and will rediscover `export-seed`, `site import` and the file-vs-D1
  database trap by trial and error. That is not a hypothetical: it happened.
- `mise run skills:sync` refreshes both the vendored copy and the `.claude/skills/emdash`
  symlink (kept for Claude Code; gitignored, because it points into `.src/`). `apply` runs it.
- `mise run skills:check` fails if the committed copy has drifted from what the site ships.
  `repo:check` runs it.
- Separately, `skills add`-installed skills (currently just `mise-guide`) are **not** vendored
  — they are reproducible from `skills-lock.json` via `mise run skills:add-all`.

**Schema references:** https://mise.jdx.dev/schema/mise.json · https://pitchfork.jdx.dev/schema.json
