---
title: "An existing site"
nav_order: 5
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# An existing site

The tasks expect the site in a `site/` folder. If your repo *is* the site:

```toml
[env]
SITE_FOLDER = "."
```

Everything works except `site:new` and `site:delete`, which refuse.
