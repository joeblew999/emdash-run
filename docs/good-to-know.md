---
title: "Good to know"
nav_order: 12
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# Good to know

- **Every task is safe to run again**, and the test runs each of them twice. A task that deletes
  or publishes asks first; in CI nothing asks.
- **Every task prints where it is acting** — the site folder, this machine or the deployed site —
  before it acts.
- What a task needs, stops or leaves behind is in its description: [`docs/tasks.md`](tasks.md).
