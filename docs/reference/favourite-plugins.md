---
title: Favourite plugins
nav_order: 5
parent: Reference
---

# Favourite plugins: what `plugin:favourites` installs, and why

The plugins from EmDash's registry that `mise run plugin:favourites` installs into a site, why each is on the list, and what was looked at and left off. Read it before you rely on one, or to choose your own list.

```sh
mise run plugin:favourites -- --yes   # install them all, at the releases below
mise run plugin:works                 # check every plugin the site has, one line per check
```

One already installed at that release is left alone. One installed at another release is a `FAIL` line, and the task fails: `plugin:update` moves it.

Your own list, in the project's `mise.toml`:

```toml
[env]
PLUGINS = "@netdollar.dev/forms@0.1.0 @meekmedia.bsky.social/bulletin"   # with @version: held to that release
```

## The list

Chosen by what a new site needs first, from plugins that need nothing outside the site to be of use and load and answer on a Cloudflare site and on a Node site on this machine (below). On a deployed site two of them, `link-guardian` and `instant-indexer`, have had admin pages refused ([Limits](#limits)). Each is installed at the release in the table: a newer one is not taken until someone has read what it asks for. [`plugin:update`](tasks.md#pluginupdate) prints that, beside what the installed release was granted, and moves the plugin.

| Plugin | Release | What it is for | What it may do on the site |
|---|---|---|---|
| `@netdollar.dev/forms` | 0.1.0 | Contact forms, surveys, multi-step forms. The fullest of the three form plugins tried. It stores what visitors submit: personal data | **Send email** |
| `@nookeshk.bsky.social/seo-suite` | 0.2.0 | Keyphrase and readability checks, JSON-LD, redirects, an SEO health page | Read content, the model, taxonomies, media and redirects; **change content, editor drafts and redirects** |
| `@meekmedia.bsky.social/link-guardian` | 0.1.0 | Finds broken links, and stale ones after a slug change. Nothing else surveyed does it | Read content and the model; **change redirects; call any address on the internet** (it follows the site's links) |
| `@peachfinthemes.com/instant-indexer` | 1.0.0 | Tells search engines (IndexNow) when a page is added or changed. No account needed. From an address only this machine can reach it sends nothing, and its own log page says so | Read content and the model; **call out to the search engines** |
| `@agenticecom.net/media-alt-text-queue` | 0.2.1 | Finds images with no alt text | Read content, revisions, the model and media; **change a media item's details** |

`plugin:install` prints this for any plugin before it installs, with the hosts it may call and the tools it gives to agents. A plugin that can change things or reach outside the site, and any install with `--live`, needs `--yes`. So `plugin:favourites` needs it.

## The two more that `plugin:demo` uses

[`plugin:demo`](tasks.md#plugindemo) has seven plugins each do what they are for: the five above, and two that are not favourites. It installs those the site lacks, each at the release here.

| Plugin | Release | What it does there | Why it is not a favourite |
|---|---|---|---|
| `@masonjames.com/contact-forms` | 0.2.0 | A form, a visitor's message read back, and the form on the site's Contact page | One forms plugin is enough, and this is the simpler one. On a Cloudflare site it takes one message and refuses every later one ([Upstream issues](../upstream.md)) |
| `@swiss.ky/linguadash` | 0.2.1 | A French entry of a post, published where the site has French among its languages | Of use only on a site with a second language. Ask for it by that release: 0.1.0 could not be installed (below) |

## What "loads and answers" means

It is what [`plugin:works`](tasks.md#pluginworks) says of a plugin, one line per check, and its description lists the checks. It does not say the plugin works. What it cannot check:

- **A route that needs a POST or an input is only shown to be there** (it answers 400 or 405), not to do its job.
- **A refusal the plugin catches itself leaves no trace**, so "nothing refused" means nothing refused that reached the log.
- **Hooks are not fired.** A plugin that only acts when content is saved or a comment arrives (`comment-notify`) is checked for loading only.
- **A registry plugin not installed by `plugin:install` on this machine** has its public routes skipped: EmDash has no request that lists them ([Upstream issues](../upstream.md)).

`plugin:demo` is the other check, for the seven it knows: each does its real thing.

## Every plugin tried

`plugin:works` was run on macOS with EmDash 1.2.0, on a `cloudflare:starter` site and a `node:starter` site on this machine, each with every plugin below installed at once. The table is as it stood on 2026-10-08. It does not say what a deployed site does: there `bulletin`, `link-guardian` and `instant-indexer` have had admin pages refused ([Limits](#limits)).

| plugin | version | Cloudflare site | Node site | on the list? |
|---|---|---|---|---|
| `@netdollar.dev/forms` | 0.1.0 | loads and answers | loads and answers | yes |
| `@nookeshk.bsky.social/seo-suite` | 0.2.0 | loads and answers | loads and answers | yes |
| `@meekmedia.bsky.social/link-guardian` | 0.1.0 | loads and answers | loads and answers | yes |
| `@peachfinthemes.com/instant-indexer` | 1.0.0 | loads and answers | loads and answers | yes |
| `@agenticecom.net/media-alt-text-queue` | 0.2.1 | loads and answers | loads and answers | yes |
| `@masonjames.com/contact-forms` | 0.2.0 | loads and answers | loads and answers | no: above. The test installs it |
| `@agenticecom.net/rendered-seo-inspector` | 0.1.1 | loads and answers | loads and answers | no: overlaps `seo-suite` |
| `@shane.bsky.shas.am/emdash-umami-analytics` | 0.1.2 | loads and answers | loads and answers | no: shows numbers from an Umami server, which a new site does not have |
| `@eisbachcode.de/analytics` | 0.2.2 | loads and answers | loads and answers | no: shows Cloudflare Web Analytics, which needs setting up in Cloudflare first |
| `@agenticecom.net/llms-txt` | 0.1.0 | loads and answers | loads and answers | no: not something every site wants; a good one to add |
| `@peachfinthemes.com/comment-spam-protection` | 1.0.0 | loads and answers | loads and answers | no: its licence is Elastic-2.0, not MIT, and two of its five pages are "Pro feature" notices |
| `@lasymphonieagency.com/comment-notify` | 0.1.0 | works (loading only: it has no routes or pages) | works (the same) | no: does nothing until the site has an email provider |
| `@meekmedia.bsky.social/bulletin` | 0.1.1 | loads and answers; deployed, its three admin pages were refused in one run of two | loads and answers | no: a newsletter needs an email provider first |
| `@verco.app/image-optimizer` | 0.1.0 | loads and answers | loads and answers | no: by its own description it is read-only for now |
| `@solspace.com/freeform` | 0.1.3 | **does not work** | **breaks every plugin** | no |
| `@swiss.ky/linguadash` | 0.1.0 | **cannot be installed** | **cannot be installed** | no |
| `@swiss.ky/linguadash` | 0.2.1 | not run here: `plugin:demo` installs it | not run here | no: above |

What the two failures printed:

- **`@solspace.com/freeform`**, Cloudflare site, `mise run plugin:works`: "FAIL freeform admin page: /_emdash/admin/plugins/r_f5zatpijxyewomb3/forms — the plugin answered 400; the page shows: Plugin Error Plugin responded with 400: … ROUTE_ERROR … Failed to start Worker: Uncaught Error: No such module "emdash"". On the Node site its failure to start stopped the sandbox process for every plugin ([Upstream issues](../upstream.md)); `mise run plugin:remove -- @solspace.com/freeform` put the others back.
- **`@swiss.ky/linguadash`**, release 0.1.0, both sites, `mise run plugin:install -- @swiss.ky/linguadash`: "FAIL @swiss.ky/linguadash: the site would not verify it — 400 RECORD_VERIFICATION_FAILED: The signed policy requires provenance, but the release has none."

Not surveyed: search, backups. Redirects are covered by `seo-suite` and `link-guardian`.

## Limits

- **Cloudflare:** a registry plugin needs the Worker Loader binding, and deploying a site with it needs the Workers Paid plan. `mise run live:check` (wrangler's dry run) passes with it on.
- **A deployed site:** the live group ran the registry steps (`tests/both/registry.mjs`) on a deployed Cloudflare site on 2026-10-09, twice. With `--live`, `plugin:install`, `plugin:favourites`, `plugin:update`, `plugin:remove`, and `plugin:works` for one plugin pass. `plugin:works -- --live` with no name does not hold: in each run a plugin's admin pages were refused, a different plugin's each time, pages that had answered 200 the run before. `bulletin`'s three pages in the first; `link-guardian`'s dashboard and `instant-indexer`'s two pages in the second. `link-guardian`'s dashboard was refused the same way on a preview on 2026-10-08. What the site answered, and why as far as it is known: [Upstream issues](../upstream.md).
- **Node:** installing, updating or removing a plugin restarts the built site, and one plugin that cannot start takes the rest down ([Upstream issues](../upstream.md)).
- **Windows and Linux:** what this page shows was run on macOS. None of the plugin tasks is in the smoke level, which is all that GitHub has run of the test as it is now ([Getting started](../getting-started.md)).
- **These are other people's plugins.** A new release can break one. `mise run dev:test:plugin --level all` installs the list and runs `plugin:works` on it; with `--node`, on a Node site.
