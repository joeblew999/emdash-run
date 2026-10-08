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

## What you get

- **One command per job,** named `<what>:<verb>`: `site:start`, `signin:token`, `plugin:install`, `live:ship`, `live:preview`.
- **This machine or the deployed site, by one rule:** no flag is this machine, `--live` is the deployed site. Every task prints where it is acting before it acts.
- **Sign-in without a browser,** for the CLI, agents and CI, on a local build, a deployed site behind Cloudflare Access, and a preview.
- **Plugins from EmDash's registry installed by a task,** and a task that says whether one works.
- **Previews:** the site on an address of its own, with its own database, beside the live one.
- **Known to work:** every task has test steps, on Cloudflare and Node sites and on a deployed site. [What works](docs/reference/status.md) is written by the last test run.

## What is in this repository

| Path | What it is |
|---|---|
| `tasks.toml` | The tasks: what your repo includes |
| `scripts/` | The few scripts behind them, where no command of EmDash's exists |
| `tests/` | The test that runs every task from an empty folder |
| `mise.toml`, `charter.toml` | This repo's own automation, kept by [charter](https://github.com/joeblew999/charter) |
| `docs/` | Everything else: [start here](docs/README.md), rendered at https://joeblew999.github.io/emdash-run/ |

Something wrong? [Open an issue](https://github.com/joeblew999/emdash-run/issues/new/choose). To help: [How to help](docs/contributing.md).
