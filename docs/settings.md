---
title: "Settings"
nav_order: 10
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# Settings

All optional, under `[env]` in your `mise.toml`.

| setting | default | |
|---|---|---|
| `TEMPLATE` | `cloudflare:blog` | what `site:new` makes |
| `SITE_FOLDER` | `site` | where the site is |
| `SITE_PORT` | `4321` | the dev site's port. `mise run site:ports` picks a free one for this project |
| `PREVIEW_PORT` | `4322` | the built site's port — the same |
| `LIVE_URL` | — | the deployed site |
| `ADMIN_EMAIL` | — | who may sign in to the deployed site |
| `SITE_SEED` | — | `none` if the site has no seed file |
| `PLUGIN_PUBLISHER`, `PLUGIN_AUTHOR`, `PLUGIN_SECURITY_EMAIL` | — | needed by `plugin:new` |
