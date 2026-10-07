---
title: "This machine or deployed"
nav_order: 6
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# This machine or deployed

**No flag is this machine. `--live` is the deployed site.**

```toml
[env]
LIVE_URL = "https://your-site.workers.dev"
```

```
mise run emdash -- content list posts            this machine
mise run emdash -- content list posts --live     the deployed site
mise run model:sync -- --live
```

`site:` tasks are always this machine. `live:` tasks are always the deployed site. Every task
prints where it is acting before it acts.
