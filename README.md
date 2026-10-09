# emdash-run

[![latest release](https://img.shields.io/github/v/release/joeblew999/emdash-run)](https://github.com/joeblew999/emdash-run/releases/latest)

**Work on an [EmDash](https://docs.emdashcms.com) site with a few `mise` tasks:** make a site, run it, check it, sign in, add plugins, deploy it, preview it. Each task runs EmDash's, Astro's and wrangler's own commands in the right order, and is safe to run again.

Put this in a `mise.toml` in your repo ([mise](https://mise.jdx.dev) is all you need), with the tag of the [latest release](https://github.com/joeblew999/emdash-run/releases/latest) for `vX.Y.Z`:

```toml
[settings]
experimental = true

[tools]
node = "26"
pnpm = "12"

[task_config]
includes = ["git::https://github.com/joeblew999/emdash-run.git//tasks.toml?ref=vX.Y.Z"]
```

```sh
mise run site:new      # a site, in site/
mise run site:start    # running, and you are signed in
mise tasks             # everything else
```

Then: [Getting started](docs/getting-started.md).

## What you get that EmDash's own commands do not give

EmDash, Astro and wrangler have good command lines, and these tasks run them. What is added is what those commands have no way to do, so that a developer, an agent or CI can do it by command, with nobody at a browser:

| You can | With EmDash's own tools | Here |
|---|---|---|
| Get into the admin and the API with no human | A passkey in a browser: an agent or CI stops at the sign-in page | `signin:token`, on a local build, a deployed site or a preview |
| Install, update and remove plugins | By clicking in the admin; there is no command | `plugin:install`, `plugin:update`, `plugin:remove`. What a plugin may do is printed, and one that can change things or reach outside is refused without a yes |
| Know a plugin works | Install it and look | `plugin:works`: one line per check |
| See a plugin do what it is for | Set it up and try it by hand in the admin | `plugin:demo`: seven registry plugins each do their real thing on the local build by requests alone, and one line each says what was seen: a setting on a page, a dead link found, a visitor's message read back, a form on a page a visitor opens, a post in French |
| Put a seed file into a site that is already running | A seed is applied only on the first request to an empty database, and `emdash seed` writes to a SQLite file: neither reaches a Cloudflare site's database once it runs | `site:seed`: each thing the file names is made if it is not there and left alone if it is, its pictures fetched and uploaded, one line per section. `site:demo` applies the seed file kept here (`seeds/demo.json`): a small site with something in every feature |
| See a change deployed before it is live | Make a database, a bucket and a session store, write a `previews` block, switch preview addresses on, deploy | `live:preview`: an address of its own, with its own data |
| Put sign-in in front of a deployed admin | The Cloudflare dashboard | `signin:access` |
| Run several sites, or several agents, on one machine | They are handed the same ports, and two sites starting together break each other | `site:ports`; sites start one at a time |
| Not act on the live site by accident | Each tool says which site its own way | One rule: no flag is this machine, `--live` is the deployed site, and a task says where it is acting before it acts |

The other tasks (`site:start`, `site:check`, `live:ship` and the like) are those tools' own commands in the order they have to run, each safe to run again: a convenience, and the states the tasks above stand on. `node scripts/core/cli.mjs plan <task>` prints what any task will do.

**Known to work:** every task has test steps, and [what the last run showed](docs/reference/tests.md), step by step with times, is in the docs. On three operating systems: [![stages](https://github.com/joeblew999/emdash-run/actions/workflows/stages.yml/badge.svg)](https://github.com/joeblew999/emdash-run/actions/workflows/stages.yml). On Windows only the basics are proven so far.

## What is in this repository

| Path | What it is |
|---|---|
| `tasks.toml` | The tasks: what your repo includes |
| `scripts/core/` | What a task does: the one entry (`cli.mjs`), and every state a site can be brought to, as a graph |
| `scripts/` | The work where no command of EmDash's exists: signing in, plugins, previews |
| `tests/` | The test that runs every task from an empty folder |
| `dev.toml` | The tasks for working on emdash-run itself (`dev:*`, `check`) |
| `mise.toml`, `charter.toml` | The tools and the task files included; the repo as kept by [charter](https://github.com/joeblew999/charter) |
| `docs/` | Everything else: [start here](docs/README.md), rendered at https://joeblew999.github.io/emdash-run/ |

Something wrong? [Open an issue](https://github.com/joeblew999/emdash-run/issues/new/choose). To help: [How to help](docs/contributing.md).
