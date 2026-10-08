---
title: "Every task"
nav_order: 3
---

<!-- Written by tests/status.mjs by mise from tasks.toml (mise generate task-docs): edit a task's description there, not this. -->

# Every task

Written by mise itself from [`tasks.toml`](https://github.com/joeblew999/emdash-run/blob/main/tasks.toml): each task's description, arguments and flags. In your own project the same is one command away: `mise tasks`, or `mise run <task> --help`. The order you use them in is on [The tasks](the-tasks.md); what the last test showed for each is on [What works](status.md).

## `content:pull`

- **Usage:** `content:pull`

Download the deployed site's content as a package into backups/

## `emdash`

- **Usage:** `emdash`

EmDash's CLI. This machine by default; add --live for the deployed site, --preview for the built site

## `emdash:update`

- **Usage:** `emdash:update`

Update the site to the newest EmDash, then type-check and build

## `live:backup`

- **Usage:** `live:backup`

Back up the deployed site: database bookmark + content package

## `live:logs`

- **Usage:** `live:logs`

Follow the deployed site's log

## `live:ship`

- **Usage:** `live:ship`

Deploy to Cloudflare: check, deploy, wait for the site to answer

## `live:undo`

Roll the deployed site back to the previous version (code only)

- **Usage:** `live:undo [version]`

### Arguments
- **`[version]`** — A version id; left out, the one before the current

## `model:sync`

Record the site's content model in the repo (.emdash/). Add -- --live for the deployed site

- **Usage:** `model:sync [--live]`

### Flags
- **`--live`** — Read the model of the deployed site at LIVE_URL instead of the local one

## `plugin`

- **Usage:** `plugin`

Anything else in EmDash's plugin CLI. mise run plugin -- info &lt;publisher> &lt;slug>

## `plugin:add`

Add a plugin from npm. mise run plugin:add -- <package>

- **Usage:** `plugin:add <package>`

### Arguments
- **`<package>`** — The npm package, e.g. @emdash-cms/plugin-forms

## `plugin:check`

Check a plugin: manifest, types, tests, build, bundle. mise run plugin:check -- <name>

- **Usage:** `plugin:check <name>`

### Arguments
- **`<name>`** — The folder name of the plugin under plugins/

## `plugin:new`

Make a plugin inside the site: scaffold, test, build, add. mise run plugin:new -- <name>. Run again: rebuilds and re-adds it

- **Usage:** `plugin:new <name>`

### Arguments
- **`<name>`** — The slug of the plugin, e.g. save-log

## `plugin:publish`

Publish a plugin to EmDash's registry. Asks first

- **Usage:** `plugin:publish <name>`

### Arguments
- **`<name>`** — The folder name of the plugin under plugins/

## `plugin:search`

Search EmDash's plugin registry. mise run plugin:search -- forms

- **Usage:** `plugin:search <words>`

### Arguments
- **`<words>`** — What to look for, e.g. forms

## `signin:access`

- **Usage:** `signin:access`

Put Cloudflare Access in front of the deployed site's admin (sign in by emailed code)

## `signin:open`

Open a browser window already signed in to the admin. Needs Playwright + Chrome

- **Usage:** `signin:open [--live]`

### Flags
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

## `signin:passkey`

Sign a machine in through EmDash's real setup wizard. Needs Playwright + Chrome

- **Usage:** `signin:passkey [--live]`

### Flags
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

## `signin:token`

Sign a machine in, no browser: admin + API token written to the site's database. Add -- --live for deployed

- **Usage:** `signin:token [--live]`

### Flags
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

## `site:check`

- **Usage:** `site:check`

Before a commit: seed valid, types check, site builds

## `site:delete`

- **Usage:** `site:delete`

Delete the site folder. Asks first. No site is nothing to delete

## `site:logs`

- **Usage:** `site:logs`

Follow the dev site's log

## `site:new`

Make a new site. Template: mise run site:new -- node:blog (default cloudflare:blog). A site that is already there is left alone

- **Usage:** `site:new [template]`

### Arguments
- **`[template]`** — &lt;platform>:&lt;template>

  **Choices:** `cloudflare:blog`, `cloudflare:starter`, `cloudflare:marketing`, `cloudflare:portfolio`, `node:blog`, `node:starter`, `node:marketing`, `node:portfolio`

## `site:ports`

- **Usage:** `site:ports`

Give this project two ports of its own (in mise.local.toml), so several projects — or several agents — can run at once

## `site:preview`

- **Usage:** `site:preview`

Build the site and serve it locally (port 4322) — behaves like a deployed site

## `site:reset`

- **Usage:** `site:reset`

Empty the local database and start again from the seed. Asks first

## `site:start`

- **Usage:** `site:start`

Start the dev site in the background (port 4321). EmDash signs you in by itself, and its welcome dialog is closed for you

## `site:stop`

- **Usage:** `site:stop`

Stop the dev site and the built site
