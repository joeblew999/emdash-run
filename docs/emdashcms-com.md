# What emdashcms.com teaches us

EmDash's own public site is an EmDash site, and its source is public:
<https://github.com/emdash-cms/emdashcms.com>. This is what a developer building a real site with
this harness should copy from it, and what to leave alone.

**How to read the citations.**

| prefix | means |
|---|---|
| `web:` | `.src/emdashcms.com/` — the site's source, cloned 2026-10-06 at commit `613eba1` (2026-10-05, "Merge pull request #60 … blog-cover-patterns") |
| `tpl:` | `.src/templates/` — the official templates, head "sync templates from emdash v1.0.1" |
| `docs:` | `.src/emdash/docs/src/content/docs/` at tag `emdash@1.1.0` |
| `core:`, `pkg:` | `.src/emdash/packages/core/src/`, `.src/emdash/packages/` at the same tag |

Everything here was **read, not run**. The site's dependencies were not installed and it was never
started. Statements marked *inferred* are conclusions drawn from two sources that were each read;
[what could not be verified](#unverified) is at the end.

- [What it is](#what-it-is)
- [Licence: read and learn, do not copy](#licence)
- [Content model](#content-model)
- [Routes](#routes)
- [What it does that the templates do not show](#beyond-the-templates)
- [Patterns worth adopting](#adopt)
- [Version-specific: do not carry to 1.1.0](#version-specific)
- [Things to avoid](#avoid)
- [What this means for the harness](#harness)

---

## What it is

- A landing page and a release blog. `web:seed/seed.json:5-7` ("Landing page and release blog for
  EmDash CMS")
- A Cloudflare project: D1, R2, Worker Loader, three custom domains. `web:wrangler.jsonc:10-48`
- **A fork of the `marketing-cloudflare` template that then diverged.** Its README is still the
  template's, word for word, including the "Deploy to Cloudflare" button that points at the
  template (`web:README.md:1-5`). `diff -rq tpl:marketing-cloudflare web:` shows the same file
  layout with nearly every file under `src/` changed, the template's `pricing.astro` and
  `contact.astro` removed, and a blog, feeds, sitemaps and a local plugin added.
- **Pinned to EmDash 0.38, not 1.x.** `emdash` and `@emdash-cms/cloudflare` are `^0.38.0`
  (`web:package.json:17,21`) and the lockfile resolves `emdash@0.38.0`
  (`web:pnpm-lock.yaml:2406`). Astro is `7.3.2`, exact (`web:package.json:19`). The harness targets
  1.1.0. See [version-specific](#version-specific).
- About 11,600 lines under `src/`. Most of it is presentation: one illustration component is 2,469
  lines (`web:src/components/blocks/Capabilities.astro`). The parts that touch EmDash are small.

The first lesson is the shape itself: **a real site owns its whole `src/`.** It is not a template
plus two config files. EmDash says the same about updates: an update changes packages only, and
template files are the operator's to compare (`docs:deployment/updating.mdx:21-23`).

<a id="licence"></a>
## Licence: read and learn, do not copy

The repository has **no licence file**, and `package.json` has no `license` field and says
`"private": true` (`web:package.json:4`; `git -C .src/emdashcms.com ls-files` lists no `LICENSE` or
`COPYING`). With no licence, default copyright applies: the code is published, not licensed.

Plainly:

- **We may** clone it, read it, and learn how an EmDash site is put together.
- **We may not** copy its files, components, CSS, illustrations, brand assets (`web:public/brand/`,
  `web:public/landing/`) or copy text into our site, or redistribute them.
- **What we take is the technique**, written again in our own code: which EmDash function to call,
  which header to set, which route to add. Short API usage that any EmDash site would write the
  same way is not the concern; whole files and designs are.
- **Where to copy from instead:** the official templates, which the site itself started from. The
  EmDash monorepo is MIT (`.src/emdash/LICENSE`, "Copyright 2026 Cloudflare Inc.") and the
  templates are authored in it under `templates/` (`tpl:README.md:3`). The synced
  `emdash-cms/templates` repo carries **no licence file of its own** (`ls -a .src/templates`), so
  when it matters, take the file from `.src/emdash/templates/`.
- The seed quotes named people as testimonials (`web:seed/seed.json:194-212`). Do not reuse them.

That is the reason the checkout lives under `.src/`, which is gitignored: it never enters our
history.

## Content model

All of it is in one seed. `web:seed/seed.json`

**Settings** — `title`, `tagline`. `:10-13`

**Collections**

| collection | fields | notes | source |
|---|---|---|---|
| `pages` | `title` (string, required), `content` (portableText) | `routable: false`; supports drafts, revisions, seo. One entry, `home`, whose `content` is a list of marketing blocks | `:16-35`, `:167-245` |
| `posts` | `title` (string, required, searchable), `excerpt` (text), `content` (portableText, searchable), `featured_on_homepage` (boolean, default false, indexed, not translatable), `featured_pill_text` (string, max 80), `featured_pill_tag` (string, default "Announcement", max 24), `featured_image` (image) | `urlPattern: "/blog/{slug}"`; supports drafts, revisions, search, seo | `:36-88` |

**Taxonomy** — one, `tag`, flat, on `posts`, with two terms: `announcement`, `changelog`. `:91-111`

**Menus** — five: `primary`, `footer_product`, `footer_community`, `footer_resources`,
`footer_social`. Every item is `type: "custom"` with a URL; most are external. `:113-164`

**Not in the seed:** `blockTypes`, `widgetAreas`, `redirects`, `bylines`, `sections`, `relations`.
The marketing blocks are registered by a plugin instead (below). Authors exist in production — the
code renders bylines (`web:src/lib/posts.ts:59-73`) — but none are seeded.

Three things to notice:

- **The model is small.** Two collections and one taxonomy run the public site of the product.
  `web:public/start.md:18` gives the same advice to others: "Keep the first schema small".
- **A homepage switch is a field, not code.** `featured_on_homepage` is `indexed` because the hero
  queries on it (`web:src/components/blocks/Hero.astro:30-35`), and the pill's text and tag are
  editable fields with length limits.
- **`urlPattern` matters beyond links.** *Inferred:* the per-collection sitemap EmDash provides
  builds its URLs from it (`core:astro/routes/sitemap-[collection].xml.ts:6-7`).

## Routes

Everything is server-rendered; the site's own rule is "No `getStaticPaths()` for CMS content"
(`web:AGENTS.md:40`).

| route | file | what it does |
|---|---|---|
| `/` | `web:src/pages/index.astro` | Loads the `pages` entry `home` and renders its blocks. Falls back to an "Open Admin" empty state when there is none (`:51-62`) |
| `/blog` | `web:src/pages/blog/index.astro` | All posts, newest first; the first is the feature (`:7-18`) |
| `/blog/<slug>` | `web:src/pages/blog/[slug].astro` | One post, plus "Keep reading" |
| `/blog/<slug>/og.png` | `web:src/pages/blog/[slug]/og.png.ts` | A generated share image for posts with no featured image |
| `/blog/tags`, `/blog/tag/<slug>` | `web:src/pages/blog/tags.astro`, `web:src/pages/blog/tag/[slug].astro` | The taxonomy |
| `/rss.xml` | `web:src/pages/rss.xml.ts` | RSS 2.0, 50 newest published posts |
| `/sitemap.xml` | `web:src/pages/sitemap.xml.ts` | An index of three sitemaps |
| `/sitemap-static.xml`, `/sitemap-tags.xml` | `web:src/pages/sitemap-static.xml.ts`, `web:src/pages/sitemap-tags.xml.ts` | The hand-listed pages; the tag pages |
| `/sitemap-posts.xml` | *no file in the repo* | *Inferred:* served by EmDash's own `/sitemap-[collection].xml` route, which is injected unless the site defines one (`core:astro/integration/routes.ts:1037-1041`) |
| `/robots.txt` | `web:src/pages/robots.txt.ts` | Replaces EmDash's default |
| `/home`, `/posts/<slug>` | `web:src/pages/home.ts`, `web:src/pages/posts/[slug].ts` | Redirects from old URLs |
| `/start.md`, `/seed.schema.json` | `web:public/start.md`, `web:public/seed.schema.json` | Static files |
| `404` | `web:src/pages/404.astro` | |

**It has no** search page, contact form, comments, i18n, widget areas or pricing page
(`grep` over `web:src` for `search`, `<form`, `getWidget`, `i18n`, `Comments` finds none), although
`posts` declares `search` support. A production site does not need every feature.

<a id="beyond-the-templates"></a>
## What it does that the templates do not show

Compared with `tpl:starter-cloudflare` and `tpl:marketing-cloudflare`.

| | emdashcms.com | the templates |
|---|---|---|
| `site:` in the Astro config | `site: "https://emdashcms.com"` — `web:astro.config.mjs:10` | **No template sets it** (`grep "site:" tpl:*/astro.config.mjs` is empty) |
| Edge cache | `cache: { provider: cacheCloudflare() }` — `web:astro.config.mjs:13-15` | Pages call `Astro.cache.set` but no Cloudflare template configures a provider (`tpl:starter-cloudflare/astro.config.mjs`) |
| Static asset caching | `/_astro/*` cached for a year, immutable — `web:public/_headers` | No `_headers` file |
| Custom domains | Three `routes` with `custom_domain: true` — `web:wrangler.jsonc:10-25` | None; `workers.dev` |
| Canonical host | The Worker redirects `www` and non-HTTPS to the canonical host with a 308, before Astro runs — `web:src/worker.ts:13-27` | The Worker entry is EmDash's handler, unchanged |
| A staging host | `beta.` serves the admin and API; its public pages redirect to the canonical host — `web:src/worker.ts:9-17` | — |
| Worker placement | Pinned near the D1 primary — `web:wrangler.jsonc:26-29` | Not set |
| Fixed resource ids | `account_id` and `database_id` are committed — `web:wrangler.jsonc:9,34` | Names only; Wrangler creates them |
| Admin login | Cloudflare Access, users auto-provisioned as Author — `web:astro.config.mjs:63-71` | Passkeys (EmDash's default) |
| Worker Loader | On — `web:wrangler.jsonc:43-48` | Commented out |
| Feeds and sitemaps | RSS, a sitemap index, own `robots.txt` | `blog` has `rss.xml.ts`; `starter` and `marketing` have none |
| Share images | Generated per post — `web:src/pages/blog/[slug]/og.png.ts` | — |
| URL history | Redirect routes for the old paths | — |
| A local plugin | `web:src/plugins/marketing-blocks/index.ts` | — |
| A site-specific agent skill | `web:.agents/skills/writing-changelog-posts/` | The three stock skills only |
| Supply chain | Exact pins for `astro`, `@astrojs/cloudflare`, `react`; `minimumReleaseAge: 1440`; `blockExoticSubdeps` — `web:package.json:15-23`, `web:pnpm-workspace.yaml:14-19` | Caret ranges; the same pnpm hardening |

<a id="adopt"></a>
## Patterns worth adopting

Each is a technique to write again, not a file to copy.

### 1. One layout does all the EmDash wiring

`web:src/layouts/Base.astro:33-79`

- `getSiteSettings()` gives title, tagline, logo, favicon — each with a hard-coded fallback, so the
  page renders before anyone has filled in settings (`:33-48`).
- Every menu is fetched in one `Promise.all` (`:50-56`). An empty menu drops its footer column
  rather than rendering an empty heading (`:58-63`).
- `createPublicPageContext({...})` from `emdash/page` is built once with title, description,
  canonical, image, `articleMeta` and the content reference, and handed to `<EmDashHead page=…/>`
  (`:65-79`, `:96`). The page passes data; EmDash writes the SEO tags. Both exist at 1.1.0
  (`core:page/context.ts`).
- The canonical URL is built from `Astro.site`, **not** from the request host (`:29-31`). That is
  why `site:` must be set, and why a `beta.` or `workers.dev` host cannot become the canonical.

### 2. Every content query reports to the cache

Every page that reads content does the same two lines:

```astro
const { entry, cacheHint } = await getEmDashEntry("posts", slug);
if (Astro.cache?.enabled) Astro.cache.set(cacheHint);
```

`web:src/pages/blog/[slug].astro:24,30`, `web:src/pages/index.astro:6,8`,
`web:src/pages/rss.xml.ts:13,19`, and components too (`web:src/components/blocks/Hero.astro:38`).

- The guard `Astro.cache?.enabled` means the page works with no cache provider (local dev, Node).
- Taxonomy reads use `getTaxonomyTermsWithCacheHint` (`web:src/pages/blog/tag/[slug].astro:15-18`).
- A page that lists *other* entries registers only their **tags**, so publishing a post purges the
  page without changing its own last-modified (`web:src/pages/blog/[slug].astro:42-43`).
- 1.1.0 documents the same pairing — `cacheCloudflare()` plus `Astro.cache`, purged by tag —
  `docs:deployment/cloudflare.mdx:160-197`.

### 3. Queries, and their failure paths

- Filter and sort in the query: `where: { tag: tag.slug }`, `where: { featured_on_homepage: "1" }`,
  `orderBy: { published_at: "desc" }`, `limit`. `web:src/pages/blog/tag/[slug].astro:23-27`,
  `web:src/components/blocks/Hero.astro:30-35`
- Feeds and listings ask for `status: "published"` explicitly. `web:src/pages/rss.xml.ts:13-17`
- `error` is logged and the page still renders. `web:src/pages/blog/index.astro:11`
- Slugs go through `decodeSlug` inside a `try`, because `/blog/%25` throws.
  `web:src/pages/blog/[slug].astro:12-22`
- A missing entry is told apart from a failed query by `error.name !== "LiveEntryNotFoundError"`.
  `web:src/pages/blog/[slug]/og.png.ts:20-27`
- `entry.id` is the slug; `entry.data.id` is the database id. `web:AGENTS.md:42`,
  `web:src/pages/blog/[slug].astro:44,73`
- Components are typed from the model: `ContentEntry<InferCollectionData<"posts">>`.
  `web:src/components/blog/PostCard.astro:16,23`

### 4. Editable in place

`{...post.edit.title}`, `{...post.edit.excerpt}`, `{...post.edit.featured_image}` are spread onto
the elements that show those fields. `web:src/pages/blog/[slug].astro:91,94,121`. This is what makes
visual editing work on a custom page.

### 5. Never trust a stored URL

Every URL that came from the CMS — menu items, call-to-action fields — passes through
`sanitizeHref()` before it reaches an `href`. `web:src/components/SiteHeader.astro:53,57`,
`web:src/components/SiteFooter.astro:52,59`, `web:src/components/blocks/Hero.astro:53,57`

### 6. Images

- Image fields are objects; render them with `<Image>` from `emdash/ui`.
  `web:src/components/blog/PostCover.astro:7-8`, `web:AGENTS.md:41`
- Each grid passes a `sizes` value that matches its column count.
  `web:src/components/blog/PostGrid.astro:18-27`
- A post with no image still gets a cover and a share image: art generated from the slug, as SVG on
  the page and as a PNG at `/og.png`, encoded without a rendering engine or WebAssembly so it runs
  in a Worker. `web:src/lib/post-art.ts:1-15`, `web:src/lib/post-art-png.ts:1-9`
- The share URL carries a version number so social sites refetch when the art changes.
  `web:src/lib/post-art.ts:17-21`, `web:src/pages/blog/[slug].astro:59`

### 7. SEO and feeds are routes you own

- `robots.txt` disallows `/_emdash/` but allows `/_emdash/api/media/file/`, so images can be
  indexed, and names the sitemap. `web:src/pages/robots.txt.ts:5-13`
- The sitemap is an index; EmDash supplies the per-collection one, the site adds what EmDash cannot
  know about (static routes, tag pages). `web:src/pages/sitemap.xml.ts:5`
- RSS is forty lines with its own XML escaping. `web:src/pages/rss.xml.ts`
- When URLs change, the old ones redirect — 301, or 307 when the request is a preview.
  `web:src/pages/posts/[slug].ts:8-9`

### 8. Deployment details

- `site:` set (`web:astro.config.mjs:10`).
- Host canonicalisation in the Worker entry, in front of Astro (`web:src/worker.ts:13-27`).
- The admin is reachable on a second host whose public pages redirect away (`:16-17`), so editors
  work on a host search engines never see.
- Only the icons the site uses are bundled, because the full set "adds megabytes to the deployed
  worker bundle" (`web:astro.config.mjs:33-58`).
- A local plugin's `entrypoint` is an absolute `file://` URL, because the virtual module that loads
  plugins has no location to resolve a relative path from (`web:astro.config.mjs:72-80`).
- The only secret is the Access audience tag, documented in `web:.dev.vars.example`. `.dev.vars`
  and `wrangler.preview*.jsonc` are gitignored (`web:.gitignore:12,24-26`).

### 9. Built for agents as well as people

- `web:public/start.md` is a brief for a coding agent: how to start an EmDash site, in 23 lines.
- The homepage response carries `Link` headers pointing at the docs, `llms.txt` and `start.md`.
  `web:src/pages/index.astro:10-17`
- `robots.txt` states `Content-Signal: search=yes, ai-input=yes, ai-train=yes`.
  `web:src/pages/robots.txt.ts:7`
- `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json` register the **docs** MCP server; the repo
  tells agents to search the live docs "rather than relying on training-data recall".
  `web:.mcp.json`, `web:AGENTS.md:34-36`
- A skill in the repo captures the site's one recurring job — writing a release post — with the
  approval steps written in: draft in chat, then an unpublished CMS draft, and publishing is always
  a separate request. `web:.agents/skills/writing-changelog-posts/SKILL.md:8-12`

### 10. Changing content shape without a migration

When the homepage changed from a features grid to a "capabilities" block, the page was taught to
show the new block in the old one's place, keeping the stored headline editable, with a comment
saying when to delete the bridge. `web:src/pages/index.astro:21-42`. Code first, content second —
the order EmDash recommends for model changes (`docs:deployment/schema-evolution.mdx:126`).

<a id="version-specific"></a>
## Version-specific: do not carry to 1.1.0

The site runs 0.38.0. Each row says how we know it differs.

| what the site does | at 1.1.0 | how we know |
|---|---|---|
| The Worker entry imports `@astrojs/cloudflare/entrypoints/server` and `@emdash-cms/cloudflare/sandbox`, and exports only `fetch` — `web:src/worker.ts:1-3,13` | Import `handler`, `createScheduledHandler`, `PluginBridge` from `@emdash-cms/cloudflare/worker` and export `scheduled` | `tpl:starter-cloudflare/src/worker.ts`. The `./sandbox` export still exists (`pkg:cloudflare/package.json:60`), so the old form may still build |
| **No `scheduled` handler and no cron trigger** — `web:src/worker.ts`, `web:wrangler.jsonc` | Scheduled work on Cloudflare runs only from `scheduled()` with a Cron Trigger; the templates ship `"crons": ["* * * * *"]` | `docs:deployment/cloudflare.mdx:113-118`, `tpl:starter-cloudflare/wrangler.jsonc`. *Inferred:* scheduled publishing would not fire on a 1.1.0 site built this way. What 0.38 does is unverified |
| Page blocks are a **native plugin** registering `admin.portableTextBlocks` (`marketing.hero`, …) inside a `portableText` field, rendered through `<PortableText>` — `web:src/plugins/marketing-blocks/index.ts:55-58`, `web:src/components/MarketingBlocks.astro:25-32` | Page composition is a first-class **`blocks` field**: `blockTypes` in the seed, versioned, rendered with `defineBlockComponents()` (`marketing_hero`, …) | `tpl:marketing-cloudflare/seed/seed.json:13,249`, `tpl:marketing-cloudflare/src/components/MarketingBlocks.astro:2,16`, `docs:guides/blocks.mdx`. `portableTextBlocks` still exists (`core:plugins/types.ts`) for blocks *inside rich text* |
| Block images are URL strings typed by hand: "no media picker element in the editor's plugin-block modal yet" — `web:src/plugins/marketing-blocks/index.ts:17-18` | Block fields can be image fields | `tpl:marketing-cloudflare/AGENTS.md` ("Hero and testimonial media are EmDash image fields") |
| `AGENTS.md` says `npx emdash dev` — `web:AGENTS.md:6` | The command is removed; use the site's own dev script | `docs:upgrade-to-v1.mdx:68-76` |
| `AGENTS.md` says "Always call `Astro.cache.set(cacheHint)`" — `web:AGENTS.md:43` | "When Astro's cache is enabled, pass content-query hints…" and use the `WithCacheHint` variants | `tpl:marketing-cloudflare/AGENTS.md:42`. The site's code already guards on `Astro.cache?.enabled` |
| `d1({ session: "auto" })` together with `placement.region` — `web:astro.config.mjs:61`, `web:wrangler.jsonc:26-29` | With targeted placement, keep `session` at its default `"disabled"`, and no read replicas | `docs:deployment/cloudflare.mdx:140` |
| `access({ teamDomain, autoProvision, defaultRole })`, audience from `CF_ACCESS_AUDIENCE` by comment — `web:astro.config.mjs:67-71` | The same; the docs name it with `audienceEnvVar`, whose default is `CF_ACCESS_AUDIENCE` | `docs:deployment/cloudflare.mdx:269-279`, `pkg:cloudflare/src/auth/cloudflare-access.ts:117-118` |
| Vendored skills | Older than the templates': five reference files the 1.0.1 skills have are missing | `diff -rq tpl:marketing-cloudflare/.agents web:.agents` |
| `packageManager: pnpm@12.4.1`, `onlyBuiltDependencies` — `web:package.json:5`, `web:pnpm-workspace.yaml:8-12` | The harness removes `packageManager` and uses mise's pnpm | `copy-template` in `nu/site.nu` |

**Carries over unchanged** — each symbol was found in the 1.1.0 source:
`getEmDashEntry`, `getEmDashCollection`, `getMenu`, `getSiteSettings`,
`getTaxonomyTermsWithCacheHint`, `decodeSlug`, `extractPlainText`, `sanitizeHref`,
`InferCollectionData` (`core:index.ts`); `createPublicPageContext` (`core:page/context.ts`);
`EmDashHead`, `Image`, `PortableText` (`emdash/ui`); `cacheCloudflare()`
(`docs:upgrade-to-v1.mdx:25-47` — it is the 1.0 replacement for the removed `cloudflareCache()`);
`src/live.config.ts`, identical to the template's.

The useful reading of this table: the site is evidence that **0.x sites lag**, even EmDash's own.
The upgrade guide lists five breaking changes (`docs:upgrade-to-v1.mdx:23-123`); a grep of
`web:src` and `web:astro.config.mjs` finds none of the removed APIs in use, so *inferred:* its move
to 1.x is mostly the Worker entry and, optionally, the blocks field.

<a id="avoid"></a>
## Things to avoid

- **A README that describes something else.** `web:README.md` documents the template: a `/pricing`
  and `/contact` page that no longer exist, and a deploy button for the template.
- **Agent instructions that name a removed command.** `web:AGENTS.md:6`. `AGENTS.md` and
  `CLAUDE.md` are also two full copies of the same text — the drift this repo's `AGENTS.md` exists
  to prevent.
- **Hard-coded site facts repeated across files.** The canonical URL appears in the config, the
  Worker, three sitemap files, `robots.txt` and the layout (`web:astro.config.mjs:10`,
  `web:src/worker.ts:5-7`, `web:src/pages/robots.txt.ts:11`, `web:src/pages/sitemap.xml.ts:8`,
  `web:src/layouts/Base.astro:29`). The site title is a constant in the feed although it is a
  setting in the CMS (`web:src/pages/rss.xml.ts:6`). A GitHub star count is a default prop
  (`web:src/components/SiteHeader.astro:31-32`). Read each from one place.
- **Account and database ids in git** (`web:wrangler.jsonc:9,34`). Not secrets, and it is what makes
  a deploy reproducible — but decide it on purpose. This repo's `config/site.wrangler.jsonc` already
  does the same for its D1 and KV ids.
- **A symlink for skills.** `web:.claude/skills` links to `../.agents/skills`. This repo forbids
  symlinks; it stays under `.src/` and is never copied.
- **No tests, no CI, no lint config.** The repo has none (`git ls-files` shows no `.github/`). The
  only check is `astro check` (`web:package.json:12`). That is the gap this harness fills.
- **A sitemap index that names a file the repo does not contain.** It works only while EmDash keeps
  injecting `/sitemap-[collection].xml`. A check should request every URL the index lists.

<a id="harness"></a>
## What this means for the harness

The plan that acts on this is [`plans/2026-10-06-our-site.md`](plans/2026-10-06-our-site.md). In
short:

1. **A project needs a place for its own `src/`.** Today `configure` (`nu/site.nu`) copies two
   config files and the seed over a pristine template, and `copy-template` deletes the site. A site
   like this one cannot be expressed that way.
2. **`doctor --url` can check what a production site must have:** `robots.txt` answers and names a
   sitemap; every sitemap it lists answers 200; the canonical link's host is `DEPLOY_URL`'s; a
   public page comes back with a cache header when a cache provider is configured.
3. **The templates leave out `site:` and a cache provider.** A fresh project should be told so.
4. **A secret has to reach the Worker.** Cloudflare Access needs one; so does the encryption key.
   `deploy` now refuses a Worker without the key (`main deploy` in `nu/main.nu`) but answers with a
   hand-typed `wrangler secret put` inside `.src/site`. There is no flow for putting a secret.
5. **Reference checkouts are worth one flow.** This document needed three of them side by side.

<a id="unverified"></a>
## Unverified

- **Nothing was run.** No install, no build, no request to emdashcms.com. What the live site serves
  — its headers, whether `/sitemap-posts.xml` answers — was not checked.
- That EmDash 0.38 injects `/sitemap-[collection].xml` and `/robots.txt` the way 1.1.0 does. The
  0.38 source was not read; only the 1.1.0 tag is checked out.
- Whether scheduled publishing works on the live site without a `scheduled` handler.
- That `Astro.cache.enabled` is false when no provider is configured. The guard implies it; Astro's
  source was not read.
- Whether the site's 0.38 Worker entry builds against 1.1.0.
- Whether the MIT licence of the monorepo is meant to cover the synced `emdash-cms/templates` repo,
  which has no licence file. Worth one question upstream.
- Why the site is still on 0.38. The repo does not say.
- This is a snapshot of one commit. The site changes weekly (pull request #60 merged the day before
  the clone); re-read before relying on a line number.
