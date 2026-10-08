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
| `mise run test` | Quick: the everyday tasks, one template. One task only: `mise run test -- signin:token` |
| `mise run test:full` | Everything: three sites at once, then the deployed-site tasks. About 20 minutes |
| `mise run src` | EmDash's source into `.src/emdash`, to read |
| `mise run issues` | The open issues, newest first. Start here |
| `mise run docs:setup` | Write the docs site's config and the generated pages |
| `mise run docs:check` | The generated pages are fresh, and `docs/` passes the lint (`docs:lint` alone: the lint) |
| `mise run docs:review` | Have Claude bring `docs/` into line with [Writing docs](writing.md) |
| `mise run repo` | REMOTE: keep the repo in shape from `charter.toml`: docs site, issue forms, labels, description, topics, GitHub Pages |
| `mise run repo:check` | The same, changing nothing: fails if something drifted |
| `mise run check` | Every check but the tests, in seconds: the unit tests (`node --test "tests/*.test.mjs"`), test steps for every task, a green record, `repo:ci`. What `release` runs before it tags |
| `mise run release -- vX.Y.Z` | REMOTE: cut a release from this machine ([Releases](#releases)) |
| `mise run repo:ci` | Everything the `repo-check` workflow runs, here: `docs:check`, `repo:check`, `upstream:status`. The workflow runs this one task, so a pass here is a pass on GitHub |
| `mise run upstream:status` | Every upstream issue the code works around, and whether it is still open |
| `mise run issue -- bug` | The body to fill in for an issue of one kind (`bug`, `feature`, `upstream`, `plan`), and the `gh` command that files it |

Each test runs as another developer would: a clean environment, an empty config folder, its own site in a temporary folder. It records what it saw in `tests/results.json`, and [What works](reference/status.md) is written from that. ## The site in this repo

`site/` is a real site, made with `mise run site:new` (the `cloudflare:blog` template) and committed: the place to try a task or a plugin in seconds, without making a site first. What is the machine's stays out of git: its packages, its `.env`, its local database.

```sh
mise run site:ports           # once: ports of its own for this clone
mise run site:start           # the dev site; open /_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
mise run plugin:favourites    # the favourite plugins into its local database
mise run plugin:works         # every plugin, one line per check
```

The tests do not use it: each run makes its own sites in a temporary folder, to prove the tasks from nothing.

## How it is built

| Path | What it is |
|---|---|
| `tasks.toml` | Every task. Visible ones are `<what>:<verb>`; hidden `step:*` ones are single commands, reused. A task's `description` is its documentation |
| `admin/token.mjs` | `signin:token`: an administrator and an API token written to the site's database |
| `admin/access.mjs` | `signin:access`: Cloudflare Access through Cloudflare's API |
| `admin/first-admin.mjs` | `signin:passkey`, `signin:open`: the only Playwright |
| `admin/preview.mjs` | `live:preview`: a preview's resources, its settings, and `wrangler preview` |
| `admin/plugins.mjs` | The registry `plugin:*` tasks: the requests the admin's Install button makes |
| `admin/plugin-config-edit.mjs` | The edits `plugin:sandbox`, `plugin:new` and `plugin:add` make to `astro.config.mjs`: text in, text out, inside `emdash({ … })` only, nothing when already there, a refusal when the file is not of a shape it can edit safely |
| `admin/emdash.mjs` | The `emdash` task: EmDash's CLI, with `--live`, `--preview` and what is saved for the site |
| `admin/again.mjs` | What makes tasks safe to run again; `site:ports`; starting one site at a time |
| `admin/site.mjs`, `admin/welcome.mjs` | A site's `wrangler.jsonc`, read in one place; closing EmDash's welcome dialog |
| `tests/replay.sh` | The test. Each step names the task it tests |
| `tests/config-edit.test.mjs`, `tests/fixtures/config/` | The unit tests of those edits, on fixture configs. `mise run check` runs them |
| `tests/status.mjs`, `tests/results.json` | The record of what each step showed, and the page written from it ([What works](reference/status.md)) |
| `.githooks/pre-commit` | The commit check: every task has a test step, the generated pages are fresh, `docs/` passes the lint |
| `mise.toml`, `charter.toml` | This repo's own three tasks (the rest are charter's, included from its `tasks/repo`), and the repo as charter keeps it |
| `.github/workflows/` | Each runs one mise task, so what GitHub runs you can run. `stages.yml`: `mise run test` or `test:full` on three OSes, by hand or on a tag. `repo-check.yml`: charter's, `mise run repo:ci` on every push |

## Reading EmDash

- Its skills, in any scaffolded site: `site/.agents/skills/` (`emdash-cli`, `building-emdash-site`, `creating-plugins`).
- Its docs: the `emdash-docs` MCP server (`.mcp.json`).
- Its source, to read the code: `mise run src` clones it into `.src/emdash` (`.src/` is ignored by git).

## Releases

```sh
mise run test:full                       # everything, about 20 minutes: it must be green
git add -A tests docs && git commit      # what it recorded, and the pages written from it
mise run release -- vX.Y.Z -dry-run      # says what it would do
mise run release -- vX.Y.Z               # check, tag, push, the GitHub Release with notes from the commits
```

`release` is charter's: it runs `mise run check` here and does not wait for GitHub. The `stages` workflow then runs the full test on macOS, Linux and Windows on the tag. What changed in a release is its notes on [the releases page](https://github.com/joeblew999/emdash-run/releases).
