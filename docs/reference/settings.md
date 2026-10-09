---
title: Settings
nav_order: 3
parent: Reference
---

# Settings: everything you can set in `mise.toml`

All optional, under `[env]`. One that is yours alone, such as an address or a port, goes in `mise.local.toml`: keep that file out of git.

| Setting | Default | What it is |
|---|---|---|
| `TEMPLATE` | `cloudflare:blog` | What `site:new` makes ([Templates](templates.md)) |
| `SITE_FOLDER` | `site` | Where the site is; `.` when the repo is the site |
| `SITE_SEED` | | `none` if the site has no seed file: `site:check` then skips the seed check |
| `SITE_PORT` | `4321` | The dev site's port; `mise run site:ports` picks a free one |
| `PREVIEW_PORT` | `4322` | The built site's port; the same |
| `SITE_DATABASE` | `data.db` | A Node site's database file, in the site folder: where `signin:token` writes. `site:reset` empties `data.db` whatever this says |
| `LIVE_URL` | | The deployed site's address |
| `LIVE_PREVIEW` | | A preview's name: `--live` then means that preview, when `LIVE_URL` is a `workers.dev` address ([Preview](../guides/preview.md)) |
| `ADMIN_EMAIL` | `agent@emdash.local` | Who `signin:token` and `signin:passkey` make an administrator, and who may sign in to the deployed site. `signin:access` and `signin:passkey -- --live` need it set |
| `ADMIN_NAME` | `Site Admin` | That administrator's name |
| `PLUGINS` | The favourites | What `plugin:favourites` installs: `@publisher/slug`, with `@version` to hold one to a release, separated by spaces |
| `PLUGIN_PUBLISHER`, `PLUGIN_AUTHOR`, `PLUGIN_SECURITY_EMAIL` | | Needed by `plugin:new` |

Read from the environment, not set in `mise.toml`:

| Variable | What it is |
|---|---|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | For `signin:access`, which also reads them from fnox if it is installed ([Deploy](../guides/deploy.md#the-token-signinaccess-needs)); `live:preview` uses them, when set, to switch preview addresses on |
| `EMDASH_TOKEN`, `EMDASH_HEADERS` | EmDash's own: given, the `emdash` task uses them in place of what this machine saved for the site |
| `MISE_YES`, `CI` | Either counts as `--yes` for the plugin tasks |
| `XDG_CONFIG_HOME` | Where the sign-in tasks save, in `emdash-run/` under it; `~/.config` without it |
| `EMDASH_RUN_LOCKS` | Where the locks are kept: one site starting at a time, and the ports handed out. `~/.config/emdash-run/locks` without it |
| `SIGNIN_OPEN_SECONDS` | `signin:open` closes its window by itself after this many seconds: for a run with nobody to close it |
