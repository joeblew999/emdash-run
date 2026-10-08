---
title: "Every task"
nav_order: 3
---

<!-- Written by tests/status.mjs by mise from tasks.toml (mise generate task-docs): edit a task's description there, not this. -->

# Every task

In the order you use them. This table is written by the test, from the order it runs the tasks in. Run one with
`mise run <task>`; `mise tasks ls` shows them all. Each task's arguments and flags are in
[`docs/tasks.md`](#reference), which mise writes from the tasks themselves — a task's
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
| 8 | `live:preview` | Deploy the site as it is in this folder as a PREVIEW: an address of its own, with a database, bucket and sessions of its own, beside the live site and without touching it (Cloudflare's Worker Previews). Named after the git branch, or: mise run live:preview \-\- &lt;name&gt;. Run again: the same preview, updated. The first time it makes the preview's database, bucket and session store and writes a previews block into wrangler.jsonc. A new preview has no content. To act on one, give its address as LIVE_URL to any task that takes \-\-live. Remove it: mise run live:preview \-\- &lt;name&gt; \-\-delete | yes |
| 9 | `live:logs` | Follow the deployed site's log | yes |
| 10 | `signin:open` | Open a browser window already signed in to the admin, for you to look around. Add \-\- \-\-live for the deployed site. Needs Playwright + Chrome | yes |
| 11 | `live:undo` | Roll the deployed site back to the previous version (code only) | yes |

<!-- in-order:end -->

After `site:start`, open `http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`.
EmDash sets the site up and signs you in.

Anything in EmDash's own CLI:

```
mise run emdash -- content list posts
mise run emdash -- schema add-field pages subtitle --type string
```

## Reference

Written by mise itself from [`tasks.toml`](https://github.com/joeblew999/emdash-run/blob/main/tasks.toml): each task's description, arguments and flags. In your own project the same is one command away: `mise tasks`, or `mise run <task> --help`. What the last test showed for each, step by step, is on [What works](status.md).

## `site:ports`

- **Usage:** `site:ports`

Give this project two ports of its own (in mise.local.toml), so several projects — or several agents — can run at once

## `site:new`

Make a new site. Template: mise run site:new -- node:blog (default cloudflare:blog). A site that is already there is left alone

- **Usage:** `site:new [template]`

### Arguments
- **`[template]`** — &lt;platform>:&lt;template>

  **Choices:** `cloudflare:blog`, `cloudflare:starter`, `cloudflare:marketing`, `cloudflare:portfolio`, `node:blog`, `node:starter`, `node:marketing`, `node:portfolio`

## `site:start`

- **Usage:** `site:start`

Start the dev site in the background (port 4321). EmDash signs you in by itself, and its welcome dialog is closed for you

## `site:logs`

- **Usage:** `site:logs`

Follow the dev site's log

## `emdash`

- **Usage:** `emdash`

EmDash's CLI. This machine by default; add --live for the deployed site, --preview for the built site

## `site:check`

- **Usage:** `site:check`

Before a commit: seed valid, types check, site builds

## `model:sync`

Record the site's content model in the repo (.emdash/). Add -- --live for the deployed site

- **Usage:** `model:sync [--live]`

### Flags
- **`--live`** — Read the model of the deployed site at LIVE_URL instead of the local one

## `site:preview`

- **Usage:** `site:preview`

Build the site and serve it locally (port 4322) — behaves like a deployed site

## `signin:token`

Sign a machine in with no browser — the everyday way, for the CLI, agents and CI: an admin and an API token written to the site's database. This machine's built site; add -- --live for the deployed one (Cloudflare sites only)

- **Usage:** `signin:token [--live]`

### Flags
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

## `signin:open`

Open a browser window already signed in to the admin, for you to look around. Add -- --live for the deployed site. Needs Playwright + Chrome

- **Usage:** `signin:open [--live]`

### Flags
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

## `plugin:new`

Make a plugin of your own inside the site: scaffold, test, build, add — and print the two lines to put in astro.config.mjs. Stops the site: start it again afterwards. Run again: rebuilds and re-adds it. mise run plugin:new -- <name>

- **Usage:** `plugin:new <name>`

### Arguments
- **`<name>`** — The slug of the plugin, e.g. save-log

## `plugin:check`

Check a plugin: manifest, types, tests, build, bundle. mise run plugin:check -- <name>

- **Usage:** `plugin:check <name>`

### Arguments
- **`<name>`** — The folder name of the plugin under plugins/

## `plugin:add`

Add a plugin from npm, and print the two lines to put in astro.config.mjs. Stops the site: start it again afterwards. mise run plugin:add -- <package>

- **Usage:** `plugin:add <package>`

### Arguments
- **`<package>`** — The npm package, e.g. @emdash-cms/plugin-forms

## `plugin:search`

Search EmDash's plugin registry. mise run plugin:search -- forms

- **Usage:** `plugin:search <words>`

### Arguments
- **`<words>`** — What to look for, e.g. forms

## `plugin`

- **Usage:** `plugin`

Anything else in EmDash's plugin CLI. mise run plugin -- info &lt;publisher> &lt;slug>

## `emdash:update`

- **Usage:** `emdash:update`

Update the site to the newest EmDash, then type-check and build

## `site:reset`

- **Usage:** `site:reset`

Empty the local database and start again from the seed. Asks first

## `signin:passkey`

Sign a machine in through EmDash's real setup wizard, with a passkey — for testing the wizard itself. Add -- --live for the deployed site. Needs Playwright + Chrome

- **Usage:** `signin:passkey [--live]`

### Flags
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

## `site:stop`

- **Usage:** `site:stop`

Stop the dev site and the built site

## `site:delete`

- **Usage:** `site:delete`

Delete the site folder. Asks first. No site is nothing to delete

## `signin:access`

- **Usage:** `signin:access`

Sign people in to the deployed site: Cloudflare Access in front of its admin, by a code emailed to ADMIN_EMAIL. Uploaded media stays public. Prints three lines for astro.config.mjs and wrangler.jsonc. Needs a Cloudflare API token with Access edit rights, in CLOUDFLARE_API_TOKEN or in fnox

## `live:ship`

- **Usage:** `live:ship`

Deploy to Cloudflare: check, deploy, wait for the new version to answer. A newly deployed site has no content: it prints how to bring this machine's

## `content:pull`

- **Usage:** `content:pull`

Download the deployed site's content as a package into backups/ in the site (keep that folder out of git)

## `live:backup`

- **Usage:** `live:backup`

Back up the deployed site: a database bookmark to restore to, and a content package in backups/. No SQL dump — Cloudflare's export refuses an EmDash database

## `live:preview`

Deploy the site as it is in this folder as a PREVIEW: an address of its own, with a database, bucket and sessions of its own, beside the live site and without touching it (Cloudflare's Worker Previews). Named after the git branch, or: mise run live:preview -- <name>. Run again: the same preview, updated. The first time it makes the preview's database, bucket and session store and writes a previews block into wrangler.jsonc. A new preview has no content. To act on one, give its address as LIVE_URL to any task that takes --live. Remove it: mise run live:preview -- <name> --delete

- **Usage:** `live:preview [--delete] [name]`

### Arguments
- **`[name]`** — The preview's name: part of its address. Left out, the git branch

### Flags
- **`--delete`** — Delete this preview instead (its database, bucket and session store are kept)

## `live:logs`

- **Usage:** `live:logs`

Follow the deployed site's log

## `live:undo`

Roll the deployed site back to the previous version (code only)

- **Usage:** `live:undo [version]`

### Arguments
- **`[version]`** — A version id; left out, the one before the current

## `plugin:publish`

Publish a plugin to EmDash's registry. Asks first

- **Usage:** `plugin:publish <name>`

### Arguments
- **`<name>`** — The folder name of the plugin under plugins/
