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
mise run plugin:update -- @meekmedia.bsky.social/bulletin@0.1.1   # to the release you name
mise run plugin:remove -- @netdollar.dev/forms
```

These act on this machine's built site (`site:preview`), starting it and signing in if needed. The dev site shares its database, so the plugins are there too. With `-- --live` they act on the deployed site, after `signin:token -- --live`; with `LIVE_PREVIEW=<name>` as well, on that [preview](preview.md) of it.

`plugin:works -- --live` makes the checks that can be made from outside: the site answers a visitor, lists the plugin as active, its routes answer, its admin pages load. It prints `skip` with the reason for the rest: a deployed site is not built or restarted from here, and its log is not read.

## Updating one

`plugin:update` moves an installed plugin to the release you name, and to no other. Before it sends anything it prints what the installed release was granted (`plugin:install` records that on this machine, in `~/.config/emdash-run/plugins/`), what each of the two releases declares in the registry, and what the new one asks for that the installed one did not. It needs `--yes` when the new release asks for more, and always with `--live`. The site then checks the release against the plugin it is running, and stops the same way if it finds more. EmDash refuses an older release: remove the plugin and install that release (`plugin:install -- <publisher>/<slug>@<version>`).

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

What the tasks write in `astro.config.mjs`, and what they leave to you:

| Plugin | In `astro.config.mjs` | Who writes it |
|---|---|---|
| Sandboxed: made by `plugin:new`, or a package built with `emdash-plugin build` | `import saveLog from "save-log";` and `sandboxed: [saveLog]` in `emdash({ … })` | The task |
| Native: a package that runs in the site itself, such as `@emdash-cms/plugin-forms` | `import { formsPlugin } from "@emdash-cms/plugin-forms";` and `plugins: [formsPlugin()]` | You. `plugin:add` adds the package, prints the two lines and stops: which export makes the plugin is for its README to say |

The tasks edit only the top level of the one `emdash({ … })` call, and change nothing that is already there. A config where that call is not written out (its options in a variable, a spread among them, two calls) is left as it is, and the task prints the lines to add by hand.

## Limits

- On Cloudflare, deploying a site with the sandbox on needs the Workers Paid plan.
- `plugin:works` says a plugin loads and answers: it shows a route that wants a POST only as existing, and does not fire hooks.
- A plugin runs with the permissions you agree to at install. `plugin:install` shows them all; hold a plugin to a release with `@<version>`, because a newer one may ask for more. `plugin:update` shows the difference before it moves one.
- `plugin:update` has been run only between releases that ask for the same: no plugin in the registry has a release that asks for more than the one before it, so the `--yes` it then needs is tested on made-up releases only (`tests/plugin-permissions.test.mjs`).
- On a Node site, `plugin:install`, `plugin:update` and `plugin:remove` restart the built site ([Upstream issues](../upstream.md)).
- `plugin:publish` asks first, and needs a registry login of your own.
