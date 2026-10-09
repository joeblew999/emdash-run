---
title: An existing site
nav_order: 1
parent: Guides
---

# An existing site: the tasks on a repo that already is an EmDash site

The tasks expect the site in a `site/` folder beside `mise.toml`. If your repo *is* the site, say so under `[env]` in `mise.toml`:

```toml
[env]
SITE_FOLDER = "."
```

`site:new` and `site:delete` then refuse: they make and remove a folder of the site's own, and there is none.

If the site has no seed file, also set `SITE_SEED = "none"`, and `site:check` skips the seed check.

Then:

```sh
mise run site:status    # where the site is now, and the task that gets it further
mise run site:start     # as in Getting started
```

[Getting started](../getting-started.md) has the rest.

## What the tasks change in your site

- **A task that type-checks the site adds `typescript@6` to its devDependencies** when it has no `typescript`, and says so: `site:check`, and the tasks that run it, `emdash:update`, `live:ship`, `live:preview` and `plugin:works`. Without it `astro check` asks to install it, checks nothing and ends as a success ([Upstream issues](../upstream.md)).
- **The first task that starts or builds the site writes `EMDASH_ENCRYPTION_KEY` into its `.env`**, with EmDash's own `emdash secrets generate`, when it is not there.
- **`plugin:sandbox`, and every registry plugin task on this machine, which runs it first,** edits `astro.config.mjs`, and `wrangler.jsonc` on a Cloudflare site or `package.json` and `pnpm-workspace.yaml` on a Node one. `plugin:new` and `plugin:add` edit `package.json` and `astro.config.mjs`, and `live:preview` edits `wrangler.jsonc`: [Plugins](plugins.md), [Preview](preview.md).

## Limits

- No test step runs with `SITE_FOLDER = "."`: the test's sites are in `site/`.
- `plugin:demo` needs collections named `posts` and `pages`, as EmDash's templates have.
