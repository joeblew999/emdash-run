---
title: Preview
nav_order: 6
parent: Guides
---

# Preview: the site on an address of its own, beside the live one

A preview is this folder's code deployed under the same Worker with **its own database, bucket and sessions**. The live site is not touched. It is Cloudflare's [Worker Previews](https://developers.cloudflare.com/workers/previews/), which is in open beta.

```sh
mise run live:preview -- try-nav      # a preview named try-nav
mise run live:preview                 # with no name: named after the git branch
```

It prints the address: `https://<name>-<worker>.<account>.workers.dev`. Run it again to update the same preview.

The first time, it makes what a preview needs and Cloudflare does not make for it: a database, a bucket and a session store (`<worker>-preview…`), written into a `previews` block in `site/wrangler.jsonc`. Commit that block. Every preview of the site shares them.

## Act on a preview

Set `LIVE_PREVIEW` and a task that takes `--live` acts on that preview:

```sh
LIVE_PREVIEW=try-nav mise run signin:token -- --live
LIVE_PREVIEW=try-nav mise run emdash -- whoami --live
```

Put `LIVE_PREVIEW = "try-nav"` in `mise.local.toml` and this checkout's deployed site is its preview.

**Only when `LIVE_URL` is the Worker's `workers.dev` address.** With any other address, a domain of your own, `LIVE_PREVIEW` is not read and nothing says so: the task acts on the live site.

A new preview has no content. Bring it as for a first deploy: [Deploy](deploy.md#the-first-time), step 5.

## Sign-in

`signin:access` puts the site's Access application over the Worker's preview addresses too, so a preview's admin is behind the same sign-in as the live one. If it has not been run for this site, a preview's admin is open to anyone with the address: run it.

It covers the preview addresses only when `LIVE_URL` is a `workers.dev` address.

## Remove one

```sh
mise run live:preview -- try-nav --delete
```

The preview's database, bucket and session store are kept for the next one.

## Limits

- `model:sync -- --live` does not read `LIVE_PREVIEW`: it records the live site's model. Neither do `content:pull` and the other tasks that are always the deployed site.
- `signin:open`, `signin:passkey` and `signin:mcp` read `LIVE_PREVIEW`, and no test step runs them on a preview. No test step runs `live:preview` without a name.
- `live:preview` sets `"preview_urls": true` in `wrangler.jsonc`, where `signin:access` prints `"preview_urls": false` among its lines to put in: a preview has no address without it.
- Previews share one database: two previews of one site see the same content.
- Preview addresses being on also gives every deployed version an address of its own; its `/_emdash` is behind Access like the previews.
