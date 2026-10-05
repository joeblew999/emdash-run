# 2026-10-05 — Live content: evolve the deployed site, keep the seed in sync

**Status:** active — **2 of 4 done**, 1 blocked on authenticating to production

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

## Confirmed: the deployed site is up but does not have our content

`https://emdash-run.gedw99.workers.dev/` → **200**, but `/parts/mounting-plate` → **404**, and its content API returns `NOT_AUTHENTICATED`. So the plan's premise holds: the deployed D1 was seeded before `geometry_meta` and `model_id` existed, and a seed only applies to a fresh database. **EmDash as the content layer is currently proven locally only.**

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
  - [ ] the build embeds the first seed found at `.emdash/seed.json`, `package.json#emdash.seed`, or `seed/seed.json`; with none present it embeds the starter-blog default and `astro dev` warns. Ours is `seed/seed.json`, generated by `config:apply` from `config/cad.seed.json`.
  - [ ] export the live model back into the repo after any schema evolution:
    `wrangler d1 export emdash-run --remote --output=./prod.sql` → `sqlite3 prod.db < prod.sql` → `emdash export-seed --database prod.db > .emdash/seed.json`
  - [ ] commit the refreshed seed **with** the code that depends on the new schema, so a fresh environment bootstraps to a model the code understands
  - [ ] worth automating: a `seed:from-remote` task, so the loop is one command rather than three remembered ones
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
