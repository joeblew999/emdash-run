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

[task_config]
includes = ["git::https://github.com/joeblew999/emdash-run.git//tasks.toml?ref=main"]
```

`ref=v0.7.0` pins the release. With `ref=main`, mise keeps the copy it fetched first; run
`mise cache clear` to take a newer one.

## Everyday

```
mise run site:new          make a site (once)
mise run site:start        run it — http://localhost:4321
mise run site:check        before a commit
mise run site:stop
mise tasks ls              everything else
```

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
mise run signin:token                            this machine's built site
fnox exec -- mise run signin:token -- --live     the deployed site
```

These are for development sites. What they save is in `~/.config/emdash-run/` on your machine,
never in the repo.

## Deploying (Cloudflare)

```
fnox exec -- mise run signin:access              once: Cloudflare Access in front of the admin
mise run live:ship                               check, deploy, wait for it to answer
fnox exec -- mise run signin:token -- --live     once: the CLI is signed in
mise run live:logs
mise run live:undo                               back to the previous version
mise run live:backup
```

The tasks that change Cloudflare need an API token with D1 and Access rights, as
`CLOUDFLARE_API_TOKEN`. `fnox exec --` supplies it from [fnox](https://fnox.jdx.dev); any other way
of setting the variable works too.

## Plugins

```
mise run plugin:new -- save-log        your own, inside the site
mise run plugin:add -- <npm package>   someone else's
mise run plugin:check -- save-log
mise run plugin -- search forms
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
mise run test:full     every task that needs no deployment, about 5 minutes
mise run test:published   the same, with the tasks fetched from GitHub — what another developer gets
```

Each runs as another developer would — a clean environment, an empty config folder, its own site
in a temporary folder — and writes [`docs/status.md`](docs/status.md). To
try a task by hand here, `mise run site:new` makes a `site/` (gitignored). The plan is in [`docs/plans/`](docs/plans/); the
rules for agents are in [`docs/agents/README.md`](docs/agents/README.md).
