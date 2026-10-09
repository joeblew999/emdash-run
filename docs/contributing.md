---
title: How to help
nav_order: 6
has_children: true
---

# How to help

## Report a bug

[Open an issue](https://github.com/joeblew999/emdash-run/issues/new/choose) with the task exactly as you ran it and everything it printed: the first lines say where it was acting. Check [Upstream issues](upstream.md) first. From a terminal: `mise run issue -- bug` prints the form to fill in.

## Set up

```sh
git clone https://github.com/joeblew999/emdash-run && cd emdash-run
mise trust && mise install
mise run dev:hooks                # every commit then runs the commit check
mise run dev:test --level smoke   # the basics, half a minute
```

## The tasks of this repo

[The tasks for working on this repo](reference/dev-tasks.md), written from the tasks themselves. `mise run dev:test --help` shows the levels and flags of the test.

## The test

```sh
mise run dev:test --level smoke                             # the unit tests, and a dev site that starts and answers
mise run dev:test                                           # the level fast: the everyday steps of every group
mise run dev:test --level all                               # every step, the long ones too
mise run dev:test:plugin --level all --only plugin:demo     # one group, and only the steps named
mise run dev:ci --level smoke                               # the same task on GitHub: Linux, macOS, Windows
```

What each task and level is: [its description](reference/dev-tasks.md#devtest). What the descriptions do not say:

- **The levels smoke and fast work on one test site that is kept, and kept running**, between runs: a copy of `site/` in `~/.cache/emdash-run/bench`, made again when `site/` changes; with `--node`, a site made from `node:starter` in `bench-node`. A step then costs what its task costs. The groups take it in turn.
- **The level all starts from nothing**: each group in a temporary folder of its own, removed at the end. Only there are the steps that stop, empty and delete a site, and the long ones, `site:check`, `site:seed`, `site:demo`, `plugin:demo` and `plugin:new` among them.
- **A whole group run at the level all** leaves Node's report of it in `tests/<group>/last-run.txt`, which [What the tests showed](reference/tests.md) is written from: run `mise run docs:setup` after it and commit both. A smoke or fast run, a run with `--only` and a run on GitHub leave none, so `mise run check` changes no file.
- **The live group** deploys to a Worker kept for it, and is not part of `dev:test`: `mise run dev:test:live`.
- **On GitHub** a push to `main` that touches the tasks, the scripts, the tests or `site/` runs the level smoke, and a release tag the level all. Not run there at any level: the two `signin:open` steps, which need a screen, the live group, and the Node site (`--node`). What has passed there: [Getting started](getting-started.md).

## The site in this repo

`site/` is a real site, made from EmDash's `cloudflare:blog` template and committed: the place to try a task or a plugin in seconds, without making a site first. What is the machine's stays out of git: its packages, its `.env`, its local database.

Added to the template, so that `plugin:demo` has something to show a visitor: French as a second language (`/fr/`), the two packages that draw the forms plugins' blocks, LinguaDash's language switcher, and `src/middleware.ts` ([Upstream issues](upstream.md)).

```sh
mise run site:ports     # once: ports of its own for this clone
mise run site:start     # the dev site; open /_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
mise run site:demo      # something in every core feature, on the built site
mise run plugin:demo    # seven registry plugins, each doing its real thing
mise run site:status    # where it is now
```

French there is the home page and the posts: `/fr/` and `/fr/posts/<slug>`. Menus, widgets and the words of the layout stay English, and the one post in French is the one `plugin:demo` makes.

The test works on a copy of `site/`, so the site you are looking at and its local database are not touched.

## How it is built

Each file's first lines say what it is; this is only where to look.

| Path | What is there |
|---|---|
| `tasks.toml` | The front door: every task another repo gets, as its name, its `description` (which is its documentation), its flags, and one line that runs `scripts/core/cli.mjs`. No logic |
| `scripts/core/cli.mjs`, `graph.mjs` | The one entry, and the graph: a task is a state to reach, standing on other states. `plan` and `reach` |
| `scripts/core/site.mjs`, `signin.mjs`, `tasks.mjs` | The states: a site on this machine, signing in, every other task |
| `scripts/core/seed.mjs`, `demo.mjs`, `plugin-demo.mjs` | `site:seed` section by section, `site:demo`'s list of features, `plugin:demo`'s recipe for each plugin |
| `scripts/core/api.mjs`, `emdash-client.mjs` | How `site:seed` and `site:demo` speak to a site: EmDash's own client (`emdash/client`, loaded from the site's packages) where it has a call, and a typed request where it has none |
| `scripts/core/emdash-api.d.ts`, `emdash-requests.d.ts`, `emdash-seed.d.ts` | The types: EmDash's requests, written by `mise run dev:api-types`; where that list and the site differ, by hand; a seed file, by hand |
| `scripts/core/world.mjs` | Everything outside the program: a command, a request, a file. A state reaches outside through it only, so a unit test gives it a made-up one |
| `scripts/*.mjs` | The work where EmDash has no command of its own, as functions the states call: `signin-*.mjs`, `plugin-*.mjs`, `live-*.mjs`, `emdash.mjs` |
| `seeds/demo.json` | The seed file `site:demo` applies |
| `tests/core/` | The unit tests of `scripts/core/`, on a made-up outside and a made-up EmDash |
| `tests/<group>/steps.mjs`, `tests/both/` | The steps: each runs a task on a real site. A group to a set of tasks (`site`, `signin`, `plugin`, `live`); `both` holds the steps run on this machine and on a deployed site |
| `tests/lib/`, `tests/run.mjs` | What a step is written with, and what the `dev:test` tasks run |
| `dev.toml` | This repo's own tasks |
| `.github/workflows/stages.yml` | Runs `dev:test` at a level on Linux, macOS and Windows |

Limits of that design, as the code is now:

- **The scripts beside `scripts/core/` are type-checked, and all but two are tested only by running their task on a real site.** The two with unit tests: the edits to a site's config (`plugin-astro-config.mjs`) and the reading of a release's permissions (in `plugin-api.mjs`). The rest, `signin-access.mjs`, `signin-browser.mjs`, `live-preview.mjs`, `plugin-install.mjs`, `plugin-works.mjs`, `plugin-sandbox.mjs` and `emdash.mjs` among them, reach outside by themselves, not through `world.mjs`.
- **Only `site:seed` and `site:demo` send typed requests.** `plugin:demo`, the registry plugin tasks and `site:status` send requests of their own, written by hand and not checked against EmDash's list.
- **No script starts `mise`.** One state asks for another through the graph, in the same process; `plugin-works.mjs` starts the entry again, as a process of its own, for the tasks it checks with.
- **The site's own tools (astro, emdash, wrangler) are run by Node directly**, not through `pnpm exec` ([Upstream issues](upstream.md)). Three places still use `pnpm exec` for them: a rebuild in `live-preview.mjs`, wrangler in `signin-access.mjs`, and `emdash login` in `signin-browser.mjs`. `plugin:check` and `plugin:publish` run a plugin's own `emdash-plugin` with it, in the plugin's folder.
- **The copy of EmDash's list of requests is refreshed by hand** after an EmDash upgrade: [`dev:api-types`](reference/dev-tasks.md#devapi-types) says how. `emdash:update` does not do it.

## Reading EmDash

- Its skills, in any scaffolded site: `site/.agents/skills/` (`emdash-cli`, `building-emdash-site`, `creating-plugins`).
- Its docs: the `emdash-docs` MCP server (`.mcp.json`).
- Its source, to read the code: `mise run dev:src` clones it into `.src/emdash` (`.src/` is ignored by git).

## Releases

```sh
mise run dev:ci --level all              # the level all, on three OSes
mise run dev:test:live                   # the deployed-site tasks, if a live: task changed
mise run release -- vX.Y.Z -dry-run      # says what it would do
mise run release -- vX.Y.Z               # check, tag, push, the GitHub Release with notes from the commits
```

`dev:ci --level all` has not been run yet, only the level smoke: [Getting started](getting-started.md) says what has passed, and where. `release` is charter's: it runs `mise run check` here and does not wait for GitHub. The `stages` workflow then runs the level all on macOS, Linux and Windows on the tag. What changed in a release is its notes on [the releases page](https://github.com/joeblew999/emdash-run/releases).
