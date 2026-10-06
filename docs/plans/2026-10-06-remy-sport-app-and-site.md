# 2026-10-06 — The Remy-Sport app and site use each other

**Status:** active — blocked — **0 of 9 done**

**Starts after [`2026-10-06-our-site.md`](2026-10-06-our-site.md).** Nothing here begins until that
plan's items 4 (the site has its own `src/`), 6 (the first pages) and 10 (first deploy) are ticked.
The owner's words: "once it's working we can then explore". Item 1 below is the exception — it is
decisions, and can be answered any day.

The app is a single-page application behind hash routes: a search engine and a link preview see one
empty page titled "Remy Sport". The site will be server-rendered and editable. Each has what the
other lacks. This plan finds out, with cheap experiments first, which links between them are worth
keeping.

The thinking, the evidence and the ideas rejected are in
[`../remy-sport-app-and-site.md`](../remy-sport-app-and-site.md). Idea numbers below refer to it.

**Where the work happens.** Items 2, 3, 5, 6 and 8 are in `remy-sport-emdash`. Item 7 is in this
repo's harness. Items marked **app** need a change in `joeblew999/remy-sport`, made there by the
people who work there; this repo never writes to it. A box that needs the app is ticked when the
change is seen live, not when it is asked for.

**Effort, roughly.** Item 1: an hour of the owner's time. Item 2: a day. Item 3: half a day here,
half a day in the app. Item 4: an hour. Item 5: a day. Item 6: two days. Item 7: a day. Item 8: half
a day, then waiting. Item 9: an hour, after a month. About a week of work in all, not counting
design, words, Thai, or the app's side.

## What is verified, and what is a guess

**Verified by reading `joeblew999/remy-sport` at `d2e1f01`:**

- Routes are hash routes; `routeHref` returns `#/<page>/<id>`. `src/web/lib/router.tsx`
- The Worker answers any HTML navigation with the same shell. `src/index.ts` (`isNavigation`)
- The REST API is open to any origin without credentials. `src/api/openapi.ts` (`CORSPlugin`)
- Events have no image, slug or status column. `src/db/app-schema.ts:71-99`
- Venues have an address. `src/db/fixtures-schema.ts:69-75`
- The app has no webhook or change feed. grep of `src/api`
- An open, unstarted plan would build public event and organisation pages inside the app.
  `docs/2026-09-11-01-localisation-and-public-surface-plan.md`, stages 5 and 6
- That plan says teams, games and players are never public; the API code grants `VIEW_TEAM` to the
  public and serves rosters. `src/api/registrations.ts` (`roster`)
- Staging holds fixtures only, by rule. `src/environment.ts`

**Verified by running a read-only request on 2026-10-06:**

- `https://remy.ubuntusoftware.net/` is 2,223 bytes with no description, Open Graph or JSON-LD.
- `/sitemap.xml` and `/.well-known/apple-app-site-association` are 404.
- `/api/events`, `/api/events/{id}`, `/api/orgs`, `/api/teams`, `/api/teams/{id}/players`,
  `/api/games`, `/api/standings` answer 200 with no cookie. `/api/players/{id}` answers 401.
- `/api/events` carries `access-control-allow-origin: *` and no cache header.
- Names arrive as `{"th": …, "en": …}`.

**Verified by reading EmDash at `emdash@1.1.0`:**

- A content read through the REST API needs a session or a token.
  `packages/core/src/astro/routes/api/content/[collection]/index.ts:23`
- A plugin can fetch allowed hosts, write content, run on a `cron` hook and expose a public route.
  `docs/…/plugins/creating-plugins/capabilities.mdx`, `reference/hooks.mdx`, `api-routes.mdx`
- `<EmDashHead>` writes JSON-LD for `BlogPosting` and `WebSite` only. `docs/…/guides/seo.mdx:14`
- The admin 404s when the default locale is prefixed. `docs/…/guides/internationalization.mdx`

**Guesses — each has a step below that settles it:**

- That production's events are fixtures, so an event page has nothing real to index. Item 1.
- That a Worker in the site's account can fetch the app's API on every cache miss without being
  challenged or limited by Cloudflare. The app's HTML carries a bot-challenge script. Item 2.
