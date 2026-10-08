# emdash-run

Work on an [EmDash](https://docs.emdashcms.com) site with a few `mise` tasks: make a site, run it,
check it, sign in, deploy it. Each task runs EmDash's own commands in the right order.

https://github.com/joeblew999/emdash-run

**What works right now: [`docs/status.md`](docs/status.md)** — the last test run, step by step.

Docs: <https://joeblew999.github.io/emdash-run/> · Something wrong? [Open an issue](https://github.com/joeblew999/emdash-run/issues/new/choose).

## Set up

You need [mise](https://mise.jdx.dev). Put this in a `mise.toml` in your repo:

```toml
[settings]
experimental = true

[tools]
node = "26"
pnpm = "12"
fnox = "1.36.0"   # keeps your Cloudflare token; only needed for signin:access

[task_config]
includes = ["git::https://github.com/joeblew999/emdash-run.git//tasks.toml?ref=v1.1.0"]
```

That pins release `v1.0.1`; change the tag to update. `ref=main` follows development, but mise
keeps the copy it fetched first: run `mise cache clear` to take a newer one.

## The tasks

In the order you use them. This table is written by the test, from the order it runs the tasks in. Run one with
`mise run <task>`; `mise tasks ls` shows them all. Each task's arguments and flags are in
[`docs/tasks.md`](docs/tasks.md), which mise writes from the tasks themselves — a task's
description in `tasks.toml` is its documentation.

<!-- in-order:begin (written by tests/status.mjs — run a test, do not edit) -->
**On this machine**

| | task | what it does | tested |
|---|---|---|---|
| 1 | `site:ports` | Give this project two ports of its own (in mise.local.toml), so several projects — or several agents — can run at once | yes |
| 2 | `site:new` | Make a new site. Template: mise run site:new \-\- node:blog (default cloudflare:blog). A site that is already there is left alone | yes |
| 3 | `site:start` | Start the dev site in the background (port 4321). EmDash signs you in by itself, and its welcome dialog is closed for you | yes |
| 4 | `site:logs` | Follow the dev site's log | yes |
| 5 | `emdash` | EmDash's CLI. This machine by default; add \-\-live for the deployed site, \-\-preview for the built site | yes |
| 6 | `site:check` | Before a commit: seed valid, types check, site builds | yes |
| 7 | `model:sync` | Record the site's content model in the repo (.emdash/). Add \-\- \-\-live for the deployed site | yes |
| 8 | `site:preview` | Build the site and serve it locally (port 4322) — behaves like a deployed site | yes |
| 9 | `signin:token` | Sign a machine in with no browser — the everyday way, for the CLI, agents and CI: an admin and an API token written to the site's database. This machine's built site; add \-\- \-\-live for the deployed one (Cloudflare sites only) | yes |
| 10 | `signin:open` | Open a browser window already signed in to the admin, for you to look around. Add \-\- \-\-live for the deployed site. Needs Playwright + Chrome | yes |
| 11 | `plugin:new` | Make a plugin of your own inside the site: scaffold, test, build, add — and print the two lines to put in astro.config.mjs. Stops the site: start it again afterwards. Run again: rebuilds and re-adds it. mise run plugin:new \-\- &lt;name&gt; | yes |
| 12 | `plugin:check` | Check a plugin: manifest, types, tests, build, bundle. mise run plugin:check \-\- &lt;name&gt; | yes |
| 13 | `plugin:add` | Add a plugin from npm, and print the two lines to put in astro.config.mjs. Stops the site: start it again afterwards. mise run plugin:add \-\- &lt;package&gt; | yes |
| 14 | `plugin:search` | Search EmDash's plugin registry. mise run plugin:search \-\- forms | yes |
| 15 | `plugin` | Anything else in EmDash's plugin CLI. mise run plugin \-\- info &lt;publisher&gt; &lt;slug&gt; | yes |
| 16 | `emdash:update` | Update the site to the newest EmDash, then type-check and build | yes |
| 17 | `site:reset` | Empty the local database and start again from the seed. Asks first | yes |
| 18 | `signin:passkey` | Sign a machine in through EmDash's real setup wizard, with a passkey — for testing the wizard itself. Add \-\- \-\-live for the deployed site. Needs Playwright + Chrome | yes |
| 19 | `site:stop` | Stop the dev site and the built site | yes |
| 20 | `site:delete` | Delete the site folder. Asks first. No site is nothing to delete | yes |

**On the deployed site**

| | task | what it does | tested |
|---|---|---|---|
| 1 | `signin:access` | Sign people in to the deployed site: Cloudflare Access in front of its admin, by a code emailed to ADMIN_EMAIL. Uploaded media stays public. Prints three lines for astro.config.mjs and wrangler.jsonc. Needs a Cloudflare API token with Access edit rights, in CLOUDFLARE_API_TOKEN or in fnox | yes |
| 2 | `emdash` | EmDash's CLI. This machine by default; add \-\-live for the deployed site, \-\-preview for the built site | yes |
| 3 | `live:ship` | Deploy to Cloudflare: check, deploy, wait for the new version to answer. A newly deployed site has no content: it prints how to bring this machine's | yes |
| 4 | `signin:token` | Sign a machine in with no browser — the everyday way, for the CLI, agents and CI: an admin and an API token written to the site's database. This machine's built site; add \-\- \-\-live for the deployed one (Cloudflare sites only) | yes |
| 5 | `model:sync` | Record the site's content model in the repo (.emdash/). Add \-\- \-\-live for the deployed site | yes |
| 6 | `content:pull` | Download the deployed site's content as a package into backups/ in the site (keep that folder out of git) | yes |
| 7 | `live:backup` | Back up the deployed site: a database bookmark to restore to, and a content package in backups/. No SQL dump — Cloudflare's export refuses an EmDash database | yes |
| 8 | `live:logs` | Follow the deployed site's log | yes |
| 9 | `signin:open` | Open a browser window already signed in to the admin, for you to look around. Add \-\- \-\-live for the deployed site. Needs Playwright + Chrome | yes |
| 10 | `live:undo` | Roll the deployed site back to the previous version (code only) | yes |

<!-- in-order:end -->

After `site:start`, open `http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`.
EmDash sets the site up and signs you in.

Anything in EmDash's own CLI:

```
mise run emdash -- content list posts
mise run emdash -- schema add-field pages subtitle --type string
```

## Templates

```
mise run site:new -- node:blog
```

| | `blog` | `starter` | `marketing` | `portfolio` |
|---|---|---|---|---|
| Cloudflare (Workers, D1, R2) | `cloudflare:blog` | `cloudflare:starter` | `cloudflare:marketing` | `cloudflare:portfolio` |
| Node.js (SQLite, local uploads) | `node:blog` | `node:starter` | `node:marketing` | `node:portfolio` |

With no argument it uses `TEMPLATE` from your `mise.toml`, else `cloudflare:blog`.

## An existing site

The tasks expect the site in a `site/` folder. If your repo *is* the site:

```toml
[env]
SITE_FOLDER = "."
```

Everything works except `site:new` and `site:delete`, which refuse.

## This machine or deployed

**No flag is this machine. `--live` is the deployed site.**

```toml
[env]
LIVE_URL = "https://your-site.workers.dev"
```

```
mise run emdash -- content list posts            this machine
mise run emdash -- content list posts --live     the deployed site
mise run model:sync -- --live
```

`site:` tasks are always this machine. `live:` tasks are always the deployed site. Every task
prints where it is acting before it acts.

## Signing in

On the dev site (`site:start`) you never need to. A built site — `site:preview` locally, or a
deployed one — has real sign-in. Pick a way:

<!-- tasks:signin: -->
| task | what it does |
|---|---|
| `signin:token` | Sign a machine in with no browser — the everyday way, for the CLI, agents and CI: an admin and an API token written to the site's database. This machine's built site; add \-\- \-\-live for the deployed one (Cloudflare sites only) |
| `signin:open` | Open a browser window already signed in to the admin, for you to look around. Add \-\- \-\-live for the deployed site. Needs Playwright + Chrome |
| `signin:passkey` | Sign a machine in through EmDash's real setup wizard, with a passkey — for testing the wizard itself. Add \-\- \-\-live for the deployed site. Needs Playwright + Chrome |
| `signin:access` | Sign people in to the deployed site: Cloudflare Access in front of its admin, by a code emailed to ADMIN_EMAIL. Uploaded media stays public. Prints three lines for astro.config.mjs and wrangler.jsonc. Needs a Cloudflare API token with Access edit rights, in CLOUDFLARE_API_TOKEN or in fnox |
<!-- /tasks -->

These are for development sites. What they save is in `~/.config/emdash-run/` on your machine,
never in the repo.

## Deploying

For a site on Cloudflare. You need to be signed in to Cloudflare (`mise x -- pnpm dlx wrangler login`).
Every task is safe to run again. In this order the first time: `signin:access`, put the lines it
prints into the site, `live:ship`, `signin:token -- --live`.

<!-- tasks:live: -->
| task | what it does |
|---|---|
| `live:ship` | Deploy to Cloudflare: check, deploy, wait for the new version to answer. A newly deployed site has no content: it prints how to bring this machine's |
| `live:backup` | Back up the deployed site: a database bookmark to restore to, and a content package in backups/. No SQL dump — Cloudflare's export refuses an EmDash database |
| `live:logs` | Follow the deployed site's log |
| `live:undo` | Roll the deployed site back to the previous version (code only) |
<!-- /tasks -->

**A newly deployed site has no content.** `live:ship` says so, with the commands: export this
machine's content (`mise run emdash -- site export --output site.emdash`), then import it with
`--live` — `--analyze` first, which prints a plan, then `--plan <digest> --confirm`.

Everything uses that wrangler login except `signin:access`: wrangler's login can read Cloudflare
Access but not change it. For that one task, make an API token in the Cloudflare dashboard
(My Profile → API Tokens) with **Access: Apps and Policies — Edit** and **Access: Service Tokens —
Edit**, and store it with [fnox](https://fnox.jdx.dev), which the task reads by itself:

```
fnox init                             if this machine has no fnox config yet
fnox set CLOUDFLARE_API_TOKEN         it asks for the value
```

Or set `CLOUDFLARE_API_TOKEN` in your environment any other way.

## Plugins

<!-- tasks:plugin -->
| task | what it does |
|---|---|
| `plugin:new` | Make a plugin of your own inside the site: scaffold, test, build, add — and print the two lines to put in astro.config.mjs. Stops the site: start it again afterwards. Run again: rebuilds and re-adds it. mise run plugin:new \-\- &lt;name&gt; |
| `plugin:check` | Check a plugin: manifest, types, tests, build, bundle. mise run plugin:check \-\- &lt;name&gt; |
| `plugin:add` | Add a plugin from npm, and print the two lines to put in astro.config.mjs. Stops the site: start it again afterwards. mise run plugin:add \-\- &lt;package&gt; |
| `plugin:search` | Search EmDash's plugin registry. mise run plugin:search \-\- forms |
| `plugin` | Anything else in EmDash's plugin CLI. mise run plugin \-\- info &lt;publisher&gt; &lt;slug&gt; |
| `plugin:publish` | Publish a plugin to EmDash's registry. Asks first |
<!-- /tasks -->

## Settings

All optional, under `[env]` in your `mise.toml`.

| setting | default | |
|---|---|---|
| `TEMPLATE` | `cloudflare:blog` | what `site:new` makes |
| `SITE_FOLDER` | `site` | where the site is |
| `SITE_PORT` | `4321` | the dev site's port. `mise run site:ports` picks a free one for this project |
| `PREVIEW_PORT` | `4322` | the built site's port — the same |
| `LIVE_URL` | — | the deployed site |
| `ADMIN_EMAIL` | — | who may sign in to the deployed site |
| `SITE_SEED` | — | `none` if the site has no seed file |
| `PLUGIN_PUBLISHER`, `PLUGIN_AUTHOR`, `PLUGIN_SECURITY_EMAIL` | — | needed by `plugin:new` |

## Several sites, or several agents, at once

Two projects on one machine would both want ports 4321 and 4322. In each one:

```
mise run site:ports        two free ports of its own, written to mise.local.toml (git ignores it)
```

Everything else is already separate: what the sign-in tasks save is named by the site's folder,
and a deployed site by its address. For agents working side by side on one repo: a git worktree
each, `site:ports` in each. The full test runs three sites at once this way.

## Good to know

- **Every task is safe to run again**, and the test runs each of them twice. A task that deletes
  or publishes asks first; in CI nothing asks.
- **Every task prints where it is acting** — the site folder, this machine or the deployed site —
  before it acts.
- What a task needs, stops or leaves behind is in its description: [`docs/tasks.md`](docs/tasks.md).

## Working on emdash-run

```
mise run test          the everyday tasks from an empty folder, about a minute
mise run test:full     everything: both templates, then the deployed-site tasks — about 8 minutes
mise run docs          rebuild every generated page (the tests and the commit check do it too)
mise run hooks         once per clone: turns on the commit check
```

The commit check keeps three things together (running a test turns it on too, and CI fails on
stale pages). A commit that touches `tasks.toml`, the test or this
README is refused if a task has no test step, if a test step names a task that is gone, or if the
pages built from them (the task table above, [`docs/`](docs/)) are out of date — it rebuilds them
and asks you to add them.

Each runs as another developer would — a clean environment, an empty config folder, its own site
in a temporary folder — and adds its results to [`docs/status.md`](docs/status.md). To
try a task by hand here, `mise run site:new` makes a `site/` (gitignored). The plan is in [`docs/plans/`](docs/plans/); the
rules for agents are in [`docs/agents/README.md`](docs/agents/README.md).
