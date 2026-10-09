---
title: "Tasks"
nav_order: 100
parent: "Reference"
---

# Tasks

Written by `charter docs` from what `charter docs-tasks -only tasks.toml` prints (docs/_generated.toml): don't edit, change the code that command reads, then `mise run docs:setup`.

Run one with `mise run <task>`; its arguments and flags go after `--`. `mise tasks` lists them, and `mise run <task> --help` shows one.

## From `tasks.toml`

| Task | What it does |
|---|---|
| [`site:new`](#sitenew) | Make a new site. Template: mise run site:new \-\- node:blog (default cloudflare:blog). A site that is already there is left alone |
| [`site:ports`](#siteports) | Give this project two ports of its own (in mise.local.toml), so several projects — or several agents — can run at once |
| [`site:status`](#sitestatus) | Where this site is, state by state: is there a site, are its packages in, is the dev site running, is it built from what is here now, is the built site running, is this machine signed in, does the deployed site answer — and for each that is not so, the task that gets it there. It only looks: nothing is started, built or changed |
| [`plan`](#plan) | What a task would do, in order, and do nothing: every state it stands on, then the task. mise run plan \-\- signin:token, mise run plan \-\- signin:token \-\-live |
| [`site:start`](#sitestart) | Start the dev site in the background (port 4321). EmDash signs you in by itself, and its welcome dialog is closed for you |
| [`site:stop`](#sitestop) | Stop the dev site and the built site |
| [`site:logs`](#sitelogs) | Follow the dev site's log |
| [`site:check`](#sitecheck) | Before a commit: seed valid, types check, site builds. A site with no typescript gets typescript@6 added to its devDependencies first, and says so: without it astro check asks to install it, checks nothing and ends as a success |
| [`site:preview`](#sitepreview) | Build the site and serve it locally (port 4322) — behaves like a deployed site |
| [`site:seed`](#siteseed) | Apply an EmDash seed file to this machine's built site while it is running and has content in it. EmDash's own seeding does not: it applies a seed only on the first request to an empty database, and `emdash seed` writes to a SQLite file. Each thing the file names is looked for on the site, made if it is not there, left alone if it is: settings (only one the site has not set), collections and their fields (comments on or off as the file says), relations, taxonomies and terms, bylines, entries with their terms and bylines, published or draft, menus and their items, redirects, widget areas and their widgets, sections. A picture an entry names by its address ($media) is fetched and uploaded with its alt text, once: it needs the internet. Never a near copy of what is there: a menu item is the one with its label or its destination, a widget the one of its kind. One line per section, then a skip line for each thing in the file that is not applied: block types, translations, a picture inside a body, a byline's avatar, an entry with no slug, and any key that is not EmDash's seed format. EmDash's own check of the file is made first (the one emdash seed \-\-validate makes, from the site's own EmDash), and a file it refuses is not applied. A thing the site refuses, or a picture that cannot be fetched, is in a FAIL line with what was answered, and the task fails; the rest is still applied, and the next run puts right what was left half done. mise run site:seed \-\- &lt;file&gt;; no file: the site's own (seed/seed.json). Through EmDash's HTTP API — with EmDash's own client, from the site's packages, where it has a call for the thing — and never a deployed site: it builds and starts the built site and signs this machine in if needed. Run again: nothing is made or fetched twice |
| [`site:demo`](#sitedemo) | Put something real into every core feature of EmDash, so the admin and the site have something to show: a small site that reads like one. Most of it is a seed file in EmDash's own format, seeds/demo.json in emdash-run, applied as site:seed applies one: a title, a tagline, a social link and what robots are told (these replace the site's own); categories, one under another, and tags; two bylines, one a guest's; four published posts and two drafts, each one a visitor will see with a photograph fetched from its address; two pages; Contact in the primary menu, and a second menu; widgets in the sidebar and the footer; a section; a redirect; comments turned on for posts. Then what a seed file cannot say: a post's title and description for search engines; two more revisions of it; a day one draft is scheduled for; comments shown without approval, with a visitor's comment and an answer to it; a signed preview link to the other draft; the site's icon, made here, with a caption and a focal point; the picture a shared link is shown with; an API token that may only read (not kept, not printed); backups turned on and one taken. One line per section of the seed file and per feature: made or already there, and what shows that it works. A thing the site refuses, or a photograph that cannot be fetched, is in a FAIL line with what was answered, and the task fails. This machine's built site, never a deployed one: it builds and starts it and signs this machine in if needed. It needs the internet, for the photographs. Run again: nothing is made or fetched twice. To make a set-up of your own repeatable, copy seeds/demo.json, change it, and apply it with site:seed |
| [`site:reset`](#sitereset) | Empty the local database and start again from the seed. Asks first |
| [`site:delete`](#sitedelete) | Delete the site folder. Asks first. No site is nothing to delete |
| [`model:sync`](#modelsync) | Record the site's content model in the repo (.emdash/). Add \-\- \-\-live for the deployed site |
| [`content:pull`](#contentpull) | Download the deployed site's content as a package into backups/ in the site (keep that folder out of git) |
| [`plugin:new`](#pluginnew) | Make a plugin inside the site: scaffold, test, build, add to the site's config (its import, and its name in sandboxed: [ … ] of emdash({ … }); a config it cannot edit safely is left alone, with the lines to add). mise run plugin:new \-\- &lt;name&gt;. Run again: rebuilds it |
| [`plugin:check`](#plugincheck) | Check a plugin: manifest, types, tests, build, bundle. mise run plugin:check \-\- &lt;name&gt; |
| [`plugin:add`](#pluginadd) | Add a plugin from npm: the package, and for a sandboxed plugin (one built with emdash-plugin build) its two lines in the site's astro.config.mjs. A native plugin's two lines are printed for you to add, and the task stops there: which of its exports makes the plugin is for its README to say, and this does not guess. A config it cannot edit safely is left alone, with the lines to add. mise run plugin:add \-\- &lt;package&gt;. Run again: nothing changes |
| [`plugin:search`](#pluginsearch) | Search EmDash's plugin registry. mise run plugin:search \-\- forms |
| [`plugin:sandbox`](#pluginsandbox) | Let the site run sandboxed plugins, which every registry plugin is: sandboxRunner in emdash({ … }) of the site's astro.config.mjs and, on a Cloudflare site, the Worker Loader binding in wrangler.jsonc; on a Node site its two packages, and workerd's install script allowed in pnpm-workspace.yaml, so the sandbox process stops when EmDash stops it. Stops the site when it changes packages. A file it cannot edit safely is left alone, with the lines to add by hand. Run again: nothing changes |
| [`plugin:install`](#plugininstall) | Install a plugin from EmDash's registry, no clicking: mise run plugin:install \-\- &lt;publisher&gt;/&lt;slug&gt;, or &lt;publisher&gt;/&lt;slug&gt;@&lt;version&gt; for that release and no other, newest or not. It prints everything the plugin asks for; one that can change things or reach outside the site, and any install with \-\-live, needs \-\-yes |
| [`plugin:update`](#pluginupdate) | Update an installed registry plugin to a release you name: mise run plugin:update \-\- &lt;publisher&gt;/&lt;slug&gt;@&lt;version&gt;. Before anything is sent it prints what the installed release was granted (what plugin:install recorded on this machine, in ~/.config/emdash-run/plugins/) and what each of the two releases declares in the registry, and says what the new one asks for that the installed one did not. A release that asks for more, and any update with \-\-live, needs \-\-yes; the site then checks the release against the plugin it is running, and that too stops without \-\-yes. This machine's built site, starting it and signing in if needed; \-\-live is the deployed one. An older release is refused by EmDash: remove the plugin and install that release. Run again: nothing to update |
| [`plugin:remove`](#pluginremove) | Remove a registry plugin from the site; what it stored is kept. mise run plugin:remove \-\- &lt;publisher&gt;/&lt;slug&gt;. Add \-\-live for deployed |
| [`plugin:favourites`](#pluginfavourites) | Install the favourite registry plugins in one go, each at the release that was tried (docs/reference/favourite-plugins.md), or your own list: PLUGINS in mise.toml. It prints what each asks for and needs \-\-yes: some can change content or reach outside the site. Add \-\-live for deployed |
| [`plugin:works`](#pluginworks) | Does a plugin load and answer? One line per check. This machine's built site: it builds and starts (skipped when the site is already built from the code that is here and answering; \-\-fresh does both anyway), lists the plugin as active, its routes answer a GET (those open to visitors asked with no sign-in), its admin pages load in Chrome with the saved sign-in, the log and the sandbox show no refusal; it restarts the built site, and signs in if needed. With \-\-live, the deployed site (or its preview, with LIVE_PREVIEW): it answers a visitor, lists the plugin as active, its routes answer, its admin pages load — and it says which checks it skipped and why: nothing is built, restarted or signed in to, and the log is not read. Sign in first: mise run signin:token \-\- \-\-live. It does not try a form's submit or fire a hook. mise run plugin:works \-\- &lt;name&gt;. No name: every plugin |
| [`plugin:demo`](#plugindemo) | Seven plugins from EmDash's registry each do their real thing, with requests only and nobody clicking, and one line each says what was seen — and, where the site can show it, what a visitor is given. SEO Suite: the organisation and the X handle its settings name are on the home page. Link Guardian: it finds a dead link in a published post. Image Alt Text Manager: an image with no alt text is in its queue, and the alt text saved there is on the image. Contact Forms: a form named Contact, the message a visitor sends to it read back, and the form on the site's Contact page (on a Cloudflare site with EmDash 1.2.0 that one message is all Contact Forms 0.2.0 takes: a later one, from the page too, is answered Please try again later — scripts/core/plugin-demo.mjs says why). Forms: a form named Feedback, a visitor's answers read back, and the form on a page Feedback. LinguaDash: a French entry of a post, given its French words and published, at the address the English page names as its French one. Instant Indexer: the key search engines ask a site for is at its address, and it sends nothing from an address only this machine can reach: the line quotes it saying so. A form is on a page only on a site whose config has that plugin's own package for drawing it (@masonjames/emdash-contact-forms, @netdollar/emdash-forms), and a French entry is published only on a site with French among its languages (i18n in its Astro config), as this repo's site/ has both: on a site without, the line says what the site lacks, the form is put on no page and the French entry stays a draft. This machine's built site and no other: it builds, starts and signs in if needed, and installs those of the seven the site lacks, each at the release that was tried, agreeing to what it asks for as plugin:install \-\-yes does (some can change content or reach outside the site). What it makes stays in the site: a published post plugin-demo with a photograph (plugin-demo-photo.jpg, asked for at Unsplash), an image plugin-demo.png, the form Contact with one message and the form Feedback with one, the pages contact and feedback, both in the primary menu (a page contact that is already there keeps what it says, and the form is added under it), the French entry, and a few plugin settings (a value the site already has is kept). It needs collections of posts and pages, as EmDash's templates have, and the internet: the registry, the photograph, and the dead link is really asked for. Run again: every line says already so, and nothing is made twice. A plugin that did not do its thing is a FAIL line with what the site answered, and the task fails. plugin:works is the other check: that a plugin loads and answers |
| [`plugin:publish`](#pluginpublish) | Publish a plugin to EmDash's registry. Asks first |
| [`plugin`](#plugin) | Anything else in EmDash's plugin CLI. mise run plugin \-\- info &lt;publisher&gt; &lt;slug&gt; |
| [`signin:token`](#signintoken) | Sign a machine in with no browser — the everyday way, for the CLI, agents and CI: an admin and an API token written to the site's database. This machine's built site; add \-\- \-\-live for the deployed one (Cloudflare sites only) |
| [`signin:mcp`](#signinmcp) | How an agent connects to the site's own MCP server: EmDash has one, with tools for content, schema, media, menus, taxonomies and more, and it takes the token signin:token saves. Prints the address and the settings for an agent's .mcp.json, with the token read from the environment, never printed. This machine's built site; add \-\- \-\-live for the deployed one |
| [`signin:access`](#signinaccess) | Sign people in to the deployed site: Cloudflare Access in front of its admin, by a code emailed to ADMIN_EMAIL. Uploaded media stays public. Prints three lines for astro.config.mjs and wrangler.jsonc. Needs a Cloudflare API token with Access edit rights, in CLOUDFLARE_API_TOKEN or in fnox |
| [`signin:passkey`](#signinpasskey) | Sign a machine in through EmDash's real setup wizard, with a passkey — for testing the wizard itself. Add \-\- \-\-live for the deployed site. Needs Playwright + Chrome |
| [`signin:open`](#signinopen) | Open a browser window already signed in to the admin, for you to look around. Add \-\- \-\-live for the deployed site. Needs Playwright + Chrome |
| [`live:ship`](#liveship) | Deploy to Cloudflare: check, deploy, wait for the new version to answer. A newly deployed site has no content: it prints how to bring this machine's content to it |
| [`live:preview`](#livepreview) | Deploy the site as it is in this folder as a PREVIEW: an address of its own, with a database, bucket and sessions of its own, beside the live site and without touching it (Cloudflare's Worker Previews). Named after the git branch, or: mise run live:preview \-\- &lt;name&gt;. Run again: the same preview, updated. The first time it makes the preview's database, bucket and session store and writes a previews block into wrangler.jsonc. A new preview has no content. To act on one, give its address as LIVE_URL to any task that takes \-\-live. Remove it: mise run live:preview \-\- &lt;name&gt; \-\-delete |
| [`live:undo`](#liveundo) | Roll the deployed site back to the previous version (code only) |
| [`live:logs`](#livelogs) | Follow the deployed site's log |
| [`live:backup`](#livebackup) | Back up the deployed site: a database bookmark to restore to, and a content package in backups/. No SQL dump — Cloudflare's export refuses an EmDash database |
| [`emdash:update`](#emdashupdate) | Update the site to the newest EmDash, then type-check and build |
| [`emdash`](#emdash) | EmDash's CLI. This machine by default; add \-\-live for the deployed site, \-\-preview for the built site |
| [`live:check`](#livecheck) | Hidden. site:check, then a dry run of the deploy |
| [`site:admin`](#siteadmin) | Hidden. Fresh built site + signin:passkey in one go. Empties the local database |

## Each task

### `site:new`

Make a new site. Template: mise run site:new -- node:blog (default cloudflare:blog). A site that is already there is left alone

- **Usage:** `site:new [template]`

**Arguments**
- **`[template]`** — &lt;platform>:&lt;template>

  **Choices:** `cloudflare:blog`, `cloudflare:starter`, `cloudflare:marketing`, `cloudflare:portfolio`, `node:blog`, `node:starter`, `node:marketing`, `node:portfolio`

### `site:ports`

- **Usage:** `site:ports`

Give this project two ports of its own (in mise.local.toml), so several projects — or several agents — can run at once

### `site:status`

- **Usage:** `site:status`

Where this site is, state by state: is there a site, are its packages in, is the dev site running, is it built from what is here now, is the built site running, is this machine signed in, does the deployed site answer — and for each that is not so, the task that gets it there. It only looks: nothing is started, built or changed

### `plan`

- **Usage:** `plan`

What a task would do, in order, and do nothing: every state it stands on, then the task. mise run plan -- signin:token, mise run plan -- signin:token --live

### `site:start`

- **Usage:** `site:start`

Start the dev site in the background (port 4321). EmDash signs you in by itself, and its welcome dialog is closed for you

### `site:stop`

- **Usage:** `site:stop`

Stop the dev site and the built site

### `site:logs`

- **Usage:** `site:logs`

Follow the dev site's log

### `site:check`

- **Usage:** `site:check`

Before a commit: seed valid, types check, site builds. A site with no typescript gets typescript@6 added to its devDependencies first, and says so: without it astro check asks to install it, checks nothing and ends as a success

### `site:preview`

- **Usage:** `site:preview`

Build the site and serve it locally (port 4322) — behaves like a deployed site

### `site:seed`

Apply an EmDash seed file to this machine's built site while it is running and has content in it. EmDash's own seeding does not: it applies a seed only on the first request to an empty database, and `emdash seed` writes to a SQLite file. Each thing the file names is looked for on the site, made if it is not there, left alone if it is: settings (only one the site has not set), collections and their fields (comments on or off as the file says), relations, taxonomies and terms, bylines, entries with their terms and bylines, published or draft, menus and their items, redirects, widget areas and their widgets, sections. A picture an entry names by its address ($media) is fetched and uploaded with its alt text, once: it needs the internet. Never a near copy of what is there: a menu item is the one with its label or its destination, a widget the one of its kind. One line per section, then a skip line for each thing in the file that is not applied: block types, translations, a picture inside a body, a byline's avatar, an entry with no slug, and any key that is not EmDash's seed format. EmDash's own check of the file is made first (the one emdash seed --validate makes, from the site's own EmDash), and a file it refuses is not applied. A thing the site refuses, or a picture that cannot be fetched, is in a FAIL line with what was answered, and the task fails; the rest is still applied, and the next run puts right what was left half done. mise run site:seed -- <file>; no file: the site's own (seed/seed.json). Through EmDash's HTTP API — with EmDash's own client, from the site's packages, where it has a call for the thing — and never a deployed site: it builds and starts the built site and signs this machine in if needed. Run again: nothing is made or fetched twice

- **Usage:** `site:seed [file]`

**Arguments**
- **`[file]`** — A seed file in EmDash's format (https://emdashcms.com/seed.schema.json); a relative path is from the project's folder. Left out: the site's own, seed/seed.json

### `site:demo`

- **Usage:** `site:demo`

Put something real into every core feature of EmDash, so the admin and the site have something to show: a small site that reads like one. Most of it is a seed file in EmDash's own format, seeds/demo.json in emdash-run, applied as site:seed applies one: a title, a tagline, a social link and what robots are told (these replace the site's own); categories, one under another, and tags; two bylines, one a guest's; four published posts and two drafts, each one a visitor will see with a photograph fetched from its address; two pages; Contact in the primary menu, and a second menu; widgets in the sidebar and the footer; a section; a redirect; comments turned on for posts. Then what a seed file cannot say: a post's title and description for search engines; two more revisions of it; a day one draft is scheduled for; comments shown without approval, with a visitor's comment and an answer to it; a signed preview link to the other draft; the site's icon, made here, with a caption and a focal point; the picture a shared link is shown with; an API token that may only read (not kept, not printed); backups turned on and one taken. One line per section of the seed file and per feature: made or already there, and what shows that it works. A thing the site refuses, or a photograph that cannot be fetched, is in a FAIL line with what was answered, and the task fails. This machine's built site, never a deployed one: it builds and starts it and signs this machine in if needed. It needs the internet, for the photographs. Run again: nothing is made or fetched twice. To make a set-up of your own repeatable, copy seeds/demo.json, change it, and apply it with site:seed

### `site:reset`

- **Usage:** `site:reset`

Empty the local database and start again from the seed. Asks first

### `site:delete`

- **Usage:** `site:delete`

Delete the site folder. Asks first. No site is nothing to delete

### `model:sync`

Record the site's content model in the repo (.emdash/). Add -- --live for the deployed site

- **Usage:** `model:sync [--live]`

**Flags**
- **`--live`** — Read the model of the deployed site at LIVE_URL instead of the local one

### `content:pull`

- **Usage:** `content:pull`

Download the deployed site's content as a package into backups/ in the site (keep that folder out of git)

### `plugin:new`

Make a plugin inside the site: scaffold, test, build, add to the site's config (its import, and its name in sandboxed: [ … ] of emdash({ … }); a config it cannot edit safely is left alone, with the lines to add). mise run plugin:new -- <name>. Run again: rebuilds it

- **Usage:** `plugin:new <name>`

**Arguments**
- **`<name>`** — The slug of the plugin, e.g. save-log

### `plugin:check`

Check a plugin: manifest, types, tests, build, bundle. mise run plugin:check -- <name>

- **Usage:** `plugin:check <name>`

**Arguments**
- **`<name>`** — The folder name of the plugin under plugins/

### `plugin:add`

Add a plugin from npm: the package, and for a sandboxed plugin (one built with emdash-plugin build) its two lines in the site's astro.config.mjs. A native plugin's two lines are printed for you to add, and the task stops there: which of its exports makes the plugin is for its README to say, and this does not guess. A config it cannot edit safely is left alone, with the lines to add. mise run plugin:add -- <package>. Run again: nothing changes

- **Usage:** `plugin:add <package>`

**Arguments**
- **`<package>`** — The npm package, e.g. @emdash-cms/plugin-forms

### `plugin:search`

Search EmDash's plugin registry. mise run plugin:search -- forms

- **Usage:** `plugin:search <words>`

**Arguments**
- **`<words>`** — What to look for, e.g. forms

### `plugin:sandbox`

- **Usage:** `plugin:sandbox`

Let the site run sandboxed plugins, which every registry plugin is: sandboxRunner in emdash({ … }) of the site's astro.config.mjs and, on a Cloudflare site, the Worker Loader binding in wrangler.jsonc; on a Node site its two packages, and workerd's install script allowed in pnpm-workspace.yaml, so the sandbox process stops when EmDash stops it. Stops the site when it changes packages. A file it cannot edit safely is left alone, with the lines to add by hand. Run again: nothing changes

### `plugin:install`

Install a plugin from EmDash's registry, no clicking: mise run plugin:install -- <publisher>/<slug>, or <publisher>/<slug>@<version> for that release and no other, newest or not. It prints everything the plugin asks for; one that can change things or reach outside the site, and any install with --live, needs --yes

- **Usage:** `plugin:install [--live] [--yes] <plugin>…`

**Arguments**
- **`<plugin>…`** — As plugin:search prints it, e.g. @netdollar.dev/forms; with @&lt;version> to hold it to that release

**Flags**
- **`--live`** — The deployed site at LIVE_URL instead of the local production build
- **`--yes`** — Agree to what the plugin asks for. Needed when it can change things or reach outside the site, and always with --live

### `plugin:update`

Update an installed registry plugin to a release you name: mise run plugin:update -- <publisher>/<slug>@<version>. Before anything is sent it prints what the installed release was granted (what plugin:install recorded on this machine, in ~/.config/emdash-run/plugins/) and what each of the two releases declares in the registry, and says what the new one asks for that the installed one did not. A release that asks for more, and any update with --live, needs --yes; the site then checks the release against the plugin it is running, and that too stops without --yes. This machine's built site, starting it and signing in if needed; --live is the deployed one. An older release is refused by EmDash: remove the plugin and install that release. Run again: nothing to update

- **Usage:** `plugin:update [--live] [--yes] <plugin>…`

**Arguments**
- **`<plugin>…`** — The plugin and the release to move it to, e.g. @meekmedia.bsky.social/bulletin@0.1.1

**Flags**
- **`--live`** — The deployed site at LIVE_URL instead of the local production build
- **`--yes`** — Agree to what the new release asks for. Needed when it asks for more than the installed one, and always with --live

### `plugin:remove`

Remove a registry plugin from the site; what it stored is kept. mise run plugin:remove -- <publisher>/<slug>. Add --live for deployed

- **Usage:** `plugin:remove [--live] <plugin>…`

**Arguments**
- **`<plugin>…`** — As plugin:search prints it, e.g. @netdollar.dev/forms

**Flags**
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

### `plugin:favourites`

Install the favourite registry plugins in one go, each at the release that was tried (docs/reference/favourite-plugins.md), or your own list: PLUGINS in mise.toml. It prints what each asks for and needs --yes: some can change content or reach outside the site. Add --live for deployed

- **Usage:** `plugin:favourites [--live] [--yes]`

**Flags**
- **`--live`** — The deployed site at LIVE_URL instead of the local production build
- **`--yes`** — Agree to what each plugin asks for. Needed: some of the favourites can change content or reach outside the site

### `plugin:works`

Does a plugin load and answer? One line per check. This machine's built site: it builds and starts (skipped when the site is already built from the code that is here and answering; --fresh does both anyway), lists the plugin as active, its routes answer a GET (those open to visitors asked with no sign-in), its admin pages load in Chrome with the saved sign-in, the log and the sandbox show no refusal; it restarts the built site, and signs in if needed. With --live, the deployed site (or its preview, with LIVE_PREVIEW): it answers a visitor, lists the plugin as active, its routes answer, its admin pages load — and it says which checks it skipped and why: nothing is built, restarted or signed in to, and the log is not read. Sign in first: mise run signin:token -- --live. It does not try a form's submit or fire a hook. mise run plugin:works -- <name>. No name: every plugin

- **Usage:** `plugin:works [--live] [--fresh] [name]…`

**Arguments**
- **`[name]…`** — &lt;publisher>/&lt;slug> of a registry plugin, or the name of one in plugins/. None: every plugin the site has

**Flags**
- **`--live`** — The deployed site at LIVE_URL instead of the local production build: only the checks that can be made from outside
- **`--fresh`** — Check, build and restart the site first even when it is already built from this code and answering

### `plugin:demo`

- **Usage:** `plugin:demo`

Seven plugins from EmDash's registry each do their real thing, with requests only and nobody clicking, and one line each says what was seen — and, where the site can show it, what a visitor is given. SEO Suite: the organisation and the X handle its settings name are on the home page. Link Guardian: it finds a dead link in a published post. Image Alt Text Manager: an image with no alt text is in its queue, and the alt text saved there is on the image. Contact Forms: a form named Contact, the message a visitor sends to it read back, and the form on the site's Contact page (on a Cloudflare site with EmDash 1.2.0 that one message is all Contact Forms 0.2.0 takes: a later one, from the page too, is answered Please try again later — scripts/core/plugin-demo.mjs says why). Forms: a form named Feedback, a visitor's answers read back, and the form on a page Feedback. LinguaDash: a French entry of a post, given its French words and published, at the address the English page names as its French one. Instant Indexer: the key search engines ask a site for is at its address, and it sends nothing from an address only this machine can reach: the line quotes it saying so. A form is on a page only on a site whose config has that plugin's own package for drawing it (@masonjames/emdash-contact-forms, @netdollar/emdash-forms), and a French entry is published only on a site with French among its languages (i18n in its Astro config), as this repo's site/ has both: on a site without, the line says what the site lacks, the form is put on no page and the French entry stays a draft. This machine's built site and no other: it builds, starts and signs in if needed, and installs those of the seven the site lacks, each at the release that was tried, agreeing to what it asks for as plugin:install --yes does (some can change content or reach outside the site). What it makes stays in the site: a published post plugin-demo with a photograph (plugin-demo-photo.jpg, asked for at Unsplash), an image plugin-demo.png, the form Contact with one message and the form Feedback with one, the pages contact and feedback, both in the primary menu (a page contact that is already there keeps what it says, and the form is added under it), the French entry, and a few plugin settings (a value the site already has is kept). It needs collections of posts and pages, as EmDash's templates have, and the internet: the registry, the photograph, and the dead link is really asked for. Run again: every line says already so, and nothing is made twice. A plugin that did not do its thing is a FAIL line with what the site answered, and the task fails. plugin:works is the other check: that a plugin loads and answers

### `plugin:publish`

Publish a plugin to EmDash's registry. Asks first

- **Usage:** `plugin:publish <name>`

**Arguments**
- **`<name>`** — The folder name of the plugin under plugins/

### `plugin`

- **Usage:** `plugin`

Anything else in EmDash's plugin CLI. mise run plugin -- info &lt;publisher> &lt;slug>

### `signin:token`

Sign a machine in with no browser — the everyday way, for the CLI, agents and CI: an admin and an API token written to the site's database. This machine's built site; add -- --live for the deployed one (Cloudflare sites only)

- **Usage:** `signin:token [--live]`

**Flags**
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

### `signin:mcp`

How an agent connects to the site's own MCP server: EmDash has one, with tools for content, schema, media, menus, taxonomies and more, and it takes the token signin:token saves. Prints the address and the settings for an agent's .mcp.json, with the token read from the environment, never printed. This machine's built site; add -- --live for the deployed one

- **Usage:** `signin:mcp [--live]`

**Flags**
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

### `signin:access`

- **Usage:** `signin:access`

Sign people in to the deployed site: Cloudflare Access in front of its admin, by a code emailed to ADMIN_EMAIL. Uploaded media stays public. Prints three lines for astro.config.mjs and wrangler.jsonc. Needs a Cloudflare API token with Access edit rights, in CLOUDFLARE_API_TOKEN or in fnox

### `signin:passkey`

Sign a machine in through EmDash's real setup wizard, with a passkey — for testing the wizard itself. Add -- --live for the deployed site. Needs Playwright + Chrome

- **Usage:** `signin:passkey [--live]`

**Flags**
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

### `signin:open`

Open a browser window already signed in to the admin, for you to look around. Add -- --live for the deployed site. Needs Playwright + Chrome

- **Usage:** `signin:open [--live]`

**Flags**
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

### `live:ship`

- **Usage:** `live:ship`

Deploy to Cloudflare: check, deploy, wait for the new version to answer. A newly deployed site has no content: it prints how to bring this machine's content to it

### `live:preview`

Deploy the site as it is in this folder as a PREVIEW: an address of its own, with a database, bucket and sessions of its own, beside the live site and without touching it (Cloudflare's Worker Previews). Named after the git branch, or: mise run live:preview -- <name>. Run again: the same preview, updated. The first time it makes the preview's database, bucket and session store and writes a previews block into wrangler.jsonc. A new preview has no content. To act on one, give its address as LIVE_URL to any task that takes --live. Remove it: mise run live:preview -- <name> --delete

- **Usage:** `live:preview [--delete] [name]`

**Arguments**
- **`[name]`** — The preview's name: part of its address. Left out, the git branch

**Flags**
- **`--delete`** — Delete this preview instead (its database, bucket and session store are kept)

### `live:undo`

Roll the deployed site back to the previous version (code only)

- **Usage:** `live:undo [version]`

**Arguments**
- **`[version]`** — A version id; left out, the one before the current

### `live:logs`

- **Usage:** `live:logs`

Follow the deployed site's log

### `live:backup`

- **Usage:** `live:backup`

Back up the deployed site: a database bookmark to restore to, and a content package in backups/. No SQL dump — Cloudflare's export refuses an EmDash database

### `emdash:update`

- **Usage:** `emdash:update`

Update the site to the newest EmDash, then type-check and build

### `emdash`

- **Usage:** `emdash`

EmDash's CLI. This machine by default; add --live for the deployed site, --preview for the built site

### `live:check`

- **Usage:** `live:check`

Hidden. site:check, then a dry run of the deploy

### `site:admin`

- **Usage:** `site:admin`

Hidden. Fresh built site + signin:passkey in one go. Empties the local database
