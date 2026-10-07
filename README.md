# emdash-run

[![stages](https://github.com/joeblew999/emdash-run/actions/workflows/stages.yml/badge.svg)](https://github.com/joeblew999/emdash-run/actions/workflows/stages.yml)

**The stages of working on an [EmDash](https://docs.emdashcms.com) site, as a few `mise` tasks.**


https://github.com/joeblew999/emdash-run


Each task is EmDash's own commands in the right order — its scaffolder, its dev server, its CLI,
Astro's and wrangler's — and nothing is copied into your repo. Where no command exists, four small
scripts in [`admin/`](admin/) cover the gap.

**What works right now is a file, not a claim: [`docs/status.md`](docs/status.md)**, written by
`mise run test` in this repo.

> `v0.7.0` is the last release. Signing in, deploying and `--live` are on `main` and not yet in a
> release; they have run on macOS only. What is left: [`docs/plans/`](docs/plans/).

## Use it in your repo

You need [mise](https://mise.jdx.dev). Put this in a `mise.toml`:

```toml
[settings]
experimental = true

[tools]
node = "26"
pnpm = "12"

[task_config]
includes = ["git::https://github.com/joeblew999/emdash-run.git//tasks.toml?ref=v0.7.0"]
```

The tools are your project's: the tasks run whatever `node` and `pnpm` your `mise.toml` names
(EmDash needs Node 22.16 or later). Leave the block out and they run whatever the machine has.

Then:

```
mise run site:new -- cloudflare:blog   a site, once — or node:blog, cloudflare:starter, …
mise run site:start                    install, make its key if it has none, run it in the background
mise run site:logs                     follow the running site's log
mise run site:stop
mise run site:check                    before a commit: the seed is valid, the types check, it builds
mise run site:preview                  the built site on this machine (port 4322): real sign-in, like a deployed one
mise run site:reset                    the local site back to its seed — it asks first
mise run site:delete                   remove site/ again — it asks first

mise run model:sync                    after a model change in the admin: record it in the repo
mise run content:pull                  the deployed site's content, as a package on this machine

mise run plugin:new -- save-log        a plugin of your own: scaffolded, tested, built, added to the site
mise run plugin:check -- save-log      its manifest, types, tests, build and registry bundle
mise run plugin:add -- <npm package>   someone else's plugin, declared in the repo
mise run plugin:publish -- save-log    release it to EmDash's registry — it asks first
mise run plugin -- search forms        anything else in EmDash's plugin CLI

mise run live:ship                     check, deploy to Cloudflare with the site's secrets, wait for it to answer
mise run live:undo                     the previous version back — code only
mise run live:logs                     follow the deployed site's log
mise run live:backup                   the database's bookmark, and the site as a package
mise run model:sync -- --live          the deployed site's model, recorded in the repo
mise run emdash:update                 the site on the newest EmDash, type-checked and built

mise run signin:token                  a machine is a full user of the built site — no browser
mise run signin:access                 people sign in to the deployed site through Cloudflare Access
mise run signin:passkey                a machine signs in through EmDash's real wizard (needs Playwright)
mise run signin:open                   a browser window signed in to the admin, for you (needs Playwright)

mise run emdash -- content list posts  anything else, through EmDash's own CLI
```

### This machine or the deployed site

**No flag is this machine. `--live` is the deployed site** — the address in `LIVE_URL`, under `[env]`
in your `mise.toml`. With no `LIVE_URL`, `--live` says so and stops.

```
mise run emdash -- content list posts            this machine
mise run emdash -- content list posts --live     the deployed site
mise run model:sync -- --live
fnox exec -- mise run signin:token -- --live     tasks that change Cloudflare take your token from fnox
```

`site:` tasks are always this machine; `live:` tasks are always the deployed site. This machine has
two sites: the dev one (`site:start`, port 4321) and the built one (`site:preview`, port 4322). The
`signin:` tasks act on the built one and start it if it is not running; `emdash` acts on the dev one
unless you add `--preview`.

Run a task where there is no site and it says so, and what to do.

Two more, not in the list because other tasks run them: `site:preview` (the production build,
served on this machine) and `live:check` (`site:check`, then wrangler's dry run of the deploy).

After `site:start`, open
`http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`. That is EmDash's own
development sign-in: the first time, it sets the site up with the template's sample content.

## Choosing a template

`<platform>:<template>` — the way EmDash's scaffolder spells it.

| | `blog` | `starter` | `marketing` | `portfolio` |
|---|---|---|---|---|
| **Cloudflare** — Workers, D1, R2 | `cloudflare:blog` | `cloudflare:starter` | `cloudflare:marketing` | `cloudflare:portfolio` |
| **Node.js** — SQLite file, local uploads | `node:blog` | `node:starter` | `node:marketing` | `node:portfolio` |

Say it as an argument, `mise run site:new -- node:blog`, or set `TEMPLATE = "node:blog"` under
`[env]` in your `mise.toml`. With neither you get `cloudflare:blog`. A name that is not in the table
is refused and nothing is made.

## An existing site

The tasks look for the site in a `site/` folder beside `mise.toml`. An existing EmDash repo usually
*is* the site — `astro.config.mjs` at its root. Say so, and everything but two tasks works there:

```toml
[env]
SITE_FOLDER = "."
```

Every task runs on it but two. `site:new` and `site:delete` refuse:
there is nothing to make, and the folder they would remove is your project. They only ever work on
a plainly named folder of its own — never `.`, never a path that leaves the project.

## Settings

All optional, under `[env]` in your `mise.toml`:

| setting | default | what it does |
|---|---|---|
| `TEMPLATE` | `cloudflare:blog` | what `site:new` makes when it is given no argument |
| `SITE_FOLDER` | `site` | where the site is — `.` when the repo itself is the site |
| `SITE_PORT` | `4321` | the port the site runs on — give each project its own to run several at once |
| `PREVIEW_PORT` | `4322` | the port `site:preview` serves the built site on |
| `SITE_SEED` | — | `none` for a site with no seed file, so `site:check` does not ask EmDash to validate one |
| `ADMIN_EMAIL`, `ADMIN_NAME` | — | who the `signin:` tasks make the deployed site's administrator, and who `signin:access` lets in. Use your own address: a login provider added later links to the account with the same verified address |
| `LIVE_URL` | — | the address of the deployed site; the `live:` tasks and `content:pull` need it |
| `PLUGIN_PUBLISHER`, `PLUGIN_AUTHOR`, `PLUGIN_SECURITY_EMAIL` | — | who publishes your plugins. `plugin:new` needs all three: EmDash's scaffolder refuses without them, and the publisher must be a real Atmosphere handle or a DID |

## What is proven

[`docs/status.md`](docs/status.md) is the record: every step of the last test run, pass or fail,
with the date, the commit and the machine. `mise run test` (about a minute) runs the everyday path
from an empty folder; `mise run test:full` runs every task that needs no deployment, on a
Cloudflare and a Node.js template side by side.

- **macOS:** everything in the status file, on every change.
- **Linux and Windows:** the tasks in `v0.7.0` passed there
  ([`stages.yml`](.github/workflows/stages.yml), run 37565911607). What has been added since has
  not run there. The workflow now runs the same `mise run test:full`, by hand or on a release tag.
- **A deployed site:** `live:ship`, `live:undo`, `live:logs`, `live:backup`, `signin:access`,
  `signin:token -- --live`, `signin:open -- --live`, `content:pull` and `model:sync -- --live`
  were run by hand against one Worker behind Cloudflare Access. They are not in the test: it has
  no deployed site to use.

## What to know

- **Updating is changing the tag** in that line. A project pointing at `main` instead does not
  update by itself — mise keeps the first copy it fetched; or add `task.remote_no_cache = true` under
  `[settings]` to fetch every time (about a second per command); or run `mise cache clear` once.
- **In CI, nothing asks.** mise answers every prompt with yes when `CI` is set — `site:delete`,
  `site:reset` and `plugin:publish` included.
- **`plugin:new` and `plugin:add` stop the site first** and tell you to start it again: on Windows
  a running site does not survive packages changing under it.
- **Signing in.** In development (`site:start`) EmDash signs you in by itself. A built site — on
  this machine or deployed — has real sign-in, and there are several ways, kept side by side:

  | task | signs in | needs Playwright | for |
  |---|---|---|---|
  | `signin:token` | a machine | no | everyday: the CLI, agents, CI. Writes an administrator and an EmDash API token straight into the site's database |
  | `signin:access` | people, plus a pass for machines | no | a deployed site: Cloudflare Access in front of the admin; sign in with a code sent to `ADMIN_EMAIL` |
  | `signin:passkey` | a machine | yes, and Chrome or Edge | testing EmDash's own setup wizard and CLI login |
  | `signin:open` | a person | yes, and Chrome or Edge | a signed-in browser window, with what `signin:token` or `signin:passkey` saved |

  What they save is in `~/.config/emdash-run/` on your machine, never in the repo: tokens, the
  Access pass, passkeys — named by site, so many sites and many machines do not collide. With
  `--live`, `signin:token` also writes EmDash's own sign-in store, so the plain `emdash` CLI works.
  These are for development sites: whoever can write to a site's database can make themselves its
  administrator this way. The tasks that change Cloudflare need a token with D1 and Access rights —
  wrangler's own login can read Access but not change it — and take it from fnox:
  `fnox exec -- mise run signin:access`.
- **A plugin lives inside the site**, in `plugins/<name>`, so the path to it is the same whether
  the site is in `site/` or is the project. After `plugin:new` or `plugin:add` you add two lines
  to `astro.config.mjs` yourself — the task prints them. No command of EmDash's makes that edit.
- **`content:pull` writes to `backups/` in the site.** Keep that folder out of git: a package
  holds drafts too.
- **The EmDash version is your site's**, in `site/package.json` and its lockfile — not a setting here.
- **Everything else is EmDash's.** Its scaffolder gives the site the agent skills
  (`site/.agents/skills/`), the docs MCP config and an encryption key in a gitignored `.env`.

## Not here yet

- A release with everything since `v0.7.0` in it.
- `signin:token -- --live` for a Node.js site: its deployed database is wherever you host it.
- `plugin:publish` has never published: it needs a registry login.

The plan: [`docs/plans/2026-10-07-next.md`](docs/plans/2026-10-07-next.md). How the tasks were
arrived at, with the command behind every step: [`docs/plans/done/`](docs/plans/done/).

## This repo

It uses its own tasks: `site/` here was made by `mise run site:new`, and `mise.toml` includes
`tasks.toml` from beside it. Working on the tasks themselves: [`docs/agents/README.md`](docs/agents/README.md).
