---
title: This machine or deployed
nav_order: 2
parent: Guides
---

# This machine or deployed: which site a task acts on

**No flag is this machine. `--live` is the deployed site.** Every task prints where it is acting before it acts.

| Tasks | Act on |
|---|---|
| `site:*` | Always this machine |
| `live:*`, `content:pull` | Always the deployed site |
| `emdash`, `model:sync`, `signin:*`, the registry `plugin:*` tasks | This machine; the deployed site with `--live` |

The deployed site is `LIVE_URL`, under `[env]` in `mise.toml`:

```toml
[env]
LIVE_URL = "https://your-site.workers.dev"
```

```sh
mise run emdash -- content list posts            # this machine
mise run emdash -- content list posts --live     # the deployed site
mise run model:sync -- --live
```

## The two sites on this machine

| Site | Started by | Port | Sign-in |
|---|---|---|---|
| The dev site | `site:start` | 4321 | EmDash signs you in by itself |
| The built site: the build a deploy ships | `site:preview` | 4322 | Real sign-in, as on a deployed site |

`emdash` acts on the dev site, and on the built one with `--preview`. The `signin:*` tasks and the registry `plugin:*` tasks act on the built site. Both share one database.

## A preview of the deployed site

With `LIVE_PREVIEW=<name>` set, `--live` means that [preview](preview.md) instead of the live site.
