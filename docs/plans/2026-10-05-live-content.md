# 2026-10-05 — Live content: get the deployed site onto the current seed

**Status:** active — **3 of 5 done**, blocked on a destructive decision (wipe production's D1) and, if the API path is taken instead, on a hand-approved device code

This plan was written as "export a seed, re-seed production". Reading the EmDash skills (which were
not loaded when it was written — see the commit that vendored them) showed that framing was wrong.
The authoritative page is
[Evolve a deployed site's schema](https://docs.emdashcms.com/deployment/schema-evolution/), and it
says plainly:

> The seed file only participates in [first-time bootstrap]. Its schema and structure are applied
> **once**, on the first request before the setup wizard has been completed. Deploying a changed seed
> file against an existing database **does nothing** — evolving a live site's schema always happens
> through the admin panel or the API.

So `mise run seed:apply` (wipe the D1 and let it rebuild) is a **local development tool only**. It is
not, and cannot be, how a deployed site is updated.

## The four workflows, which must not be confused

| Workflow | What changes | How |
|---|---|---|
| Content editing | Entries, media, settings | admin panel, or `emdash content` over REST |
| Code deploy | templates, config, EmDash version | `wrangler deploy` (may migrate EmDash's own tables) |
| First-time bootstrap | everything, from empty | migrations + seed, automatic on first boot |
| **Schema evolution** | collections, fields, taxonomies | admin panel, or `emdash schema` against the live site |

Our production problem is the fourth row, and the fix is the API path — not a seed.

## The real diagnosis — this plan's premise was WRONG, twice

Both earlier readings were wrong, and the second one was found by trying to log in.

**1. Production had never been set up at all.** Visiting `/_emdash/admin/device` redirected to
`/_emdash/admin/setup`, and `/api/setup/status` returned `needsSetup: true` until the wizard was
completed. So the earlier claim — "the deployed D1 was seeded before `geometry_meta` existed" — was
false: nothing had ever been seeded, because setup had never run. The 404s on `/parts/…` were
"no content", not "stale content". Every authenticated call failed for the same reason: there was
no admin user to authenticate as, which also means no token to mint and no passkey to register.

**2. The deployed build predates the seed fix.**

| event | time (UTC) |
| --- | --- |
| `wrangler deployments list` — the two deploys | `03:58:33` and `04:08:56` |
| the commit that added `model_id` and deleted the fabricated values | `08:33:01` |

So the build production is running embeds the **old** seed — and the wizard, just completed, applied
*that*. Production now has the fabricated schema and data: `brep_file` / `step_file`, no `model_id`,
and `geometry_meta` full of invented vertices and volumes.

**The root cause is therefore not a missing migration at all — it is that nothing redeployed after the
seed was fixed.** `site:deploy` last ran 4.5 hours before the fix, and no amount of `emdash schema`
work would have been the right first move.

## Confirmed: the deployed site is up but does not have our content

`https://emdash-run.gedw99.workers.dev/` → **200**, but `/parts/mounting-plate` → **404**, and its content API returns `NOT_AUTHENTICATED`.

Note that parts are not publicly routable — the same path 404s locally — so a 404 there says nothing
about content. That is what made this look like a staleness problem for so long.

## Items

- [x] **Learn the `emdash export-seed` round trip**
  - [x] run `emdash export-seed --with-content=all` against the local site — **and learn the trap**: it reads a database *file* (`-d`, default `./data.db`), the same file-vs-D1 confusion as `emdash seed`. `-d .wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite` reads the dev server's real DB.
  - [x] diff the result against `config/cad.seed.json` — **no drift.** Both exports (default and D1) are byte-identical, and against the applied seed: same 5 collections, identical `parts` field list, identical content counts (`projects:2 assemblies:2 parts:5 pages:1 posts:1`) and slugs, identical values.
  - [x] every difference understood: the only one is **key order** inside `data` — the `geometry_meta` JSON column round-trips with keys reordered. Not drift.
  - [x] noted: the export re-expresses references as portable `$ref:` (the applied seed stores a raw entry id; the export writes `$ref:assemblies:main-bracket`).
  - [x] **the whole-site tool is `emdash site export|import`** — a tar of `manifest.json` + `records/<table>/*.ndjson` covering schema *and* content, with a `packageDigest`. Ran it against local: 14 files, 38912 bytes, `sha256:2c154ed4…`. Remote-first (`--url`, `--token`), so it reads the running instance over HTTP and sidesteps the file-DB trap. **But it imports only into an empty site** and needs the `admin` scope or the transfer scopes — so it is the wrong tool for evolving a populated production site, which is what this plan actually needs. The CLI skill also warns it carries every entry plus authors' and commenters' email addresses, so treat a package like a database backup.
- [ ] **Evolve the live site's schema** — the documented API path, not a seed
  - [ ] authenticate: `pnpm exec emdash login --url https://emdash-run.gedw99.workers.dev` (device flow), **or** create a token in the admin under **Settings → API Tokens** and pass `--token` / `EMDASH_TOKEN` (the CI path)
  - [ ] `emdash schema get parts --url …` first — the commands are **not idempotent**, and `add-field` against an existing field can fail
  - [ ] `emdash schema add-field parts model_id --type string --label "Model" --url …`
  - [ ] remove `brep_file` and `step_file` — **destructive**: removing a field deletes its column and values, and a JSON export cannot restore them. Order it after the code that stops using it, take a D1 backup, and rehearse on a preview database first (below)
  - [ ] update the 5 parts: `emdash content update parts <id> --rev <rev> --data '{…}' --url …` — remote, and it auto-publishes, so no revision juggling by hand
  - [ ] the live part editor shows Model / Objects / Model version / Model updated / Format / Source / Synced
  - [ ] **scripted, not ad hoc**: these are meant to be checked in as an ordered list so every environment gets the same change. Not idempotent — inspect with `schema list`/`get`, and stop on the first error.
- [ ] **Keep the repo's seed in sync with the live model** — the obligation this plan was missing
  - [x] **the documented recipe does not work on EmDash.** `wrangler d1 export emdash-run --remote` fails outright:
    `✘ D1 Export error: cannot export databases with Virtual Tables (fts5)`. EmDash uses FTS5 for search — `_emdash_fts_pages`, `_emdash_fts_posts` plus 10 shadow tables — so the first step of the loop the docs prescribe cannot run on any EmDash site with search enabled.
  - [x] **the way around it is the other deployment target.** EmDash runs on **Node.js** (SQLite file, local/S3 storage) as well as **Cloudflare** (D1/Hyperdrive, R2). On Node.js the database is a plain SQLite file, so the loop becomes a file copy plus `emdash export-seed --database <file>` — no `wrangler` involved, and no FTS5 export limitation. That is also why the CLI's `./data.db` default exists at all: it is the Node.js default, not a bug.
  - [x] **but do not switch this repo to Node.js casually.** The docs state plainly: *"Sandboxed plugins are D1-only. The sandbox plugin bridge talks to a D1 binding directly, independent of the configured adapter"* — so moving to SQLite would break the sandboxed twin, which is half of the `plugin-sandbox-model` evaluation. The adapter is a real constraint on that comparison, not a preference.
  - [x] the workable path on D1 is per-table extraction: `wrangler d1 execute --remote --json` works (used it for `_emdash_fields`, `ec_parts` and the migration status), so the model can be read back with targeted queries while skipping the FTS tables.
  - [x] **implemented: `mise run seed:from-remote`** — diffs the deployed content model against the repo's seed, read-only, no admin token. It reports the drift the plan had only described in prose:
    ```
    deployed: 5 collections, 20 fields
    repo:     5 collections, 19 fields
    drift:
      missing from the deployed site: parts.model_id
      only on the deployed site:      parts.brep_file
      only on the deployed site:      parts.step_file
    ```
    That is the migration, computed rather than remembered — and it makes "how far behind is production?" a repeatable answer instead of a hand-check.
  - [x] it reports rather than writes, deliberately: writing a seed is only correct once the deployed site is **ahead** of the repo, and it is behind. `scripts/lib/d1.mjs` holds the query helper (argv, not `sh -c`, so SQL quoting is not a problem).
  - [ ] extend it to content once the schema is in sync, so the same command covers the `ec_*` tables
  - [ ] note also, from the database docs: *"Sample content from the seed is applied only when an administrator chooses it in the setup wizard"* — the schema applies at first boot, but demo content is opt-in, which is a nuance `seed:apply` papers over locally
  - [ ] commit the refreshed seed **with** the code that depends on the new schema, so a fresh environment bootstraps to a model the code understands
- [ ] **Redeploy, then bootstrap production fresh** — the document's own recovery path
  - [ ] `mise run site:deploy` — the build must embed the CURRENT seed; it currently embeds the 04:08 UTC one
  - [ ] then point the deploy at an **empty** database and re-run setup, per *"Recover from a wrong turn: a fresh environment bootstrapped with the wrong model → update the seed, rebuild, and point the deploy at an empty database to bootstrap again"*
  - [ ] production's D1 holds only the fabricated seed data, so emptying it costs nothing real — **but it is destructive, so it needs a deliberate decision**
  - [ ] re-run setup in a browser after the reset; the wizard applies the embedded seed's schema and, if chosen, its sample content
  - [ ] confirm from outside with `mise run seed:from-remote` — it should report **no drift**
- [x] **Authenticating to production needs a device code approved by hand**
  - [x] `EMDASH_URL=https://emdash-run.gedw99.workers.dev mise run emdash:cli -- login` prints a URL and a code; nothing proceeds until *someone* opens `/_emdash/admin/device`, enters the code, and approves it. The wrapper appends `--url` for remote commands, so `EMDASH_URL` is the knob.
  - [x] **it worked**: `✔ Logged in as gedw99@gmail.com (admin)`, `Token saved`
- [ ] **BLOCKED: authenticated CLI access to production does not work at all**
  - [x] the token is **persisted server-side and valid**, yet every command is rejected. `_emdash_oauth_tokens` after two logins:
    ```
    access   scopes=["admin"] client_type=cli created_at="2026-10-05 10:15:21" expires_at="2026-10-05T11:15:21.596Z"
    refresh  scopes=["admin"] client_type=cli created_at="2026-10-05 10:15:21" expires_at="2027-01-03T10:15:21.596Z"
    ```
    `whoami` ran at `10:17:15Z` — 58 minutes before that access token expired — and returned **`ERROR Token is invalid or expired`**. The CLI then **purged** the stored credential, so the failure is self-erasing: the evidence disappears with it.
  - [x] not the wrapper: `pnpm exec emdash whoami --url https://…` fails identically while `whoami` with no URL succeeds against localhost's dev bypass. So it is remote-token validation, not argument handling.
  - [x] **the row is internally inconsistent**: `created_at` is stored naive (`2026-10-05 10:15:21`, no `Z`) while `expires_at` is canonical (`…T11:15:21.596Z`). Migration `079_datetime_normalization` and `site:doctor`'s "datetime storage: all stored content datetimes are canonical (UTC)" check exist precisely for this class of problem, and this is a mismatch *within one row*.
  - [ ] report upstream — this blocks the whole `emdash schema` / `emdash content` surface against a Cloudflare deployment, which is the documented way to evolve a populated live site
  - [ ] worth trying before giving up: whether `EMDASH_ENCRYPTION_KEY` being absent affects it. The docs scope that key to plugin `secret` setting envelopes, so it *should not* — but production has no secrets at all, and the failure is unexplained enough to test rather than reason about. `emdash secrets generate --write <path>` produces one without it passing through a transcript.
- [ ] **So the viable path is the wipe, not the API**
  - [ ] `emdash schema` is the documented way to evolve a *populated* site, and it is unavailable here — which removes the objection to a clean bootstrap
  - [ ] the cost is real and worth stating: production has **1 user** (an admin account with a registered passkey), so a wipe means re-running the wizard and re-registering a passkey. Nobody otherwise loses anything — the 5 parts are the fabricated seed and the post/page are template sample content.
  - [ ] a third option preserves the admin: apply the same change with direct D1 SQL taken from the local schema, the path set aside early on. More work, no auth needed, nothing lost.
- [ ] **Rehearse destructive changes on a preview environment** — the docs' own procedure
  - [ ] `wrangler d1 create emdash-run-preview --binding DB --env preview --update-config` (bindings are not inherited from the top level)
  - [ ] `wrangler d1 export emdash-run --remote --output=./prod.sql`, then `wrangler d1 execute DB --env preview --remote --file=./prod.sql`
  - [ ] deploy to preview, run the schema change against the preview URL, verify public pages + admin forms + generated types
  - [ ] take a fresh production backup, then run the same commands against production
- [x] **Check production secrets** — `wrangler secret list` → `[]`
  - [x] **production has no secrets at all**, so no `EMDASH_ENCRYPTION_KEY`
  - [x] local does not have one either (no `.env`), and the exported package contains **no encrypted values** — settings are plain (`site_title`, `site:title`, `site:tagline`)
  - [x] so nothing is broken *today*. But the moment any plugin setting is declared `type: "secret"`, encryption has no key in either environment. Worth setting before that, not after.
- [x] **Live logs** — `wrangler tail` connects
  - [x] the recipe: `fnox exec -- sh -c 'cd .src/site && pnpm exec wrangler tail --format pretty'`. It must run from `.src/site` — from the repo root it fails with `ERR_PNPM_NO_PKG_MANIFEST`, because there is no root package.json for `pnpm exec` to resolve against.
  - [x] used it: `Successfully created tail`, `Connected to emdash-run, waiting for logs...`
  - [x] gotcha recorded: the tail takes a few seconds to establish, and requests sent during that window are **not** captured. Drive traffic only after it says it is connected — otherwise it looks like tailing is broken.
  - [ ] capture one real request end to end, in a second terminal
