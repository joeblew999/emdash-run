---
title: "Working on emdash-run"
nav_order: 13
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# Working on emdash-run

```
mise run test          the everyday tasks from an empty folder, about a minute
mise run test:full     everything: both templates, then the deployed-site tasks — about 8 minutes
mise run docs          rebuild every generated page (the tests and the commit check do it too)
mise run hooks         once per clone: turns on the commit check
```

The commit check keeps three things together. A commit that touches `tasks.toml`, the test or this
README is refused if a task has no test step, if a test step names a task that is gone, or if the
pages built from them (the task table above, [`docs/`](docs/)) are out of date — it rebuilds them
and asks you to add them.

Each runs as another developer would — a clean environment, an empty config folder, its own site
in a temporary folder — and adds its results to [`docs/status.md`](status.md). To
try a task by hand here, `mise run site:new` makes a `site/` (gitignored). The plan is in [`docs/plans/`](plans/README.md); the
rules for agents are in [`docs/agents/README.md`](agents/README.md).
