---
title: Preview
nav_order: 5
parent: Guides
---

# Preview: the site on an address of its own, beside the live one

A preview is this folder's code deployed under the same Worker with **its own database, bucket and sessions**. The live site is not touched. It is Cloudflare's [Worker Previews](https://developers.cloudflare.com/workers/previews/), which is in open beta.

```sh
mise run live:preview                 # named after the git branch
mise run live:preview -- try-nav      # or name it
```

It prints the address: `https://<name>-<worker>.<account>.workers.dev`. Run it again to update the same preview.

The first time, it makes what a preview needs and Cloudflare does not make for it: a database, a bucket and a session store (`<worker>-preview…`), written into a `previews` block in `site/wrangler.jsonc`. Commit that block. Every preview of the site shares them.

## Act on a preview

Set `LIVE_PREVIEW` and every task that takes `--live` acts on that preview:

```sh
LIVE_PREVIEW=try-nav mise run signin:token -- --live
LIVE_PREVIEW=try-nav mise run emdash -- site import site.emdash --analyze --live
```

Put `LIVE_PREVIEW = "try-nav"` in `mise.local.toml` and this checkout's deployed site is its preview.

A new preview has no content. Bring it as for a first deploy: [Deploy](deploy.md#the-first-time), step 5.

## Sign-in

Run `mise run signin:access` once after the first preview: it puts the site's Access application over the preview addresses too. Until then a preview's admin is open to anyone with the address.

## Remove one

```sh
mise run live:preview -- try-nav --delete
```

The preview's database, bucket and session store are kept for the next one.

## Limits

- `signin:open` and `signin:passkey` do not read `LIVE_PREVIEW`.
- Previews share one database: two previews of one site see the same content.
- Preview addresses being on also gives every deployed version an address of its own; its `/_emdash` is behind Access like the previews.
