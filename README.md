# emdash-run

[![stages](https://github.com/joeblew999/emdash-run/actions/workflows/stages.yml/badge.svg)](https://github.com/joeblew999/emdash-run/actions/workflows/stages.yml)

**The stages of working on an [EmDash](https://docs.emdashcms.com) site, as a few `mise` tasks.**

Each task is EmDash's own commands in the right order: its scaffolder, its dev server, its CLI.
There is no script underneath and nothing is copied into your repo.

> Until 2026-10-07 this repo was a nushell harness; release 0.6.1 is that, and is no longer
> developed (it is kept in [`reference/nushell-harness/`](reference/nushell-harness/)). `v0.7.0` is
> the first release of what is below. What is coming is in [`docs/plans/`](docs/plans/).

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
mise run site:preview                  the production build, served on this machine — signs in like a deployed site
mise run site:admin                    that build with an administrator and a signed-in CLI, nobody at a browser
mise run site:reset                    the local site back to its seed — it asks first
mise run site:delete                   remove site/ again — it asks first

mise run model:sync                    after a model change in the admin: record it in the repo
mise run content:pull                  the deployed site's content, as a package on this machine

mise run plugin:new -- save-log        a plugin of your own: scaffolded, tested, built, added to the site
mise run plugin:check -- save-log      its manifest, types, tests, build and registry bundle
mise run plugin:add -- <npm package>   someone else's plugin, declared in the repo
mise run plugin:publish -- save-log    release it to EmDash's registry — it asks first
mise run plugin -- search forms        anything else in EmDash's plugin CLI

mise run live:check                    would this deploy — wrangler's dry run, no account needed
mise run live:ship                     put it live on Cloudflare, and wait for it to answer
mise run live:key                      once, after the first ship: the encryption key, as a secret
mise run live:admin                    the deployed site set up and the CLI signed in to it, nobody at a browser
mise run live:undo                     the previous version back — code only
mise run live:logs                     follow the deployed site's log
mise run live:backup                   the database's bookmark, and the site as a package
mise run model:sync -- --live          the deployed site's model, recorded in the repo
mise run emdash:update                 the site on the newest EmDash, type-checked and built

mise run emdash -- content list posts  anything else, through EmDash's own CLI
```

Run a task where there is no site and it says so, and what to do.

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
| `PREVIEW_PORT` | `4322` | the port `site:preview` serves the production build on |
| `SITE_SEED` | — | `none` for a site with no seed file, so `site:check` does not ask EmDash to validate one |
| `ADMIN_EMAIL`, `ADMIN_NAME` | — | who `live:admin` makes the deployed site's first administrator. Use your own address: a login provider added later links to the account with the same verified address |
| `LIVE_URL` | — | the address of the deployed site; the `live:` tasks and `content:pull` need it |
| `PLUGIN_PUBLISHER`, `PLUGIN_AUTHOR`, `PLUGIN_SECURITY_EMAIL` | — | who publishes your plugins. `plugin:new` needs all three: EmDash's scaffolder refuses without them, and the publisher must be a real Atmosphere handle or a DID |

## What is proven

On every push that changes the tasks, [`stages.yml`](.github/workflows/stages.yml) starts from an
empty folder holding only the `mise.toml` above and runs the commands a developer types — on
**macOS, Linux and Windows**, on a Cloudflare and on a Node.js template:

- `site:new`, by a setting and by an argument; the right platform comes out; a wrong name is refused
- `site:start`; the site answers; EmDash's sign-in sets it up
- `emdash`, with a flag and with a quoted argument that contains spaces
- `site:start` again leaves the running site alone; `site:stop` stops it
- `site:delete` refuses without a yes and deletes with one
- with no site, a task says so plainly
- `site:check` passes beside the running site and fails on a type error
- `live:check` rehearses the deploy with no account (Cloudflare)
- `model:sync` records a model change; `content:pull` brings a package down
- `plugin:new`, `plugin:check`, `plugin:add`
- `site:reset` refuses without a yes, and puts the site back on its seed
- an existing site at the project root: `site:start`, `emdash`, `site:check`, `model:sync` and
  `site:reset` run on it; `site:new` and `site:delete` refuse, and the project is left whole

By hand, on macOS: a sandboxed plugin made by `plugin:new` answering on a Cloudflare site and on a
Node.js site once the two lines were added to `astro.config.mjs`; and a package from `content:pull`
loaded into an empty site with EmDash's two import commands.

## What to know

- **Updating is changing the tag** in that line. A project pointing at `main` instead does not
  update by itself — mise keeps the first copy it fetched; or add `task.remote_no_cache = true` under
  `[settings]` to fetch every time (about a second per command); or run `mise cache clear` once.
- **In CI, nothing asks.** mise answers every prompt with yes when `CI` is set — `site:delete`,
  `site:reset` and `plugin:publish` included.
- **`plugin:new` and `plugin:add` stop the site first** and tell you to start it again: on Windows
  a running site does not survive packages changing under it.
- **Real sign-in without a person.** In development EmDash signs you in by itself; a build does
  not. `site:admin` empties the local database, serves the production build, and a script
  completes EmDash's setup wizard with a simulated passkey and approves the CLI's sign-in — so
  anything that needs a signed-in site can be built and tested with nobody there. It needs Chrome
  or Edge and is the one script in this repo. Then:
  `mise run emdash -- <command> --url http://localhost:4322`.
- **The same for a deployed site: `live:admin`.** It sets the site at `LIVE_URL` up as
  `ADMIN_EMAIL`, or signs in to one it set up before, and signs the CLI in. The passkey it makes
  is saved in `~/.config/emdash-run/passkeys/`, readable only by you. **That file is the way in
  to the site — whoever has it is its administrator. Keep a copy somewhere safe, and never commit
  it.** A site somebody else set up, it cannot enter and does not try.
- **A plugin lives inside the site**, in `plugins/<name>`, so the path to it is the same whether
  the site is in `site/` or is the project. After `plugin:new` or `plugin:add` you add two lines
  to `astro.config.mjs` yourself — the task prints them. No command of EmDash's makes that edit.
- **`content:pull` writes to `backups/` in the site.** Keep that folder out of git: a package
  holds drafts too.
- **The EmDash version is your site's**, in `site/package.json` and its lockfile — not a setting here.
- **Everything else is EmDash's.** Its scaffolder gives the site the agent skills
  (`site/.agents/skills/`), the docs MCP config and an encryption key in a gitignored `.env`.

## Not here yet

Deploying is built and was proven on a throwaway Worker on macOS; it is not in a release yet.
The package half of `live:backup`, `content:pull` and `model:sync -- --live` against a real
deployment wait on a person signing in to it: [`docs/plans/2026-10-07-live.md`](docs/plans/2026-10-07-live.md). How
the tasks were arrived at, with the EmDash command behind every step and the gaps that are known:
[`docs/plans/done/2026-10-07-stages.md`](docs/plans/done/2026-10-07-stages.md).

## This repo

It uses its own tasks: `site/` here was made by `mise run site:new`, and `mise.toml` includes
`tasks.toml` from beside it. Working on the tasks themselves: [`docs/agents/README.md`](docs/agents/README.md).
