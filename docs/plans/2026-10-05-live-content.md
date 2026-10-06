# 2026-10-05 — Live content: get the deployed site onto the current seed

**Status:** done — production is in sync, schema **and** content, verified by `mise run check:deployed`. The wipe this plan concluded was inevitable never happened; the documented API path worked once the CLI's auth fault was found.

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

## How it actually resolved — the API path worked; the wipe was never needed

Every blocker recorded below was real, and all of them turned out to be one fault: **the CLI does not
send the credential it stored.** `emdash login` succeeds, writes a valid `admin`-scoped token, and
*every* subsequent command is rejected as `Token is invalid or expired` — because the request goes out
with no token attached. Passing it explicitly (`--token`, the CLI's own first documented auth option)
fixes it, and that is what `scripts/emdash.mjs` now does. Two traps fell out of the same
investigation:

- **a failed call purges the stored credential**, so the failure erases its own evidence — which is
  why it took four hand-approved device codes to pin down;
- production was never the problem. `whoami` against it returns the admin user once the token is
  actually sent.

With auth working, the documented API path did the whole job in place:

```
emdash schema add-field    parts model_id
emdash schema remove-field parts brep_file
emdash schema remove-field parts step_file
mise run content:set parts <entry> '{…}'     # ×5
```

`content update` **merges** — fields the payload does not mention survive — so the five parts kept
their `name` / `part_number` / `material` while gaining a `model_id`. Field removal being destructive,
it ran after the parts had stopped using those fields.

The verification is one command:

```
$ mise run check:deployed
→ core migrations      Pending: none
→ content model        ✓ matches the repo's seed
→ content + join + R2  ✓ 5/5
```

The premise was wrong twice over, as the diagnosis below records: production had never been set up at
all, and the build behind it predated the seed fix. Neither is a schema-*evolution* problem, and
neither is what was actually fixed here.

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
- [x] **Evolve the live site's schema** — the documented API path, not a seed
  - [x] authenticate: `emdash login --url https://emdash-run.gedw99.workers.dev` (device flow), then pass the stored token with `--token` — see the resolution section. The device flow was never the problem; sending the token it produced was.
  - [x] `emdash schema get parts --url …` first — the commands are **not idempotent**, and `add-field` against an existing field can fail
  - [x] `emdash schema add-field parts model_id --type string --label "Model" --url …`
  - [x] remove `brep_file` and `step_file` — **destructive**, so it ran only after the parts had stopped referencing them. No D1 backup or preview rehearsal was needed in the end: the values removed were fabricated seed data with nothing real to lose.
  - [x] update the 5 parts — via the composed task rather than the raw command, since it reads the revision for you: `mise run content:set parts <entry> '{…}'`. `content update` auto-publishes, so no revision juggling by hand, and it **merges** rather than replaces.
  - [x] the live part editor shows Model / Objects / Model version / Model updated / Format / Source / Synced
  - [x] **scripted, not ad hoc** — this ran as an ordered list via `mise run check:deployed`, which is retained, so every environment gets the same change and a drift check in one command
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
  - [x] extended to content — but not by widening `seed:from-remote`. `mise run check:deployed` reads content back through the official `emdash content list`/`get` and compares it to the repo, which is the same guarantee with less invented code. (`seed:from-remote` stays schema-only; it is the read-only drift report with no token.)
  - [x] noted, from the database docs: *"Sample content from the seed is applied only when an administrator chooses it in the setup wizard"* — the schema applies at first boot, but demo content is opt-in. `seed:apply` papers over that nuance locally, and it is worth remembering before assuming a fresh bootstrap reproduces the local content.
  - [x] committed together — the seed's `model_id` and the parts that use it went in as one change, so a fresh environment bootstraps to a model the code understands
- [x] **Redeploy, then bootstrap production fresh** — the document's own recovery path — **not needed**
  - [x] **superseded.** Production was never wiped and setup was never re-run. Evolving the schema in place with `emdash schema` left nothing fabricated to clear: once the two obsolete fields were dropped, the deployed model *was* the repo's model.
  - [x] routine hygiene, done: production has been redeployed since with a build that embeds the current seed, so a future first-time bootstrap would no longer embed the stale one
  - [x] confirmed from outside with `mise run check:deployed`, which covers schema **and** content (5/5) — a stronger check than the `seed:from-remote` drift report this item originally asked for.
- [x] **Authenticating to production needs a device code approved by hand**
  - [x] `EMDASH_URL=https://emdash-run.gedw99.workers.dev mise run emdash:cli -- login` prints a URL and a code; nothing proceeds until *someone* opens `/_emdash/admin/device`, enters the code, and approves it. The wrapper appends `--url` for remote commands, so `EMDASH_URL` is the knob.
  - [x] **it worked**: `✔ Logged in as gedw99@gmail.com (admin)`, `Token saved`
- [x] **SOLVED: the CLI was not sending its own stored token**
  - [x] the token is **persisted server-side and valid**, yet every command is rejected. `_emdash_oauth_tokens` after two logins:
    ```
    access   scopes=["admin"] client_type=cli created_at="2026-10-05 10:15:21" expires_at="2026-10-05T11:15:21.596Z"
    refresh  scopes=["admin"] client_type=cli created_at="2026-10-05 10:15:21" expires_at="2027-01-03T10:15:21.596Z"
    ```
    `whoami` ran at `10:17:15Z` — 58 minutes before that access token expired — and returned **`ERROR Token is invalid or expired`**. The CLI then **purged** the stored credential, so the failure is self-erasing: the evidence disappears with it.
  - [x] not the wrapper: `pnpm exec emdash whoami --url https://…` fails identically while `whoami` with no URL succeeds against localhost's dev bypass. So it is remote-token validation, not argument handling.
  - [x] **the row is internally inconsistent**: `created_at` is stored naive (`2026-10-05 10:15:21`, no `Z`) while `expires_at` is canonical (`…T11:15:21.596Z`). Migration `079_datetime_normalization` and `site:doctor`'s "datetime storage: all stored content datetimes are canonical (UTC)" check exist precisely for this class of problem, and this is a mismatch *within one row*.
  - [x] **resolved — and it is not an upstream bug, and not the encryption key.** The CLI stores a token and then does not attach it to its own requests; passing `--token` is the documented first auth option and it works. `scripts/emdash.mjs` passes it. Still worth reporting, because the failure mode is silent *and* self-erasing.
  - [x] the `EMDASH_ENCRYPTION_KEY` guess was a red herring for this fault — but the key genuinely was missing from production, and is now set. `emdash secrets generate --write` piped straight into `wrangler secret put`, so the value never passed through a transcript.
- [x] **WRONG: the wipe was not the only viable path — the API worked**
  - [x] the reasoning was sound but rested on the auth failure being unfixable. It was a missing `--token`. Nothing here needed a wipe.
  - [x] the cost analysis stands, and is why avoiding the wipe was worth pursuing — production has **1 user** (an admin with a registered passkey), so a wipe means re-running the wizard and re-registering one
  - [x] the third option (direct D1 SQL) was set aside and stayed aside — correct call, since the official API did the job. `scripts/lib/d1.mjs` has since been deleted; nothing in the repo hand-rolls SQL against D1 any more.
- [x] **No preview rehearsal was needed** — the docs prescribe one for destructive changes, and this was the one item deliberately skipped: the only data at risk was fabricated seed values in two fields, and the change was rehearsed implicitly by reading the model back with `schema get` before each step. On a site with real user content this would have been the wrong call.
- [x] **Check production secrets** — `wrangler secret list` → `[]`
  - [x] **production has no secrets at all**, so no `EMDASH_ENCRYPTION_KEY`
  - [x] local does not have one either (no `.env`), and the exported package contains **no encrypted values** — settings are plain (`site_title`, `site:title`, `site:tagline`)
  - [x] so nothing is broken *today*. But the moment any plugin setting is declared `type: "secret"`, encryption has no key in either environment. Worth setting before that, not after.
- [x] **Live logs** — `wrangler tail` connects
  - [x] the recipe: `fnox exec -- sh -c 'cd .src/site && pnpm exec wrangler tail --format pretty'`. It must run from `.src/site` — from the repo root it fails with `ERR_PNPM_NO_PKG_MANIFEST`, because there is no root package.json for `pnpm exec` to resolve against.
  - [x] used it: `Successfully created tail`, `Connected to emdash-run, waiting for logs...`
  - [x] gotcha recorded: the tail takes a few seconds to establish, and requests sent during that window are **not** captured. Drive traffic only after it says it is connected — otherwise it looks like tailing is broken.
  - [ ] capture one real request end to end, in a second terminal
