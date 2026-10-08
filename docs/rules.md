---
title: Rules
nav_order: 1
parent: How to help
---

# Rules for working in this repo

The rules every repo shares are in [Rules for every repo](repo/rules.md), which charter writes: the same page in each. These are this repo's own, and add to those. Binding, for developers and agents alike: other repos include these tasks.

| Rule | Why |
|---|---|
| **Use EmDash's, Astro's and wrangler's own commands.** Run `--help` before writing a step: if a command exists, the step is that command. A script in `scripts/` only where none exists | The tasks stay thin, and follow upstream by themselves |
| **A task's `description` is its documentation,** with the `help` of its arguments and flags. Write it for someone who has read nothing else: what it does, where it acts, what it needs, what it stops or asks | [Tasks](reference/tasks.md) and `mise tasks` are written from it, and nothing else is |
| **A new task gets a test step in the same commit.** A name people will look for is a task of its own, not an argument to a general one | The commit check refuses a task without a step |
| **"It works" means [What works](reference/status.md) says so for this commit.** `mise run test` after a change to `tasks.toml` or `scripts/`, `mise run test:full` before a release | Nobody has to re-run everything to know |
| **Every task prints where it is acting:** no flag is this machine, `--live` is the deployed site | A task on the wrong site is the costly mistake |
| **Steps are plain `program arguments` lines;** a task finds its files with `env.MISE_TASK_DIR` inside `run`; no `tools =` on a task | They mean the same on macOS, Linux and Windows, and a hidden step inherits no tools |
| **Stop the site before changing its packages** | On Windows a running site holds them |
| **Nothing in `tasks.toml` or `scripts/` may need charter** | A project that includes the tasks has only node and pnpm |
| **These are development sites.** `signin:token` and the like trade safety for speed on purpose | Hardening is a separate job |

## Working beside other agents, here

Beside [what every repo asks](repo/rules.md#working-beside-other-agents):

- **`mise run site:ports` first,** in any project you start a site in.
- **One site at a time** in your own work: the machine has 16 GB, and the full test already runs three.
- **The deployed test Worker belongs to one run at a time.** The full test takes a lock and skips the deployed part if another holds it.
- **`site:stop` in your own project only,** never by port or by name; and none of `site:stop`, `site:reset`, `site:delete` or a package install in a folder where someone has a site running.
- **Sign in with `signin:token`, not `emdash login`** ([Upstream issues](upstream.md)).
