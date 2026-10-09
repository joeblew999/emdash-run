---
title: Deploy
nav_order: 5
parent: Guides
---

# Deploy: a site on Cloudflare, with sign-in and content

For a site made from a `cloudflare:*` template. Sign in to Cloudflare once: `mise x -- pnpm dlx wrangler login`. Every task here is safe to run again.

## The first time

1. Name the Worker, database and bucket in `site/wrangler.jsonc`, and set `LIVE_URL` and `ADMIN_EMAIL` under `[env]` in `mise.toml`.
2. `mise run signin:access`: Cloudflare Access in front of the admin. It prints the lines to put in `astro.config.mjs` and `wrangler.jsonc`; put them in.
3. `mise run live:ship`: check, deploy, wait for the new version to answer.
4. `mise run signin:token -- --live`: the CLI is an administrator of the deployed site.
5. Bring the content. A newly deployed site has none:

```sh
mise run emdash -- site export --output site.emdash                         # this machine's content
mise run emdash -- site import site.emdash --analyze --live                 # prints a plan and its digest
mise run emdash -- site import site.emdash --plan <digest> --confirm --live
```

These three are EmDash's own `site export` and `site import`, as `live:ship` prints them for a site with no home page. No test step runs them.

`site:seed` and `site:demo` do not fill a deployed site: [This machine or deployed](local-or-deployed.md#three-tasks-never-act-on-a-deployed-site).

## After that

```sh
mise run live:ship       # deploy again
mise run live:logs       # follow its log
mise run live:undo       # back to the previous version (code only)
mise run live:backup     # a database bookmark to restore to, and a content package
mise run content:pull    # the deployed content, as a package in site/backups/
```

## The token `signin:access` needs

Everything uses the wrangler login except `signin:access`: that login can read Cloudflare Access but not change it. Make an API token in the Cloudflare dashboard (My Profile, API Tokens) with **Access: Apps and Policies, Edit** and **Access: Service Tokens, Edit**, and give it to the task in `CLOUDFLARE_API_TOKEN`. With [fnox](https://fnox.jdx.dev) in your `[tools]` the task reads it from there by itself:

```sh
fnox init                        # if this machine has no fnox config yet
fnox set CLOUDFLARE_API_TOKEN    # it asks for the value
```

## Limits

- `signin:access` covers `/_emdash` only: the site's pages stay public, and so do uploaded media and the addresses a plugin opens to visitors.
- `live:undo` rolls back code, not content. For content: `live:backup` before a risky change.
- A deployed site with the plugin sandbox on needs the Workers Paid plan.
- The deploying tasks are tested by the live group, which deploys to a Worker kept for it and is run by name ([How to help](../contributing.md#the-test)).
