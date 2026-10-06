# What Remy-Sport is, and what its site needs from EmDash

Written on 2026-10-06 from the owner's two repos, read at these commits (local checkouts, equal to
`origin/main` by `gh api …/commits/main`):

| prefix | means |
|---|---|
| `app:` | `joeblew999/remy-sport` at `d2e1f01` — the application. Private |
| `biz:` | `joeblew999/remy-sport-biz` at `ddeedbd` — the Product Owner's repo. Private |

Both checkouts had uncommitted edits to `README.md` and `mise.toml`; where a fact comes from one of
those it says "working tree". "Ran" means a read-only request or command was run on 2026-10-06.
Everything else was read, not run. No other Remy repository was studied, on the owner's instruction.

The plan that follows from this is [`plans/2026-10-06-our-site.md`](plans/2026-10-06-our-site.md).
EmDash itself is in [`emdash.md`](emdash.md).

- [What the project is](#what-the-project-is)
- [What exists today](#what-exists-today)
- [What nothing yet does](#what-nothing-yet-does) — the gap a site fills
- [What the site must do](#what-the-site-must-do)
- [EmDash: covered, plugin, or stays in the app](#emdash-covered-plugin-or-stays-in-the-app)
- [Could not determine](#could-not-determine)

---

## What the project is

**Verified**

- "Basketball events, teams and live scoring for Thailand." `app:README.md` (working tree, line 15)
- A SaaS platform for sport event management: tournaments, leagues, camps and showcases. Revenue
  intent is subscription or per-event fees paid by organisers and schools. The pilot market is
  international schools in Thailand. `biz:company/facts.md` § Business
- The scope is wider than schools. Remy, 2026-05-08: "our website / project is for all events in
  Thailand. Not only for schools … It's a page everyone can come to and find events and register to
  play by." 3x3 and 5-on-5, FIBA-certified or not. `biz:decisions/Q-and-A.md` § 23
- Six user types: tournament organiser, coach or team manager, player, spectator or fan, referee,
  platform admin. A spectator reads without an account and never writes. `biz:domain/actors.md`
- Two founders. Gerard Webb builds it. Remy Boswell is the Product Owner, a basketball coach, and
  does not code. `biz:company/facts.md` § Founders, `biz:README.md:11-13`
- The problem it answers: events live in Facebook groups, LINE groups and Google Forms. Remy has
  collected about 65 of them by hand, one file each. `biz:research/events-raw/`,
  `biz:content/blog/README.md` § Content angles
- There is no legal entity, bank account or payment processor yet. `biz:company/facts.md` § Business

**Three names are in use for one product**

| name | where | source |
|---|---|---|
| Remy Sport | the app's title, API title, repo | `app:src/web/index.html`, `app:src/api/openapi.ts` (`docsTitle`) |
| RemySports | the pitch deck's unbranded baseline | `biz:pitchdeck/index.html:3,10` |
| ChampsCircuit | the product brand, selected 2026-05-08 | `biz:company/facts.md` § Naming intent |

`champscircuit.com` is the intended primary domain and is **not registered**: status "pending" in
`biz:company/brand-registrations.md` § Domain names; ran `whois champscircuit.com` → "No match".
The same file leaves an open question to both founders on whether to reconsider the brand, because
of a US youth-basketball brand called "Circuit of Champions". § Prior-usage.

## What exists today

### The app

| | | source |
|---|---|---|
| Stack | React 19 SPA built with Vite, served by one Cloudflare Worker that is also the API (oRPC, OpenAPI). D1 through Drizzle. R2, Queues, Analytics Engine, a 5-minute cron, Cloudflare email sending | `app:package.json`, `app:wrangler.toml` |
| Sign-in | Better Auth 1.7.2, a one-time code by email. No passwords. `emailOTP` and `admin` plugins | `app:src/auth.config.ts:266,293`, `biz:decisions/decision-001-auth-provider.md`, `biz:process/roadmap/roadmap.md` § Now |
| Routing | Hash routes (`#/event/<id>`), chosen so the same bundle runs in Tauri webviews | `app:src/web/lib/router.tsx:1`, `biz:decisions/decision-003-frontend-targets.md` |
| Native | A Tauri 2 shell for desktop and mobile, and a PWA | `app:src-tauri/`, `app:package.json` (`vite-plugin-pwa`) |
| Live video | Media over QUIC, publish and watch, with per-game relay credentials | `app:src/moq-relay.ts`, `app:src/api/relay-credentials.ts`, `app:src/web/pages/live.tsx` |
| Languages | 27 locale files. All 27 are in `LOCALES`, the list a reader is offered; 26 are agent translations and none is human-reviewed | `app:project.inlang/settings.json`, `app:src/domain/model/vocabularies.ts:14-45`, `app:docs/README.md` (Translation provenance) |
| Command line | `package.json` scripts run with `bun`. mise only pins tools. The committed `mise.toml` has no includes; the working-tree README says the former shared mise library is retired | `app:package.json`, `app:mise.toml`, `app:README.md` (working tree) |
| Licence | None | `gh repo view joeblew999/remy-sport --json licenseInfo` → null |

**Deployed** (`app:wrangler.toml`, `app:README.md`; each ran, HTTP 200):

| environment | URL |
|---|---|
| production | `https://remy.ubuntusoftware.net` |
| staging | `https://staging-remy.ubuntusoftware.net` |
| public API document | `https://remy.ubuntusoftware.net/api/openapi.json` — "Remy Sport API" 0.1.0 |

All of it is on one Cloudflare account, on the zone `ubuntusoftware.net`. `app:wrangler.toml`
(`account_id`, `routes`), `app:mise.toml` (`TUNNEL_ZONE`)

**What a person can do there today** is the "Now" table of `biz:process/roadmap/roadmap.md`: sign
in, browse and filter events, event pages, create and edit events, co-organisers, teams,
organisations, divisions, fixtures, score entry, match status, result pages, spoiler mode,
standings, an admin console. Registration and rosters are "Coming Next": modelled and readable,
not writable. Of 76 actions in the model, 12 are not built. `biz:README.md:129-134`

### The help site

A second, independent site inside the app's repo: `app:sites/help`, built with Fumapress, deployed
as its own Worker.

- English, Thai and Japanese; 39 pages; the Thai and Japanese are drafts awaiting human review.
  `app:sites/help/AGENTS.md`, `app:sites/help/i18n.ts`
- It has a news archive, an RSS feed, a sitemap, `llms.txt` and a read-only MCP endpoint.
  `app:sites/help/README.md` § Local addresses
- It is edited as MDX files, optionally through a local visual editor that "is never deployed".
  The README calls this "local authoring, not a production multi-user CMS".
  `app:sites/help/README.md` § Collaboration
- Production is `https://help.remy.ubuntusoftware.net/`. Ran: `/`, `/sitemap.xml` and `/rss.xml`
  return 200. `app:sites/help/AGENTS.md` still says "unpublished"; the deployment says otherwise.

### The business repo

The model (`biz:domain/model/`, copied verbatim into the app), the backlog, decisions, company and
brand state, research, a pitch deck, and one piece of public content:

- `biz:content/blog/2026-05-thailand-basketball-events-guide.md` — a guide to events in June, July
  and August 2026, in three tiers. A second copy, `…-WIX.md`, is the same post marked up by hand
  for the Wix editor.
- `biz:content/blog/README.md` says posts "go out on Substack (or wherever the blog is hosted)
  before ChampsCircuit launches", gives each post a status, platform, angle and audience (coaches,
  organisers, parents, players, general), and lists six angles to write.
- The post was shared in three Thai Facebook groups on 2026-05-29 with a Google Sheet.
  `biz:research/contacts/community.md:11-13`

## What nothing yet does

**Verified**

- **No page of the app can be indexed.** It is one HTML shell titled "Remy Sport" with hash routes;
  everything after `#` never reaches a server. `app:src/web/index.html`,
  `app:src/web/lib/router.tsx:1`
- **The blog has no home.** The one post exists as markdown and as a hand-formatted Wix copy, with
  the platform still written as "Substack / Facebook / LinkedIn / Other".
  `biz:content/blog/README.md`
- **The app repo has an open plan for exactly this gap, not started.**
  `app:docs/2026-09-11-01-localisation-and-public-surface-plan.md` (status "open, 2026-09-11",
  listed under "Not yet started" in `app:docs/README.md`). It proposes, inside the app's Worker:
  - stage 5: prerendered marketing pages per locale — `/{locale}/`, `/{locale}/coaches`,
    `/{locale}/parents` — with `hreflang`, a sitemap and `robots.txt`;
  - stage 6: `/{locale}/events/<id>` and `/{locale}/orgs/<id>` rendered from D1 at request time,
    edge-cached, purged by tag;
  - stage 4: retire `sites/help` and move help into the app.
  It has no blog and no editor: pages are React components in `src/site/`.
- **That plan draws a privacy line.** "Public means a crawler may see it: marketing pages, events,
  orgs. Teams, players, people, games and live scores are never public." Same file, § The URL scheme.
  The platform holds children's names and ages, and `app:src/environment.ts` names Thailand's PDPA.

**Inferred — the owner has said only "the site is for the Remy-Sport project"**

The EmDash site is the public, editor-run surface: the landing and audience pages and the blog.
It is the one thing in the list above that needs a non-coding author to publish without a deploy,
which is what a CMS is for. It is not the app, and it does not need to replace the help site.
Whether it replaces stage 5 of the app's plan is the owner's call; the plan lists it as open.

## What the site must do

Each row says whether the need is verified in the repos or inferred from them.

| need | what | status and source |
|---|---|---|
| Who reads | Coaches, organisers, parents, players, and anyone searching for basketball events in Thailand. No account needed | Verified: `biz:content/blog/README.md` (Audience), `biz:decisions/Q-and-A.md` § 23, `biz:domain/actors.md` § 4 |
| Who edits | Remy writes; she does not code. Gerard administers | Inferred from `biz:README.md:11-13` and `biz:content/blog/README.md` ("Remy's personal brand content") |
| Blog | Posts with a status, an angle, an audience and a date. Long tables of events. One post exists | Verified: `biz:content/blog/` |
| Landing and audience pages | A home page, and a page each for coaches and parents. Organisers are the paying side and the positioning note names them first | Verified for coaches and parents (`app:docs/2026-09-11-01-…plan.md` § The URL scheme); inferred for organisers (`biz:company/facts.md` § Business) |
| Languages | Thai and English at least. The roadmap calls those two complete in the product; the pilot is Thailand | Verified: `biz:process/roadmap/roadmap.md` § Now. How many more is [not determined](#could-not-determine) |
| Events on the site | A list of upcoming events that links into the app | Inferred: the guide post is a hand-kept event list with a "Google Sheets" link still marked "coming soon" (`biz:content/blog/2026-05-…guide.md`), while the app already serves the list |
| Data feed | The app's public API. `GET /events`, `/events/{id}`, `/events/{eventId}/sessions`, `/events/{eventId}/teams`, `/orgs`, `/orgs/{id}`, `/games`, `/standings` and others need no credentials, and the API answers any origin | Verified: ran `curl …/api/openapi.json` (operations with no `security`); `app:src/api/openapi.ts:135` (`CORSPlugin({ origin: "*" })`) |
| What must not be shown | Teams, players, people, games and live scores, to a crawler. The API serves `GET /players` and `/games` returns 401 without credentials (checked against the live API on 2026-10-06; this document first said otherwise), so the API allows more than the stated line does | Verified: plan § The URL scheme; ran the same `curl` |
| Images | Post images and event posters | Inferred. Nothing in either repo says where images live for content |
| Video | Live video stays in the app. The roadmap's public-facing video items are "Live stream links" (YouTube or external) and, under Future Ideas, "Video & photo galleries" | Verified: `app:src/moq-relay.ts`, `biz:process/roadmap/roadmap.md` |
| Sign-in for readers | None. Every account, role and session is the app's | Verified: `app:src/auth.config.ts`; nothing in either repo asks for sign-in on a content site |
| Sign-in for editors | Not stated anywhere. The app's convention is an emailed code and no passwords | Not determined. See the plan, item 2 |
| Domain | Intended `champscircuit.com`, unregistered. Everything deployed is under `ubuntusoftware.net` | Verified: above |
| A privacy page | The platform holds minors' data and `environment.ts` cites PDPA | Inferred. No privacy text exists in either repo |
| Search engines and assistants | Sitemap, `robots.txt`, `hreflang`. The help site already publishes `llms.txt` | Verified as intent: plan stage 5; `app:sites/help/README.md` |

**The links between the three sites** (inferred from the URLs above): the site links to the app
for anything a person does (`https://remy.ubuntusoftware.net/#/event/<id>`) and to the help site
for how-to. The app's hash URLs change if its TanStack Router plan lands (`/app/events/<id>`,
plan stage 4), so the site should build those links in one place.

## EmDash: covered, plugin, or stays in the app

EmDash's side of each row is sourced in [`emdash.md`](emdash.md) § What a real site needs and
[`emdashcms-com.md`](emdashcms-com.md) § Content model. None of it has been run for this site.

### Covered by EmDash as it ships

| need | how |
|---|---|
| Posts and pages edited in a browser, with drafts, revisions and scheduled publishing | Collections in the seed; the admin at `/_emdash/admin`. Scheduled publishing on Cloudflare needs the cron trigger |
| Audience and topic on a post | Taxonomies |
| Remy as the named author | Bylines |
| Menus that point at the app and the help site | Menus with custom URLs, as emdashcms.com does |
| Images | Media on R2, transformed through the `IMAGES` binding |
| Thai and English | Astro's own `i18n` block. The default locale must not be prefixed, or the admin 404s — so `/` is one language and the other is `/th/` or `/en/`. This differs from the app plan's `/{locale}/` for every language |
| Search over posts | Full-text on D1 |
| Agents drafting or loading content | The MCP server and `emdash content create` |
| Sitemap, RSS, `robots.txt`, canonical URLs | Routes the site owns; no template sets `site:` |

### Site code, not a plugin

- **The events list.** A page in the site's `src/` that fetches the app's public API on the server
  and caches the result. It needs no admin screen and stores nothing in EmDash. This depends on the
  harness gap "a site needs its own `src/`" (plan item 4).
- **The landing and audience pages**, their layout, and the links into the app.

### Needs a plugin

| need | plugin | note |
|---|---|---|
| A contact or "list my event" form | `@emdash-cms/plugin-forms`, which this repo's own project already loads (`mise.toml`, `SITE_PACKAGES`) | Inferred need. Notifications from it need an email provider |
| Email: invites for a second editor, form notifications | An email provider plugin. Without one, production sends nothing | Only if sign-in is not Cloudflare Access |
| An event inside a post — the editor picks an event, the post shows its current date, venue and status | A plugin of our own: a block with a picker that reads the app's API | Inferred, and not needed first. The guide post's tables are the case for it. Whether a seed `blockTypes` entry plus a site component does this without a plugin was not checked |

A sandboxed plugin on Cloudflare needs the Workers Paid plan; a native one needs a deploy.
`emdash.md` § Two targets.

### Stays in the app

Accounts, roles and sessions. Events, organisations, teams, players, games, scores, standings and
the database they live in. Registration. Notifications and push. Live video and relay credentials.
The admin console. The API. The help site, unless the owner decides otherwise. The site reads the
first group through the public API and writes none of it.

## Could not determine

- **What the owner means the site to contain.** The owner said the site is for Remy-Sport and
  named its repo. Everything under "inferred" above is a reading of the repos, not an instruction.
- **Whether this site replaces stage 5 of the app's public-surface plan, or stage 6 as well.**
  The plan is open and waits on the Product Owner.
- **Which name the site carries**: Remy Sport, RemySports or ChampsCircuit. The brand question in
  `biz:company/brand-registrations.md` is open.
- **Which languages.** The app offers 27. The roadmap says Thai and English are complete and
  Japanese is "drafted … and deliberately not offered yet". `brand-registrations.md` says the
  released locales are th, en and ja. The three statements disagree.
- **Whether the blog is Remy's personal brand or the product's.** `biz:content/blog/README.md`
  says personal, published before launch; the post itself reads as the product's.
- **Whether the Cloudflare account behind this repo's `DEPLOY_URL` (`gedw99.workers.dev`) is the
  account in `app:wrangler.toml`**, and whether that account is on the Workers Paid plan. Neither
  was queried.
- **Who else would edit**, and whether Remy has a GitHub or Google account an OAuth sign-in could
  use. `biz:profiles/README.md` holds one Facebook link.
- **Whether the app's `GET /events` is safe to list in full on a public page.** It returns every
  event row with the organiser's name, ordered by start date, with no filter
  (`app:src/api/events.ts:158-163,204-216`). Which statuses that includes — cancelled, past, test
  data — was not checked against production.
- **Any analytics, consent or cookie requirement** for a public site aimed at Thailand. Not in
  either repo.
- `joeblew999/remy-sport-rust` does not exist on GitHub (`gh repo view` → not found) and has no
  local checkout. `app:docs/README.md` says the Rust app moved to `joeblew999/champs-circuit` on
  2026-09-18; that repo was not read.
