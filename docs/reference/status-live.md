---
title: "The live tests: the tasks that act on a deployed site"
nav_order: 105
parent: "Reference"
---

# The live tests: the tasks that act on a deployed site

Written by `charter docs` from what `node tests/record.mjs --page status-live` prints (docs/_generated.toml): don't edit, change the code that command reads, then `mise run docs:setup`.

Run them: `mise run test:live`. The steps: `tests/live/steps.mjs`. Every group: [What works](status.md).

## On the deployed site

**22 of 22 steps pass, in 5 min 33 s.** State: changed since it passed. Run 2026-10-08 04:50 UTC at commit `cad9abe`, on macOS.

| | Task | Step | Seconds |
|---|---|---|---|
| pass | `site:new` | makes the site that will be deployed | 30 |
| pass | `signin:access` | Cloudflare Access is in front of the admin | 2 |
| pass | `signin:access` | uploaded media stays public; the team's domain is printed before any deploy | 0 |
| pass | `emdash` | a site set to Cloudflare Access: the dev site starts and the CLI works on it | 13 |
| pass | `live:ship` | deploys; the site answers with the change | 46 |
| pass | `signin:access` | run again: changes nothing | 2 |
| pass | `signin:token` | \-\-live: the CLI is an administrator of the deployed site | 3 |
| pass | `signin:token` | \-\-live, run again: still an administrator | 3 |
| pass | `emdash` | \-\-live reads and writes the deployed site | 6 |
| pass | `plugin:works` | \-\-live: the deployed site is checked from outside; it says what it skips, and builds and restarts nothing | 2 |
| pass | `model:sync` | \-\-live records the deployed model | 1 |
| pass | `content:pull` | downloads the deployed site as a package | 41 |
| pass | `live:backup` | the database bookmark and a package | 46 |
| pass | `live:preview` | a preview: an address of its own, the live site still answers | 42 |
| pass | `live:preview` | run again: the same preview, nothing new made | 31 |
| pass | `signin:token` | LIVE_PREVIEW: the CLI is an administrator of the preview, in the preview's own database | 7 |
| pass | `live:preview` | \-\-delete removes it; again: nothing to delete | 6 |
| pass | `live:logs` | shows a request to the deployed site | 22 |
| pass | `signin:open` | \-\-live opens a signed-in window | 9 |
| pass | `signin:access` | a visitor reaches uploaded media and plugins' public routes without signing in | 1 |
| pass | `live:undo` | puts the previous version back: the change is gone | 15 |
| pass | `site:delete` | removes the local site folder | 5 |
