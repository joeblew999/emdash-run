---
title: "The tasks for working on this repo"
nav_order: 101
parent: "Reference"
---

# The tasks for working on this repo

Written by `charter docs` from what `charter docs-tasks -not tasks.toml -title "The tasks for working on this repo"` prints (docs/_generated.toml): don't edit, change the code that command reads, then `mise run docs:setup`.

Run one with `mise run <task>`; its arguments and flags go after `--`. `mise tasks` lists them, and `mise run <task> --help` shows one.

## From `dev.toml`

| Task | What it does |
|---|---|
| [`dev:types`](#devtypes) | Type-check tests/ and scripts/ (tsconfig.json) |
| [`dev:test`](#devtest) | The test of every task, at one of three levels, the same here and on GitHub (dev:ci). smoke: the basics, in half a minute — a project is made, its tasks run, the site starts, answers and stops. fast, the default: the everyday steps. all: every step, the long ones too. It is the unit tests and the site, signin and plugin groups, each a task of its own that mise runs side by side — so it takes as long as the slowest of them. (The live group deploys: dev:test:live, by name) |
| [`dev:test:unit`](#devtestunit) | The unit tests, in a second: the graph of states and each state with a made-up outside, the edits to a site's config, and that every task has a test step |
| [`dev:test:site`](#devtestsite) | The site group: making, running, checking and deleting a site, on a copy of site/ |
| [`dev:test:signin`](#devtestsignin) | The signin group: the CLI and a browser window as an administrator of the built site |
| [`dev:test:plugin`](#devtestplugin) | The plugin group: a plugin of your own, and plugins from EmDash's registry |
| [`dev:test:live`](#devtestlive) | REMOTE: the live group — the tasks that act on a deployed site, on the Worker kept for testing (TEST_LIVE_URL and TEST_LIVE_NAME in mise.local.toml). It deploys, and takes about five minutes |
| [`dev:ci`](#devci) | REMOTE: have GitHub run dev:test at a level on Linux, macOS and Windows (the stages workflow). By itself GitHub runs smoke on a push to main and all on a release tag |
| [`check`](#check) | What must pass before a release, and what release runs before it tags: the test (dev:test) and repo:ci (the docs and the repo are as charter keeps them) |
| [`dev:src`](#devsrc) | EmDash's source into .src/emdash (git ignores it), to read when a task meets something EmDash does that its docs do not say. Run again: the newest |
| [`dev:commit`](#devcommit) | What the commit check runs, in seconds: the types (dev:types), the unit tests (every task has a test step among them), and the docs are fresh and pass the lint (docs:check) |
| [`dev:hooks`](#devhooks) | Turn on the commit check in this clone (running the test does it too): every commit runs dev:commit |

## From `joeblew999/charter//tasks/repo`

| Task | What it does |
|---|---|
| [`docs:setup`](#docssetup) | Write the docs site's config and docs/writing.md (the same for every repo; GitHub Pages renders the folder), and the pages docs/_generated.toml lists |
| [`docs:lint`](#docslint) | Check docs/ for what a program can check: front matter, links, the index, tasks and paths that don't exist |
| [`docs:check`](#docscheck) | Fail if the docs site's config or a generated page differs from what docs:setup writes, or docs/ fails the lint |
| [`docs:review`](#docsreview) | Have Claude (the claude command) bring docs/ up to date and into line with docs/writing.md |
| [`docs:pages`](#docspages) | REMOTE, once per repo: turn on GitHub Pages for docs/ on main (GitHub renders the markdown itself) |
| [`release`](#release) | REMOTE: cut a release from this machine: mise run release \-\- vX.Y.Z [-dry-run]. The repo is clean and is the default branch on GitHub, then the repo's own tasks where it has them: setup, check, dist. Then the tag, the push, the GitHub Release with notes from the commits. It does not wait for GitHub's workflows: check is the same check, run here; a workflow that FAILED on this commit stops it |
| [`repo`](#repo) | REMOTE: keep the repo in shape from charter.toml at its root: docs site, issue forms, labels, description, homepage, topics, GitHub Pages; the workflows only in a repo with charter projects |
| [`repo:check`](#repocheck) | REMOTE, read-only: fail if the repo differs from charter.toml and the tool's templates (charter repo -check) |
| [`issues`](#issues) | REMOTE, read-only: the open issues, newest first: what is reported and what is planned (a plan is an issue) |
| [`repo:ci`](#repoci) | Everything the repo-check workflow runs, here: docs:check (the docs site and generated pages are fresh, docs/ passes the lint), repo:check (the repo is as charter.toml says), upstream:status. The workflow runs this one task and nothing else, so a pass here is a pass on GitHub. REMOTE, read-only |
| [`issue`](#issue) | Print the body to fill in for an issue of one kind, with that form's headings, and the gh command that files it with the form's labels: mise run issue \-\- bug (or feature, upstream, plan) |
| [`upstream:status`](#upstreamstatus) | REMOTE, read-only: the upstream issues the code works around (every `Upstream:` tag): CLOSED means that workaround can go |

## Each task

### `dev:types`

- **Usage:** `dev:types`

Type-check tests/ and scripts/ (tsconfig.json)

### `dev:test`

The test of every task, at one of three levels, the same here and on GitHub (dev:ci). smoke: the basics, in half a minute — a project is made, its tasks run, the site starts, answers and stops. fast, the default: the everyday steps. all: every step, the long ones too. It is the unit tests and the site, signin and plugin groups, each a task of its own that mise runs side by side — so it takes as long as the slowest of them. (The live group deploys: dev:test:live, by name)

- **Usage:** `dev:test [--level <level>] [--node]`

**Flags**
- **`--level <level>`** — smoke, fast or all

  **Choices:** `smoke`, `fast`, `all`

  **Default:** `fast`
- **`--node`** — On a Node site made from EmDash's template

### `dev:test:unit`

- **Usage:** `dev:test:unit`

The unit tests, in a second: the graph of states and each state with a made-up outside, the edits to a site's config, and that every task has a test step

### `dev:test:site`

The site group: making, running, checking and deleting a site, on a copy of site/

- **Usage:** `dev:test:site [FLAGS]`

**Flags**
- **`--level <level>`** — smoke, fast or all

  **Choices:** `smoke`, `fast`, `all`

  **Default:** `fast`
- **`--node`** — On a Node site made from EmDash's template
- **`--only <words>`** — Only the steps whose name has these words

### `dev:test:signin`

The signin group: the CLI and a browser window as an administrator of the built site

- **Usage:** `dev:test:signin [FLAGS]`

**Flags**
- **`--level <level>`** — smoke, fast or all

  **Choices:** `smoke`, `fast`, `all`

  **Default:** `fast`
- **`--node`** — On a Node site made from EmDash's template
- **`--only <words>`** — Only the steps whose name has these words

### `dev:test:plugin`

The plugin group: a plugin of your own, and plugins from EmDash's registry

- **Usage:** `dev:test:plugin [FLAGS]`

**Flags**
- **`--level <level>`** — smoke, fast or all

  **Choices:** `smoke`, `fast`, `all`

  **Default:** `fast`
- **`--node`** — On a Node site made from EmDash's template
- **`--only <words>`** — Only the steps whose name has these words

### `dev:test:live`

REMOTE: the live group — the tasks that act on a deployed site, on the Worker kept for testing (TEST_LIVE_URL and TEST_LIVE_NAME in mise.local.toml). It deploys, and takes about five minutes

- **Usage:** `dev:test:live [FLAGS]`

**Flags**
- **`--level <level>`** — smoke, fast or all

  **Choices:** `smoke`, `fast`, `all`

  **Default:** `fast`
- **`--node`** — On a Node site made from EmDash's template
- **`--only <words>`** — Only the steps whose name has these words

### `dev:ci`

REMOTE: have GitHub run dev:test at a level on Linux, macOS and Windows (the stages workflow). By itself GitHub runs smoke on a push to main and all on a release tag

- **Usage:** `dev:ci [--level <level>]`

**Flags**
- **`--level <level>`** — smoke, fast or all

  **Choices:** `smoke`, `fast`, `all`

  **Default:** `smoke`

### `check`

- **Usage:** `check`

What must pass before a release, and what release runs before it tags: the test (dev:test) and repo:ci (the docs and the repo are as charter keeps them)

### `dev:src`

- **Usage:** `dev:src`

EmDash's source into .src/emdash (git ignores it), to read when a task meets something EmDash does that its docs do not say. Run again: the newest

### `dev:commit`

- **Usage:** `dev:commit`

What the commit check runs, in seconds: the types (dev:types), the unit tests (every task has a test step among them), and the docs are fresh and pass the lint (docs:check)

### `dev:hooks`

- **Usage:** `dev:hooks`

Turn on the commit check in this clone (running the test does it too): every commit runs dev:commit

### `docs:setup`

- **Usage:** `docs:setup`

Write the docs site's config and docs/writing.md (the same for every repo; GitHub Pages renders the folder), and the pages docs/_generated.toml lists

### `docs:lint`

- **Usage:** `docs:lint`

Check docs/ for what a program can check: front matter, links, the index, tasks and paths that don't exist

### `docs:check`

- **Usage:** `docs:check`

Fail if the docs site's config or a generated page differs from what docs:setup writes, or docs/ fails the lint

### `docs:review`

- **Usage:** `docs:review`

Have Claude (the claude command) bring docs/ up to date and into line with docs/writing.md

### `docs:pages`

- **Usage:** `docs:pages`

REMOTE, once per repo: turn on GitHub Pages for docs/ on main (GitHub renders the markdown itself)

### `release`

- **Usage:** `release`

REMOTE: cut a release from this machine: mise run release -- vX.Y.Z [-dry-run]. The repo is clean and is the default branch on GitHub, then the repo's own tasks where it has them: setup, check, dist. Then the tag, the push, the GitHub Release with notes from the commits. It does not wait for GitHub's workflows: check is the same check, run here; a workflow that FAILED on this commit stops it

### `repo`

- **Usage:** `repo`

REMOTE: keep the repo in shape from charter.toml at its root: docs site, issue forms, labels, description, homepage, topics, GitHub Pages; the workflows only in a repo with charter projects

### `repo:check`

- **Usage:** `repo:check`

REMOTE, read-only: fail if the repo differs from charter.toml and the tool's templates (charter repo -check)

### `issues`

- **Usage:** `issues`

REMOTE, read-only: the open issues, newest first: what is reported and what is planned (a plan is an issue)

### `repo:ci`

- **Usage:** `repo:ci`

Everything the repo-check workflow runs, here: docs:check (the docs site and generated pages are fresh, docs/ passes the lint), repo:check (the repo is as charter.toml says), upstream:status. The workflow runs this one task and nothing else, so a pass here is a pass on GitHub. REMOTE, read-only

### `issue`

- **Usage:** `issue`

Print the body to fill in for an issue of one kind, with that form's headings, and the gh command that files it with the form's labels: mise run issue -- bug (or feature, upstream, plan)

### `upstream:status`

- **Usage:** `upstream:status`

REMOTE, read-only: the upstream issues the code works around (every `Upstream:` tag): CLOSED means that workaround can go
