---
title: Getting started
nav_order: 2
---

# Getting started: from nothing to a running site you are signed in to

You need [mise](https://mise.jdx.dev) and git, on macOS, Linux or Windows. mise fetches Node and pnpm.

## 1. Include the tasks

In a `mise.toml` in your repo, with the tag of the [latest release](https://github.com/joeblew999/emdash-run/releases/latest) for `vX.Y.Z`:

```toml
[settings]
experimental = true

[tools]
node = "26"
pnpm = "12"

[task_config]
includes = ["git::https://github.com/joeblew999/emdash-run.git//tasks.toml?ref=vX.Y.Z"]
```

Then `mise trust && mise install`. To update later, change the tag.

## 2. Make a site and run it

```sh
mise run site:new      # a site in site/, from the template cloudflare:blog
mise run site:start    # the dev site, in the background, on port 4321
```

Open `http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`: EmDash sets the site up and signs you in. Another template: [Templates](reference/templates.md). A repo that already is a site: [An existing site](guides/existing-site.md).

## 3. Work on it

```sh
mise run emdash -- content list posts                              # anything in EmDash's own CLI
mise run emdash -- schema add-field pages subtitle --type string
mise run model:sync                                                # record the content model in the repo
mise run site:check                                                # before a commit: seed, types, build
mise run site:logs
mise run site:stop
```

`mise tasks` lists every task with what it does; so does [Tasks](reference/tasks.md).

## Next

| To | Read |
|---|---|
| Sign a script or an agent in | [Sign in](guides/sign-in.md) |
| Put the site on Cloudflare | [Deploy](guides/deploy.md) |
| Add plugins | [Plugins](guides/plugins.md) |
| Run two sites on one machine | [Several sites at once](guides/several-sites.md) |
