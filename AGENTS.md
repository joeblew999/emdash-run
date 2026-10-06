# emdash-run

**`mise.toml` is the source of truth** for tasks and workflow: read its QUICK REFERENCE
block at the top, and use `mise tasks ls` for the full list. Never keep a second copy of
the task list anywhere — duplicated lists drift from the tasks they describe. README.md
is orientation only.

**Files that must agree** — `mise.toml` is the source of truth for all of them:

- `pitchfork.toml` — every `run` in it is `mise run <task>`; the task must exist in `mise.toml`.
  It says *when* the daemons run, `mise.toml` says *what* they are. `mise run repo:sync` fails if
  a task named there is missing (and `repo:check` composes it), so the two cannot drift apart
  silently.
- `.mcp.json` — its `${EMDASH_MCP_TOKEN}` is the file `mcp:token-admin` writes and `[env]` loads.
- this file — if a rule changes in `mise.toml`, change it here too.

Never keep a second copy of the task list anywhere; duplicated lists drift from the tasks they
describe.

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

## Tasks

**There are no scripts.** `mise.toml` is the interface *and* the implementation: every task body is
**nushell** (`[task_config] shell`), not POSIX sh, so the whole thing is one file and behaves the
same on every machine.

- run the task, never re-derive the steps by hand;
- **a task body beats a helper file.** `cp`, `rm`, `git`, `pnpm`, `curl` and `emdash` need no
  wrapper — mise already provides the argument parser (`usage`), the working directory (`dir`), the
  runner, and `sources`/`outputs` for skipping work already done. The `scripts/` tree was 16 files
  and 1975 lines, most of it `process.argv[2]` dispatch into a handful of shell lines; **all of it
  is gone.** Eight tasks that relayed to subcommands their script never implemented were fixed — a
  relay that does not relay is worse than none;
- the logic that did need a real language is nushell now, and where it replaced something subtle the
  port was proved equivalent first: the seed merge emits byte-identical JSON, and the
  deployed-schema diff produces identical output, both checked by diffing against the old code
  before deleting it;
- **nushell specifics that bite.** Environment variables are `$env.VAR`, including usage arguments
  (`$env.usage_<name>`). Inside `$"...($x)..."` parentheses are **subexpressions**, so a literal
  `(text)` in a message must be phrased around — `token(s)` fails as "Command `s` not found", and
  that has bitten three times here. A regex in a double-quoted string is a parse error
  (`\s`), so regexes go in single quotes; in TOML a block containing `\s` needs `'''`, since `"""`
  rejects the escape. `insert` errors on an existing column and `upsert` is the overwrite. A
  closure cannot capture a `mut` binding, so copy it into a `let` first;
- there is no `set -e`: a failing external command does not abort the body, so check
  `$env.LAST_EXIT_CODE` for the ones you care about and exit non-zero yourself.

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
  Use **`browser_run_code_unsafe`**, not the individual click tools. The integrated browser's
  window is fixed (~1080×1800) and its viewport will not scroll, so anything below the fold is
  unclickable — every click is rejected with "element is outside of the viewport", and
  `scrollIntoViewIfNeeded`, `dispatchEvent`, `focus()`+`Enter` and JS `.click()` all do nothing.
  The Playwright MCP browser launches its own browser, where `page.setViewportSize()` works:

  ```js
  await page.setViewportSize({ width: 1400, height: 4000 });  // tall enough for the whole form
  await page.goto('http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin');
  const btn = page.getByRole('button', { name: 'Geometry' });  // returns 3 — pick the one whose aria-expanded is not null
  await btn.nth(1).click();
  ```

  `browser_take_screenshot({ fullPage: true })` then captures the below-fold panels, which is the
  only way to see them.

  **When checking whether a panel loaded, grep the right endpoint.** A saved-entry panel fetches
  through the HOST, not the plugin's own route:

  ```
  POST /_emdash/api/content/<collection>/<entry-id>/plugin-extensions/<plugin-id>
  ```

  Grepping `/_emdash/api/plugins/…` finds nothing and looks exactly like a panel that never
  loaded. That mistake produced a confident, wrong conclusion here — the panel had worked all
  along.

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
