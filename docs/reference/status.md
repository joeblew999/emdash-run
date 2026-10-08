---
title: "What works: every task, and what the last test run showed"
nav_order: 101
parent: "Reference"
---

# What works: every task, and what the last test run showed

Written by `charter docs` from what `node tests/status.mjs --page status` prints (docs/_generated.toml): don't edit, change the code that command reads, then `mise run docs:setup`.

**133 steps pass, 0 fail, 0 of 35 tasks have no test.**

The last run: `quick`, at commit `4b2bfce+uncommitted`, 2026-10-08 02:04 UTC, on a Mac. A run replaces the steps it ran and keeps the rest: the last table says when each step ran. The same test runs on macOS, Linux and Windows in the `stages` workflow, on a release tag.

Every test runs as another developer would: a clean environment, an empty config folder, a site of its own in a temporary folder. Run them: [How to help](../contributing.md).

## By task

| Task | Cloudflare site | Node site | Deployed site | |
|---|---|---|---|---|
| `content:pull` | pass ×1 | pass ×1 | pass ×1 |  |
| `emdash` | pass ×4 | pass ×4 | pass ×2 |  |
| `emdash:update` | pass ×1 | pass ×1 |  |  |
| `live:backup` |  |  | pass ×1 |  |
| `live:check` (hidden) | pass ×1 |  |  |  |
| `live:logs` |  |  | pass ×1 |  |
| `live:preview` |  |  | pass ×3 |  |
| `live:ship` |  |  | pass ×1 |  |
| `live:undo` |  |  | pass ×1 |  |
| `model:sync` | pass ×1 | pass ×1 | pass ×1 |  |
| `plugin` | pass ×1 | pass ×1 |  |  |
| `plugin:add` | pass ×2 | pass ×2 |  |  |
| `plugin:check` | pass ×1 | pass ×1 |  |  |
| `plugin:favourites` | pass ×3 | pass ×3 |  |  |
| `plugin:install` | pass ×3 | pass ×3 |  |  |
| `plugin:new` | pass ×2 | pass ×2 |  |  |
| `plugin:publish` | pass ×1 | pass ×1 |  |  |
| `plugin:remove` | pass ×2 | pass ×2 |  |  |
| `plugin:sandbox` | pass ×2 | pass ×2 |  |  |
| `plugin:search` | pass ×1 | pass ×1 |  |  |
| `plugin:works` | pass ×4 | pass ×4 |  |  |
| `signin:access` |  |  | pass ×4 |  |
| `signin:open` | pass ×2 | pass ×2 | pass ×1 |  |
| `signin:passkey` | pass ×1 | pass ×1 |  |  |
| `signin:token` | pass ×4 | pass ×4 | pass ×3 |  |
| `site:admin` (hidden) | pass ×1 | pass ×1 |  |  |
| `site:check` | pass ×2 | pass ×2 |  |  |
| `site:delete` | pass ×3 | pass ×3 | pass ×1 |  |
| `site:logs` | pass ×1 | pass ×1 |  |  |
| `site:new` | pass ×2 | pass ×2 | pass ×1 |  |
| `site:ports` | pass ×3 | pass ×2 |  |  |
| `site:preview` | pass ×1 | pass ×1 |  |  |
| `site:reset` | pass ×2 | pass ×2 |  |  |
| `site:start` | pass ×4 | pass ×4 |  |  |
| `site:stop` | pass ×1 | pass ×1 |  |  |

## Every step

