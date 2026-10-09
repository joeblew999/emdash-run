---
title: Getting started
nav_order: 2
---

# Getting started: from nothing to a running site you are signed in to

You need [mise](https://mise.jdx.dev) and git. mise fetches Node and pnpm.

The tasks are written for macOS, Linux and Windows. What has been shown to work, and where:

- **macOS:** the run in [What the tests showed](reference/tests.md), on a developer's machine. Each block there says its level; a step marked as skipped was not run.
- **Linux and Windows:** only what the `stages` workflow on GitHub has run. Of the test as it is now that is the smoke level, which passes on Linux, macOS and Windows: the unit tests, and a project given its ports whose dev site starts, answers and signs a developer in.
- **Windows, beyond that:** the fast and all levels have not passed there. In the last run of every step on Windows the steps on the dev site passed, and the first step that builds the site and starts the built one did not end in five minutes ([issue 6](https://github.com/joeblew999/emdash-run/issues/6), open).

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

Open `http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`: EmDash sets the site up and signs you in. Another template, and which of them the test makes a site from: [Templates](reference/templates.md). A repo that already is a site: [An existing site](guides/existing-site.md).

## 3. Work on it

```sh
mise run emdash -- schema list                                                      # anything in EmDash's own CLI
mise run emdash -- schema add-field pages subtitle --type string --label Subtitle
mise run model:sync                                                                 # record the content model in the repo
mise run site:check                                                                 # before a commit: seed, types, build
mise run site:logs
mise run site:stop
```

`mise tasks` lists every task with what it does; so does [Tasks](reference/tasks.md).

## 4. See where the site is, and what a task would do

```sh
mise run site:status                     # state by state, with the task that gets each further
mise run plan -- signin:token            # every state that task stands on, in order
mise run plan -- signin:token --live     # the same, for the deployed site
```

Both only look: nothing is started, built or changed.

A task brings the site to a state, and each state stands on others: being signed in to the built site stands on that site running, which stands on it being built. A task reaches them in order and skips each that is already so. Every state prints one line with the time it took:

```text
[site:built] already so (<time>)
[site:built-running] done in <time>
```

A task leaves the dev site and the built site as it found them: one that was running before the task and is not answering properly after it is started again. `site:stop` and `site:delete` are the two that do not.

`plan` shows the states a task stands on, not the states it reaches from inside its own work: `site:check` builds the site, and its plan does not have the state `site:built`.

## Next

| To | Read |
|---|---|
| Sign a script or an agent in | [Sign in](guides/sign-in.md) |
| Fill the site from a seed file | [Seed files](guides/seed.md) |
| Add plugins | [Plugins](guides/plugins.md) |
| Put the site on Cloudflare | [Deploy](guides/deploy.md) |
| Run two sites on one machine | [Several sites at once](guides/several-sites.md) |
