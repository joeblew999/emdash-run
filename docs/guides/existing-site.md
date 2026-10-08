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

Everything works except `site:new` and `site:delete`, which refuse: there is nothing for them to make or remove.

If the site has no seed file, also set `SITE_SEED = "none"`, and `site:check` skips the seed check.

Then `mise run site:start`, as in [Getting started](../getting-started.md).
