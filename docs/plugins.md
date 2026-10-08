---
title: "Plugins"
nav_order: 9
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# Plugins

From EmDash's registry — no package, no config line, no clicking in the admin:

```
mise run plugin:search -- forms                     find one; it prints @publisher/slug
mise run plugin:install -- @netdollar.dev/forms     install it, as the admin's Install button does
mise run plugin:works -- @netdollar.dev/forms       does it work? one line per check
mise run plugin:works                               every plugin the site has
mise run plugin:favourites                          the favourites, in one go
mise run plugin:remove -- @netdollar.dev/forms
```

The favourites, why each is one, and what was rejected: [`docs/favourite-plugins.md`](favourite-plugins.md).
Your own list: `PLUGINS = "@a/one @b/two"` under `[env]`.

These act on this machine's built site (`site:preview`), starting it and signing in if needed;
the dev site shares its database, so the plugins are there too. With `-- --live` they act on the
deployed site, after `signin:token -- --live`.

A registry plugin runs in EmDash's sandbox, which a new site does not have switched on.
`plugin:install` switches it on (`plugin:sandbox`: one line in `astro.config.mjs`, and on
Cloudflare the `worker_loaders` line in `wrangler.jsonc`; on Node two packages). **On Cloudflare,
deploying a site with the sandbox on needs the Workers Paid plan.**

Your own, or one from npm — the task writes its lines in `astro.config.mjs`:

```
mise run plugin:new -- save-log        your own, inside the site
mise run plugin:add -- <npm package>   someone else's
mise run plugin:check -- save-log
mise run plugin -- <anything else in EmDash's plugin CLI>
```
