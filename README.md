# emdash-run

**A reusable EmDash harness. Clone it, point it at your project, and work on every part of EmDash
from the command line.**

It runs the *real* published `emdash` — the real admin UI, the real plugin registry — and it deploys
to Cloudflare. Nothing here is a mock-up. Everything EmDash exposes is reachable from `mise run`:
schema, content, media, taxonomies, menus, search, seeds, migrations, whole-site export/import, and
plugins. Each task is either one official CLI command, or a workflow composed from several.

## What a developer can do with it

| | |
|---|---|
| **Run EmDash locally** | An official template (`starter-cloudflare`) against the published `emdash` package — admin UI, passkey auth, revisions, media library, schema builder — on `:4321`. |
| **Model content** | Collections, fields, taxonomies, menus. `mise run emdash -- schema …`, or the admin. `mise run schema:diff` shows how a deployment differs from the repo. |
| **Seed it** | `seed:build` merges the template's demo seed with your project's seed. `seed:apply` lands *edits* into the running site's D1, in place. |
| **Write content** | `mise run content:set -- <collection> <entry> <json>`, or the whole `emdash content` surface. |
| **Write plugins** | `mise run plugin:new -- <name>` scaffolds one with the official CLI, fits it to the site, loads it, and has the running site call it. `plugin:roundtrip` proves that whole path with a throwaway plugin. |
| **Deploy, then verify** | `mise run deploy` builds, ships to Cloudflare, and *proves* what is live matches the repo. |
| **Back up and restore** | `mise run snapshot` — the whole site, schema **and** content, as a `.emdash` package. `mise run restore -- <package>` puts it back into an empty site. |
| **Drive it from an agent** | EmDash's MCP endpoint with scoped tokens, plus mise's MCP server for the tasks. |

## Where to start

```
mise run setup     first time: clone the template, install, apply config, plugins, skills
mise run dev       every time: bring the site up and print every URL
mise run check     before a commit — and it is wired to git's pre-commit hook
```

`mise tasks ls` lists everything. [`docs/tasks.md`](docs/tasks.md) is the same list as
documentation, generated from `mise.toml` so it cannot drift.

## How it is put together

**`mise.toml` is the interface *and* the implementation.** There are no scripts: every task body is
nushell, so a task is one readable thing that behaves the same on every platform. mise supplies the
composition — `depends`, `usage` for typed arguments, `dir`/`env`, `sources`/`outputs` to skip work
already done, and `[daemons]` for the processes; nushell does the work.

```
mise.toml    the tasks, in two kinds: PRIMITIVES (one official CLI command, nothing invented)
             and WORKFLOWS (the jobs a developer does, composed from them)
config/      our config — astro.config, wrangler.jsonc, and this project's own seed
plugins/     local plugins — empty until you run plugin:new; registered with the site automatically
.src/        gitignored checkouts: templates/, site/, emdash/ (on demand)
docs/        agents/ (how to work here), tasks.md (generated), plugin.md, auth.md
.githooks/   the committed pre-commit hook — `mise run repo:hooks` points git at it
```

`mise run repo:urls` prints every URL it serves.

## Pointing it at your own project

Every value that names a project lives in one **PROJECT SETTINGS** block at the top of `[env]` in
`mise.toml`: the template, the EmDash version, the deploy URL, the site's daemon name, your seed
file, and the collection/field/bucket that `repo:verify` asserts. The tasks are
written against the official CLIs and the official template layout, so they do not change — that
block is the whole port.

## Where to look

- [`docs/agents/README.md`](docs/agents/README.md) — how to work here: the rules, the checks, the tools
- [`docs/agents/mise-nushell.md`](docs/agents/mise-nushell.md) — writing tasks: mise facts, nushell traps
- [`docs/tasks.md`](docs/tasks.md) — every task, with its dependencies (generated)
- [`docs/plugin.md`](docs/plugin.md) — plugins: the scaffold-to-running round trip, and what the scaffold gets wrong
- [`docs/auth.md`](docs/auth.md) — EmDash's auth model and our token strategy
- [`docs/plans/`](docs/plans/) — what is left · [`done/`](docs/plans/done/) — closed
- [`docs/plugin-catalog/`](docs/plugin-catalog/) — generated from the registry

**What is still one project's.** The seed in `config/cad.seed.json` and the R2 cross-check in
`repo:verify` come from the project this started on. They work, and they are the example of "your
project's seed" — but they are the part to replace. [`docs/plans/`](docs/plans/) tracks making
that clean.
