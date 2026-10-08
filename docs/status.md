---
title: What works
nav_order: 50
---

# What works

Written by `tests/replay.sh` and `tests/status.mjs`. Do not edit: run a test.

**105 steps pass, 0 fail, 0 of 30 tasks have no test.**

Last run: `full`, tasks from the local files, commit `d606b40+uncommitted`, 2026-10-08 01:23 UTC, 288s. Each run replaces the steps it ran and keeps the rest; the table at the end says when each step last ran.

- `mise run test` — quick: the everyday tasks, one template, about a minute
- `mise run test:full` — everything: both templates, then the tasks that act on a deployed site

Every test runs as another developer would: a clean environment and an empty config folder. This page is from a Mac; the same test runs on macOS, Linux and Windows in the `stages` workflow.

## By task — every task in `tasks.toml`

| task | Cloudflare site | Node site | deployed site | |
|---|---|---|---|---|
| `content:pull` | pass ×1 | pass ×1 | pass ×1 |  |
| `emdash` | pass ×4 | pass ×4 | pass ×2 |  |
| `emdash:update` | pass ×1 | pass ×1 | — |  |
| `live:backup` | — | — | pass ×1 |  |
| `live:check` (hidden) | pass ×1 | — | — |  |
| `live:logs` | — | — | pass ×1 |  |
| `live:preview` | — | — | pass ×3 |  |
| `live:ship` | — | — | pass ×1 |  |
| `live:undo` | — | — | pass ×1 |  |
| `model:sync` | pass ×1 | pass ×1 | pass ×1 |  |
| `plugin` | pass ×1 | pass ×1 | — |  |
| `plugin:add` | pass ×2 | pass ×2 | — |  |
| `plugin:check` | pass ×1 | pass ×1 | — |  |
| `plugin:new` | pass ×2 | pass ×2 | — |  |
| `plugin:publish` | pass ×1 | pass ×1 | — |  |
| `plugin:search` | pass ×1 | pass ×1 | — |  |
| `signin:access` | — | — | pass ×4 |  |
| `signin:open` | pass ×2 | pass ×2 | pass ×1 |  |
| `signin:passkey` | pass ×1 | pass ×1 | — |  |
| `signin:token` | pass ×4 | pass ×4 | pass ×3 |  |
| `site:admin` (hidden) | pass ×1 | pass ×1 | — |  |
| `site:check` | pass ×2 | pass ×2 | — |  |
| `site:delete` | pass ×3 | pass ×3 | pass ×1 |  |
| `site:logs` | pass ×1 | pass ×1 | — |  |
| `site:new` | pass ×2 | pass ×2 | pass ×1 |  |
| `site:ports` | pass ×3 | pass ×2 | — |  |
| `site:preview` | pass ×1 | pass ×1 | — |  |
| `site:reset` | pass ×2 | pass ×2 | — |  |
| `site:start` | pass ×4 | pass ×4 | — |  |
| `site:stop` | pass ×1 | pass ×1 | — |  |

## Every step

