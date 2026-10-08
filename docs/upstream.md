---
title: Upstream issues
nav_order: 3
parent: How to help
---

# Upstream issues: every workaround, and the issue it waits for

`mise run upstream:status` shows the state of each issue that has one. When one closes, do what the row says, then `mise run dev:test`. Seen with EmDash 1.2.0, Astro 7.3.5 and wrangler 4.147.0 unless a row says otherwise.

| Issue | Problem | Workaround | When fixed |
|---|---|---|---|
| [emdash#3993](https://github.com/emdash-cms/emdash/issues/3993) | With Cloudflare Access configured, the CLI cannot sign in to the dev site: `/_emdash/api/auth/dev-bypass` is not there | The `emdash` task takes a token from `/_emdash/api/setup/dev-bypass?token=1` (`scripts/emdash.mjs`) | Take that block out |
| [emdash#3994](https://github.com/emdash-cms/emdash/issues/3994) | `emdash whoami` does not send `EMDASH_HEADERS`, so it fails behind Cloudflare Access | `signin:token -- --live` also writes EmDash's sign-in store; the `emdash` task answers `whoami` itself | Take both out |
| [emdash#3995](https://github.com/emdash-cms/emdash/issues/3995) | `emdash whoami` exits 0 when no site is running | `site:start` ends on `emdash schema list` | Use `whoami` |
| [emdash#3996](https://github.com/emdash-cms/emdash/issues/3996) | The CLI's sign-in file is written without a lock: two sign-ins at once lose one | `signin:token` keeps a file per site; the test gives each site a config folder | Share one config folder in the test |
| EmDash, not filed | No setup and no CLI sign-in without a browser; `emdash login` always opens one | `signin:token` writes the administrator and the token into the database | Use EmDash's way |
| EmDash, not filed | Under Cloudflare Access a machine cannot sign in by any documented route | `signin:token -- --live` | Use the documented route |
| EmDash, not filed | A local sign-in is kept per project folder and outlives the database | `signin:token` does not use `emdash login`; `site:reset` removes the saved token with the database | |
| EmDash, not filed | The welcome dialog has no setting | `site:start` and `signin:token` close it with the call its own button makes (`scripts/core/site.mjs`, `scripts/core/signin.mjs`) | Set the option |
| EmDash, not filed | A Node build takes itself to be on port 4321 | `site:preview` sets `EMDASH_SITE_URL` | |
| EmDash, not filed | `emdash export-seed` and `emdash doctor` cannot reach a Cloudflare template's local database | `model:sync` records the model with `emdash types`; the seed is not refreshed | Refresh the seed too |
| EmDash, not filed | `emdash migrate` cannot use wrangler's sign-in | No migration step: EmDash migrates on the first request | |
| EmDash, not filed | The skills `create-emdash` writes cannot be refreshed | `emdash:update` says they are not updated | Refresh them in `emdash:update` |
| EmDash, not filed | `emdash-plugin init` fails on Windows beside a running dev server | `plugin:new` stops the site first | |
| EmDash, not filed | Nothing checks a project before its first deploy | `live:check` is wrangler's dry run | |
| EmDash, not filed | No command installs a registry plugin | `plugin:install` sends the admin's two requests (`scripts/plugin-install.mjs`) | Use the command |
| EmDash, not filed | `create-emdash --sandboxed-plugins` does not switch the sandbox on | `plugin:sandbox` writes both settings | |
| EmDash, not filed | `emdash-plugin info <handle> <slug>` fails when the publisher's own host is down | `plugin:install` asks the registry's aggregator | |
| EmDash, not filed | On a Node site EmDash stops workerd's launcher, not workerd: the sandbox process outlives a restart of the sandbox and the site itself, keeps its port, and the next one fails with `bind(): Address already in use` | `plugin:sandbox` allows workerd's install script (`allowBuilds` in `pnpm-workspace.yaml`), which puts the program in the launcher's place; `site:stop` stops one left over; `plugin:install` and `plugin:remove` restart a Node site | Drop all three |
| EmDash, not filed | A Node site's sandbox takes fixed ports from 18788, so two Node sites on one machine cannot both run sandboxed plugins (seen 2026-10-08, macOS: the second one's workerd ends with `bind(): Address already in use`) | None: one Node site with sandboxed plugins at a time | |
| EmDash, not filed | On a Node site one plugin that cannot start takes every sandboxed plugin down | `plugin:works` reports it; `plugin:remove` takes it out | |
| EmDash, not filed | Nothing lists what an installed registry plugin declares | `plugin:install` keeps what the registry answered, for `plugin:works` | Ask the site |
| EmDash's guide, not filed | The backup guide's SQL dump fails on a site with search: D1's export refuses the search tables | `live:backup` takes a Time Travel bookmark and a content package | Add the dump |
| wrangler, not filed | `wrangler types --check` fails on a freshly scaffolded template | Not used as a check | Add it to `site:check` |
| Cloudflare's Vite plugin, not filed | Two sites started in the same moment take the same debugger port (9229), and one answers 500 to everything | Sites start one at a time, machine-wide (`scripts/site.mjs`) | Drop the lock |
| Cloudflare Worker Previews (beta) | A preview's database, bucket and session store are not made for it, and a preview has no address until preview addresses are on | `live:preview` makes them and switches the addresses on (`scripts/live-preview.mjs`) | Let wrangler do it |
