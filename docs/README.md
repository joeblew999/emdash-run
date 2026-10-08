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
includes = ["git::https://github.com/joeblew999/emdash-run.git//tasks.toml?ref=v1.1.0"]
```

That pins release `v1.0.1`; change the tag to update. `ref=main` follows development, but mise
keeps the copy it fetched first: run `mise cache clear` to take a newer one.

## In these docs

| | |
|---|---|
| [Templates](templates.md) | the eight kinds of site `site:new` can make |
| [An existing site](an-existing-site.md) | using the tasks on a repo that already is an EmDash site |
| [This machine or deployed](this-machine-or-deployed.md) | one rule: no flag is this machine, `--live` is the deployed site |
| [Signing in](signing-in.md) | the four ways, and which to use |
| [Deploying](deploying.md) | putting a site on Cloudflare, undoing, logs, backups |
| [Plugins](plugins.md) | searching the registry, installing with no clicking, knowing one works, making your own |
| [Settings](settings.md) | everything you can set in `mise.toml` |
| [Several sites, or several agents, at once](several-sites-or-several-agents-at-once.md) |  |
| [Good to know](good-to-know.md) | what asks first, what stops the site, what is not there |
| [Working on emdash-run](working-on-emdash-run.md) | the tests, and where the rules are |
| [Every task](tasks.md) | in the order you use them; each one's description, arguments and flags — written by mise from `tasks.toml` |
| [Favourite plugins](favourite-plugins.md) | the registry plugins `plugin:favourites` installs, why, and what was rejected |
| [What works](status.md) | every task, and what the last test run showed |
| [Upstream bugs](upstream.md) | where EmDash, Astro or wrangler do not behave as documented |
| [For agents](agents/README.md) | the rules for working on this repo |
| [Plans](plans/README.md) | what is next, and what was done |
| [Writing docs](writing.md) | how these pages are written |