- That the event and venue reads together hold enough for a valid `SportsEvent`. Item 2.
- That Google and LINE render a useful result from such a page. Items 2 and 9.
- That Astro's cache on Cloudflare can serve a stale copy when the upstream fails. Item 2.
- That the app's team will take an announcement banner. Item 3.
- That a browser inside Tauri can fetch the site's feed. Item 3.
- That the app's router keeps a `ref` query through sign-in. Item 4.
- That a custom JSON-LD block can sit beside `<EmDashHead>` without two conflicting scripts. Item 2.

## Items

- [ ] **1. The decisions** — *the owner's; an hour.* Each has a recommendation. Items that wait on one say so
  - [ ] **Who owns the indexable page for an event: the site, or the app's Worker?** Recommendation: the site, for now, as item 2's experiment; decide for good in item 9 with numbers. Then one line in the app's public-surface plan says its stages 5 and 6 are on hold. The owner edits that file
  - [ ] **Where is the privacy line?** Recommendation: the site renders **events, organisations and venues only**. No team, roster, game, score or standing until this is settled in the app's model. Ask separately, in `remy-sport`, whether `/api/teams/{id}/players` should answer an anonymous caller at all
  - [ ] **Where do real events come from?** Recommendation: into the app, once — the 66 in `remy-sport-biz/research/events-raw/` as listed events. Not into an EmDash collection. Until then item 2 runs against staging's fixtures and proves the mechanism, not the traffic
  - [ ] **The URL plan** (idea 14). Recommendation: `/events`, `/events/<id>/<slug>`, `/orgs/<slug>`, Thai under `/th/`; the id is looked up, the slug redirects when wrong. Written in `remy-sport-emdash/README.md` before item 2 publishes a URL
  - [ ] **One host or two?** Recommendation: two now. Revisit when the brand domain exists and the app has moved under `/app`
  - [ ] **How stale may a public event page be?** Recommendation: five minutes
  - [ ] **Will the app take the small changes?** A `noindex` on its shell (item 8), a recorded `ref` (item 4), an announcement banner (item 3). Recommendation: yes to all three; each is under a day there
  - [ ] **Help.** Recommendation: leave the Fumapress site as it is. No item here touches it
  - [ ] **Identity.** Recommendation: no link at all. Editors in EmDash, users in the app. No item here builds one

- [ ] **2. Experiment: one event, as a page a crawler can read** — *a day. Tests the riskiest guess: that the app's API, as it is, can feed an indexable page.* Idea 1
  - [ ] a setting `APP_ORIGIN` in the site's Worker `vars`; staging's API for local and preview, production's for production (idea 24). Proof: change it, one command, the page shows the other environment's event
  - [ ] before any code: `curl <APP_ORIGIN>/api/events/<id>` and the venue read. Write here every field the page will print, and every field `SportsEvent` wants that is missing (image, status, price are expected)
  - [ ] a route `src/pages/events/[id]/[...slug].astro` that fetches on the server and renders name, dates, venue and address, organiser, divisions, and one link into the app built by the our-site plan's link function
  - [ ] **proof:** `curl -s <site>/events/<id>/<slug> | grep "<the event's name>"` exits 0 — the name is in the HTML with no JavaScript run
  - [ ] the page carries `<title>`, a description, a canonical link on the site's host, Open Graph tags, and `hreflang` for English and Thai. Proof: each is found by `grep` in the same response
  - [ ] one `application/ld+json` script of `@type` `SportsEvent` with `name`, `startDate`, `endDate`, `location` (name and address), `organizer`, `sport`. Proof: the script parses as JSON locally; Google's Rich Results Test, pasted the HTML, reports an Event with no errors. Record its warnings here
  - [ ] the page for `/th/events/<id>/…` prints `names.th`. Proof: the Thai name is in that response and not in the English one
  - [ ] a wrong slug answers 301 to the right one; an id the API does not know answers 404. Proof: two `curl -I` lines
  - [ ] cache: the response has a cache header of five minutes; a second request does not reach the app. Proof: `wrangler tail` on the site shows one upstream fetch for two page requests
  - [ ] **app down:** with `APP_ORIGIN` on a closed port, a page that was served before still answers 200 from the stale copy; one never served answers 503 with `Retry-After`. Never 404, never an empty 200. If Astro's cache cannot serve stale, write what was used instead
  - [ ] a `sitemap-events.xml` built from `GET /api/events`, linked from the sitemap index. Proof: every URL in it answers 200
  - [ ] Lighthouse on the deployed page: SEO 100, and the performance score written here. Proof: the report's JSON is attached to the commit message or pasted here
  - [ ] a link preview: paste the deployed URL into LINE and into Facebook's sharing debugger. Record what each shows. Expected finding: no image, because events have none
  - [ ] count the upstream calls a cold page makes and whether any was challenged or limited. If so, stop and record it — the fix is a service binding or an API key, and both need the app
  - [ ] nothing on the page comes from `/teams`, `/players`, `/games` or `/standings`. Proof: `grep` of the route's source

