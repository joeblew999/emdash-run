---
title: "What works: every task, and what the last test run showed"
nav_order: 101
parent: "Reference"
---

# What works: every task, and what the last test run showed

Written by `charter docs` from what `node tests/record.mjs --page status` prints (docs/_generated.toml): don't edit, change the code that command reads, then `mise run docs:setup`.

**139 steps pass, 0 fail, 0 of 36 tasks have no test.**

The test is in four groups, named as the tasks are. Each runs alone, on a site of its own, and has a page of its own with every step. A group is **proven** when every step of it passed and nothing it depends on has changed since: its tasks, its scripts, its steps, the site. `mise run test` runs the groups that are not proven; a run replaces everything recorded for its group. [How to help](../contributing.md) says more.

| Group | What it tests | Run it | State | Steps | Took | Last run | Commit |
|---|---|---|---|---|---|---|---|
| [`site`](status-site.md) | making, running, checking and deleting a site | `mise run test:site` | proven | 25 | 2 min 33 s | 2026-10-08 04:37 UTC | `ada7563+uncommitted` |
| [`signin`](status-signin.md) | the CLI and a browser window as an administrator of the built site | `mise run test:signin` | proven | 9 | 1 min 43 s | 2026-10-08 04:39 UTC | `ada7563+uncommitted` |
| [`plugin`](status-plugin.md) | a plugin of your own, and plugins from EmDash's registry | `mise run test:plugin` | proven | 29 | 4 min 26 s | 2026-10-08 04:44 UTC | `ada7563+uncommitted` |
| [`live`](status-live.md) | the tasks that act on a deployed site | `mise run test:live` | changed since it passed | 21 |  | 2026-10-08 02:58 UTC | `5ccdf89+uncommitted` |

On a Node site (`mise run test:node`, before a release): 55 of 55 steps pass, last run 2026-10-08 01:44 UTC.

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
| `plugin:add` | pass ×1 | pass ×2 |  |  |
| `plugin:check` | pass ×1 | pass ×1 |  |  |
| `plugin:favourites` | pass ×3 | pass ×3 |  |  |
| `plugin:install` | pass ×6 | pass ×3 |  |  |
| `plugin:new` | pass ×2 | pass ×2 |  |  |
| `plugin:publish` | pass ×1 | pass ×1 |  |  |
| `plugin:remove` | pass ×2 | pass ×2 |  |  |
| `plugin:sandbox` | pass ×2 | pass ×2 |  |  |
| `plugin:search` | pass ×1 | pass ×1 |  |  |
| `plugin:update` | pass ×5 |  |  |  |
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
| `site:ports` | pass ×2 | pass ×2 |  |  |
| `site:preview` | pass ×1 | pass ×1 |  |  |
| `site:reset` | pass ×2 | pass ×2 |  |  |
| `site:start` | pass ×4 | pass ×4 |  |  |
| `site:stop` | pass ×1 | pass ×1 |  |  |