| Task | Where | Step | | Run | Commit | When |
|---|---|---|---|---|---|---|
| `content:pull` | cloudflare | with no LIVE_URL says so | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `content:pull` | deployed | downloads the deployed site as a package | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `content:pull` | node | with no LIVE_URL says so | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `emdash:update` | cloudflare | updates, type-checks and builds | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `emdash:update` | node | updates, type-checks and builds | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `emdash` | cloudflare | a quoted JSON argument arrives whole | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `emdash` | cloudflare | whoami on the dev site | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `emdash` | cloudflare | \-\-live with no LIVE_URL says so | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `emdash` | cloudflare | \-\-preview writes to the built site | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `emdash` | deployed | a site set to Cloudflare Access: the dev site starts and the CLI works on it | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `emdash` | deployed | \-\-live reads and writes the deployed site | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `emdash` | node | a quoted JSON argument arrives whole | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `emdash` | node | whoami on the dev site | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `emdash` | node | \-\-live with no LIVE_URL says so | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `emdash` | node | \-\-preview writes to the built site | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `live:backup` | deployed | the database bookmark and a package | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `live:check` | cloudflare | the deploy rehearses with no account | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `live:logs` | deployed | shows a request to the deployed site | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `live:preview` | deployed | a preview: an address of its own, the live site still answers | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `live:preview` | deployed | run again: the same preview, nothing new made | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `live:preview` | deployed | \-\-delete removes it; again: nothing to delete | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `live:ship` | deployed | deploys; the site answers with the change | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `live:undo` | deployed | puts the previous version back: the change is gone | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `model:sync` | cloudflare | records an added field in .emdash/ | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `model:sync` | deployed | \-\-live records the deployed model | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `model:sync` | node | records an added field in .emdash/ | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:add` | cloudflare | adds a package from npm, and its lines in the site's config | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:add` | cloudflare | run again: the config is not touched | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:add` | node | adds a package from npm, and its lines in the site's config | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:add` | node | run again: the config is not touched | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:check` | cloudflare | the plugin passes its checks | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:check` | node | the plugin passes its checks | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:favourites` | cloudflare | installs the favourites in one go | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:favourites` | cloudflare | run again: all already installed | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:favourites` | cloudflare | PLUGINS in the project chooses the list | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:favourites` | node | installs the favourites in one go | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:favourites` | node | run again: all already installed | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:favourites` | node | PLUGINS in the project chooses the list | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:install` | cloudflare | installs a registry plugin with no clicking, from a stopped site | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:install` | cloudflare | run again: it is already installed | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:install` | cloudflare | a plugin the registry does not have: says so and fails | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:install` | node | installs a registry plugin with no clicking, from a stopped site | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:install` | node | run again: it is already installed | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:install` | node | a plugin the registry does not have: says so and fails | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:new` | cloudflare | scaffolds, tests, builds and adds a plugin — to the site's config too, by itself | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:new` | cloudflare | run again: not scaffolded twice, still builds, the config is not touched | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:new` | node | scaffolds, tests, builds and adds a plugin — to the site's config too, by itself | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:new` | node | run again: not scaffolded twice, still builds, the config is not touched | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:publish` | cloudflare | asks first, and stops with nobody to answer (a real publish is never run) | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:publish` | node | asks first, and stops with nobody to answer (a real publish is never run) | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:remove` | cloudflare | removes a registry plugin | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:remove` | cloudflare | run again: nothing to remove | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:remove` | node | removes a registry plugin | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:remove` | node | run again: nothing to remove | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:sandbox` | cloudflare | the site can run sandboxed plugins: the runner is in its config | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:sandbox` | cloudflare | run again: nothing changes | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:sandbox` | node | the site can run sandboxed plugins: the runner is in its config | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:sandbox` | node | run again: nothing changes | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:search` | cloudflare | finds plugins in the registry | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:search` | node | finds plugins in the registry | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:works` | cloudflare | the registry plugin: every check passes | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:works` | cloudflare | the plugin plugin:new made: its route answers from the sandbox | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:works` | cloudflare | a plugin the site does not have fails | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:works` | cloudflare | no name: every plugin in the site works — the favourites among them | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:works` | node | the registry plugin: every check passes | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:works` | node | the plugin plugin:new made: its route answers from the sandbox | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:works` | node | a plugin the site does not have fails | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin:works` | node | no name: every plugin in the site works — the favourites among them | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin` | cloudflare | passes any command to the plugin CLI | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `plugin` | node | passes any command to the plugin CLI | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:access` | deployed | Cloudflare Access is in front of the admin | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:access` | deployed | uploaded media stays public; the team's domain is printed before any deploy | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:access` | deployed | run again: changes nothing | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:access` | deployed | a visitor reaches uploaded media without signing in | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:open` | cloudflare | opens a signed-in window (token) | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:open` | cloudflare | opens a signed-in window (passkey) | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:open` | deployed | \-\-live opens a signed-in window | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:open` | node | opens a signed-in window (token) | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:open` | node | opens a signed-in window (passkey) | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:passkey` | cloudflare | completes the EmDash wizard on a fresh database | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:passkey` | node | completes the EmDash wizard on a fresh database | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:token` | cloudflare | the CLI is an administrator of the built site | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `signin:token` | cloudflare | run again: still an administrator | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `signin:token` | cloudflare | starts the built site when it is stopped | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:token` | cloudflare | the saved token goes when the local database does | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:token` | deployed | \-\-live: the CLI is an administrator of the deployed site | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:token` | deployed | \-\-live, run again: still an administrator | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:token` | deployed | LIVE_PREVIEW: the CLI is an administrator of the preview, in the preview's own database | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:token` | node | the CLI is an administrator of the built site | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:token` | node | run again: still an administrator | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:token` | node | starts the built site when it is stopped | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `signin:token` | node | the saved token goes when the local database does | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:admin` | cloudflare | a fresh built site, signed in, in one go | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:admin` | node | a fresh built site, signed in, in one go | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:check` | cloudflare | passes on a sound site | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `site:check` | cloudflare | fails on a type error | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `site:check` | node | passes on a sound site | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:check` | node | fails on a type error | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:delete` | cloudflare | removes the site folder | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `site:delete` | cloudflare | run again: nothing to delete | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `site:delete` | cloudflare | refuses with nobody to ask | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:delete` | deployed | removes the local site folder | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:delete` | node | refuses with nobody to ask | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:delete` | node | removes the site folder | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:delete` | node | run again: nothing to delete | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:logs` | cloudflare | shows the dev site log | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `site:logs` | node | shows the dev site log | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:new` | cloudflare | makes the site | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `site:new` | cloudflare | run again: the site is left alone | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `site:new` | deployed | makes the site that will be deployed | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:new` | node | makes the site | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:new` | node | run again: the site is left alone | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:ports` | cloudflare | gives the project two ports of its own | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `site:ports` | cloudflare | run again: it keeps them | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `site:ports` | cloudflare | three sites at once, each on its own ports with only its own content | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:ports` | node | gives the project two ports of its own | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:ports` | node | run again: it keeps them | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:preview` | cloudflare | serves the built site; dev sign-in is off there | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `site:preview` | node | serves the built site; dev sign-in is off there | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:reset` | cloudflare | empties the local content | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:reset` | cloudflare | refuses with nobody to ask | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:reset` | node | empties the local content | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:reset` | node | refuses with nobody to ask | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:start` | cloudflare | with no site, says so and stops | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `site:start` | cloudflare | starts the dev site; EmDash's welcome dialog is closed | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `site:start` | cloudflare | run again: it is already running | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `site:start` | cloudflare | the dev site answers; dev sign-in works | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `site:start` | node | with no site, says so and stops | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:start` | node | starts the dev site; EmDash's welcome dialog is closed | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:start` | node | run again: it is already running | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:start` | node | the dev site answers; dev sign-in works | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
| `site:stop` | cloudflare | stops both sites; twice is fine | PASS | quick | `4b2bfce+uncommitted` | 2026-10-08 02:04 UTC |
| `site:stop` | node | stops both sites; twice is fine | PASS | full | `201a653` | 2026-10-08 01:44 UTC |
