---
title: "What works: every task, and what the last test run showed"
nav_order: 102
parent: "Reference"
---

# What works: every task, and what the last test run showed

Written by `charter docs` from what `node tests/record.mjs --page status` prints (docs/_generated.toml): don't edit, change the code that command reads, then `mise run docs:setup`.

**132 steps pass, 0 fail, 1 of 36 tasks have no recorded run on this machine.**

The test is in four groups, named as the tasks are. Each runs alone, on a site of its own, and has a page of its own with every step. A group is **proven** when its everyday steps passed and nothing it depends on has changed since: its tasks, its scripts, its steps, the site. `mise run dev:test` runs the everyday steps of the groups that are not proven, in about a minute a group. The long steps run with `mise run dev:test --level all`. The `stages` workflow runs both on Linux, macOS and Windows. [How to help](../contributing.md) says more.

| Group | What it tests | Run it | Everyday steps | Long steps | Took | Last run | Commit |
|---|---|---|---|---|---|---|---|
| [`site`](status-site.md) | making, running, checking and deleting a site | `mise run dev:test site` | 17: changed since it passed | no run recorded | 1 min 13 s | 2026-10-08 05:03 UTC | `4c9d7c9+uncommitted` |
| [`signin`](status-signin.md) | the CLI and a browser window as an administrator of the built site | `mise run dev:test signin` | 9: changed since it passed | no run recorded | 1 min 43 s | 2026-10-08 04:39 UTC | `ada7563+uncommitted` |
| [`plugin`](status-plugin.md) | a plugin of your own, and plugins from EmDash's registry | `mise run dev:test plugin` | 29: changed since it passed | no run recorded | 4 min 26 s | 2026-10-08 04:44 UTC | `ada7563+uncommitted` |
| [`live`](status-live.md) | the tasks that act on a deployed site | `mise run dev:test live` | 22: changed since it passed |  | 5 min 33 s | 2026-10-08 04:50 UTC | `cad9abe` |

On a Node site (`mise run dev:test --node --level all`, before a release): 55 of 55 steps pass, last run 2026-10-08 01:44 UTC.

## By task

| Task | Cloudflare site | Node site | Deployed site | |
|---|---|---|---|---|
| `content:pull` | pass ×1 | pass ×1 | pass ×1 |  |
| `emdash` | pass ×4 | pass ×4 | pass ×2 |  |
| `emdash:update` |  | pass ×1 |  |  |
| `live:backup` |  |  | pass ×1 |  |
| `live:check` (hidden) |  |  |  | on CI: its steps are long ones |
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
| `plugin:works` | pass ×4 | pass ×4 | pass ×1 |  |
| `signin:access` |  |  | pass ×4 |  |
| `signin:open` | pass ×2 | pass ×2 | pass ×1 |  |
| `signin:passkey` | pass ×1 | pass ×1 |  |  |
| `signin:token` | pass ×4 | pass ×4 | pass ×3 |  |
| `site:admin` (hidden) | pass ×1 | pass ×1 |  |  |
| `site:check` | pass ×1 | pass ×2 |  |  |
| `site:delete` | pass ×2 | pass ×3 | pass ×1 |  |
| `site:logs` | pass ×1 | pass ×1 |  |  |
| `site:new` | pass ×1 | pass ×2 | pass ×1 |  |
| `site:ports` | pass ×2 | pass ×2 |  |  |
| `site:preview` | pass ×1 | pass ×1 |  |  |
| `site:reset` |  | pass ×2 |  |  |
| `site:start` | pass ×3 | pass ×4 |  |  |
| `site:stop` | pass ×1 | pass ×1 |  |  |
