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
mise run test          # the everyday tasks from an empty folder, about a minute
```

Running a test turns on the commit check in your clone.

## The tasks of this repo

| Task | What it does |
|---|---|
| `mise run test` | The test: every group that is not proven |
| `mise run test:site` | One group alone. The groups are named as the tasks are: `test:site`, `test:signin`, `test:plugin`, `test:live` |
| `mise run test:node` | The `site`, `signin` and `plugin` groups on a Node site made from EmDash's template: before a release |
| `mise run src` | EmDash's source into `.src/emdash`, to read |
| `mise run issues` | The open issues, newest first. Start here |
| `mise run docs:setup` | Write the docs site's config and the generated pages |
| `mise run docs:check` | The generated pages are fresh, and `docs/` passes the lint (`docs:lint` alone: the lint) |
| `mise run docs:review` | Have Claude bring `docs/` into line with [Writing docs](writing.md) |
| `mise run repo` | REMOTE: keep the repo in shape from `charter.toml`: docs site, issue forms, labels, description, topics, GitHub Pages |
| `mise run repo:check` | The same, changing nothing: fails if something drifted |
| `mise run check` | Every check but the tests, in seconds: the unit tests (`node --test "tests/**/*.test.mjs"`), test steps for every task, a green record, `repo:ci`. What `release` runs before it tags |
| `mise run release -- vX.Y.Z` | REMOTE: cut a release from this machine ([Releases](#releases)) |
| `mise run repo:ci` | Everything the `repo-check` workflow runs, here: `docs:check`, `repo:check`, `upstream:status`. The workflow runs this one task, so a pass here is a pass on GitHub |
| `mise run upstream:status` | Every upstream issue the code works around, and whether it is still open |
| `mise run issue -- bug` | The body to fill in for an issue of one kind (`bug`, `feature`, `upstream`, `plan`), and the `gh` command that files it |

Each test runs as another developer would: a clean environment, an empty config folder, a copy of `site/` in a temporary folder. 

A group is the unit. Each has a folder, `tests/<group>/`, with its steps (`steps.sh`) and what its last run showed (`results.json`), and a page written from that; [What works](reference/status.md) is the index of them. Each group runs alone, on a site of its own, so you run the one you are working on.

A group is **proven** when every step of it passed and nothing it depends on has changed since: its tasks, its scripts, its steps, the site. A proven group is not run again; `mise run test:plugin -- --again` runs it anyway. Change a plugin script and only the `plugin` group has to run. A run replaces everything recorded for its group. On a CI runner nothing is skipped.

 A failing step prints its last 30 lines of output. A step that has not ended after 15 minutes is stopped and fails, and the steps after it in the group are not run; `STEP_LIMIT=<seconds>` changes the limit.

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
| `scripts/plugin-sandbox.mjs` | The site's files: the sandbox runner in `astro.config.mjs` and `wrangler.jsonc`, a plugin package's lines, and (for `site:stop`) a Node site's leftover sandbox process |
| `scripts/plugin-api.mjs` | The one client the registry tasks and the works check speak to a site and to the registry with; what `plugin:install` records about a plugin |
| `scripts/plugin-install.mjs` | `plugin:install`, `plugin:favourites`, `plugin:update`, `plugin:remove`: the requests the admin's buttons make |
| `scripts/plugin-works.mjs` | `plugin:works`: one line per check, on this machine's built site or, from outside, on the deployed one |
| `scripts/emdash.mjs` | The `emdash` task: EmDash's CLI, with `--live`, `--preview` and what is saved for the site |
| `scripts/site.mjs` | What makes tasks safe to run again; `site:ports`; starting one site at a time |
| `scripts/wrangler-config.mjs`, `scripts/site-welcome.mjs` | A site's `wrangler.jsonc`, read in one place, and which deployed site `--live` means; closing EmDash's welcome dialog |
| `tests/site/`, `tests/signin/`, `tests/plugin/`, `tests/live/` | One folder per group: `steps.sh`, its steps, each naming the task it tests; `results.json`, what its last run showed |
| `tests/run.sh`, `tests/lib.sh` | The runner (which groups, one test at a time, a clean environment) and what the steps are written with (`ok`, `no`, `need`, `says`) |
| `tests/plugin/*.test.mjs`, `tests/plugin/fixtures/` | The unit tests of the plugin scripts' own functions: the edits to `astro.config.mjs` on fixture configs, and how `plugin:update` compares two releases. Every test and `mise run check` run them first |
| `tests/record.mjs` | Writes each group's record, says whether a group is proven, and prints the pages ([What works](reference/status.md) and one per group) |
| `.githooks/pre-commit` | The commit check: every task has a test step, the generated pages are fresh, `docs/` passes the lint |
| `mise.toml`, `charter.toml` | This repo's own tasks (the rest are charter's, included from its `tasks/repo`), and the repo as charter keeps it |
| `.github/workflows/` | Each runs one mise task, so what GitHub runs you can run. `stages.yml`: `mise run test` on three OSes, by hand or on a tag. `repo-check.yml`: charter's, `mise run repo:ci` on every push |

## Reading EmDash

- Its skills, in any scaffolded site: `site/.agents/skills/` (`emdash-cli`, `building-emdash-site`, `creating-plugins`).
- Its docs: the `emdash-docs` MCP server (`.mcp.json`).
- Its source, to read the code: `mise run src` clones it into `.src/emdash` (`.src/` is ignored by git).

## Releases

```sh
mise run test                            # every group that is not proven: it must be green
mise run test:node                       # the same on a Node site
git add -A tests docs && git commit      # what it recorded, and the pages written from it
mise run release -- vX.Y.Z -dry-run      # says what it would do
mise run release -- vX.Y.Z               # check, tag, push, the GitHub Release with notes from the commits
```

`release` is charter's: it runs `mise run check` here and does not wait for GitHub. The `stages` workflow then runs the test on macOS, Linux and Windows on the tag. What changed in a release is its notes on [the releases page](https://github.com/joeblew999/emdash-run/releases).
