# emdash-run

[![stages](https://github.com/joeblew999/emdash-run/actions/workflows/stages.yml/badge.svg)](https://github.com/joeblew999/emdash-run/actions/workflows/stages.yml)

**The stages of working on an [EmDash](https://docs.emdashcms.com) site, as a few `mise` tasks.**

Each task is EmDash's own commands in the right order: its scaffolder, its dev server, its CLI.
There is no script underneath and nothing is copied into your repo.

> **Being rebuilt.** Until 2026-10-07 this repo was a nushell harness; release 0.6.1 is that, and is
> no longer developed (it is kept in [`reference/nushell-harness/`](reference/nushell-harness/)).
> What is below is what exists today. What is coming is in
> [`docs/plans/2026-10-07-stages.md`](docs/plans/2026-10-07-stages.md).

## Use it in your repo

You need [mise](https://mise.jdx.dev). Put this in a `mise.toml`:

```toml
[settings]
experimental = true

[task_config]
includes = ["git::https://github.com/joeblew999/emdash-run.git//tasks.toml?ref=main"]
```

Then:

```
mise run site:new -- cloudflare:blog   a site, once — or node:blog, cloudflare:starter, …
mise run site:start                    install, make its key if it has none, check the seed, run it in the background
mise run emdash -- content list posts  anything else, through EmDash's own CLI
mise run site:logs                     follow the running site's log
mise run site:stop
mise run site:delete                   remove site/ again — it asks first
```

After `site:start`, open
`http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`. That is EmDash's own
development sign-in: the first time, it sets the site up with the template's sample content.

## Choosing a template

`<platform>:<template>` — the way EmDash's scaffolder spells it.

| | `blog` | `starter` | `marketing` | `portfolio` |
|---|---|---|---|---|
| **Cloudflare** — Workers, D1, R2 | `cloudflare:blog` | `cloudflare:starter` | `cloudflare:marketing` | `cloudflare:portfolio` |
| **Node.js** — SQLite file, local uploads | `node:blog` | `node:starter` | `node:marketing` | `node:portfolio` |

Say it as an argument, `mise run site:new -- node:blog`, or set `TEMPLATE = "node:blog"` under
`[env]` in your `mise.toml`. With neither you get `cloudflare:blog`. A name that is not in the table
is refused and nothing is made.

## Settings

Both optional, under `[env]` in your `mise.toml`:

| setting | default | what it does |
|---|---|---|
| `TEMPLATE` | `cloudflare:blog` | what `site:new` makes when it is given no argument |
| `SITE_PORT` | `4321` | the port the site runs on — give each project its own to run several at once |

## What is proven

On every push that changes the tasks, [`stages.yml`](.github/workflows/stages.yml) starts from an
empty folder holding only the `mise.toml` above and runs the commands a developer types — on
**macOS, Linux and Windows**, on a Cloudflare and on a Node.js template:

- `site:new`, by a setting and by an argument; the right platform comes out; a wrong name is refused
- `site:start`; the site answers; EmDash's sign-in sets it up
- `emdash`, with a flag and with a quoted argument that contains spaces
- `site:start` again leaves the running site alone; `site:stop` stops it
- `site:delete` refuses without a yes and deletes with one

## What to know

- **A project pointing at `main` does not update by itself.** mise keeps the first copy it fetched.
  Point at a tag and change the tag to update; or add `task.remote_no_cache = true` under
  `[settings]` to fetch every time (about a second per command); or run `mise cache clear` once.
- **In CI, `site:delete` does not ask.** mise answers every prompt with yes when `CI` is set.
- **The EmDash version is your site's**, in `site/package.json` and its lockfile — not a setting here.
- **Everything else is EmDash's.** Its scaffolder gives the site the agent skills
  (`site/.agents/skills/`), the docs MCP config and an encryption key in a gitignored `.env`.

## Not here yet

Checking before a commit, keeping the admin and the repo in step, plugins, deploying, backups and
updating EmDash. The plan has each as a stage, with the EmDash command behind every step and the
gaps that are known: [`docs/plans/2026-10-07-stages.md`](docs/plans/2026-10-07-stages.md).

## This repo

It uses its own tasks: `site/` here was made by `mise run site:new`, and `mise.toml` includes
`tasks.toml` from beside it. Working on the tasks themselves: [`docs/agents/README.md`](docs/agents/README.md).
