---
title: Plugins
nav_order: 6
parent: Guides
---

# Plugins: your own, one from npm, one from the registry

Two kinds. A **registry** plugin is installed into the site's database, as the admin's Install button does: no package, no config line. A **package** plugin is in `package.json` and `astro.config.mjs`, and the task writes both.

## From EmDash's registry

```sh
mise run plugin:search -- forms                     # find one: it prints @publisher/slug
mise run plugin:install -- @netdollar.dev/forms     # it prints what the plugin asks for; --yes to agree
mise run plugin:works -- @netdollar.dev/forms       # does it load and answer? one line per check
mise run plugin:favourites -- --yes                 # the favourites, in one go
mise run plugin:remove -- @netdollar.dev/forms
```

These act on this machine's built site (`site:preview`), starting it and signing in if needed. The dev site shares its database, so the plugins are there too. With `-- --live` they act on the deployed site, after `signin:token -- --live`.

A registry plugin runs in EmDash's sandbox, which a new site does not have switched on: `plugin:install` switches it on (`plugin:sandbox`).

The favourites, why each is one, and what was left off: [Favourite plugins](../reference/favourite-plugins.md). Your own list: `PLUGINS = "@a/one @b/two"` under `[env]`.

## Your own, or one from npm

```sh
mise run plugin:new -- save-log                      # scaffold, test, build, add to the site
mise run plugin:check -- save-log                    # manifest, types, tests, build, bundle
mise run plugin:add -- @emdash-cms/plugin-forms      # a package from npm
mise run plugin -- info <publisher> <slug>           # anything else in EmDash's plugin CLI
```

`plugin:new` needs `PLUGIN_PUBLISHER`, `PLUGIN_AUTHOR` and `PLUGIN_SECURITY_EMAIL` ([Settings](../reference/settings.md)). `plugin:new` and `plugin:add` stop the site: start it again afterwards.

## Limits

- On Cloudflare, deploying a site with the sandbox on needs the Workers Paid plan.
- `plugin:works` says a plugin loads and answers: it shows a route that wants a POST only as existing, and does not fire hooks.
- A plugin runs with the permissions you agree to at install. `plugin:install` shows them all; hold a plugin to a release with `@<version>`, because a newer one may ask for more.
- On a Node site, `plugin:install` and `plugin:remove` restart the built site ([Upstream issues](../upstream.md)).
- `plugin:publish` asks first, and needs a registry login of your own.
