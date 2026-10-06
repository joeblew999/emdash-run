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
| **Model content** | Collections, fields, taxonomies, menus. `mise run emdash -- schema …`, or the admin. `mise run schema:diff -- --url <url>` shows how a deployment differs from the repo. |
| **Seed it** | `mise run dev` merges the template's seed with your project's and lands *edits* in the running database, in place. `seed:export` reads it back. |
| **Write content** | `mise run content:set -- <collection> <entry> <json>`, or the whole `emdash content` surface. |
| **Write plugins** | `mise run plugin:new -- <name>` scaffolds one with the official CLI, fits it to the site, loads it, and has the running site call it. `plugin:roundtrip` proves that whole path with a throwaway plugin. |
| **Deploy, then verify** | `mise run deploy` refuses to ship if `check` fails, builds, ships to Cloudflare, and verifies what is live. `mise run rollback` puts the previous version back. |
| **Back up and restore** | `mise run snapshot` — the whole site, schema **and** content, as a `.emdash` package. `mise run restore -- <package> --wipe --confirm` puts it back locally. |
| **Drive it from an agent** | EmDash's MCP endpoint with scoped tokens, plus mise's MCP server for the tasks. |

## Where to start

```
mise run setup       first time: template, install, config — then the site is up
mise run dev         after any change: config, seed, plugins, restart, URLs
mise run check       before a commit — the git hook runs it          --fix repairs
mise run doctor      is the running site what the repo says?         --url <deployment>
mise run deploy      check, build, ship to Cloudflare, verify        --dry
mise run plugin:new -- <name>     scaffold a plugin and load it into the running site
mise run emdash -- <anything>     the official CLI
```

`mise tasks ls` lists all 26. Each is a **flow** — one command for one job — and
[`docs/tasks.md`](docs/tasks.md) is the same list, generated.

## How it is put together

```
mise.toml    settings and task names — 230 lines
nu/          the logic, in nushell: one command per task, shared helpers, unit tests
config/      our site config and this project's seed, applied over the template by `dev`
plugins/     local plugins — empty until you run plugin:new
.src/        gitignored checkouts: the template, the site, the EmDash source
docs/        agents/ (how to work here), tasks.md (generated), plugin.md, auth.md, plans/
```

Everything is built on the two official CLIs and the official template. The harness adds only
what they leave to you: getting config and a seed into a template, loading a plugin into a running
site, checking that what is live matches the repo.

## Pointing it at your own project

Every value that names a project is in the **PROJECT SETTINGS** block of `mise.toml`: the template,
the EmDash version, the deploy URL, your seed, who your plugins are from, and what `doctor` should
assert about your content. Each `doctor` setting is optional — leave it empty and that check is
skipped. `nu/` never names a project.

## Where to look

- [`docs/agents/README.md`](docs/agents/README.md) — how to work here: the rules, the checks, the tools
- [`docs/agents/nushell.md`](docs/agents/nushell.md) — working in `nu/`: the shape, the helpers, the traps
- [`docs/tasks.md`](docs/tasks.md) — every task, with its dependencies (generated)
- [`docs/plugin.md`](docs/plugin.md) — plugins: the scaffold-to-running round trip, and what the scaffold gets wrong
- [`docs/auth.md`](docs/auth.md) — EmDash's auth model and our token strategy
- [`docs/plans/`](docs/plans/) — what is left · [`done/`](docs/plans/done/) — closed
- [`docs/plugin-catalog/`](docs/plugin-catalog/) — generated from the registry

**What is still one project's.** The seed in `config/cad.seed.json` and the R2 cross-check in
`doctor` come from the project this started on. They work, and they are the example of "your
project's seed" — but they are the part to replace. [`docs/plans/`](docs/plans/) tracks making
that clean.
