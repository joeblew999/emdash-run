---
title: "The site tests: making, running, checking and deleting a site"
nav_order: 102
parent: "Reference"
---

# The site tests: making, running, checking and deleting a site

Written by `charter docs` from what `node tests/record.mjs --page status-site` prints (docs/_generated.toml): don't edit, change the code that command reads, then `mise run docs:setup`.

Run them: `mise run dev:test site`. The steps: `tests/site/steps.mjs`. Every group: [What works](status.md).

## On a Cloudflare site

**17 of 17 steps pass, in 1 min 13 s.** State: changed since it passed. Run 2026-10-08 05:03 UTC at commit `4c9d7c9+uncommitted`, on macOS.

| | Task | Step | Seconds |
|---|---|---|---|
| pass | `site:ports` | gives the project two ports of its own | 0 |
| pass | `site:ports` | run again: it keeps them | 0 |
| pass | `site:new` | run again: the site is left alone | 0 |
| pass | `site:start` | starts the dev site; EmDash's welcome dialog is closed | 18 |
| pass | `site:start` | run again: it is already running | 2 |
| pass | `site:start` | the dev site answers; dev sign-in works | 0 |
| pass | `site:logs` | shows the dev site log | 5 |
| pass | `emdash` | a quoted JSON argument arrives whole | 1 |
| pass | `emdash` | whoami on the dev site | 0 |
| pass | `emdash` | \-\-live with no LIVE_URL says so (it must refuse) | 0 |
| pass | `content:pull` | with no LIVE_URL says so (it must refuse) | 0 |
| pass | `site:check` | passes on a sound site | 17 |
| pass | `model:sync` | records an added field in .emdash/ | 1 |
| pass | `site:preview` | serves the built site; dev sign-in is off there | 7 |
| pass | `site:stop` | stops both sites; twice is fine | 3 |
| pass | `site:delete` | removes the site folder | 6 |
| pass | `site:delete` | run again: nothing to delete | 0 |

## On a Node site

**24 of 24 steps pass.** Run 2026-10-08 01:44 UTC at commit `201a653`, on undefined.

| | Task | Step | Seconds |
|---|---|---|---|
| pass | `site:ports` | gives the project two ports of its own | undefined |
| pass | `site:ports` | run again: it keeps them | undefined |
| pass | `site:start` | with no site, says so and stops (it must refuse) | undefined |
| pass | `site:new` | makes the site | undefined |
| pass | `site:new` | run again: the site is left alone | undefined |
| pass | `site:start` | starts the dev site; EmDash's welcome dialog is closed | undefined |
| pass | `site:start` | run again: it is already running | undefined |
| pass | `site:start` | the dev site answers; dev sign-in works | undefined |
| pass | `site:logs` | shows the dev site log | undefined |
| pass | `emdash` | a quoted JSON argument arrives whole | undefined |
| pass | `emdash` | whoami on the dev site | undefined |
| pass | `emdash` | \-\-live with no LIVE_URL says so (it must refuse) | undefined |
| pass | `site:check` | passes on a sound site | undefined |
| pass | `site:check` | fails on a type error | undefined |
| pass | `model:sync` | records an added field in .emdash/ | undefined |
| pass | `site:preview` | serves the built site; dev sign-in is off there | undefined |
| pass | `content:pull` | with no LIVE_URL says so (it must refuse) | undefined |
| pass | `emdash:update` | updates, type-checks and builds | undefined |
| pass | `site:reset` | empties the local content | undefined |
| pass | `site:reset` | refuses with nobody to ask (it must refuse) | undefined |
| pass | `site:delete` | refuses with nobody to ask (it must refuse) | undefined |
| pass | `site:stop` | stops both sites; twice is fine | undefined |
| pass | `site:delete` | removes the site folder | undefined |
| pass | `site:delete` | run again: nothing to delete | undefined |
