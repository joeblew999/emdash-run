---
title: For agents
nav_order: 70
---

# Agent guide — emdash-run

This repo is a set of `mise` tasks for working on an EmDash site. Read this before changing anything.

## How the owner wants the work done

1. **Use EmDash's own commands.** It ships three CLIs — `emdash`, `emdash-plugin`, `create-emdash`
   — and Astro and wrangler have theirs. Run `--help` before writing a step; if a command exists,
   the step is that command. A script is allowed only where no command exists.
2. **A new task gets a test step in the same change** — `docs/status.md` lists every task and says
   NOT TESTED for one without. A name people will look for is a task of its own, not an argument
   to a general one (`plugin:search`, not `plugin -- search`).
   **Know what works from a file.** After any change to `tasks.toml` or `admin/`, run
   the quick test (`test`) and commit the `docs/status.md` it writes. Before a release, the full
   one (`test:full`). `TEST_FROM=github` before either fetches the tasks from GitHub: what another
   developer gets. "It works" means the status file
   says so for this commit.
3. **Do the whole job in one pass.** When something changes, fix everything it makes stale in the
   same pass: descriptions, README, plan, changelog. Look ahead for what breaks next.
4. **Start with the issues.** `issues` (in this repo) lists what developers have reported. An open
   issue labelled `needs-triage` is dealt with before anything else: reproduce it with the test,
   fix it, add a test step for it, answer the issue.
   **Say what failed, first, unasked.** Never report something as working that you have not run.
5. **One plan.** `docs/plans/` holds one open plan, in stages. A finding becomes a box in it, not
   a new plan or a new task.
6. **Never wait in silence.** Start a long run in the background and keep working.
7. **No CI unless the owner says.** The workflow runs by hand or on a release tag only.
8. **These are test sites.** Do not switch things off or add security guards while the owner is
   exploring; security is a later job, with the owner.
9. **Every task is safe to run again**, and the test proves it by running it twice. A doc that says
   "once" is describing a defect in the task: fix the task. Where the answer depends on what is
   on disk — which mise cannot see — `admin/again.mjs` asks.
10. **Keep it short.** Task descriptions are one line. Docs are for someone who wants to use the
   tasks, not a record of how they were made.

## Working beside other agents

More than one agent may be working on this machine. So that none disturbs another:

1. **Your own git worktree.** Never work in a folder another agent is in.
2. **Your own ports.** In any project you start a site in: `mise run site:ports`, first. The test
   does this itself.
3. **Never `mise cache clear`.** The copy of the tasks mise fetched is shared by every project on
   the machine. Pin a tag instead of following `main`.
4. **One site at a time.** The machine has 16 GB. The full test already runs three.
5. **The deployed test Worker belongs to one agent at a time.** The full test takes a lock before
   it deploys and skips the deployed part if another run holds it. Do not deploy to it by hand
   unless the plan gives you that job.
6. **Do not stop what you did not start.** `site:stop` in your own project only; never kill by
   port or by name.
8. **A folder where the owner has a site running is not yours.** Do not run `site:stop`,
   `site:reset`, `site:delete` or a package install there, and do not send an agent there with a
   brief that lets it. (2026-10-07: an agent sent to deploy the Remy-Sport site ran `site:stop` in
   the owner's folder, and the site the owner was looking at went down.) Deploy from a worktree of
   that repo, or leave the dev site alone and say so in the brief.
7. **Sign in with `signin:token`, not `emdash login`.** EmDash keeps every sign-in in one file and
   two written at the same moment lose one (`docs/upstream.md` § 14). `signin:token` keeps a file
   per site.

## How it is built

| | |
|---|---|
| `tasks.toml` | every task. Visible ones are `<what>:<verb>`; hidden `step:*` ones are single commands, reused |
| `admin/token.mjs` | `signin:token` — an administrator and an API token written to the site's database |
| `admin/access.mjs` | `signin:access` — Cloudflare Access through Cloudflare's API |
| `admin/first-admin.mjs` | `signin:passkey`, `signin:open` — the only Playwright |
| `admin/again.mjs` | what makes `site:new`, `site:delete` and `plugin:new` safe to run again; and `site:ports` |
| `admin/welcome.mjs` | closes EmDash's welcome dialog for the user a task makes (`site:start`, `signin:token`), through EmDash's own API |
| `admin/emdash.mjs` | the `emdash` task — the CLI, plus `--live`, `--preview` and what is saved for the site |
| `tests/replay.sh` | the test, at two levels: `test` (quick) and `test:full` (everything, the deployed-site tasks included). Each step names the task it tests |
| `tests/status.mjs`, `tests/results.json` | the record, kept across runs; `docs/status.md` (one row per task) and the README's ordered task table are built from it |
| `.githooks/pre-commit` | on after `mise run hooks`. Change a task → change its test step and its description in the same commit; the hook refuses the commit otherwise, and rebuilds the README table and `docs/` pages. Never edit those pages by hand, never skip the hook |
| `docs/tasks.md` | every task, in the order a developer uses them (the test's order), written by mise (`mise generate task-docs`) from `tasks.toml` — on every test run, on `mise run docs`, and by the commit check. **One source each:** what a task does is its `description` (and the `help` of its arguments and flags) in `tasks.toml`; the order and what is proven is `tests/replay.sh`; the README holds only what is not a task. A README section lists its tasks with `<!-- tasks:PREFIX -->` `<!-- /tasks -->`, filled from the descriptions — never by hand |
| `docs/_config.yml`, `.github/ISSUE_TEMPLATE/`, `.github/labels.tsv` | written by charter, the owner's tool: `docs:setup`, `github:labels` |
| `mise.toml` | this repo's settings and its own `test` tasks |
| `site/` | not in the repo. The `site:new` task makes one here to try tasks on; it is gitignored |

## Rules that came from mistakes

- **Where a task acts:** no flag is this machine; `--live` is the deployed site (`LIVE_URL`).
  Every task prints where it is acting.
- **A setting is read in a task as `env.NAME | default(value='…')`** (inside mise's double curly
  braces). `get_env()` does not see the project's settings.
- **A task finds its own files with `env.MISE_TASK_DIR`** — it is filled in inside `run`, not
  inside `dir`.
- **No `tools =` on a task.** A hidden step does not inherit them; the project's `[tools]` is the
  one place.
- **Steps are plain `program arguments` lines** so they mean the same on every OS.
- **Stop the site before changing its packages.** On Windows a running site breaks otherwise.
- **`emdash whoami` exits 0 with no site running.** To check a site answers, use
  `emdash schema list`.
- **`emdash login` saves its sign-in per project folder**, and a stale one breaks the dev CLI.
  `signin:token` does not use it.
- **The live tasks use the wrangler login.** Only `signin:access` needs more — wrangler's login
  cannot change Cloudflare Access — and it reads `CLOUDFLARE_API_TOKEN` from the environment or,
  by itself, from fnox. No task needs a `fnox exec --` prefix. fnox is in the README's `[tools]`.
- **Add files to a commit by name.**

## Reading EmDash

- Its skills, in any scaffolded site: `site/.agents/skills/` (`emdash-cli`,
  `building-emdash-site`, `creating-plugins`).
- Its docs: the `emdash-docs` MCP server (`.mcp.json`). Its source, when you need to read the code:
  `git clone https://github.com/emdash-cms/emdash .src/emdash` (`.src/` is gitignored).
- Things in EmDash and wrangler that do not behave as documented: `docs/upstream.md`.
