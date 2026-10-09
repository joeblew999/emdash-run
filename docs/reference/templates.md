---
title: Templates
nav_order: 4
parent: Reference
---

# Templates: the eight kinds of site `site:new` makes

```sh
mise run site:new -- cloudflare:starter
```

| | `blog` | `starter` | `marketing` | `portfolio` |
|---|---|---|---|---|
| Cloudflare (Workers, D1, R2) | `cloudflare:blog` | `cloudflare:starter` | `cloudflare:marketing` | `cloudflare:portfolio` |
| Node.js (SQLite, local uploads) | `node:blog` | `node:starter` | `node:marketing` | `node:portfolio` |

With no argument it uses `TEMPLATE` from your `mise.toml`, else `cloudflare:blog`. They are EmDash's own templates, made by `create-emdash`.

Only a Cloudflare site can be deployed and previewed by these tasks, and `signin:token -- --live` works on a Cloudflare site only. A Node site is deployed wherever you host it.

## Which the test runs on

| Site | Where |
|---|---|
| A copy of this repo's `site/`: `cloudflare:blog`, with French and two forms plugins' blocks added | The site, signin and plugin groups |
| `node:starter`, made by `site:new` | The same three groups, with `--node` |
| `cloudflare:starter`, made by `site:new` | The live group, and one step of the site group at the level all |

So `site:new` is run for the two `starter` templates only. No test step makes a site from `cloudflare:blog`, the default, nor from `node:blog` or a `marketing` or `portfolio` template.
