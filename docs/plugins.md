---
title: "Plugins"
nav_order: 9
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# Plugins

```
mise run plugin:new -- save-log        your own, inside the site
mise run plugin:add -- <npm package>   someone else's
mise run plugin:check -- save-log
mise run plugin:search -- forms
mise run plugin -- <anything else in EmDash's plugin CLI>
```

After `plugin:new` or `plugin:add` you add two lines to the site's `astro.config.mjs`; the task
prints them.
