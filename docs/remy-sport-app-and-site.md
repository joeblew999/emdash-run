# The Remy-Sport app and the Remy-Sport site: what each can do for the other

A brainstorm, written on 2026-10-06 for the owner. It starts once the site is up. The plan that
follows from it is [`plans/2026-10-06-remy-sport-app-and-site.md`](plans/2026-10-06-remy-sport-app-and-site.md).

It does not repeat [`remy-sport.md`](remy-sport.md), which says what the project is and what the
site must hold. Read that first. This document is about the **link** between the two.

**How to read the citations.**

| prefix | means |
|---|---|
| `app:` | `joeblew999/remy-sport` at `d2e1f01` (2026-09-30), local checkout |
| `biz:` | `joeblew999/remy-sport-biz` at `ddeedbd` (2026-09-30), local checkout |
| `docs:`, `core:` | EmDash's docs and source at `emdash@1.1.0`, as in [`emdash.md`](emdash.md) |
| **ran** | a read-only `curl` against the live app or help site on 2026-10-06 |
| *inferred* | a conclusion from sources that were each read. Not something anyone said |

Nothing here was built. No other Remy repository was read.

- [a. What Remy-Sport has today, and why it is weak for product and SEO](#a)
- [b. What any such system needs](#b)
- [c. The ideas](#c)
- [d. The combinations worth pursuing](#d)
- [e. Questions only the owner can answer](#e)

---

<a id="a"></a>
## a. What Remy-Sport has today

### The short version

The app is good at being an app. It is one Cloudflare Worker that serves a React single-page
application and a typed API from the same origin. It installs as a PWA, wraps as a Tauri app, works
in 27 locale files, and has a careful permission model. All of that was optimised for a signed-in
person on a phone at a gym.

None of it was built for a stranger arriving from Google, and the code says so in three places.

### Why a search engine sees nothing

1. **Every page has the same URL as far as a server can tell.** Routes are hash routes:
   `#/event/evt_001`, `#/team/team_001`. `app:src/web/lib/router.tsx:1-3` ("Hash-based router. Hash
   routes are required for Tauri webview compatibility"), and `routeHref` in the same file returns
   `#/${route.page}/${route.id}`. A browser never sends the part after `#`. Google does not treat
   `#/…` fragments as separate pages. So the whole product is one URL: `/`.
   The choice was deliberate: `biz:decisions/decision-003-frontend-targets.md` § Decision.

2. **That one URL is an empty shell.** Ran `curl https://remy.ubuntusoftware.net/`: 2,223 bytes,
   `<title>Remy Sport</title>`, `<div id="root"></div>`, script tags. No description, no Open Graph
   tags, no canonical link, no structured data, no text. Source: `app:src/web/index.html`.
   The manifest has a description ("Basketball events, teams and live scoring for Thailand");
   the page does not.

3. **A real path gets the same shell.** Ran `curl -H 'Accept: text/html' …/events/evt_001`: 200,
   the shell again. Without the `Accept` header: 404. `app:src/index.ts` (`isNavigation`, `shell`).
   So a crawler that did guess a path would get a soft 404 with the home page's title.

4. **No sitemap. No robots.txt of its own.** Ran: `/sitemap.xml` → 404. `/robots.txt` → 200, but it
   is Cloudflare's managed content-signals notice, comments only; nothing in
   `app:src/web/public/` supplies one.

5. **A shared link has no preview.** Paste an event link into LINE or Facebook and the card says
   "Remy Sport" with no image, for every link. *Inferred* from point 2: link previews read Open
   Graph tags from the server's HTML and never run the app. This matters more than Google for this
   market: the research shows events spread through Facebook and LINE
   (`biz:research/events-raw/`, 66 files; `biz:company/brand-registrations.md` § LINE).

6. **Nothing can be opened from outside into the installed app.** Ran:
   `/.well-known/apple-app-site-association` → 404. `app:src-tauri/tauri.conf.json` declares no
   deep-link scheme. The mobile apps are not in the stores; that waits on a legal entity and takes
   6–10 weeks after one exists (`biz:company/critical-path.md`).

### Why it is weak as a product surface

- **There is nowhere to say what it is.** No landing page, no "for organisers", no pricing, no
  privacy page, no terms. A grep of `app:src/web/pages/` finds eighteen screens; all are the tool.
- **Nobody who does not code can change a word.** Product copy is compiled Paraglide messages
  (`app:messages/*.json`, 27 files). The Product Owner does not code (`biz:README.md:11-13`).
- **Entities have no pictures and no stories.** The `event` table has a name, a description, dates,
  codes and an organiser. No image, no slug, no status. `app:src/db/app-schema.ts:71-99`. The R2
  bucket is bound and nothing reads or writes it: `STORAGE` appears only in `app:src/types.ts:3`.
- **The one piece of public writing is homeless.** A guide to summer events, kept as markdown and
  again as a hand-formatted Wix copy. `biz:content/blog/`.

### What it has that a site can use

This is the part that makes a link cheap.

- **A public, documented, read-only API that answers any origin.** `CORSPlugin({ origin: "*" })`,
  no credentials. `app:src/api/openapi.ts`. Ran, all 200 with no cookie or key:
  `/api/events` (4 events, 11.9 KB), `/api/events/{id}`, `/api/orgs`, `/api/orgs/{id}`,
  `/api/teams` (15), `/api/teams/{id}/players`, `/api/games`, `/api/standings?eventId=…`,
  `/api/reference`, `/api/openapi.json` (113 KB).
- **The API document is generated from the router**, so it cannot describe an endpoint that does
  not exist. `app:src/api/index.ts`, `app:src/api/openapi.ts` (header comment).
- **Names come in Thai and English already**: `"names": {"th": "…", "en": "…"}` on events, teams,
  orgs, venues. Ran `/api/events`.
- **Venues have a street address.** `app:src/db/fixtures-schema.ts:69-75`. Google's event results
  want one.
- **A staging twin that only ever holds fixtures**, by written rule. `app:src/environment.ts`
  ("Staging seeds from FIXTURES ONLY"). A safe thing to develop a site against.
- **Its own telemetry**, in Analytics Engine, with a typed catalogue. `app:src/analytics.ts`.
- **A precedent for checking the API contract from outside.** The help site's tool package checks
  the app's generated schema before each call. `app:sites/help-tools/README.md`.

### Four facts that shape everything below

1. **The app repo already has a plan to build the public surface inside the app.**
   `app:docs/2026-09-11-01-localisation-and-public-surface-plan.md`, open, not started. Stage 5:
   prerendered marketing pages. Stage 6: `/{locale}/events/<id>` and `/{locale}/orgs/<id>` rendered
   from D1 at request time, edge-cached, purged on mutation. Stage 4 moves the app under `/app`
   with real paths and retires the help site. Stages 5 and 6 are what an EmDash site would also do.
   Two plans now cover the same ground.

2. **The privacy line is drawn in two places and they disagree.**
   - That plan: "Teams, players, people, games and live scores are never public." § The URL scheme.
   - The running API: teams, rosters, games and standings need no session. Ran
     `/api/teams/team_001/players`: children's names in Thai and English, jersey number, position.
     The code defends it: "a roster of children is what is printed on a gym wall"
     (`app:src/api/registrations.ts`, above `roster`). The model grants `VIEW_TEAM` to `PUBLIC`.
     The roadmap lists "Game result pages … readable without an account" as shipped
     (`biz:process/roadmap/roadmap.md` § Now).
   - A single player is stricter: `/api/players/ply_001` → 401, "this row names a minor"
     (`app:src/api/players.ts`, `stricterThanModel`).

   Reachable through an app and **indexed by Google under a child's name** are different exposures.
   The site makes the second one possible for the first time.

3. **Production holds fixtures, not real events.** *Inferred*: ran `/api/events` → 4 events with ids
   `evt_001`…, all `createdAt: 2026-01-01`; "Chiang Mai Summer Basketball Camp 2026" is a row in
   the seed (`app:src/domain/model/entities.ts`). Meanwhile 66 real Thai events sit as research
   notes in `biz:research/events-raw/`. An indexable page per event is worth nothing until the
   events are real.

4. **A help site already exists and is live.** `help.remy.ubuntusoftware.net`, MDX in git, 39 pages,
   three languages, sitemap, `hreflang`, Open Graph, `llms.txt`, RSS (ran). It is the proof that a
   separate crawlable site beside the app works for this project. It is also a third place for
   words, and the app plan wants to retire it.

---

<a id="b"></a>
## b. What any such system needs

A consumer sports product with an app and a public web presence. "App has" means verified in the
repo. "Site" means the EmDash site should own it. "Shared" means neither can do it alone.

| need | app has it | site should own it | shared | missing today |
|---|---|---|---|---|
| A URL per thing (event, org, team) that a server answers | No — hash routes | | **Yes**: app's data, someone's HTML | Yes |
| Title, description, Open Graph, canonical per page | No | Yes, for its own pages | Yes, for entity pages | Yes |
| Structured data for sports entities | No | Renders it | App supplies the facts | Yes; events lack an image and a status |
| Sitemap and robots.txt | No | Yes | Entity URLs come from the app's list | Yes |
| Landing pages, audience pages, pricing | No | **Yes** | | Yes |
| Sign-up and the way into the product | Yes — emailed code | Links to it | The hand-off URL | A return path from site to app |
| App install, deep links | PWA install only | Banner and links | Universal links need both | Store apps, association files |
| News, guides, announcements | No | **Yes** | Showing them inside the app | Yes |
| Help | Separate help site | No — leave it | | A decision: three candidates |
| Privacy policy, terms | No text anywhere | **Yes** | The app links to them | Yes; the stores require a URL |
| Changelog | Help site's `/updates` | Blog tag, later | | Minor |
| Editorial workflow: drafts, review, scheduling | No | **Yes** — EmDash | | |
| Localisation | 27 files, 2 reviewed-ish | Thai + English | Names from the app are already bilingual | Human review of Thai |
| Accounts for users | **Yes** — Better Auth | No | No | |
| Accounts for editors | No | **Yes** — EmDash admin | No | |
| Canonical domain data | **Yes** — D1 | Never | Public read model | A written public projection |
| Freshness and caching of public reads | No cache headers on `/api/events` (ran) | Edge cache | Purge or TTL | Cache headers; a change signal |
| Images and video for entities | No — R2 unused; live video is private | **Yes** — media library | Keyed to the app's ids | Yes |
| Search | Filters in Discover | Full-text over posts | Across both: later | |
| Analytics | **Yes** — product telemetry | Page analytics, Search Console | Attribution site → sign-up | Yes |
| Email | Notifications, sign-in codes | Newsletter, later | | |
| Trust: status, contact | `/api/health` | Contact, about | | A contact route |
| Environments | dev, staging, production | One target today | Which app a site build reads | Site staging |
| Backups | D1 Time Travel (Cloudflare) | Harness gap, known | | |
| Performance | Tuned for repeat use | Tuned for first visit | | |

The pattern: **the app owns facts and people; the site owns words, pictures and first impressions.**
Almost every "shared" row is the same thing seen from a different side — the app's public facts,
rendered as HTML by something that a crawler can read.

---

<a id="c"></a>
## c. The ideas

Each has what it gives, what it costs, what it depends on, and a verdict.

### App → site: data out

**1. A crawlable page per event and per organisation, rendered by the site from the app's API.**
The site has a route `/events/<id>/<slug>`. On a request it fetches `GET /api/events/<id>` and the
venue, renders name, dates, place, organiser, divisions and a button into the app, and emits
`SportsEvent` JSON-LD and Open Graph tags. The response is cached at the edge for minutes.
- *Gives:* the thing the owner says is missing. Indexable pages and link previews, with no change
  to the app.
- *Costs:* freshness is the cache time, because the site cannot know an event changed. The site
  depends on the API's shape. Every cache miss is a subrequest to another Worker.
- *Failure modes:* app down → serve the stale copy, or a 503 with `Retry-After`. Never a 404 and
  never an empty 200: both tell Google the page is gone. Event deleted → the API's 404 must become
  the site's 404 (or 410).
- *Depends on:* the site having its own `src/` (our-site plan, item 4); the privacy line (below);
  real events in production.
- *Verdict:* **do first, as an experiment.** It is a day of work and it tests the three riskiest
  assumptions at once: that the API is enough, that Google and LINE accept the result, and that the
  owner wants the site — not the app — to own these pages.

**2. The same pages, rendered by the app's own Worker** (the app plan's stage 6).
- *Gives:* the best technical answer for entity pages. The data is local. The cache is purged by
  the same code that changes the row. The public projection sits next to the permission code.
- *Costs:* it waits behind the app's stages 2 to 4 — vocabulary into Paraglide, notifications, the
  router migration — none started. No editor, so no pictures or stories without more app work.
- *Verdict:* **do later, maybe.** It is the right long-term home for *facts*. Idea 1 gets the
  evidence this year. If the URL plan is agreed first (idea 9), moving from 1 to 2 changes who
  answers a URL, not the URL.

**3. A sandboxed EmDash plugin that copies app entities into EmDash collections** on a `cron` hook
or from a webhook. EmDash supports the parts: `network:request` with `allowedHosts`,
`content:write`, a `cron` hook scheduled with `ctx.cron.schedule()`, public plugin routes for
webhooks. `docs:plugins/creating-plugins/capabilities.mdx`, `docs:reference/hooks.mdx` § Cron hook,
`docs:plugins/creating-plugins/api-routes.mdx` § Authentication.
- *Gives:* EmDash's sitemap, search, SEO panel and relations for free. Posts can link to events.
- *Costs:* a second copy of every row, with all that follows: drift, deletes that do not arrive,
  renames, 27 name variants against EmDash's row-per-locale model
  (`docs:guides/internationalization.mdx`). Editors can open a synced row in the admin and change
  it; nothing stops them. A sandboxed plugin needs the Workers Paid plan to deploy
  ([`plugin.md`](plugin.md)). The app has no webhook or change feed (grep of `app:src/api` for
  `webhook`: none), so it would be polling.
- *Verdict:* **do not do.** It buys convenience with a second source of truth. Idea 4 gets the
  useful half.

**4. Enrichment keyed by the app's id — the CMS adds to an entity without copying it.**
A small EmDash collection, `stories`, with one field that matters: `app_event_id` (or
`app_org_id`). The rest is what the app does not have: a cover image, a gallery, a written recap,
a sponsor. The site's event page is then *facts from the API* plus *the story from EmDash, if there
is one*. The roadmap already wants this and has no home for it: "Video & photo galleries" and
"Sponsor display — title sponsors and partner logos on event pages"
(`biz:process/roadmap/roadmap.md` § Future Ideas).
- *Gives:* the real answer to "some data link". Each side stores only what it owns. An event page
  gets a picture, which Google's event results and every link preview want. Remy can publish a
  recap the evening a tournament ends, with no deploy.
- *Costs:* a dangling key when an event is deleted — the page shows nothing, which is correct. An
  editor must paste or pick an id; a picker is a small plugin later (our-site plan, item 7's block).
- *Depends on:* idea 1 existing.
- *Verdict:* **do later — second.** It is the idea most worth building once pages exist.

**5. An events index and "upcoming events" on the home page**, from `GET /api/events`.
Already in the our-site plan (item 7). Listed here because it is the smallest version of the link.
- *Verdict:* **do first**, there.

**6. Build-time import** — bake the events into the site when it deploys.
- *Costs:* an event created in the app is invisible until someone deploys the site. EmDash sites
  are server-rendered; there is no build step to hang this on.
- *Verdict:* **do not do.**

**7. The app pushes a "changed" signal** so the site can purge one page instead of waiting.
A queue message or a `fetch` from the event mutations to a site endpoint that purges by tag.
- *Gives:* minutes become seconds.
- *Costs:* the app now calls the site on a write path. It must never fail a write because the site
  is down.
- *Verdict:* **do later, only if minutes hurt.** For an event page, they do not. Live scores are a
  different matter and stay in the app.

**What must stay private, whatever is built.** Players by name. Guardians. Coaches' names (the API
already hides them from a stranger). Attendance. Anything under `/api/me`, `/api/people`,
`/api/meetings`. Live video. And until the owner settles the two-places problem in § a: teams,
rosters, games and standings stay off the site even though the API will hand them over.

### Site → app: content in

**8. Announcements shown inside the app.** An `announcements` collection in EmDash: text in Thai
and English, a link, a start and end time, a severity. The site serves the current ones as a small
JSON file at a public URL with a cache header and `Access-Control-Allow-Origin: *`. The app fetches
it after it has rendered, with a short timeout, and shows a banner or nothing.
- *Why a route of the site and not EmDash's REST API:* a content read needs a session or a token
  (`core:astro/routes/api/content/[collection]/index.ts:23`, `requirePerm(user, "content:read")`).
  A token in a browser bundle is a leak. A public, cached feed has nothing to steal.
- *Gives:* "registration for X closes Friday" or "scores are delayed tonight" without an app
  release. Scheduling is EmDash's, and needs the cron trigger on Cloudflare.
- *Costs:* a change in the app repo, by the app's team. The Tauri and offline cases need the fetch
  to be optional. A wrong announcement is on every screen at once — so only an Editor publishes.
- *Verdict:* **do first as the second experiment**, because it proves the direction nobody has
  tried. Small, and it is the whole of "content in" in one piece.

**9. Legal pages owned by the site, linked from the app.** Privacy and terms do not exist in either
repo. The platform holds children's data and the code cites PDPA (`app:src/environment.ts`). Apple
and Google both ask for a privacy policy URL at submission.
- *Verdict:* **do first.** It is a page and two links. The text is the owner's.

**10. Help content from EmDash.** Help already has a home, a toolchain, three languages and a plan
of its own.
- *Verdict:* **do not do now.** Moving it is weeks of work for no new capability. See § e.

**11. Product copy, onboarding text or feature flags managed as content.**
- *Costs:* the app's strings are compiled, typed, checked for completeness across 27 locales, and
  work offline (`app:tests/repo/messages.test.ts`, per `app:docs/README.md`). Fetching them at run
  time gives up all four. A flag in a CMS couples what the app *does* to an editor's click and to
  the site being up; the app already has a typed policy table for that
  (`app:src/environment.ts`, `POLICY`).
- *Verdict:* **do not do.**

**12. An agent drafts the monthly events guide.** EmDash's MCP server can create a draft post
(`docs:reference/mcp-server.mdx`). The app's API lists events. An agent reads one, writes the other
as a **draft**, and Remy edits and publishes. Today the guide is typed by hand, twice.
- *Depends on:* real events in the app, or the agent reading `biz:research/events-raw/` instead.
- *Verdict:* **do later.** Cheap once both ends exist, and it is the first use of the two APIs
  together that saves a person time.

**13. "List my event" on the site creates a draft event in the app.**
- *Costs:* the app declares an API-key scheme and has not built it ("Neither is built",
  `app:src/api/openapi.ts`; `app:src/auth.config.ts` loads only `emailOTP` and `admin`).
- *Verdict:* **do later.** Until then the form lands in the EmDash admin and a person follows up.

### Shared surface

**14. One URL plan, agreed before any entity page is published.** This is the cheapest thing on the
page and the most expensive to get wrong.
- Site: `/`, `/organisers`, `/coaches`, `/parents`, `/blog/…`, `/events`, `/events/<id>/<slug>`,
  `/orgs/<slug>`, `/privacy`, `/terms`; Thai under `/th/…` (EmDash's admin breaks if the default
  locale is prefixed, `docs:guides/internationalization.mdx`).
- App: everything a signed-in person does. Today `https://remy.ubuntusoftware.net/#/…`.
- The id is in the URL and is what the site looks up. The slug is decoration, made from the name;
  a wrong slug redirects to the right one. Events have no slug column, and names change.
- Google indexes the site. The app's shell should say `noindex` once the site is live, so a search
  for the brand lands on a page with words on it. *Inferred*, and it is a change in the app.
- *Verdict:* **do first.** It is a decision, not code.

**15. Two hosts now, one host later.**
- *Two hosts* (site on its own host, app where it is): no change to the app. Costs: Google treats
  them as two sites; the site cannot tell whether a visitor is signed in.
- *One host, split by path* (site Worker on `/`, app Worker on `/app/*`, `/api/*`, `/rpc/*`): one
  origin for cookies, links, sitemap and ranking. It needs the app's stage 4 first. And there is a
  trap: the app's service worker is registered at scope `/` (`"scope":"/"` in the live manifest,
  ran; `app:src/web/vite.config.ts`). On a shared host it would answer the site's pages from the
  app's cache until its scope moves to `/app/`.
- *Verdict:* **two hosts first; one host later**, when the brand domain exists and the app has
  moved under `/app` for its own reasons. Agreeing idea 14 now is what keeps that move cheap.

**16. Links from the site into the app, built in one place.** Already in the our-site plan (item 6).
Add one thing: every such link carries `ref=site` and the page it came from, inside the hash
(`#/event/evt_001?ref=site-event`), which the app's router already parses
(`app:src/web/lib/router.tsx`, `parseRoute`).
- *Verdict:* **do first.**

**17. Smart app banners and universal links.** There is no store app to point at, and no
association file. On Android an installed PWA can take over links to its own host; on iOS it cannot
(`app:docs/done/2026-09-08-04-ios-installed-web-app-links.md` is marked superseded "because no
supported fix exists", per `app:docs/README.md`).
- *Verdict:* **do later**, after the store apps. Until then: a plain "Open the app" button.

**18. Shared look.** The app's tokens are in one file: Inter, Noto Sans Thai, a primary of
`oklch(0.553 0.195 38.402)`, theme colour `#dd5230`. `app:src/web/styles.css:48-118`,
`app:src/web/index.html`.
- *Verdict:* **copy them by hand once.** A shared package for two consumers is more machinery than
  the problem. Revisit if email templates become a third.

**19. Attribution from the site to a sign-up.** Site: Cloudflare Web Analytics and Search Console.
App: record the `ref` from idea 16 as one more field in its telemetry catalogue, on the first
session and on sign-in (`app:src/analytics.ts` — fields are append-only by design).
- *Gives:* the one number that says whether the site works: visits → opened the app → signed in.
- *Costs:* one small app change. Consent rules for Thailand are not in either repo; not known.
- *Verdict:* **do first for the site half; ask for the app half.**

**20. Search across both.** *Verdict:* **do later.** Posts are searchable in EmDash; events are a
filtered list. One box over both is a feature for when there is enough of each to need it.

### Identity

**21. Keep the two sets of accounts completely separate.** Two editors in EmDash, behind Cloudflare
Access (our-site plan, item 8). Every user of the product in Better Auth. No shared session, no
single sign-on, no EmDash "subscriber" accounts for app users.
- *Why:* nothing on the site needs to know who the reader is. EmDash's five roles are one number
  per user ([`auth.md`](auth.md)); they cannot say "this organiser may edit this event's story".
- *Verdict:* **do first — by doing nothing.**

**22. Show a signed-in visitor "Go to your dashboard" instead of "Sign in".**
- *Costs:* on two hosts the site cannot read the app's cookie, and the app's API refuses
  credentialed cross-origin calls on purpose (`app:src/api/openapi.ts`, the CORS comment).
  Personalised HTML also cannot be cached.
- *Verdict:* **do not do** on two hosts. One button, "Open the app", and the app decides. On one
  host it becomes a same-origin fetch in the browser and is cheap — one more reason for idea 15's
  second half, later.

**23. Organisers writing on the site.** *Verdict:* **do not do** until EmDash has per-entry
permissions. Remy publishes; organisers send her the words.

### Operations

**24. Which app each site environment reads.** Production site → production API. Local and any
preview site → the app's **staging** API, which holds fixtures only by rule. One setting,
`APP_ORIGIN`, in the Worker's `vars`.
- *Verdict:* **do first.**

**25. Deploy order.** The app adds before the site uses. The site stops using before the app
removes. The app's team cannot see the site's code, so the site must say what it reads: a short
list of operations and fields, kept in the site's repo.
- *Verdict:* **do first**, as the input to idea 26.

**26. `doctor` verifies the link.** The harness's `doctor` already does settings-driven
cross-checks: `VERIFY_COLLECTION`, `VERIFY_JOIN_FIELD`, `VERIFY_BUCKET` and friends compare an
entry to an object elsewhere (`nu/checks.nu`). The same idea, pointed at the app:
- the upstream contract: fetch `<APP_ORIGIN>/api/openapi.json`; fail if an operation or response
  field the site lists is gone;
- one known entity: the site's page for it returns 200, contains the name the API returns, and
  carries JSON-LD that parses with the expected `@type`;
- the privacy line: fetch a roster from the app; fail if any of those names appears in any page
  the sitemap lists;
- the feed in idea 8: valid JSON, a cache header, the CORS header;
- app down: with `APP_ORIGIN` pointed at a closed port, an entity page is not a 404.

All settings-driven; nothing about Remy-Sport goes in `nu/`.
- *Verdict:* **do first, alongside each experiment** — a link nobody checks is a link that rots.

**27. What breaks when one side is down.** Site down: the app must not notice (idea 8's fetch is
optional). App down: landing, blog and legal pages are untouched; entity pages serve stale; the
events list says so.
- *Verdict:* this is a **rule**, tested by idea 26.

### What not to do

- **An `events` collection in EmDash, filled in by hand.** It is what the guide post already is,
  made permanent. Two lists of events, two answers. If the 66 researched events are to be listed,
  they go into the app, once (§ e, question 3).
- **Syncing app rows into the CMS** (idea 3). A copy that an editor can edit.
- **The app depending on the CMS to start, sign in or show a score.** Anything from the site is
  optional, late and cached.
- **Single sign-on, or any shared session, now.** No page needs it.
- **Indexing anything with a child's name on it.** Not teams with rosters, not box scores. A
  `noindex` tag is not a privacy control; the page must not be rendered at all.
- **Moving help a third time** before deciding where it lives.
- **Putting the site on the app's host before the service worker's scope has moved.**
- **Runtime product copy or feature flags from the CMS** (idea 11).
- **Building the same public pages twice** — once in the site and once in the app's stage 5 and 6 —
  because nobody edited the other plan.

---

<a id="d"></a>
## d. The combinations worth pursuing

Four coherent shapes. They are not exclusive over time: A leads to B or D.

### A. Two hosts, a thin link — start here

The site owns landing pages, blog, legal, the events list and **an indexable page per event and
organisation**, all read from the app's public API with an edge cache. The app changes in three
small ways: `noindex` on its shell, a `ref` it records, and an optional announcement banner.
Ideas 1, 5, 8, 9, 14, 16, 19, 21, 24–27.

- *For:* days, not weeks. Almost no work in the app. Every part can be thrown away.
- *Against:* freshness is a cache time. Two hosts split whatever ranking is earned. The site is
  only as good as the events in the app, and today those are fixtures.

### B. A plus enrichment — the site becomes the editorial layer of every entity

A, then idea 4: stories, pictures and sponsors keyed by the app's ids, and idea 12: agent-drafted
guides. The app may later show a story's cover and link from its own event page.

- *For:* this is the "data link" that makes one product out of two. Each side keeps one job.
- *Against:* event pages now have two upstreams. An editor works with ids until a picker exists.

### C. The app renders entity pages; the site is words only

The app does its stage 6. The site keeps landing, blog and legal, and links across.

- *For:* the best freshness and the cleanest privacy enforcement; no cross-Worker reads.
- *Against:* it waits on three unstarted stages in the app. No editor near the entity pages, so no
  stories or pictures without building a media feature in the app. Nothing to show for weeks.

### D. One host — where A or B end up

The brand domain. The site answers `/`, the app answers `/app`, `/api`, `/rpc`. One sitemap, one
origin, a header that knows who you are, universal links with one association file.

- *For:* the finished product. Idea 22 becomes cheap.
- *Against:* needs the app's router migration, the service-worker scope change, and a brand and
  domain decision open since May (`biz:company/brand-registrations.md`). Not a first step.

**What I would do:** A now, as experiments, in the order of the plan. Then B. Decide between C and
D only with evidence from A — in particular whether minutes of staleness ever mattered, and
whether Remy used the editor. Whichever is chosen, agree the URL plan (idea 14) first; it is what
makes A cheap to leave.

---

<a id="e"></a>
## e. Questions only the owner can answer

1. **Who owns the indexable page for an event — the site, or the app's Worker?** The app's plan
   says the app (stage 6). This document says the site first, as an experiment. Both cannot stand.
   One of the two plans needs a line saying so.

2. **Where is the privacy line?** The app's plan says teams, games and standings are never public.
   The app's API, model and roadmap say they are. And separately: should a roster of children's
   names be served to an anonymous caller at all, now that a public site could index it? Until
   answered, the site shows events and organisations only.

3. **Where do real events come from?** Production appears to hold four fixture events. There are 66
   researched ones in the business repo. Are events that the platform does not run — only lists —
   meant to be rows in the app? The model has a `MODERATE_LISTINGS` action
   (`app:src/domain/model/vocabularies.ts:85`) and `biz:decisions/decision-006-domain-completion.md`
   lists "a general-purpose listings marketplace" among alternatives deferred beyond the pilot. If they are not app rows, the site's
   event pages have little to index and the guide posts stay the directory.

4. **Will the app take four small changes for the site's sake?** `noindex` on the shell; a recorded
   `ref`; an optional announcement banner; cache headers on public reads. And two larger ones when
   wanted: an image and a status on events. None can be made from this repo.

5. **One host or two, and on which domain?** The our-site plan asks the domain question already.
   The new part is whether the app is expected to move under `/app` on the same host one day.

6. **Where does help live in a year?** The Fumapress site (today), lazy MDX inside the app (the
   app's plan, stage 4), or the EmDash site. This document recommends leaving it alone and deciding
   once, not moving it twice.

7. **Is a few minutes of staleness acceptable on a public event page?** If a changed date must show
   at once, the app has to tell the site (idea 7), or own the page (shape C).

8. **Workers Paid plan?** It decides whether any sandboxed plugin — an event picker, a sync — can
   deploy. Shape A needs none.

9. **Analytics and consent.** Which analytics the public site may run for visitors in Thailand, and
   whether a consent notice is needed. Not in either repo.

10. **Who reviews Thai on public pages?** Entity names come from organisers in both languages. The
    words around them are ours, and the Thai in the app is unreviewed (`app:docs/README.md`,
    Translation provenance).
