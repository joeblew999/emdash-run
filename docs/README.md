---
title: Home
nav_order: 1
permalink: /
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# emdash-run

Work on an [EmDash](https://docs.emdashcms.com) site with a few `mise` tasks: make a site, run it,
check it, sign in, deploy it. Each task runs EmDash's own commands in the right order.

https://github.com/joeblew999/emdash-run

**What works right now: [`docs/status.md`](status.md)** — the last test run, step by step.

## Set up

You need [mise](https://mise.jdx.dev). Put this in a `mise.toml` in your repo:

```toml
[settings]
experimental = true

[tools]
node = "26"
pnpm = "12"
fnox = "1.36.0"   # keeps your Cloudflare token; only needed for signin:access

[task_config]
includes = ["git::https://github.com/joeblew999/emdash-run.git//tasks.toml?ref=v1.0.0"]
```

That pins release `v1.0.0`; change the tag to update. `ref=main` follows development, but mise
keeps the copy it fetched first: run `mise cache clear` to take a newer one.

## In these docs

| | |
|---|---|
| [The tasks, in the order you use them](the-tasks-in-the-order-you-use-them.md) | |
| [Templates](templates.md) | |
| [An existing site](an-existing-site.md) | |
| [This machine or the deployed site](this-machine-or-the-deployed-site.md) | |
| [Signing in](signing-in.md) | |
| [Deploying (Cloudflare)](deploying-cloudflare.md) | |
| [Plugins](plugins.md) | |
| [Settings](settings.md) | |
| [Good to know](good-to-know.md) | |
| [Working on this repo](working-on-this-repo.md) | |
| [What works](status.md) | every task, and what the last test run showed |
| [Upstream bugs](upstream.md) | where EmDash, Astro or wrangler do not behave as documented |
| [For agents](agents/README.md) | the rules for working on this repo |
| [Plans](plans/README.md) | what is next, and what was done |
| [Writing docs](writing.md) | how these pages are written |
