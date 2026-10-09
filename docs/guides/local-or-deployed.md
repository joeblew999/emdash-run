---
title: This machine or deployed
nav_order: 2
parent: Guides
---

# This machine or deployed: which site a task acts on

**No flag is this machine. `--live` is the deployed site.** With `--live` a task prints `-> DEPLOYED site: <address>` before it does anything there. Every task but `plan`, `site:new`, `site:ports` and `site:delete` first prints the site folder it acts in.

| Tasks | Act on |
|---|---|
| `site:*`, `emdash:update`, `plugin:demo`, and the tasks for a plugin in the site's own packages: `plugin:new`, `plugin:add`, `plugin:check`, `plugin:sandbox` | Always this machine |
| `live:ship`, `live:preview`, `live:undo`, `live:logs`, `live:backup`, `content:pull`, `signin:access` | Always the deployed site |
| `emdash`, `model:sync`, `signin:token`, `signin:mcp`, `signin:passkey`, `signin:open`, `plugin:install`, `plugin:update`, `plugin:remove`, `plugin:favourites`, `plugin:works` | This machine; the deployed site with `--live` |

`live:check` is a rehearsal on this machine: `site:check`, then wrangler's dry run of the deploy. `live:preview` and `live:logs` act on the Worker that `wrangler.jsonc` names, and need no `LIVE_URL`.

The deployed site is `LIVE_URL`, under `[env]` in `mise.toml`:

```toml
[env]
LIVE_URL = "https://your-site.workers.dev"
```

```sh
mise run emdash -- schema list            # this machine
mise run emdash -- schema list --live     # the deployed site
mise run model:sync -- --live
mise run plan -- signin:token --live      # what a task would stand on there; nothing is done
```

## The two sites on this machine

| Site | Started by | Port | Sign-in |
|---|---|---|---|
| The dev site | `site:start` | 4321 | EmDash signs you in by itself |
| The built site: the build a deploy ships | `site:preview` | 4322 | Real sign-in, as on a deployed site |

`emdash` and `model:sync` act on the dev site; `emdash` acts on the built one with `--preview`. The other tasks in the last row above, and `site:seed`, `site:demo` and `plugin:demo`, act on the built site, building and starting it if needed. Both sites share one database. `mise run site:status` says which is running.

## Three tasks never act on a deployed site

`site:seed`, `site:demo` and `plugin:demo` make things on this machine's built site only. Not one of them has a `--live` flag, and each refuses one: asked with `--live` it stops at its first state, before anything is signed in to the deployed site, and does nothing.

## A preview of the deployed site

With `LIVE_PREVIEW=<name>` set, and `LIVE_URL` the Worker's `workers.dev` address, `--live` means that [preview](preview.md) instead of the live site.
