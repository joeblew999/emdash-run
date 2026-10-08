---
title: "Tasks: every one, in the order you use them"
nav_order: 100
parent: "Reference"
---

# Tasks: every one, in the order you use them

Written by `node tests/status.mjs --page tasks` (docs/_generated.toml), never by hand: change the code it reads, then `mise run docs:setup`.

Run one with `mise run <task>`; arguments and flags go after `--`. In your own project `mise tasks` lists them, and `mise run <task> --help` shows one. What each showed in the last test run: [What works](status.md).

## On this machine

| | Task | What it does |
|---|---|---|
| 1 | [`site:ports`](#siteports) | Give this project two ports of its own (in mise.local.toml), so several projects — or several agents — can run at once |
| 2 | [`site:new`](#sitenew) | Make a new site. Template: mise run site:new \-\- node:blog (default cloudflare:blog). A site that is already there is left alone |
| 3 | [`site:start`](#sitestart) | Start the dev site in the background (port 4321). EmDash signs you in by itself, and its welcome dialog is closed for you |
| 4 | [`site:logs`](#sitelogs) | Follow the dev site's log |
| 5 | [`emdash`](#emdash) | EmDash's CLI. This machine by default; add \-\-live for the deployed site, \-\-preview for the built site |
| 6 | [`site:check`](#sitecheck) | Before a commit: seed valid, types check, site builds |
| 7 | [`model:sync`](#modelsync) | Record the site's content model in the repo (.emdash/). Add \-\- \-\-live for the deployed site |
| 8 | [`site:preview`](#sitepreview) | Build the site and serve it locally (port 4322) — behaves like a deployed site |
| 9 | [`signin:token`](#signintoken) | Sign a machine in with no browser — the everyday way, for the CLI, agents and CI: an admin and an API token written to the site's database. This machine's built site; add \-\- \-\-live for the deployed one (Cloudflare sites only) |
| 10 | [`signin:open`](#signinopen) | Open a browser window already signed in to the admin, for you to look around. Add \-\- \-\-live for the deployed site. Needs Playwright + Chrome |
| 11 | [`plugin:sandbox`](#pluginsandbox) | Let the site run sandboxed plugins, which every registry plugin is: the runner in the site's config. Run again: nothing changes |
| 12 | [`plugin:new`](#pluginnew) | Make a plugin inside the site: scaffold, test, build, add to the site's config. mise run plugin:new \-\- &lt;name&gt;. Run again: rebuilds it. Stops the site: start it again afterwards |
| 13 | [`plugin:check`](#plugincheck) | Check a plugin: manifest, types, tests, build, bundle. mise run plugin:check \-\- &lt;name&gt; |
| 14 | [`plugin:add`](#pluginadd) | Add a plugin from npm: the package, and its lines in the site's config. mise run plugin:add \-\- &lt;package&gt;. Stops the site: start it again afterwards |
| 15 | [`plugin:search`](#pluginsearch) | Search EmDash's plugin registry. mise run plugin:search \-\- forms |
| 16 | [`plugin:install`](#plugininstall) | Install a plugin from EmDash's registry, no clicking: mise run plugin:install \-\- &lt;publisher&gt;/&lt;slug&gt;. Add \-\-live for the deployed site |
| 17 | [`plugin:works`](#pluginworks) | Does a plugin work? One line per check: builds, starts, listed, routes, admin page, log, sandbox. mise run plugin:works \-\- &lt;name&gt;. No name: every plugin |
| 18 | [`plugin:remove`](#pluginremove) | Remove a registry plugin from the site; what it stored is kept. mise run plugin:remove \-\- &lt;publisher&gt;/&lt;slug&gt;. Add \-\-live for deployed |
| 19 | [`plugin:favourites`](#pluginfavourites) | Install the favourite registry plugins in one go (docs/reference/favourite-plugins.md), or your own list: PLUGINS in mise.toml. Add \-\-live for deployed |
| 20 | [`plugin`](#plugin) | Anything else in EmDash's plugin CLI. mise run plugin \-\- info &lt;publisher&gt; &lt;slug&gt; |
| 21 | [`emdash:update`](#emdashupdate) | Update the site to the newest EmDash, then type-check and build |
| 22 | [`site:reset`](#sitereset) | Empty the local database and start again from the seed. Asks first |
| 23 | [`signin:passkey`](#signinpasskey) | Sign a machine in through EmDash's real setup wizard, with a passkey — for testing the wizard itself. Add \-\- \-\-live for the deployed site. Needs Playwright + Chrome |
| 24 | [`site:stop`](#sitestop) | Stop the dev site and the built site |
| 25 | [`site:delete`](#sitedelete) | Delete the site folder. Asks first. No site is nothing to delete |

## On the deployed site

| | Task | What it does |
|---|---|---|
| 1 | [`signin:access`](#signinaccess) | Sign people in to the deployed site: Cloudflare Access in front of its admin, by a code emailed to ADMIN_EMAIL. Uploaded media stays public. Prints three lines for astro.config.mjs and wrangler.jsonc. Needs a Cloudflare API token with Access edit rights, in CLOUDFLARE_API_TOKEN or in fnox |
| 2 | [`emdash`](#emdash) | EmDash's CLI. This machine by default; add \-\-live for the deployed site, \-\-preview for the built site |
| 3 | [`live:ship`](#liveship) | Deploy to Cloudflare: check, deploy, wait for the new version to answer. A newly deployed site has no content: it prints how to bring this machine's |
| 4 | [`signin:token`](#signintoken) | Sign a machine in with no browser — the everyday way, for the CLI, agents and CI: an admin and an API token written to the site's database. This machine's built site; add \-\- \-\-live for the deployed one (Cloudflare sites only) |
| 5 | [`model:sync`](#modelsync) | Record the site's content model in the repo (.emdash/). Add \-\- \-\-live for the deployed site |
| 6 | [`content:pull`](#contentpull) | Download the deployed site's content as a package into backups/ in the site (keep that folder out of git) |
| 7 | [`live:backup`](#livebackup) | Back up the deployed site: a database bookmark to restore to, and a content package in backups/. No SQL dump — Cloudflare's export refuses an EmDash database |
| 8 | [`live:preview`](#livepreview) | Deploy the site as it is in this folder as a PREVIEW: an address of its own, with a database, bucket and sessions of its own, beside the live site and without touching it (Cloudflare's Worker Previews). Named after the git branch, or: mise run live:preview \-\- &lt;name&gt;. Run again: the same preview, updated. The first time it makes the preview's database, bucket and session store and writes a previews block into wrangler.jsonc. A new preview has no content. To act on one, give its address as LIVE_URL to any task that takes \-\-live. Remove it: mise run live:preview \-\- &lt;name&gt; \-\-delete |
| 9 | [`live:logs`](#livelogs) | Follow the deployed site's log |
| 10 | [`signin:open`](#signinopen) | Open a browser window already signed in to the admin, for you to look around. Add \-\- \-\-live for the deployed site. Needs Playwright + Chrome |
| 11 | [`live:undo`](#liveundo) | Roll the deployed site back to the previous version (code only) |

## Each task

### `site:ports`

- **Usage:** `site:ports`

Give this project two ports of its own (in mise.local.toml), so several projects — or several agents — can run at once

### `site:new`

Make a new site. Template: mise run site:new -- node:blog (default cloudflare:blog). A site that is already there is left alone

- **Usage:** `site:new [template]`

**Arguments**
- **`[template]`** — &lt;platform>:&lt;template>

  **Choices:** `cloudflare:blog`, `cloudflare:starter`, `cloudflare:marketing`, `cloudflare:portfolio`, `node:blog`, `node:starter`, `node:marketing`, `node:portfolio`

### `site:start`

- **Usage:** `site:start`

Start the dev site in the background (port 4321). EmDash signs you in by itself, and its welcome dialog is closed for you

### `site:logs`

- **Usage:** `site:logs`

Follow the dev site's log

### `emdash`

- **Usage:** `emdash`

EmDash's CLI. This machine by default; add --live for the deployed site, --preview for the built site

### `site:check`

- **Usage:** `site:check`

Before a commit: seed valid, types check, site builds

### `model:sync`

Record the site's content model in the repo (.emdash/). Add -- --live for the deployed site

- **Usage:** `model:sync [--live]`

**Flags**
- **`--live`** — Read the model of the deployed site at LIVE_URL instead of the local one

### `site:preview`

- **Usage:** `site:preview`

Build the site and serve it locally (port 4322) — behaves like a deployed site

### `signin:token`

Sign a machine in with no browser — the everyday way, for the CLI, agents and CI: an admin and an API token written to the site's database. This machine's built site; add -- --live for the deployed one (Cloudflare sites only)

- **Usage:** `signin:token [--live]`

**Flags**
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

### `signin:open`

Open a browser window already signed in to the admin, for you to look around. Add -- --live for the deployed site. Needs Playwright + Chrome

- **Usage:** `signin:open [--live]`

**Flags**
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

### `plugin:sandbox`

- **Usage:** `plugin:sandbox`

Let the site run sandboxed plugins, which every registry plugin is: the runner in the site's config. Run again: nothing changes

### `plugin:new`

Make a plugin inside the site: scaffold, test, build, add to the site's config. mise run plugin:new -- <name>. Run again: rebuilds it. Stops the site: start it again afterwards

- **Usage:** `plugin:new <name>`

**Arguments**
- **`<name>`** — The slug of the plugin, e.g. save-log

### `plugin:check`

Check a plugin: manifest, types, tests, build, bundle. mise run plugin:check -- <name>

- **Usage:** `plugin:check <name>`

**Arguments**
- **`<name>`** — The folder name of the plugin under plugins/

### `plugin:add`

Add a plugin from npm: the package, and its lines in the site's config. mise run plugin:add -- <package>. Stops the site: start it again afterwards

- **Usage:** `plugin:add <package>`

**Arguments**
- **`<package>`** — The npm package, e.g. @emdash-cms/plugin-forms

### `plugin:search`

Search EmDash's plugin registry. mise run plugin:search -- forms

- **Usage:** `plugin:search <words>`

**Arguments**
- **`<words>`** — What to look for, e.g. forms

### `plugin:install`

Install a plugin from EmDash's registry, no clicking: mise run plugin:install -- <publisher>/<slug>. Add --live for the deployed site

- **Usage:** `plugin:install [--live] <plugin>…`

**Arguments**
- **`<plugin>…`** — As plugin:search prints it, e.g. @netdollar.dev/forms

**Flags**
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

### `plugin:works`

Does a plugin work? One line per check: builds, starts, listed, routes, admin page, log, sandbox. mise run plugin:works -- <name>. No name: every plugin

- **Usage:** `plugin:works [name]…`

**Arguments**
- **`[name]…`** — &lt;publisher>/&lt;slug> of a registry plugin, or the name of one in plugins/. None: every plugin the site has

### `plugin:remove`

Remove a registry plugin from the site; what it stored is kept. mise run plugin:remove -- <publisher>/<slug>. Add --live for deployed

- **Usage:** `plugin:remove [--live] <plugin>…`

**Arguments**
- **`<plugin>…`** — As plugin:search prints it, e.g. @netdollar.dev/forms

**Flags**
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

### `plugin:favourites`

Install the favourite registry plugins in one go (docs/reference/favourite-plugins.md), or your own list: PLUGINS in mise.toml. Add --live for deployed

- **Usage:** `plugin:favourites [--live]`

**Flags**
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

### `plugin`

- **Usage:** `plugin`

Anything else in EmDash's plugin CLI. mise run plugin -- info &lt;publisher> &lt;slug>

### `emdash:update`

- **Usage:** `emdash:update`

Update the site to the newest EmDash, then type-check and build

### `site:reset`

- **Usage:** `site:reset`

Empty the local database and start again from the seed. Asks first

### `signin:passkey`

Sign a machine in through EmDash's real setup wizard, with a passkey — for testing the wizard itself. Add -- --live for the deployed site. Needs Playwright + Chrome

- **Usage:** `signin:passkey [--live]`

**Flags**
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

### `site:stop`

- **Usage:** `site:stop`

Stop the dev site and the built site

### `site:delete`

- **Usage:** `site:delete`

Delete the site folder. Asks first. No site is nothing to delete

### `signin:access`

- **Usage:** `signin:access`

Sign people in to the deployed site: Cloudflare Access in front of its admin, by a code emailed to ADMIN_EMAIL. Uploaded media stays public. Prints three lines for astro.config.mjs and wrangler.jsonc. Needs a Cloudflare API token with Access edit rights, in CLOUDFLARE_API_TOKEN or in fnox

### `live:ship`

- **Usage:** `live:ship`

Deploy to Cloudflare: check, deploy, wait for the new version to answer. A newly deployed site has no content: it prints how to bring this machine's

### `content:pull`

- **Usage:** `content:pull`

Download the deployed site's content as a package into backups/ in the site (keep that folder out of git)

### `live:backup`

- **Usage:** `live:backup`

Back up the deployed site: a database bookmark to restore to, and a content package in backups/. No SQL dump — Cloudflare's export refuses an EmDash database

### `live:preview`

Deploy the site as it is in this folder as a PREVIEW: an address of its own, with a database, bucket and sessions of its own, beside the live site and without touching it (Cloudflare's Worker Previews). Named after the git branch, or: mise run live:preview -- <name>. Run again: the same preview, updated. The first time it makes the preview's database, bucket and session store and writes a previews block into wrangler.jsonc. A new preview has no content. To act on one, give its address as LIVE_URL to any task that takes --live. Remove it: mise run live:preview -- <name> --delete

- **Usage:** `live:preview [--delete] [name]`

**Arguments**
- **`[name]`** — The preview's name: part of its address. Left out, the git branch

**Flags**
- **`--delete`** — Delete this preview instead (its database, bucket and session store are kept)

### `live:logs`

- **Usage:** `live:logs`

Follow the deployed site's log

### `live:undo`

Roll the deployed site back to the previous version (code only)

- **Usage:** `live:undo [version]`

**Arguments**
- **`[version]`** — A version id; left out, the one before the current

### `plugin:publish`

Publish a plugin to EmDash's registry. Asks first

- **Usage:** `plugin:publish <name>`

**Arguments**
- **`<name>`** — The folder name of the plugin under plugins/