- [ ] **3. Experiment: one announcement, written in EmDash, shown in the app** — *half a day here; half a day in the app. Tests the direction nobody has tried.* Idea 8
  - [ ] a collection `announcements` added to the running site with `emdash schema`, then to the seed: `message` (text, translatable), `link` (url), `severity` (select), `starts_at`, `ends_at`. Editors can publish; nobody else
  - [ ] a route `src/pages/feeds/announcements.json.ts`: published entries whose window includes now, both languages, at most five. Headers: `Cache-Control: public, max-age=60`, `Access-Control-Allow-Origin: *`. No token anywhere
  - [ ] proof: `curl -sI <site>/feeds/announcements.json` shows both headers; the body parses; an unpublished entry is absent; an entry whose `ends_at` has passed is absent
  - [ ] **app:** the app fetches the feed after first render with a two-second timeout and shows a dismissible banner, or nothing. Asked for in `remy-sport` as an issue with this item's link; the feed's shape is frozen here first
  - [ ] **proof:** Remy edits the announcement's text in the admin and publishes; within two minutes the app on staging shows the new text, with no deploy of either side
  - [ ] proof: with the site's host blocked, the app starts, signs in and shows a score exactly as before
  - [ ] proof: the banner appears in the installed PWA and in the Tauri build. If Tauri cannot fetch it, record why
  - [ ] schedule an announcement for ten minutes ahead on the deployed site; it appears on time. This also proves the cron trigger

