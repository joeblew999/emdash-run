---
title: Rules
nav_order: 1
parent: How to help
---

# Rules for working in this repo

Binding, for developers and agents alike: other repos include these tasks.

| Rule | Why |
|---|---|
| **`docs/` is the single source of truth.** `README.md`, `AGENTS.md` and `CLAUDE.md` only point to it. Pages follow [Writing docs](writing.md); run `mise run docs:lint` | One place cannot contradict itself |
| **Never edit what is generated** ([the list](README.md#what-is-generated)) | A hand edit is lost, and the commit check fails |
| **Use EmDash's, Astro's and wrangler's own commands.** Run `--help` before writing a step: if a command exists, the step is that command. A script in `admin/` only where none exists | The tasks stay thin, and follow upstream by themselves |
| **A task's `description` is its documentation,** with the `help` of its arguments and flags. Write it for someone who has read nothing else: what it does, where it acts, what it needs, what it stops or asks | [Tasks](reference/tasks.md) and `mise tasks` are written from it, and nothing else is |
| **A new task gets a test step in the same commit.** A name people will look for is a task of its own, not an argument to a general one | The commit check refuses a task without a step |
| **"It works" means [What works](reference/status.md) says so for this commit.** Run `mise run test` after a change to `tasks.toml` or `admin/`, `mise run test:full` before a release | Nobody has to re-run everything to know |
| **Say what failed, first, unasked.** Never report as working what you have not run | A reader acts on it |
| **Every task is safe to run again,** and the test runs each twice. Where the answer depends on what is on disk, `admin/again.mjs` asks | A doc that says "once" describes a defect in the task |
| **Every task prints where it is acting:** no flag is this machine, `--live` is the deployed site | A task on the wrong site is the costly mistake |
| **Steps are plain `program arguments` lines;** a task finds its files with `env.MISE_TASK_DIR` inside `run`; no `tools =` on a task | They mean the same on macOS, Linux and Windows, and a hidden step inherits no tools |
| **Stop the site before changing its packages** | On Windows a running site holds them |
| **Workarounds name their issue:** `Upstream: <owner>/<repo>#<n> (when fixed: ...)`, and a row in [Upstream issues](upstream.md) | Otherwise it is never removed |
| **Plans are GitHub issues,** made with `charter issue plan`. Start with `mise run issues`: one labelled `needs-triage` comes before anything else | The docs say what is true now |
| **No CI as the edit loop.** The workflow runs by hand or on a release tag | A run takes twenty minutes on three machines |
| **These are development sites.** `signin:token` and the like trade safety for speed on purpose | Hardening is a separate job |
| **Add files to a commit by name** | Other agents' work is in the same tree |

## Working beside other agents

More than one agent may be working on this machine.

- **Your own git worktree,** and in any project you start a site in, `mise run site:ports` first.
- **Never `mise cache clear`:** the copy of the tasks mise fetched is shared by every project on the machine. Pin a tag.
- **One site at a time** in your own work: the machine has 16 GB, and the full test already runs three.
- **The deployed test Worker belongs to one run at a time.** The full test takes a lock and skips the deployed part if another holds it.
- **Do not stop what you did not start:** `site:stop` in your own project only, never by port or by name.
- **A folder where someone has a site running is not yours:** no `site:stop`, `site:reset`, `site:delete` or package install there. Work in a worktree of that repo.
- **Sign in with `signin:token`, not `emdash login`** ([Upstream issues](upstream.md)).
