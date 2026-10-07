# emdash-run

Work on an [EmDash](https://docs.emdashcms.com) site with a few `mise` tasks: make a site, run it,
check it, sign in, deploy it. Each task runs EmDash's own commands in the right order.

https://github.com/joeblew999/emdash-run

**What works right now: [`docs/status.md`](docs/status.md)** — the last test run, step by step.

> `v0.7.0` is the last release. Signing in, deploying and `--live` are newer: they are on `main`
> and have only been run on macOS.

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
includes = ["git::https://github.com/joeblew999/emdash-run.git//tasks.toml?ref=main"]
```

`ref=v0.7.0` pins the release. With `ref=main`, mise keeps the copy it fetched first; run
`mise cache clear` to take a newer one.

## The tasks, in the order you use them

This table is written by the test, from the order it runs the tasks in. Run one with
`mise run <task>`; `mise tasks ls` shows them all.

<!-- in-order:begin (written by tests/status.mjs — run a test, do not edit) -->
**On this machine**

| | task | what it does | tested |
|---|---|---|---|
| 1 | `mise run site:start` | Start the dev site in the background (port 4321). EmDash signs you in by itself | yes |
| 2 | `mise run site:new` | Make a new site. Template: mise run site:new -- node:blog (default cloudflare:blog) | yes |
| 3 | `mise run site:logs` | Follow the dev site's log | yes |
| 4 | `mise run emdash` | EmDash's CLI. This machine by default; add --live for the deployed site, --preview for the built site | yes |
| 5 | `mise run site:check` | Before a commit: seed valid, types check, site builds | yes |
| 6 | `mise run model:sync` | Record the site's content model in the repo (.emdash/). Add -- --live for the deployed site | yes |
| 7 | `mise run site:preview` | Build the site and serve it locally (port 4322) — behaves like a deployed site | yes |
| 8 | `mise run signin:token` | Sign a machine in, no browser: admin + API token written to the site's database. Add -- --live for deployed | yes |
| 9 | `mise run live:check` | Hidden. site:check, then a dry run of the deploy | yes |
| 10 | `mise run content:pull` | Download the deployed site's content as a package into backups/ | yes |
| 11 | `mise run signin:open` | Open a browser window already signed in to the admin. Needs Playwright + Chrome | yes |
| 12 | `mise run plugin:new` | Make a plugin inside the site: scaffold, test, build, add. mise run plugin:new -- <name> | yes |
| 13 | `mise run plugin:check` | Check a plugin: manifest, types, tests, build, bundle. mise run plugin:check -- <name> | yes |
| 14 | `mise run plugin:add` | Add a plugin from npm. mise run plugin:add -- <package> | yes |
| 15 | `mise run plugin:search` | Search EmDash's plugin registry. mise run plugin:search -- forms | yes |
| 16 | `mise run plugin` | Anything else in EmDash's plugin CLI. mise run plugin -- info <publisher> <slug> | yes |
| 17 | `mise run emdash:update` | Update the site to the newest EmDash, then type-check and build | yes |
| 18 | `mise run site:reset` | Empty the local database and start again from the seed. Asks first | yes |
| 19 | `mise run signin:passkey` | Sign a machine in through EmDash's real setup wizard. Needs Playwright + Chrome | yes |
| 20 | `mise run site:admin` | Hidden. Fresh built site + signin:passkey in one go. Empties the local database | yes |
| 21 | `mise run site:delete` | Delete the site folder. Asks first | yes |
| 22 | `mise run site:stop` | Stop the dev site and the built site | yes |

**On the deployed site**

| | task | what it does | tested |
|---|---|---|---|
| 1 | `mise run live:ship` | Deploy to Cloudflare: check, deploy, wait for the site to answer | yes |
| 2 | `mise run live:undo` | Roll the deployed site back to the previous version (code only) | **FAILS** |
| 3 | `mise run site:new` | Make a new site. Template: mise run site:new -- node:blog (default cloudflare:blog) | yes |
| 4 | `mise run signin:access` | Put Cloudflare Access in front of the deployed site's admin (sign in by emailed code) | yes |
| 5 | `mise run signin:token` | Sign a machine in, no browser: admin + API token written to the site's database. Add -- --live for deployed | yes |
| 6 | `mise run emdash` | EmDash's CLI. This machine by default; add --live for the deployed site, --preview for the built site | yes |
| 7 | `mise run model:sync` | Record the site's content model in the repo (.emdash/). Add -- --live for the deployed site | yes |
| 8 | `mise run content:pull` | Download the deployed site's content as a package into backups/ | yes |
| 9 | `mise run live:backup` | Back up the deployed site: database bookmark + content package | yes |
| 10 | `mise run live:logs` | Follow the deployed site's log | yes |
| 11 | `mise run signin:open` | Open a browser window already signed in to the admin. Needs Playwright + Chrome | yes |
| 12 | `mise run site:delete` | Delete the site folder. Asks first | yes |
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

## This machine or the deployed site

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

| task | signs in | browser? | use it for |
|---|---|---|---|
| `signin:token` | a machine | no | the CLI, agents, CI — the everyday one |
| `signin:access` | people | no | a deployed site: Cloudflare Access, sign in by emailed code |
| `signin:passkey` | a machine | Playwright + Chrome | testing EmDash's own setup wizard |
| `signin:open` | you | Playwright + Chrome | a browser window already signed in |

```
mise run signin:token                 this machine's built site
mise run signin:token -- --live       the deployed site
```

These are for development sites. What they save is in `~/.config/emdash-run/` on your machine,
never in the repo.

## Deploying (Cloudflare)

Sign in to Cloudflare once: `mise x -- pnpm dlx wrangler login`. Then:

```
mise run signin:access                once: Cloudflare Access in front of the admin
mise run live:ship                    check, deploy, wait for it to answer
mise run signin:token -- --live       once: the CLI is signed in
mise run live:logs
mise run live:undo                    back to the previous version
mise run live:backup
```

Everything uses that wrangler login except `signin:access`: wrangler's login can read Cloudflare
Access but not change it. For that one task, make an API token in the Cloudflare dashboard
(My Profile → API Tokens) with **Access: Apps and Policies — Edit** and **Access: Service Tokens —
Edit**, and store it with [fnox](https://fnox.jdx.dev), which the task reads by itself:

```
fnox init                             once per machine
fnox set CLOUDFLARE_API_TOKEN         it asks for the value
```

Or set `CLOUDFLARE_API_TOKEN` in your environment any other way.

## Plugins

```
mise run plugin:new -- save-log        your own, inside the site
mise run plugin:add -- <npm package>   someone else's
mise run plugin:check -- save-log
mise run plugin:search -- forms
mise run plugin -- <anything else in EmDash's plugin CLI>
```

After `plugin:new` or `plugin:add` you add two lines to the site's `astro.config.mjs`; the task
prints them.

## Settings

All optional, under `[env]` in your `mise.toml`.

| setting | default | |
|---|---|---|
| `TEMPLATE` | `cloudflare:blog` | what `site:new` makes |
| `SITE_FOLDER` | `site` | where the site is |
| `SITE_PORT` | `4321` | the dev site's port |
| `PREVIEW_PORT` | `4322` | the built site's port |
| `LIVE_URL` | — | the deployed site |
| `ADMIN_EMAIL` | — | who may sign in to the deployed site |
| `SITE_SEED` | — | `none` if the site has no seed file |
| `PLUGIN_PUBLISHER`, `PLUGIN_AUTHOR`, `PLUGIN_SECURITY_EMAIL` | — | needed by `plugin:new` |

## Good to know

- `site:reset`, `site:delete` and `plugin:publish` ask first. In CI nothing asks.
- `plugin:new` and `plugin:add` stop the site; start it again afterwards.
- `content:pull` and `live:backup` write to `backups/` in the site. Keep it out of git.
- There is no SQL dump in `live:backup`: Cloudflare's export refuses an EmDash database.
- `signin:token -- --live` works for Cloudflare sites only.

## Working on this repo

```
mise run test          the everyday tasks from an empty folder, about a minute
mise run test:full     everything: both templates, then the deployed-site tasks — about 8 minutes
```

Each runs as another developer would — a clean environment, an empty config folder, its own site
in a temporary folder — and adds its results to [`docs/status.md`](docs/status.md). To
try a task by hand here, `mise run site:new` makes a `site/` (gitignored). The plan is in [`docs/plans/`](docs/plans/); the
rules for agents are in [`docs/agents/README.md`](docs/agents/README.md).