- [ ] **4. Links into the app carry where they came from** — *an hour, plus one app change.* Ideas 16 and 19
  - [ ] the site's link function adds `ref=site-<page>` inside the hash query. Proof: `grep` of a rendered page shows `#/event/<id>?ref=site-event`
  - [ ] proof: opening that link lands on the event in the app, signed out and signed in
  - [ ] Cloudflare Web Analytics on the site; Search Console verified for the site's host and the sitemap submitted. Proof: Search Console lists the sitemap as read
  - [ ] **app:** the first `ref` seen in a session is recorded in telemetry and kept through sign-in. Proof: `bun run ops analytics` in `remy-sport` shows a row with `ref=site-event`
  - [ ] the consent question (the brainstorm's § e, question 9) is answered by the owner before analytics runs in production; if it is not, this box says what runs meanwhile

- [ ] **5. Organisations, the index, and the same care** — *a day. Only after item 2 passes.* Ideas 1 and 5
  - [ ] `/orgs/<slug>` from `GET /api/orgs/{id}`; organisations already have a slug. `Organization` or `SportsOrganization` JSON-LD. The same proofs as item 2: name in the HTML, structured data valid, stale when the app is down
  - [ ] an event page links to its organiser's page and back; both carry `BreadcrumbList`
  - [ ] `/events` lists upcoming events and each links to its own page on the site, not straight into the app. This replaces the outbound links from the our-site plan's item 7
  - [ ] `sitemap-orgs.xml`
  - [ ] the three fetches share one function with one timeout and one cache rule

- [ ] **6. Enrichment: a story for an event, keyed by the app's id** — *two days. Only after item 2 passes and item 1's privacy answer is in.* Idea 4
  - [ ] a collection `stories`: `app_event_id` (string, indexed), `cover` (image), `summary` (text), `body` (portableText), `sponsor_name`, `sponsor_logo` (image). Not routable: it has no page of its own
  - [ ] the event page shows the story when one is published for that id, and is unchanged when none is. Proof: publish, request, the cover's URL is in the HTML and in `og:image`; unpublish, it is gone
  - [ ] the JSON-LD gains `image`. Proof: the Rich Results warning recorded in item 2 is gone
  - [ ] a story whose event no longer exists renders nowhere and is listed by `doctor` as a finding
  - [ ] no field of the story repeats a fact the app holds — no name, no date, no venue. Proof: the collection's field list, read
  - [ ] the id is typed by hand at first. A picker is the event block in the our-site plan's item 7; do not build a second one here
  - [ ] later, and only if wanted: the app's own event screen shows the story's cover from a second public feed, `feeds/stories/<id>.json`. **app**

- [ ] **7. `doctor` checks the link** — *a day, in this repo's harness.* Idea 26. Settings-driven; nothing about Remy-Sport in `nu/`. Each check is planted with a fault and must fail, as `check` requires
  - [ ] `VERIFY_UPSTREAM_OPENAPI` and `VERIFY_UPSTREAM_USES` (a file in the project listing operations and response fields): `doctor` fetches the document and fails on any that is missing. Plant: a field the app does not have
  - [ ] `VERIFY_PAGE` (a URL template), `VERIFY_PAGE_SOURCE` (an upstream URL and a JSON path): the page must be 200 and contain the value the upstream returns. Plant: a page that prints a constant
  - [ ] the same page must carry one JSON-LD script that parses and has `VERIFY_PAGE_LD_TYPE`. Plant: a trailing comma
  - [ ] `VERIFY_FORBIDDEN_SOURCE` (an upstream URL and a JSON path yielding strings): no page listed in the sitemap may contain any of them. For this site: the names in a staging roster. Plant: a page that prints one
  - [ ] `VERIFY_FEED`: the URL is 200, parses, and carries the two headers from item 3
  - [ ] all of it runs under `doctor -- --url <deployment>` as well as locally
  - [ ] `docs/tasks.md` is regenerated; the README's settings table has the new rows; unit tests for the pure parts are in `nu/tests.nu`
  - [ ] proof: in `remy-sport-emdash`, `mise run doctor` passes; with `APP_ORIGIN` pointed at production while the list still names a staging id, it fails and says which check

- [ ] **8. The two sides point at each other** — *half a day, then waiting on the app*
  - [ ] privacy and terms pages exist on the site in both languages, with the owner's text (idea 9). Proof: both answer 200 and are in the sitemap
  - [ ] the brand tokens — the two fonts, the primary colour, the logo — are copied once from `remy-sport/src/web/styles.css` and `src/web/public/brand.svg` into the site's layout, with a comment saying where from (idea 18). No shared package
  - [ ] **app:** the app's shell carries `<meta name="robots" content="noindex">`, a description, and a link to the site. Proof: `curl https://remy.ubuntusoftware.net/ | grep noindex`
  - [ ] **app:** the app's footer or menu links to the site's privacy and terms pages
  - [ ] **app:** public reads send a cache header. Proof: `curl -sI …/api/events | grep -i cache-control`
  - [ ] the site's README states the deploy order (idea 25): the app adds before the site uses; the site stops using before the app removes; `VERIFY_UPSTREAM_USES` is the list the app's team reads

- [ ] **9. Read the results and choose a shape** — *an hour, a month after item 2 is live on real events*
  - [ ] from Search Console: how many event and organisation pages are indexed, and the impressions and clicks on them. Written here
  - [ ] from item 4: visits to event pages, clicks into the app, sign-ins with a `ref`. Written here
  - [ ] did five minutes of staleness cause a wrong date to be seen by anyone? Did the app being down ever show on the site?
  - [ ] did Remy publish a story or an announcement without help?
  - [ ] then one of, written here with the reason: **keep A/B** (the site owns entity pages); **move to C** (the app's Worker renders them, the site keeps the stories and redirects); **plan D** (one host) as a new plan
  - [ ] whichever is chosen, the app's public-surface plan and this one say the same thing

## Not in this plan, on purpose

Each is argued in [`../remy-sport-app-and-site.md`](../remy-sport-app-and-site.md) § What not to do.

- Copying app rows into EmDash collections, by plugin or by hand.
- Single sign-on or any shared session.
- Pages for teams, rosters, games, scores or standings.
- Help content. Product copy or feature flags from the CMS.
- Smart app banners and universal links — there is no store app yet.
- One host for both. It is item 9's possible outcome, and a plan of its own.
