---
title: "Several sites, or several agents, at once"
nav_order: 11
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# Several sites, or several agents, at once

Two projects on one machine would both want ports 4321 and 4322. In each one:

```
mise run site:ports        two free ports of its own, written to mise.local.toml (git ignores it)
```

Everything else is already separate: what the sign-in tasks save is named by the site's folder,
and a deployed site by its address. For agents working side by side on one repo: a git worktree
each, `site:ports` in each. The full test runs three sites at once this way.
