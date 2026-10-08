---
title: "Plugins"
nav_order: 9
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# Plugins

<!-- tasks:plugin -->
| task | what it does |
|---|---|
| `plugin:sandbox` | Let the site run sandboxed plugins, which every registry plugin is: the runner in the site's config. Run again: nothing changes |
| `plugin:new` | Make a plugin inside the site: scaffold, test, build, add to the site's config. mise run plugin:new \-\- &lt;name&gt;. Run again: rebuilds it. Stops the site: start it again afterwards |
| `plugin:check` | Check a plugin: manifest, types, tests, build, bundle. mise run plugin:check \-\- &lt;name&gt; |
| `plugin:add` | Add a plugin from npm: the package, and its lines in the site's config. mise run plugin:add \-\- &lt;package&gt;. Stops the site: start it again afterwards |
| `plugin:search` | Search EmDash's plugin registry. mise run plugin:search \-\- forms |
| `plugin:install` | Install a plugin from EmDash's registry, no clicking: mise run plugin:install \-\- &lt;publisher&gt;/&lt;slug&gt;. Add \-\-live for the deployed site |
| `plugin:works` | Does a plugin work? One line per check: builds, starts, listed, routes, admin page, log, sandbox. mise run plugin:works \-\- &lt;name&gt;. No name: every plugin |
| `plugin:remove` | Remove a registry plugin from the site; what it stored is kept. mise run plugin:remove \-\- &lt;publisher&gt;/&lt;slug&gt;. Add \-\-live for deployed |
| `plugin:favourites` | Install the favourite registry plugins in one go (docs/favourite-plugins.md), or your own list: PLUGINS in mise.toml. Add \-\-live for deployed |
| `plugin` | Anything else in EmDash's plugin CLI. mise run plugin \-\- info &lt;publisher&gt; &lt;slug&gt; |
| `plugin:publish` | Publish a plugin to EmDash's registry. Asks first |
<!-- /tasks -->

Two kinds. A **registry** plugin (`plugin:search`, `plugin:install`, `plugin:favourites`) is
installed into the site's database, as the admin's Install button does: no package, no config
line. A **package** plugin (`plugin:new`, `plugin:add`) is in `package.json` and
`astro.config.mjs`, and the task writes both.

The favourites, why each is one, and what was rejected: [`docs/favourite-plugins.md`](favourite-plugins.md).
Your own list: `PLUGINS = "@a/one @b/two"` under `[env]`.

The registry tasks act on this machine's built site (`site:preview`), starting it and signing in
if needed; the dev site shares its database, so the plugins are there too. With `-- --live` they
act on the deployed site, after `signin:token -- --live`.

A registry plugin runs in EmDash's sandbox, which a new site does not have switched on:
`plugin:install` switches it on. **On Cloudflare, deploying a site with the sandbox on needs the
Workers Paid plan.**
