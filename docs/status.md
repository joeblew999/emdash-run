---
title: What works
nav_order: 50
---

# What works

Written by `tests/replay.sh` and `tests/status.mjs`. Do not edit: run a test.

**63 steps pass, 0 fail, 5 of 28 tasks have no test.**

Last run: `—`, tasks from —, commit `—`, 2026-10-07 11:00 UTC, 0s. Each run replaces the steps it ran and keeps the rest; the table at the end says when each step last ran.

- `mise run test` — quick: the everyday tasks, one template, about a minute
- `mise run test:full` — everything: both templates, then the tasks that act on a deployed site

Every test runs as another developer would: a clean environment and an empty config folder. Only macOS so far.

## By task — every task in `tasks.toml`

| task | Cloudflare site | Node site | deployed site | |
|---|---|---|---|---|
| `content:pull` | pass ×1 | pass ×1 | — |  |
| `emdash` | pass ×4 | pass ×4 | — |  |
| `emdash:update` | pass ×1 | pass ×1 | — |  |
| `live:backup` | — | — | — | **NOT TESTED** |
| `live:check` (hidden) | pass ×1 | — | — |  |
| `live:logs` | — | — | — | **NOT TESTED** |
| `live:ship` | — | — | — | **NOT TESTED** |
| `live:undo` | — | — | — | **NOT TESTED** |
| `model:sync` | pass ×1 | pass ×1 | — |  |
| `plugin` | pass ×1 | pass ×1 | — |  |
| `plugin:add` | pass ×1 | pass ×1 | — |  |
| `plugin:check` | pass ×1 | pass ×1 | — |  |
| `plugin:new` | pass ×1 | pass ×1 | — |  |
| `plugin:publish` | pass ×1 | pass ×1 | — |  |
| `plugin:search` | pass ×1 | pass ×1 | — |  |
| `signin:access` | — | — | — | **NOT TESTED** |
| `signin:open` | pass ×2 | pass ×2 | — |  |
| `signin:passkey` | pass ×1 | pass ×1 | — |  |
| `signin:token` | pass ×2 | pass ×2 | — |  |
| `site:admin` (hidden) | — | pass ×1 | — |  |
| `site:check` | pass ×2 | pass ×2 | — |  |
| `site:delete` | pass ×1 | pass ×2 | — |  |
| `site:logs` | pass ×1 | pass ×1 | — |  |
| `site:new` | pass ×1 | pass ×1 | — |  |
| `site:preview` | pass ×1 | pass ×1 | — |  |
| `site:reset` | pass ×2 | pass ×2 | — |  |
| `site:start` | pass ×3 | pass ×3 | — |  |
| `site:stop` | pass ×1 | pass ×1 | — |  |

## Every step

| task | where | step | | tier | commit | when |
|---|---|---|---|---|---|---|
| `content:pull` | cloudflare | with no LIVE_URL says so | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `content:pull` | node | with no LIVE_URL says so | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `emdash:update` | cloudflare | updates, type-checks and builds | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `emdash:update` | node | updates, type-checks and builds | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `emdash` | cloudflare | a quoted JSON argument arrives whole | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `emdash` | cloudflare | whoami on the dev site | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `emdash` | cloudflare | --live with no LIVE_URL says so | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `emdash` | cloudflare | --preview writes to the built site | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `emdash` | node | a quoted JSON argument arrives whole | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `emdash` | node | whoami on the dev site | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `emdash` | node | --live with no LIVE_URL says so | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `emdash` | node | --preview writes to the built site | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `live:check` | cloudflare | the deploy rehearses with no account | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `model:sync` | cloudflare | records an added field in .emdash/ | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `model:sync` | node | records an added field in .emdash/ | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `plugin:add` | cloudflare | adds a package from npm | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `plugin:add` | node | adds a package from npm | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `plugin:check` | cloudflare | the plugin passes its checks | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `plugin:check` | node | the plugin passes its checks | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `plugin:new` | cloudflare | scaffolds, tests, builds and adds a plugin | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `plugin:new` | node | scaffolds, tests, builds and adds a plugin | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `plugin:publish` | cloudflare | asks first, and stops with nobody to answer (a real publish is never run) | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `plugin:publish` | node | asks first, and stops with nobody to answer (a real publish is never run) | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `plugin:search` | cloudflare | finds plugins in the registry | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `plugin:search` | node | finds plugins in the registry | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `plugin` | cloudflare | passes any command to the plugin CLI | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `plugin` | node | passes any command to the plugin CLI | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `signin:open` | cloudflare | opens a signed-in window (token) | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `signin:open` | cloudflare | opens a signed-in window (passkey) | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `signin:open` | node | opens a signed-in window (token) | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `signin:open` | node | opens a signed-in window (passkey) | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `signin:passkey` | cloudflare | completes the EmDash wizard on a fresh database | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `signin:passkey` | node | completes the EmDash wizard on a fresh database | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `signin:token` | cloudflare | starts the built site when it is stopped | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `signin:token` | cloudflare | the CLI is an administrator of the built site | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `signin:token` | node | the CLI is an administrator of the built site | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `signin:token` | node | starts the built site when it is stopped | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:admin` | node | a fresh built site, signed in, in one go | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:check` | cloudflare | passes on a sound site | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `site:check` | cloudflare | fails on a type error | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `site:check` | node | passes on a sound site | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:check` | node | fails on a type error | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:delete` | cloudflare | removes the site folder | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `site:delete` | node | refuses with nobody to ask | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:delete` | node | removes the site folder | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:logs` | cloudflare | shows the dev site log | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `site:logs` | node | shows the dev site log | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:new` | cloudflare | makes the site | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `site:new` | node | makes the site | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:preview` | cloudflare | serves the built site; dev sign-in is off there | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `site:preview` | node | serves the built site; dev sign-in is off there | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:reset` | cloudflare | empties the local content | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:reset` | cloudflare | refuses with nobody to ask | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:reset` | node | empties the local content | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:reset` | node | refuses with nobody to ask | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:start` | cloudflare | with no site, says so and stops | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `site:start` | cloudflare | starts the dev site | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `site:start` | cloudflare | the dev site answers; dev sign-in works | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `site:start` | node | with no site, says so and stops | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:start` | node | starts the dev site | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:start` | node | the dev site answers; dev sign-in works | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
| `site:stop` | cloudflare | stops both sites; twice is fine | PASS | quick | `2b66bad+uncommitted` | 2026-10-07 11:00 UTC |
| `site:stop` | node | stops both sites; twice is fine | PASS | full | `8a4b1b2` | 2026-10-07 09:48 UTC |
