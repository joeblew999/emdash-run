---
title: Templates
nav_order: 4
parent: Reference
---

# Templates: the eight kinds of site `site:new` makes

```sh
mise run site:new -- node:blog
```

| | `blog` | `starter` | `marketing` | `portfolio` |
|---|---|---|---|---|
| Cloudflare (Workers, D1, R2) | `cloudflare:blog` | `cloudflare:starter` | `cloudflare:marketing` | `cloudflare:portfolio` |
| Node.js (SQLite, local uploads) | `node:blog` | `node:starter` | `node:marketing` | `node:portfolio` |

With no argument it uses `TEMPLATE` from your `mise.toml`, else `cloudflare:blog`. They are EmDash's own templates, made by `create-emdash`.

Only a Cloudflare site can be deployed, previewed and signed in to with `--live` by these tasks. A Node site is deployed wherever you host it.
