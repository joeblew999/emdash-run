---
title: Plugins
nav_order: 7
parent: Guides
---

# Plugins: your own, one from npm, one from the registry

Two kinds. A **registry** plugin is installed into the site's database, as the admin's Install button does: no package, no config line. A **package** plugin is in `package.json` and `astro.config.mjs`, and the task writes both.

## From EmDash's registry

```sh
mise run plugin:search -- forms                                    # find one: it prints @publisher/slug
mise run plugin:install -- @masonjames.com/contact-forms --yes     # it prints what the plugin asks for; --yes agrees
mise run plugin:works -- @masonjames.com/contact-forms             # does it load and answer? one line per check
mise run plugin:favourites -- --yes                                # the favourites, in one go
mise run plugin:update -- @meekmedia.bsky.social/bulletin@0.1.1    # to the release you name
mise run plugin:remove -- @masonjames.com/contact-forms
```

Without `--yes`, `plugin:install` prints what a plugin asks for and stops at one that can change things or reach outside the site.

These act on this machine's built site (`site:preview`), starting it and signing in if needed. With `-- --live` they act on the deployed site, after `signin:token -- --live`; with `LIVE_PREVIEW=<name>` as well, on that [preview](preview.md) of it.

On a deployed Cloudflare site, `plugin:install`, `plugin:favourites`, `plugin:update`, `plugin:remove`, and `plugin:works` for one plugin passed with `--live` on 2026-10-09. `plugin:works -- --live` with no name, every plugin the site has, does not hold there: straight after the installs it failed in three runs of four, a different way each time — a plugin's admin page refused, or a plugin listed as active and not in the admin's manifest. The task says each in a `FAIL` line and fails, which is what a person opening that page is shown ([Upstream issues](../upstream.md)). The test runs that check on this machine only.

The dev site shares the built site's database, so the plugins are there too. A dev site that is already running does not load a plugin installed this way until it is started again: `mise run site:stop`, then `mise run site:start`.

A registry plugin runs in EmDash's sandbox, which a new site does not have switched on. On this machine the tasks switch it on first ([`plugin:sandbox`](../reference/tasks.md#pluginsandbox)); a deployed site has to be deployed with it on: `mise run plugin:sandbox`, then `mise run live:ship`.

What each task prints and when it needs `--yes` is its description: [`plugin:install`](../reference/tasks.md#plugininstall), [`plugin:update`](../reference/tasks.md#pluginupdate), [`plugin:works`](../reference/tasks.md#pluginworks). The favourites, why each is one, and every plugin that was tried: [Favourite plugins](../reference/favourite-plugins.md). Your own list: `PLUGINS = "@a/one @b/two"` under `[env]`.

## See seven do their real thing

```sh
mise run plugin:demo
```

`plugin:works` says a plugin loads and answers. [`plugin:demo`](../reference/tasks.md#plugindemo) has seven registry plugins each do what they are for, and its description says what each does, what it installs and what it leaves in the site. What the description does not say:

- **What each plugin is set up with is written in code**, a recipe per plugin in `scripts/core/plugin-demo.mjs`: the form's fields, the post, its French words. It is not a file you edit.
- **It refuses `--live`**: this machine's built site only.
- **To draw Contact Forms' form on a page, a site needs more than the plugin's package in its config**: a `src/middleware.ts` as this repo's `site/` has ([Upstream issues](../upstream.md)).

## Your own, or one from npm

```sh
mise run plugin:new -- save-log                      # scaffold, test, build, add to the site
mise run plugin:check -- save-log                    # manifest, types, tests, build, bundle
mise run plugin:add -- @emdash-cms/plugin-forms      # a package from npm
mise run plugin -- --help                            # anything else in EmDash's plugin CLI
```

`plugin:new` needs `PLUGIN_PUBLISHER`, `PLUGIN_AUTHOR` and `PLUGIN_SECURITY_EMAIL` ([Settings](../reference/settings.md)). `plugin:new` and `plugin:add` stop the site while its packages change; one that was running before the task is started again when it ends.

What the tasks write in `astro.config.mjs`, and what they leave to you:

| Plugin | In `astro.config.mjs` | Who writes it |
|---|---|---|
| Sandboxed: made by `plugin:new`, or a package built with `emdash-plugin build` | `import saveLog from "save-log";` and `sandboxed: [saveLog]` in `emdash({ … })` | The task |
| Native: a package that runs in the site itself, such as `@emdash-cms/plugin-forms` | `import { formsPlugin } from "@emdash-cms/plugin-forms";` and `plugins: [formsPlugin()]` | You. `plugin:add` adds the package, prints the two lines and ends there, as a failure: which export makes the plugin is for its README to say |

The tasks edit only the top level of the one `emdash({ … })` call, and change nothing that is already there. A config where that call is not written out (its options in a variable, a spread among them, two calls) is left as it is, and the task prints the lines to add by hand.

## Limits

- On Cloudflare, deploying a site with the sandbox on needs the Workers Paid plan.
- `plugin:works` says a plugin loads and answers: it shows a route that wants a POST only as existing, and does not fire hooks.
- A plugin runs with the permissions you agree to at install. Hold a plugin to a release with `@<version>`, because a newer one may ask for more.
- `plugin:update` has been run only between releases that ask for the same: on 2026-10-08 no plugin in the registry had a release that asks for more than the one before it. So its stop without `--yes`, and the site's own refusal, have not been run. What is tested, on made-up releases, is how it works out that a release asks for more (`tests/plugin/plugin-permissions.test.mjs`).
- On a Node site, `plugin:install`, `plugin:update` and `plugin:remove` restart the built site ([Upstream issues](../upstream.md)).
- `plugin:publish` asks first, and needs a registry login of your own.
