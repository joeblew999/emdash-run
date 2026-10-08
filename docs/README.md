---
title: Home
nav_order: 1
permalink: /
---

# emdash-run

Work on an [EmDash](https://docs.emdashcms.com) site with a few `mise` tasks: make a site, run it, check it, sign in, add plugins, deploy it, preview it. Each task runs EmDash's, Astro's and wrangler's own commands in the right order, and is safe to run again.

Start with [Getting started](getting-started.md). What works at this commit, task by task: [What works](reference/status.md).

## The map

| You have | It gives you | Tasks |
|---|---|---|
| An empty repo, or an EmDash site | A site on this machine: the dev site, and the built site that behaves like a deployed one | `site:*`, `emdash`, `model:sync` |
| A site that needs someone signed in | A machine or a person signed in, with or without a browser | `signin:*` |
| A site that needs plugins | Your own, one from npm, or one from EmDash's registry, and a check that it works | `plugin:*` |
| A Cloudflare account | The site deployed, backed up, rolled back, and previewed beside itself | `live:*`, `content:pull` |

One rule says where a task acts: no flag is this machine, `--live` is the deployed site ([This machine or deployed](guides/local-or-deployed.md)).

## What is generated

Don't edit these: change what they are written from.

| Page or file | Written by | From |
|---|---|---|
| [Tasks](reference/tasks.md) | `mise run docs:setup` | each task's `description` in `tasks.toml`, in the order `tests/replay.sh` uses them |
| [What works](reference/status.md) | `mise run docs:setup` | `tests/results.json`, which every test run updates |
| `_config.yml`, `_sass/`, `llms.txt`, [Writing docs](writing.md) | `mise run docs:setup` | [charter](https://github.com/joeblew999/charter) |
| `.github/ISSUE_TEMPLATE/`, `.github/labels.tsv` | `mise run repo` | charter |

## Index

| Page | What it is for |
|---|---|
| [Getting started](getting-started.md) | From nothing to a running site you are signed in to |
| **[Guides](guides.md)** | One job per page |
| [An existing site](guides/existing-site.md) | Using the tasks on a repo that already is an EmDash site |
| [This machine or deployed](guides/local-or-deployed.md) | The one rule, and the three sites a project has |
| [Sign in](guides/sign-in.md) | The four ways, and which to use |
| [Deploy](guides/deploy.md) | Putting a site on Cloudflare, with sign-in and content |
| [Preview](guides/preview.md) | The site on an address of its own, beside the live one |
| [Plugins](guides/plugins.md) | Making one, adding one, installing from the registry |
| [Several sites at once](guides/several-sites.md) | Two projects, or several agents, on one machine |
| **[Reference](reference.md)** | Tables: tasks, settings, templates |
| [Tasks](reference/tasks.md) | Every task: what it does, its arguments and flags |
| [What works](reference/status.md) | Every task, and what the last test run showed |
| [Settings](reference/settings.md) | Everything you can set in `mise.toml` |
| [Templates](reference/templates.md) | The eight kinds of site `site:new` makes |
| [Favourite plugins](reference/favourite-plugins.md) | What `plugin:favourites` installs, and why |
| **How to help** | |
| [How to help](contributing.md) | Setting up, the tests, reporting a bug, how it is built |
| [Rules](rules.md) | The working rules, for developers and agents |
| [Upstream issues](upstream.md) | Every workaround, and the issue it waits for |
| [Writing docs](writing.md) | How these pages are written |
