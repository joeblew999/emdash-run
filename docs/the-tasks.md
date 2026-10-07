---
title: "The tasks"
nav_order: 3
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# The tasks

In the order you use them. This table is written by the test, from the order it runs the tasks in. Run one with
`mise run <task>`; `mise tasks ls` shows them all.

<!-- in-order:begin (written by tests/status.mjs — run a test, do not edit) -->
**On this machine**

| | task | what it does | tested |
|---|---|---|---|
| 1 | `site:new` | Make a new site. Template: mise run site:new \-\- node:blog (default cloudflare:blog) | yes |
| 2 | `site:start` | Start the dev site in the background (port 4321). EmDash signs you in by itself | yes |
| 3 | `site:logs` | Follow the dev site's log | yes |
| 4 | `emdash` | EmDash's CLI. This machine by default; add \-\-live for the deployed site, \-\-preview for the built site | yes |
| 5 | `site:check` | Before a commit: seed valid, types check, site builds | yes |
| 6 | `model:sync` | Record the site's content model in the repo (.emdash/). Add \-\- \-\-live for the deployed site | yes |
| 7 | `site:preview` | Build the site and serve it locally (port 4322) — behaves like a deployed site | yes |
| 8 | `signin:token` | Sign a machine in, no browser: admin + API token written to the site's database. Add \-\- \-\-live for deployed | yes |
| 9 | `signin:open` | Open a browser window already signed in to the admin. Needs Playwright + Chrome | yes |
| 10 | `plugin:new` | Make a plugin inside the site: scaffold, test, build, add. mise run plugin:new \-\- &lt;name&gt; | yes |
| 11 | `plugin:check` | Check a plugin: manifest, types, tests, build, bundle. mise run plugin:check \-\- &lt;name&gt; | yes |
| 12 | `plugin:add` | Add a plugin from npm. mise run plugin:add \-\- &lt;package&gt; | yes |
| 13 | `plugin:search` | Search EmDash's plugin registry. mise run plugin:search \-\- forms | yes |
| 14 | `plugin` | Anything else in EmDash's plugin CLI. mise run plugin \-\- info &lt;publisher&gt; &lt;slug&gt; | yes |
| 15 | `emdash:update` | Update the site to the newest EmDash, then type-check and build | yes |
| 16 | `site:reset` | Empty the local database and start again from the seed. Asks first | yes |
| 17 | `signin:passkey` | Sign a machine in through EmDash's real setup wizard. Needs Playwright + Chrome | yes |
| 18 | `site:stop` | Stop the dev site and the built site | yes |
| 19 | `site:delete` | Delete the site folder. Asks first | yes |

**On the deployed site**

| | task | what it does | tested |
|---|---|---|---|
| 1 | `signin:access` | Put Cloudflare Access in front of the deployed site's admin (sign in by emailed code) | yes |
| 2 | `live:ship` | Deploy to Cloudflare: check, deploy, wait for the site to answer | yes |
| 3 | `signin:token` | Sign a machine in, no browser: admin + API token written to the site's database. Add \-\- \-\-live for deployed | yes |
| 4 | `emdash` | EmDash's CLI. This machine by default; add \-\-live for the deployed site, \-\-preview for the built site | yes |
| 5 | `model:sync` | Record the site's content model in the repo (.emdash/). Add \-\- \-\-live for the deployed site | yes |
| 6 | `content:pull` | Download the deployed site's content as a package into backups/ | yes |
| 7 | `live:backup` | Back up the deployed site: database bookmark + content package | yes |
| 8 | `live:logs` | Follow the deployed site's log | yes |
| 9 | `signin:open` | Open a browser window already signed in to the admin. Needs Playwright + Chrome | yes |
| 10 | `live:undo` | Roll the deployed site back to the previous version (code only) | yes |

<!-- in-order:end -->

After `site:start`, open `http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`.
EmDash sets the site up and signs you in.

Anything in EmDash's own CLI:

```
mise run emdash -- content list posts
mise run emdash -- schema add-field pages subtitle --type string
```
