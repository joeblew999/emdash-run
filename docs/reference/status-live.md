---
title: "The live tests: the tasks that act on a deployed site"
nav_order: 105
parent: "Reference"
---

# The live tests: the tasks that act on a deployed site

Written by `charter docs` from what `node tests/record.mjs --page status-live` prints (docs/_generated.toml): don't edit, change the code that command reads, then `mise run docs:setup`.

Run them: `mise run test:live`. The steps: `tests/live/steps.sh`. Every group: [What works](status.md).

## On the deployed site

**21 of 21 steps pass.** State: changed since it passed. Run 2026-10-08 02:58 UTC at commit `5ccdf89+uncommitted`, on undefined.

| | Task | Step | Seconds |
|---|---|---|---|
| pass | `site:new` | makes the site that will be deployed | undefined |
| pass | `signin:access` | Cloudflare Access is in front of the admin | undefined |
| pass | `signin:access` | uploaded media stays public; the team's domain is printed before any deploy | undefined |
| pass | `emdash` | a site set to Cloudflare Access: the dev site starts and the CLI works on it | undefined |
| pass | `live:ship` | deploys; the site answers with the change | undefined |
| pass | `signin:access` | run again: changes nothing | undefined |
| pass | `signin:token` | \-\-live: the CLI is an administrator of the deployed site | undefined |
| pass | `signin:token` | \-\-live, run again: still an administrator | undefined |
| pass | `emdash` | \-\-live reads and writes the deployed site | undefined |
| pass | `model:sync` | \-\-live records the deployed model | undefined |
| pass | `content:pull` | downloads the deployed site as a package | undefined |
| pass | `live:backup` | the database bookmark and a package | undefined |
| pass | `live:preview` | a preview: an address of its own, the live site still answers | undefined |
| pass | `live:preview` | run again: the same preview, nothing new made | undefined |
| pass | `signin:token` | LIVE_PREVIEW: the CLI is an administrator of the preview, in the preview's own database | undefined |
| pass | `live:preview` | \-\-delete removes it; again: nothing to delete | undefined |
| pass | `live:logs` | shows a request to the deployed site | undefined |
| pass | `signin:open` | \-\-live opens a signed-in window | undefined |
| pass | `signin:access` | a visitor reaches uploaded media and plugins' public routes without signing in | undefined |
| pass | `live:undo` | puts the previous version back: the change is gone | undefined |
| pass | `site:delete` | removes the local site folder | undefined |
