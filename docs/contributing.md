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
mise run dev:test --level smoke   # the basics, half a minute
```

Running a test turns on the commit check in your clone.

## The tasks of this repo

[The tasks for working on this repo](reference/dev-tasks.md), written from the tasks themselves. `mise run dev:test --help` shows the levels, groups and flags of the test.

## The site in this repo

`site/` is a real site, made with `mise run site:new` (the `cloudflare:blog` template) and committed: the place to try a task or a plugin in seconds, without making a site first. What is the machine's stays out of git: its packages, its `.env`, its local database.

```sh
mise run site:ports           # once: ports of its own for this clone
mise run site:start           # the dev site; open /_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
mise run plugin:favourites    # the favourite plugins into its local database
mise run plugin:works         # every plugin, one line per check
```

The test works on a copy of it in a temporary folder, so the site you are looking at and its local database are not touched.

## How it is built

Each file's first lines say what it is; this is only where to look.

| Path | What is there |
|---|---|
| `tasks.toml` | The front door: every task another repo gets, as its name, its `description` (which is its documentation), its flags, and one line. No logic |
| `scripts/core/` | What a task does. `cli.mjs` is the one entry. `graph.mjs`: a task is a state to reach, standing on other states. `site.mjs`, `signin.mjs`, `tasks.mjs`: the states. `world.mjs`: everything outside the program, so a unit test can give a state a made-up one. `node scripts/core/cli.mjs plan <task>` prints what a task would do |
| `scripts/*.mjs` | The work where EmDash has no command of its own, as functions the states call: `signin-*.mjs`, `plugin-*.mjs`, `live-*.mjs`. No file here runs by itself, and none starts a task |
| `tests/<group>/steps.mjs` | The test of each task, a group to a set of tasks: `site`, `signin`, `plugin`, `live`. Ordinary tests of Node's runner |
| `tests/lib/`, `tests/run.mjs` | What a step is written with, and what `dev:test` runs |
| `dev.toml` | This repo's own tasks |
| `.github/workflows/stages.yml` | Runs `dev:test` at a level on Linux, macOS and Windows |

## Reading EmDash

- Its skills, in any scaffolded site: `site/.agents/skills/` (`emdash-cli`, `building-emdash-site`, `creating-plugins`).
- Its docs: the `emdash-docs` MCP server (`.mcp.json`).
- Its source, to read the code: `mise run dev:src` clones it into `.src/emdash` (`.src/` is ignored by git).

## Releases

```sh
mise run dev:ci --level all              # every step, on three OSes: it must be green
mise run dev:test live                   # the deployed-site tasks, if a live: task changed
mise run release -- vX.Y.Z -dry-run      # says what it would do
mise run release -- vX.Y.Z               # check, tag, push, the GitHub Release with notes from the commits
```

`release` is charter's: it runs `mise run check` here and does not wait for GitHub. The `stages` workflow then runs every step on macOS, Linux and Windows on the tag. What changed in a release is its notes on [the releases page](https://github.com/joeblew999/emdash-run/releases).
