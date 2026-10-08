---
title: "Plugins"
nav_order: 9
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# Plugins

<!-- tasks:plugin -->
| task | what it does |
|---|---|
| `plugin:new` | Make a plugin of your own inside the site: scaffold, test, build, add — and print the two lines to put in astro.config.mjs. Stops the site: start it again afterwards. Run again: rebuilds and re-adds it. mise run plugin:new \-\- &lt;name&gt; |
| `plugin:check` | Check a plugin: manifest, types, tests, build, bundle. mise run plugin:check \-\- &lt;name&gt; |
| `plugin:add` | Add a plugin from npm, and print the two lines to put in astro.config.mjs. Stops the site: start it again afterwards. mise run plugin:add \-\- &lt;package&gt; |
| `plugin:search` | Search EmDash's plugin registry. mise run plugin:search \-\- forms |
| `plugin` | Anything else in EmDash's plugin CLI. mise run plugin \-\- info &lt;publisher&gt; &lt;slug&gt; |
| `plugin:publish` | Publish a plugin to EmDash's registry. Asks first |
<!-- /tasks -->
