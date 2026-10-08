---
title: Favourite plugins
nav_order: 5
parent: Reference
---

# Favourite plugins: what `plugin:favourites` installs, and why

The plugins from EmDash's registry that `mise run plugin:favourites` installs into a site, why each
is on the list, and what was looked at and left off. Read it before you rely on one, or to choose
your own list.

```
mise run plugin:favourites -- --yes   # install them all, at the releases below; one already installed is left alone
mise run plugin:works                # check every plugin the site has, one line per check
```

Your own list, in the project's `mise.toml`:

```toml
[env]
PLUGINS = "@netdollar.dev/forms@0.1.0 @meekmedia.bsky.social/bulletin"   # with @version: held to that release
```

## The list

Chosen by what a new site needs first, from plugins that need nothing outside the site to be of use and load and answer on a Cloudflare site and on a Node site (below). Each is installed at the release in the table: a newer one is not taken until someone has read what it asks for.

| Plugin | Release | What it is for | What it may do on the site |
|---|---|---|---|
| `@netdollar.dev/forms` | 0.1.0 | Contact forms, surveys, multi-step forms. The fullest of the three form plugins tried. It stores what visitors submit: personal data | **Send email** |
| `@nookeshk.bsky.social/seo-suite` | 0.2.0 | Keyphrase and readability checks, JSON-LD, redirects, an SEO health page | Read content, the model, taxonomies, media and redirects; **change content, editor drafts and redirects** |
| `@meekmedia.bsky.social/link-guardian` | 0.1.0 | Finds broken links, and stale ones after a slug change. Nothing else surveyed does it | Read content and the model; **change redirects; call any address on the internet** (it follows the site's links) |
| `@peachfinthemes.com/instant-indexer` | 1.0.0 | Tells search engines (IndexNow) when a page is added or changed. No account needed | Read content and the model; **call out to the search engines** |
| `@agenticecom.net/media-alt-text-queue` | 0.2.1 | Finds images with no alt text | Read content, revisions, the model and media; **change a media item's details** |

`plugin:install` prints this for any plugin before it installs, with the hosts it may call and the tools it gives to agents. A plugin that can change things or reach outside the site, and any install with `--live`, needs `--yes`. So `plugin:favourites` needs it: four of the five can.

## What "loads and answers" means

`plugin:works` does not say a plugin works: it says the plugin loads and answers. It was run on macOS with EmDash 1.2.0, on a `cloudflare:starter` site and a `node:starter` site, each with every plugin below installed at once. For each plugin it prints one line per check:

| check | what is done |
|---|---|
| builds | `mise run site:check`: seed valid, types check, the site builds |
| starts | the built site is stopped and started (`mise run site:preview`) and answers 200 |
| listed | `GET /_emdash/api/admin/plugins` gives it as enabled and active, and the admin's manifest has it |
| routes | each declared route is asked with a GET. A registry plugin's public routes are the ones the site read from the signed release when `plugin:install` installed it; its other routes are those behind its MCP tools |
| admin page | each of its admin pages is loaded in Chrome, signed in with the saved token: the plugin's answer is 200, the page shows no "Plugin Error", the browser console has no error |
| log | the built site's log has EmDash's "Loaded registry plugin …" line for it, and no line saying it failed to load |
| sandbox | the log has no "Missing capability", "Host not allowed", wall-time or route error from the requests above |

What it cannot check:

- **A route that needs a POST or an input is only shown to be there** (it answers 400 or 405), not
  to do its job.
- **A refusal the plugin catches itself leaves no trace**, so "nothing refused" means nothing
  refused that reached the log.
- **Hooks are not fired.** A plugin that only acts when content is saved or a comment arrives
  (`comment-notify`) is checked for loading only.
- **A registry plugin not installed by `plugin:install` on this machine** has its public routes
  skipped: EmDash has no request that lists them ([upstream bugs](../upstream.md), 22).

## Every plugin tried

| plugin | version | Cloudflare site | Node site | on the list? |
|---|---|---|---|---|
| `@netdollar.dev/forms` | 0.1.0 | loads and answers | loads and answers | yes |
| `@nookeshk.bsky.social/seo-suite` | 0.2.0 | loads and answers | loads and answers | yes |
| `@meekmedia.bsky.social/link-guardian` | 0.1.0 | loads and answers | loads and answers | yes |
| `@peachfinthemes.com/instant-indexer` | 1.0.0 | loads and answers | loads and answers | yes |
| `@agenticecom.net/media-alt-text-queue` | 0.2.1 | loads and answers | loads and answers | yes |
| `@masonjames.com/contact-forms` | 0.2.0 | loads and answers | loads and answers | no: one forms plugin is enough; this is the simpler one, single-page forms only. The test installs it |
| `@agenticecom.net/rendered-seo-inspector` | 0.1.1 | loads and answers | loads and answers | no: overlaps `seo-suite` |
| `@shane.bsky.shas.am/emdash-umami-analytics` | 0.1.2 | loads and answers | loads and answers | no: shows numbers from an Umami server, which a new site does not have |
| `@eisbachcode.de/analytics` | 0.2.2 | loads and answers | loads and answers | no: shows Cloudflare Web Analytics, which needs setting up in Cloudflare first |
| `@agenticecom.net/llms-txt` | 0.1.0 | loads and answers | loads and answers | no: not something every site wants; a good one to add |
| `@peachfinthemes.com/comment-spam-protection` | 1.0.0 | loads and answers | loads and answers | no: its licence is Elastic-2.0, not MIT, and two of its five pages are "Pro feature" notices |
| `@lasymphonieagency.com/comment-notify` | 0.1.0 | works (loading only: it has no routes or pages) | works (the same) | no: does nothing until the site has an email provider |
| `@meekmedia.bsky.social/bulletin` | 0.1.1 | loads and answers | loads and answers | no: a newsletter needs an email provider first |
| `@verco.app/image-optimizer` | 0.1.0 | loads and answers | loads and answers | no: by its own description it is read-only for now |
| `@solspace.com/freeform` | 0.1.3 | **does not work** | **breaks every plugin** | no |
| `@swiss.ky/linguadash` | 0.1.0 | **cannot be installed** | **cannot be installed** | no |

What the two failures printed:

- **`@solspace.com/freeform`**, Cloudflare site, `mise run plugin:works`: "FAIL freeform admin
  page: /_emdash/admin/plugins/r_f5zatpijxyewomb3/forms — the plugin answered 400; the page shows:
  Plugin Error Plugin responded with 400: … ROUTE_ERROR … Failed to start Worker: Uncaught Error:
  No such module "emdash"". On the Node site its failure to start stopped the sandbox process
  for every plugin ([upstream bugs](../upstream.md), 21); `mise run plugin:remove -- @solspace.com/freeform`
  put the others back.
- **`@swiss.ky/linguadash`**, both sites, `mise run plugin:install -- @swiss.ky/linguadash`: "FAIL
  @swiss.ky/linguadash: the site would not verify it — 400 RECORD_VERIFICATION_FAILED: The signed
  policy requires provenance, but the release has none."

Not surveyed: search, backups. Redirects are covered by `seo-suite` and `link-guardian`.

## Limits

- **Cloudflare:** a registry plugin needs the Worker Loader binding, and deploying a site with it
  needs the Workers Paid plan. `mise run live:check` (wrangler's dry run) passes with it on.
- **A deployed site:** `plugin:favourites -- --live` installed the five on a preview of a deployed site, and their public routes answered a visitor there. `plugin:remove -- … --live` has not been run against a deployed site, and `plugin:works` checks this machine's built site only.
- **Node:** installing or removing a plugin restarts the built site, and one plugin that cannot
  start takes the rest down ([upstream bugs](../upstream.md), 20 and 21).
- **Windows and Linux:** none of the plugin tasks has been run there.
- **These are other people's plugins.** A new release can break one; `mise run test:full` installs
  the list and runs `plugin:works` on it, on both kinds of site.
