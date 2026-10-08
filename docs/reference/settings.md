---
title: Settings
nav_order: 3
parent: Reference
---

# Settings: everything you can set in `mise.toml`

All optional, under `[env]`. One that is yours alone, such as an address or a port, goes in `mise.local.toml`, which git ignores.

| Setting | Default | What it is |
|---|---|---|
| `TEMPLATE` | `cloudflare:blog` | What `site:new` makes ([Templates](templates.md)) |
| `SITE_FOLDER` | `site` | Where the site is; `.` when the repo is the site |
| `SITE_SEED` | | `none` if the site has no seed file |
| `SITE_PORT` | `4321` | The dev site's port; `mise run site:ports` picks a free one |
| `PREVIEW_PORT` | `4322` | The built site's port; the same |
| `LIVE_URL` | | The deployed site's address |
| `LIVE_PREVIEW` | | A preview's name: `--live` then means that preview ([Preview](../guides/preview.md)) |
| `ADMIN_EMAIL` | | Who may sign in to the deployed site, and who `signin:token` makes an administrator |
| `PLUGINS` | The favourites | What `plugin:favourites` installs: `@publisher/slug`, separated by spaces |
| `PLUGIN_PUBLISHER`, `PLUGIN_AUTHOR`, `PLUGIN_SECURITY_EMAIL` | | Needed by `plugin:new` |

Read from the environment, not set in `mise.toml`:

| Variable | What it is |
|---|---|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | For `signin:access`; read from fnox if it is installed ([Deploy](../guides/deploy.md#the-token-signinaccess-needs)) |
