# emdash-run

[![verify](https://github.com/joeblew999/emdash-run/actions/workflows/verify.yml/badge.svg)](https://github.com/joeblew999/emdash-run/actions/workflows/verify.yml)
[![release](https://img.shields.io/github/v/release/joeblew999/emdash-run)](https://github.com/joeblew999/emdash-run/releases/latest)
![macOS](https://img.shields.io/badge/macOS-works-brightgreen?logo=apple)
![Linux](https://img.shields.io/badge/Linux-works-brightgreen?logo=linux&logoColor=white)
![Windows](https://img.shields.io/badge/Windows-works-brightgreen)
![Cloudflare](https://img.shields.io/badge/runs%20on-Cloudflare-f38020?logo=cloudflare&logoColor=white)
![Node.js](https://img.shields.io/badge/runs%20on-Node.js-5fa04e?logo=nodedotjs&logoColor=white)
![mise](https://img.shields.io/badge/tasks-mise-blueviolet)
![nushell](https://img.shields.io/badge/logic-nushell-4e9a06)

**Develop and run [EmDash](https://docs.emdashcms.com) from any repo, on any OS, with one set of mise tasks.**

The real published `emdash`, an official template, the official CLIs — wired together so that each
job is one command: bring a site up, model content, build a plugin, deploy and verify, back up and
restore. You own about 30 lines of settings; the rest is the harness, and `mise run upgrade` updates it.

## Get started — in your own repo

You need [mise](https://mise.jdx.dev) and git. In your repo (or an empty folder):

```sh
# macOS, Linux
curl -fsSL https://raw.githubusercontent.com/joeblew999/emdash-run/main/install.sh | sh
```
```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/joeblew999/emdash-run/main/install.ps1 | iex
```

No Cloudflare? Start on plain Node.js instead — same tasks, nothing to sign up for:

```sh
curl -fsSL https://raw.githubusercontent.com/joeblew999/emdash-run/main/install.sh | sh -s -- starter
```
```powershell
$env:EMDASH_TEMPLATE = "starter"; irm https://raw.githubusercontent.com/joeblew999/emdash-run/main/install.ps1 | iex
```

That is the whole install. It fetches the harness, gives you a `mise.toml` of settings, installs the
toolchain, builds a site from an official template, starts it, checks it, and prints:

```
✓ EmDash 1.1.0 is running — the starter-cloudflare template, on your settings
  site    http://localhost:4321
  admin   http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
  mcp     http://localhost:4321/_emdash/api/mcp — bearer token in run/token-admin.txt
```

From then on:

```
mise run open        the admin, signed in
mise run status      what is running, and on what
mise run dev         after you change settings, the seed or a plugin — page edits reload by themselves
```

<details><summary>What the installer does, if you would rather run it by hand</summary>

```sh
git init          # unless the folder is already a repo
curl -fsSL https://github.com/joeblew999/emdash-run/releases/latest/download/emdash-harness.tar.gz | tar xz
cp nu/project.example.toml mise.toml
mise trust --all
mise run setup
```
</details>

## You are not locked into Cloudflare

EmDash runs on Cloudflare **or** on plain Node.js, and so does this. It is one line in your
`mise.toml`:

| `TEMPLATE =` | runs on | database | media | you need |
|---|---|---|---|---|
| `starter-cloudflare`, `blog-cloudflare`, `marketing-cloudflare`, `portfolio-cloudflare` | Cloudflare Workers | D1 | R2 | a Cloudflare account, to deploy |
| `starter`, `blog`, `marketing`, `portfolio` | Node.js — any host, any container, your own server | a SQLite file | local files | nothing |

To start on Node.js, pass the template to the installer —
`curl -fsSL …/install.sh | sh -s -- starter` — or change `TEMPLATE` and run `mise run setup`.

**The tasks are the same on both.** `dev`, `check`, `doctor`, `snapshot`, `restore`, the plugin
flows — identical. What differs is only what a platform cannot offer:

- `deploy` on Cloudflare builds, ships and verifies what is live. On Node.js it builds, and tells
  you how to start it — where it runs is yours to choose.
- `rollback` and `logs -- --deployed` talk to Cloudflare, and say so on Node.js.

**Plugins are sandboxed on both.** A plugin made by `mise run plugin:new` runs isolated, with only
the capabilities its manifest declares — in Cloudflare's Worker Loader, or in `workerd` under
Node.js. One kind of plugin, the same security, either platform. You never have to fall back to
trusted "native" plugins to leave Cloudflare.

**Minimal Debian** needs `apt install libatomic1` before the install.
**Deploying to Cloudflare** needs credentials in [fnox](https://fnox.jdx.dev)
(`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) and `DEPLOY_URL` in your `mise.toml`. Local
development needs neither.

**Something broke?** `mise run report` prints your versions, status and recent site log — paste it
into [a new issue](https://github.com/joeblew999/emdash-run/issues/new/choose).

## Fully verified

[![full verification](https://github.com/joeblew999/emdash-run/actions/workflows/full.yml/badge.svg)](https://github.com/joeblew999/emdash-run/actions/workflows/full.yml)

Nothing here is "should work". Every row below is a job that runs the **same `mise run` command you
run on your laptop** — no CI-only scripts — and a release is published **only if all of them pass**.

| what is proven | macOS | Linux | Windows |
|---|:-:|:-:|:-:|
| **The installer** a new dev runs, in an empty folder — Cloudflare template | ✅ | ✅ | ✅ |
| **The installer** — plain Node.js template, no Cloudflare | ✅ | ✅ | ✅ |
| **Site up + `check` + `doctor`** — Cloudflare | ✅ | ✅ | ✅ |
| **Site up + `check` + `doctor`** — Node.js | ✅ | ✅ | ✅ |
| **A plugin scaffolded, loaded, and called by the running site** — Cloudflare | ✅ | ✅ | ✅ |
| **A plugin scaffolded, loaded, and called by the running site** — Node.js | ✅ | ✅ | ✅ |
| **Snapshot of the whole site + production build** — both platforms | ✅ | ✅ | ✅ |
| **Task arguments arrive intact** — spaces, JSON, quotes, flags | ✅ | ✅ | ✅ |
| **The harness's own checks can fail** — known faults planted, each must be caught | ✅ | ✅ | ✅ |

Deploying to a live Cloudflare account is not in CI — it needs credentials. `deploy` and `rollback`
each end in a `doctor` pass on the deployment.

- **On every push and pull request** ([`verify`](.github/workflows/verify.yml)): `mise run check`
  on all three OSes — seconds. It is what catches a portability slip.
- **The whole table above** ([`full verification`](.github/workflows/full.yml)) is run by hand when
  the cross-platform layer changes — it is about 15 jobs, so it is not spent on every release.
- **A release** ([`release`](.github/workflows/release.yml)) is a tag: the fast check, then the
  tarball is published. About a minute.
- **On your machine**: `mise run verify -- --full` runs the same flow on your project's template;
  `mise run verify:template -- starter --full` runs it on a Node.js one.

It is also **portable by construction**: the logic is nushell and runs only programs mise installs, plus
git (and docker, for `verify:linux`) — no curl, no symlinks — and `mise run check` fails if one
creeps in.

## Every day

```
mise run status                   what is running, and on what
mise run dev                      after any change: config, seed, plugins, a restart if one is needed — prints the URLs
mise run check                    before a commit (the git hook runs it)        --fix repairs
mise run doctor                   is the running site what the repo says?       --url <deployment>
mise run deploy                   check, build, ship to Cloudflare, verify      --dry
mise run rollback                 put the previous deployment back
mise run snapshot                 the site's content as a package               --database: a real backup
mise run restore -- <package>     …and back again — or a backup directory       --wipe --confirm
mise run reset                    wipe the local database, back up on the seed
mise run logs                     follow the site                               --deployed
mise run plugin:new -- <name>     scaffold a plugin and load it into the running site
mise run emdash -- <anything>     the official CLI: schema, content, media, taxonomy, menu, search…
mise run upgrade                  take a newer harness
                                  (a newer EmDash: change EMDASH_VERSION in mise.toml, then mise run dev)
mise run verify                   does it all work on this machine? what CI runs      --full
mise run report                   something broke? prints what to paste into an issue
```

Each task is a **flow** — one command for a whole job. `mise tasks ls` lists all 22;
[`docs/tasks.md`](docs/tasks.md) is the same list. Add `-- --help` to any of them.

## Back up, and move content

Two different things, and the difference matters on the day you need one:

| | `mise run snapshot` | `mise run snapshot -- --database` |
|---|---|---|
| what it is | EmDash's site package (`.emdash`): schema, content, media | the database itself, and locally the media beside it |
| users, API tokens, plugin data | **no** | yes |
| goes back with | `restore -- <package>` into an **empty** site | `restore -- <directory> --confirm`, in place |
| for | moving content to another site | disaster recovery |

Neither holds `EMDASH_ENCRYPTION_KEY` (`site/.env`) — keep a copy of that somewhere else.

- **Locally and on Node.js**, `--database` stops the site, copies the database with its `-wal` and
  `-shm` files and the uploads into `run/backups/`, and starts the site again. `dev` makes the same
  copy by itself before it moves the site to another EmDash version.
- **For a Cloudflare deployment** (`-- --database --url <deployment>`) it records the D1 Time Travel
  bookmark and writes a SQL dump to `run/backups/`, with the commands that restore from either in
  `restore.txt` beside it. `deploy` prints the bookmark before it ships. The media bucket is not
  included; the file says how to copy it.

**Getting your content onto a new deployment.** A production site's first boot applies your seed's
model, not its content. So: finish the setup wizard on the deployment (no sample content), then

```
mise run snapshot
mise run restore -- run/snapshots/<file>.emdash --url <deployment>             # shows the plan
mise run restore -- run/snapshots/<file>.emdash --url <deployment> --confirm
```

If that is cut off, run the last line again: it finishes the import it started.

**Without a person.** Every `--url` flow signs in with `DEPLOY_TOKEN` when it is set — an API token
made in the deployment's admin. It is a secret: export it in the CI job, or put it in the gitignored
`mise.local.toml`. Without one, the flows use what `mise run emdash -- login --url <deployment>`
stored. (`EMDASH_TOKEN` is deliberately removed from every task, even when your shell exports it,
so a stale one cannot redirect a call. `DEPLOY_TOKEN` is not tied to a site: while it is exported in
a shell, every `--url` flow run from that shell sends it to whatever URL it is given.)

## What is yours, and what is the harness's

| | whose | what |
|---|---|---|
| `site/` | **yours** | the site itself — pages, layouts, components, `astro.config.mjs`, `wrangler.jsonc`, `seed/seed.json`. `setup` creates it once from the template; after that the harness never overwrites it |
| `mise.toml` | **yours** | your settings: template, EmDash version, deploy URL, what `doctor` checks |
| `plugins/` | **yours** | your plugins, made by `plugin:new` |
| `.config/mise/conf.d/harness.toml`, `nu/` | the harness's | tools, tasks, daemons, and the logic. Don't edit — `mise run upgrade` replaces them |
| `.src/`, `run/` | generated | reference checkouts, tokens, snapshots, database backups. Gitignored |

**Build your site in `site/`.** Edit a page and the dev server reloads it — no command to run.
Run `mise run dev` when you change settings, the seed, or a plugin. Commit `site/` like any code.

## Plugins

```
mise run plugin:new -- my-plugin      scaffold (official CLI), install, test, build, load, call it
mise run plugin:release               validate, typecheck, test, build, bundle
```

It works on a new project with no setup: the first `plugin:new` switches on plugin loading in your
site config. On Cloudflare that enables the Worker Loader binding, which needs the Workers Paid plan
to deploy — a project with no plugins stays on the template's free-plan defaults. [`docs/plugin.md`](docs/plugin.md) explains what happens at each step,
what the official scaffold gets wrong, and how the harness fixes it.

## More

- [`CHANGELOG.md`](CHANGELOG.md) — what each release changed, and its known limits
- [`docs/plugin.md`](docs/plugin.md) — the plugin round trip
- [`docs/auth.md`](docs/auth.md) — EmDash's auth model and tokens
- [`docs/agents/`](docs/agents/README.md) — working on the harness itself, for people and agents
- [`docs/agents/lessons.md`](docs/agents/lessons.md) — what building this taught us, and what is now enforced
- [`docs/emdash.md`](docs/emdash.md) — EmDash itself, read from its source: the pieces, the platforms, and how the harness maps onto them
- [`docs/plans/`](docs/plans/) — what is left

This repo is also a working project: its own `mise.toml` and `site/` are a plain `starter-cloudflare`
site that the harness is tested against. Start from the release above, not from a clone, unless you
are working on the harness.
