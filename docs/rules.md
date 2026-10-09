---
title: Rules
nav_order: 1
parent: How to help
---

# Rules for working in this repo

The rules every repo shares are in [Rules for every repo](repo/rules.md), which charter writes: the same page in each. These are this repo's own, and add to those. Binding, for developers and agents alike: other repos include these tasks.

| Rule | Why |
|---|---|
| **Use EmDash's, Astro's and wrangler's own commands.** Run `--help` before writing anything: if a command exists, the state's work is that command. Code in `scripts/` only where none exists, and then say in the README what it gives that the command line does not | Each thing built here is one more to keep working on every EmDash release |
| **A task's `description` is its documentation,** with the `help` of its arguments and flags. Write it for someone who has read nothing else: what it does, where it acts, what it needs, what it stops or asks | [Tasks](reference/tasks.md) and `mise tasks` are written from it, and nothing else is |
| **A new task gets a test step in the same commit.** A name people will look for is a task of its own, not an argument to a general one | The commit check refuses a task without a step |
| **"It works" means the test says so.** `mise run dev:test --level smoke` first, then the group you changed (`mise run dev:test:site`, `dev:test:signin`, `dev:test:plugin`); `mise run dev:ci --level all` runs the level all on three OSes | Nobody has to re-run everything to know |
| **Every task prints where it is acting:** no flag is this machine, `--live` is the deployed site | A task on the wrong site is the costly mistake |
| **A task in `tasks.toml` is a name, a description, flags and one line** that hands it to `scripts/core/cli.mjs`, found with `env.MISE_TASK_DIR`. No logic, no `depends`, no `tools =` there. What it does is a state in `scripts/core/`, standing on other states, and no script starts `mise` | It means the same on macOS, Linux and Windows, `plan` can say what it will do, and a unit test can run it with a made-up outside |
| **Stop the site before changing its packages** | On Windows a running site holds them, and a dev site whose packages change under it answers 500 from then on |
| **Nothing in `tasks.toml` or `scripts/` may need charter** | A project that includes the tasks has only node and pnpm |
| **These are development sites.** `signin:token` and the like trade safety for speed on purpose | Hardening is a separate job |

## Working beside other agents, here

Beside [what every repo asks](repo/rules.md#working-beside-other-agents):

- **`mise run site:ports` first,** in any project you start a site in.
- **One site at a time** in your own work: the machine has 16 GB. The test has sites of its own: the levels smoke and fast keep one running in `~/.cache/emdash-run/bench`, and the level all starts one for each group.
- **The deployed test Worker belongs to one run at a time.** The `live` group takes a lock and is not run if another holds it.
- **`site:stop` in your own project only,** never by port or by name; and none of `site:stop`, `site:reset`, `site:delete` or a package install in a folder where someone has a site running.
- **Sign in with `signin:token`, not `emdash login`** ([Upstream issues](upstream.md)).
