---
title: How to help
nav_order: 6
has_children: true
---

# How to help

## Report a bug

[Open an issue](https://github.com/joeblew999/emdash-run/issues/new/choose) with the task exactly as you ran it and everything it printed: the first lines say where it was acting. Check [What works](reference/status.md) and [Upstream issues](upstream.md) first. From a terminal: `mise run issue -- bug` prints the form to fill in.

## Set up

```sh
git clone https://github.com/joeblew999/emdash-run && cd emdash-run
mise trust && mise install
mise run dev:test          # the everyday tasks from an empty folder, about a minute
```

Running a test turns on the commit check in your clone.

## The tasks of this repo

[The tasks for working on this repo](reference/dev-tasks.md) lists them, written from the tasks themselves: `dev:*` and `check` are this repo's own (`dev.toml`), the rest are charter's. `mise run dev:test --help` shows the levels and flags.

Each test runs as another developer would: a clean environment, an empty config folder, a copy of `site/` in a temporary folder. 

A group is the unit. Each has a folder, `tests/<group>/`, with its steps (`steps.mjs`) and what its last run showed (`results.json`), and a page written from that; [What works](reference/status.md) is the index of them. Each group runs alone, on a site of its own, so you run the one you are working on.

A group is **proven** when its everyday steps passed and nothing it depends on has changed since. A proven group is not run again; `mise run dev:test plugin --again` runs it anyway. To work on one task, `mise run dev:test site --only site:check` runs only the steps whose name has those words, and records nothing. What a group depends on is worked out from its steps, with mise's own reading of the tasks (`mise tasks ls --json`): the tasks they run, every hidden step and script those reach, the runner, and the site. `node tests/record.mjs --depends` prints it for each group, so you can see what a change will re-run. Change `scripts/live-preview.mjs` and only the `live` group has to run. On a CI runner nothing is skipped.

The test is Node only, and its steps are tests of Node's own runner: no shell and no Unix program, so the same files run on all three OSes.

A failing step prints its last 30 lines of output. A step that has not ended after 5 minutes is stopped and fails, and the steps after it in the group are not run; `STEP_LIMIT=<seconds>` changes the limit.

## The site in this repo

`site/` is a real site, made with `mise run site:new` (the `cloudflare:blog` template) and committed: the place to try a task or a plugin in seconds, without making a site first. What is the machine's stays out of git: its packages, its `.env`, its local database.

```sh
mise run site:ports           # once: ports of its own for this clone
mise run site:start           # the dev site; open /_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
mise run plugin:favourites    # the favourite plugins into its local database
mise run plugin:works         # every plugin, one line per check
```

The tests use it: each run works on a copy of it in a temporary folder, so the site you are looking at and its local database are not touched. One test runs at a time on a machine; a second one waits.

## How it is built

| Path | What it is |
|---|---|
| `tasks.toml` | Every task. Visible ones are `<what>:<verb>`; hidden `step:*` ones are single commands, reused. A task's `description` is its documentation |
| `scripts/signin-token.mjs` | `signin:token`: an administrator and an API token written to the site's database |
| `scripts/signin-access.mjs` | `signin:access`: Cloudflare Access through Cloudflare's API |
| `scripts/signin-browser.mjs` | `signin:passkey`, `signin:open`: the only Playwright |
| `scripts/live-preview.mjs` | `live:preview`: a preview's resources, its settings, and `wrangler preview` |
| `scripts/plugin.mjs` | What the `plugin:*` tasks run: it only says which job was asked for. Each job is one of the next five files |
| `scripts/plugin-astro-config.mjs` | The edits `plugin:sandbox`, `plugin:new` and `plugin:add` make to `astro.config.mjs`: text in, text out, inside `emdash({ … })` only, nothing when already there, a refusal when the file is not of a shape it can edit safely |
| `scripts/plugin-sandbox.mjs` | The site's files: the sandbox runner in `astro.config.mjs` and `wrangler.jsonc`, and a plugin package's lines |
| `scripts/plugin-api.mjs` | The one client the registry tasks and the works check speak to a site and to the registry with; what `plugin:install` records about a plugin |
| `scripts/plugin-install.mjs` | `plugin:install`, `plugin:favourites`, `plugin:update`, `plugin:remove`: the requests the admin's buttons make |
| `scripts/plugin-works.mjs` | `plugin:works`: one line per check, on this machine's built site or, from outside, on the deployed one |
| `scripts/emdash.mjs` | The `emdash` task: EmDash's CLI, with `--live`, `--preview` and what is saved for the site |
| `scripts/site-stop.mjs` | `site:stop`: a Node site's sandbox process, which outlives the site. A file of its own, so stopping a site depends on none of the plugin scripts |
| `scripts/site.mjs` | What makes tasks safe to run again; `site:ports`; starting one site at a time |
| `scripts/wrangler-config.mjs`, `scripts/site-welcome.mjs` | A site's `wrangler.jsonc`, read in one place, and which deployed site `--live` means; closing EmDash's welcome dialog |
| `tests/site/`, `tests/signin/`, `tests/plugin/`, `tests/live/` | One folder per group: `steps.mjs`, its steps, each naming the task it tests; `results.json`, what its last run showed |
| `tests/run.mjs` | Which groups run, one test at a time, and the record of each. The steps themselves are run by Node's own test runner (`node --test`), which times them, stops one that does not end and prints them |
| `tests/lib/step.mjs`, `tests/lib/site.mjs` | What a steps file is written with (`step`, `refuses`, `long`, `setup`), and what a step does: run a task (`mise`, `attempt`), read a file, ask the site |
| `tests/lib/results.mjs`, `depends.mjs`, `pages.mjs`, `reporter.mjs`, `groups.mjs` | The records; what a group depends on; the pages; the results handed from Node's runner to the record; the groups |
| `tests/plugin/*.test.mjs`, `tests/plugin/fixtures/` | The unit tests of the plugin scripts' own functions: the edits to `astro.config.mjs` on fixture configs, and how `plugin:update` compares two releases. Every test and `mise run check` run them first |
| `tsconfig.json`, `tests/package.json` | What `mise run dev:types` checks, and the TypeScript it checks with |
| `tests/record.mjs` | The records from the command line: `--page`, `--coverage`, `--depends` |
| `.githooks/pre-commit` | The commit check: every task has a test step, the generated pages are fresh, `docs/` passes the lint |
| `dev.toml` | This repo's own tasks: `dev:*` and `check`. `mise.toml` includes it; no other repo does |
| `mise.toml`, `charter.toml` | The tools, and which task files are included (`tasks.toml`, `dev.toml`, charter's `tasks/repo`); the repo as charter keeps it |
| `.github/workflows/` | Each runs one mise task, so what GitHub runs you can run. `stages.yml`: `mise run dev:test --level <level>` on three OSes — `smoke` on a push to `main`, `all` on a tag, by hand the level you choose. Nothing else is in the workflow: it installs mise and runs the task. `repo-check.yml`: charter's, `mise run repo:ci` on every push |

## Reading EmDash

- Its skills, in any scaffolded site: `site/.agents/skills/` (`emdash-cli`, `building-emdash-site`, `creating-plugins`).
- Its docs: the `emdash-docs` MCP server (`.mcp.json`).
- Its source, to read the code: `mise run dev:src` clones it into `.src/emdash` (`.src/` is ignored by git).

## Releases

```sh
mise run dev:test                            # the everyday steps: they must be green
mise run dev:test live                       # the deployed-site tasks, if a live: task changed
mise run dev:ci --level all             # every step, on three OSes: it must be green
git add -A tests docs && git commit      # what it recorded, and the pages written from it
mise run release -- vX.Y.Z -dry-run      # says what it would do
mise run release -- vX.Y.Z               # check, tag, push, the GitHub Release with notes from the commits
```

`release` is charter's: it runs `mise run check` here and does not wait for GitHub. The `stages` workflow then runs every step on macOS, Linux and Windows on the tag. What changed in a release is its notes on [the releases page](https://github.com/joeblew999/emdash-run/releases).