| task | where | step | | tier | commit | when |
|---|---|---|---|---|---|---|
| `content:pull` | cloudflare | with no LIVE_URL says so | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `content:pull` | deployed | downloads the deployed site as a package | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `content:pull` | node | with no LIVE_URL says so | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `emdash:update` | cloudflare | updates, type-checks and builds | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `emdash:update` | node | updates, type-checks and builds | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `emdash` | cloudflare | a quoted JSON argument arrives whole | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `emdash` | cloudflare | whoami on the dev site | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `emdash` | cloudflare | --live with no LIVE_URL says so | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `emdash` | cloudflare | --preview writes to the built site | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `emdash` | deployed | a site set to Cloudflare Access: the dev site starts and the CLI works on it | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `emdash` | deployed | --live reads and writes the deployed site | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `emdash` | node | a quoted JSON argument arrives whole | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `emdash` | node | whoami on the dev site | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `emdash` | node | --live with no LIVE_URL says so | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `emdash` | node | --preview writes to the built site | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `live:backup` | deployed | the database bookmark and a package | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `live:check` | cloudflare | the deploy rehearses with no account | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `live:logs` | deployed | shows a request to the deployed site | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `live:preview` | deployed | a preview: an address of its own, the live site still answers | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `live:preview` | deployed | run again: the same preview, nothing new made | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `live:preview` | deployed | --delete removes it; again: nothing to delete | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `live:ship` | deployed | deploys; the site answers with the change | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `live:undo` | deployed | puts the previous version back: the change is gone | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `model:sync` | cloudflare | records an added field in .emdash/ | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `model:sync` | deployed | --live records the deployed model | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `model:sync` | node | records an added field in .emdash/ | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin:add` | cloudflare | adds a package from npm | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin:add` | cloudflare | run again: no error | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin:add` | node | adds a package from npm | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin:add` | node | run again: no error | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin:check` | cloudflare | the plugin passes its checks | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin:check` | node | the plugin passes its checks | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin:new` | cloudflare | scaffolds, tests, builds and adds a plugin | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin:new` | cloudflare | run again: not scaffolded twice, still builds | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin:new` | node | scaffolds, tests, builds and adds a plugin | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin:new` | node | run again: not scaffolded twice, still builds | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin:publish` | cloudflare | asks first, and stops with nobody to answer (a real publish is never run) | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin:publish` | node | asks first, and stops with nobody to answer (a real publish is never run) | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin:search` | cloudflare | finds plugins in the registry | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin:search` | node | finds plugins in the registry | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin` | cloudflare | passes any command to the plugin CLI | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `plugin` | node | passes any command to the plugin CLI | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `signin:access` | deployed | Cloudflare Access is in front of the admin | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `signin:access` | deployed | uploaded media stays public; the team's domain is printed before any deploy | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `signin:access` | deployed | run again: changes nothing | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `signin:access` | deployed | a visitor reaches uploaded media without signing in | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `signin:open` | cloudflare | opens a signed-in window (token) | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `signin:open` | cloudflare | opens a signed-in window (passkey) | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `signin:open` | deployed | --live opens a signed-in window | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `signin:open` | node | opens a signed-in window (token) | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `signin:open` | node | opens a signed-in window (passkey) | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `signin:passkey` | cloudflare | completes the EmDash wizard on a fresh database | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `signin:passkey` | node | completes the EmDash wizard on a fresh database | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `signin:token` | cloudflare | starts the built site when it is stopped | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `signin:token` | cloudflare | the saved token goes when the local database does | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `signin:token` | cloudflare | the CLI is an administrator of the built site | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `signin:token` | cloudflare | run again: still an administrator | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `signin:token` | deployed | --live: the CLI is an administrator of the deployed site | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `signin:token` | deployed | --live, run again: still an administrator | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `signin:token` | deployed | LIVE_PREVIEW: the CLI is an administrator of the preview, in the preview's own database | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `signin:token` | node | the CLI is an administrator of the built site | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `signin:token` | node | run again: still an administrator | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `signin:token` | node | starts the built site when it is stopped | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `signin:token` | node | the saved token goes when the local database does | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:admin` | cloudflare | a fresh built site, signed in, in one go | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:admin` | node | a fresh built site, signed in, in one go | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:check` | cloudflare | passes on a sound site | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `site:check` | cloudflare | fails on a type error | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `site:check` | node | passes on a sound site | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:check` | node | fails on a type error | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:delete` | cloudflare | refuses with nobody to ask | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:delete` | cloudflare | removes the site folder | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `site:delete` | cloudflare | run again: nothing to delete | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `site:delete` | deployed | removes the local site folder | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `site:delete` | node | refuses with nobody to ask | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:delete` | node | removes the site folder | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:delete` | node | run again: nothing to delete | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:logs` | cloudflare | shows the dev site log | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `site:logs` | node | shows the dev site log | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:new` | cloudflare | makes the site | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `site:new` | cloudflare | run again: the site is left alone | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `site:new` | deployed | makes the site that will be deployed | PASS | full | `d606b40+uncommitted` | 2026-10-08 01:23 UTC |
| `site:new` | node | makes the site | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:new` | node | run again: the site is left alone | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:ports` | cloudflare | three sites at once, each on its own ports with only its own content | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:ports` | cloudflare | gives the project two ports of its own | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `site:ports` | cloudflare | run again: it keeps them | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `site:ports` | node | gives the project two ports of its own | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:ports` | node | run again: it keeps them | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:preview` | cloudflare | serves the built site; dev sign-in is off there | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `site:preview` | node | serves the built site; dev sign-in is off there | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:reset` | cloudflare | empties the local content | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:reset` | cloudflare | refuses with nobody to ask | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:reset` | node | empties the local content | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:reset` | node | refuses with nobody to ask | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:start` | cloudflare | with no site, says so and stops | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `site:start` | cloudflare | starts the dev site; EmDash's welcome dialog is closed | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `site:start` | cloudflare | run again: it is already running | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `site:start` | cloudflare | the dev site answers; dev sign-in works | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `site:start` | node | with no site, says so and stops | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:start` | node | starts the dev site; EmDash's welcome dialog is closed | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:start` | node | run again: it is already running | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:start` | node | the dev site answers; dev sign-in works | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
| `site:stop` | cloudflare | stops both sites; twice is fine | PASS | quick | `d606b40+uncommitted` | 2026-10-08 01:13 UTC |
| `site:stop` | node | stops both sites; twice is fine | PASS | full | `f69d726+uncommitted` | 2026-10-07 12:06 UTC |
