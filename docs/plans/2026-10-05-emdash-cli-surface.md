# 2026-10-05 — Use more of the emdash CLI

**Status:** active — **3 of 4 done**

We call exactly **one** subcommand of the site's CLI: `seed --validate`. The others do things
this repo currently does by hand, or not at all.

## Found while auditing: two things were outright wrong

- **`scripts/emdash.mjs` appended `--url http://localhost:4321` to every command.** The CLI
  splits into LOCAL commands (`init`, `doctor`, `seed`, `migrate`, `export-seed`, `secrets`)
  that work on files or a database and have no `--url`, and REMOTE ones (`types`, `login`,
  `whoami`, `content`, `schema`, `media`, `search`, `taxonomy`, `menu`, `site`, `plugin`) that
  take it. So the flag was wrong for half of them — and hardcoding localhost meant the wrapper
  **could not reach a deployed site at all**, which is why production work kept bypassing it.
  Fixed: the URL is appended only for remote commands, and it comes from `EMDASH_URL`
  (falling back to `SITE_URL`), so pointing at production is an env var.
- **Three file-based commands default to `./data.db`, which a Cloudflare site never uses.**
  `doctor`, `seed` and `export-seed` all read that file, while the dev server reads miniflare's
  D1 under `.wrangler/state/v3/d1/`. So each silently reports on the wrong database:
  `emdash doctor` announced "no users" on a site that had one, and `emdash seed` printed
  "Seed applied successfully" into a file nothing reads. Added `devDb()` to `lib/exec.mjs`;
  `site:doctor` uses it and now reports `✔ users: 1 users`, `✔ All checks passed`.

## Items

- [x] **`emdash doctor` → `site:doctor`** — database health, scheduler wiring, diagnostics
  - [x] `site:doctor` task, pointed at the **real** dev database via `devDb()`
  - [x] reports a healthy local site: migrations 90 applied, 5 collections, canonical datetimes, 1 user, cron + `scheduled()` handler found in `./src/worker.ts`, `✔ All checks passed`
  - [ ] fail loudly when something is wrong (prove it by breaking something)
- [x] **`emdash types`** — investigated, and **not adopted**. The types already exist and are correct
  - [x] ran it: `✔ Found 5 collections`, wrote `.emdash/types.ts` + `.emdash/schema.json` (schema version `d654f11f6c2b0a05`)
  - [x] **but the file it writes does not compile.** It references `BylineSummary`, `ContentBylineCredit` and `TaxonomyTerm` while importing only `PortableTextBlock`, so `tsc` reports 15 × `TS2304: Cannot find name …` (5 collections × 3). The auto-generated `emdash-env.d.ts` gets the same shapes right — it imports all four from `"emdash"`. Two artifacts, same shape, one broken.
  - [x] **and it is not the file that matters.** The site's `tsconfig.json` includes `["src", ".astro/types.d.ts", "emdash-env.d.ts", "worker-configuration.d.ts"]` — `.emdash/types.ts` is outside `include`, and `emdash-env.d.ts` compiles clean. So wiring `emdash types` into our flow would add a broken file and change nothing.
  - [x] **`geometry_meta` is `unknown` in the generated types too**, because the field is declared `type: json`. So the panels' `isRecord` guard plus `LABELS` map is the correct handling of an untyped field, not a workaround — generated types would not remove it. Worth knowing before anyone tries to "fix" it.
  - [ ] the types that *would* help are site-side (astro pages), since they are what `emdash-env.d.ts` feeds; the plugins have their own tsconfig and cannot import them
  - [ ] report the missing import upstream (a one-line fix in the `types` command)
- [x] **`emdash migrate` → understand production migrations** — answered
  - [x] **it can read the DEPLOYED D1, and it needs no admin token.** `emdash migrate --status --d1 <name>` authenticates with the Cloudflare credentials (fnox), not the site's API — so migration state is inspectable even while every content command is blocked on auth. Added as `site:migrate` (read-only).
  - [x] **production is fully current**: `Known applied: 001_initial … 091_redirect_artifacts`, `Pending: none`, `Unknown applied: none`. So production's problem is **not** migrations.
  - [x] **and this is orthogonal to our schema work.** The docs are explicit that core migrations "do not add or remove your collections, fields, or taxonomies" — so a clean migration state says nothing about the missing `model_id` field. The API path in [`live-content`](2026-10-05-live-content.md) still stands.
  - [x] the count is 90, not 91: the manifest's name list skips `010` (`009_user_disabled` → `011_sections`), which matches `site:doctor`'s "90 applied, none pending".
  - [x] `Target fingerprint: 2ac649bc7d22b10d34535e4b63ec6cb65d4ca7e594caf386e4af49753d41c48a` — required for a noninteractive apply (`--expected-target-fingerprint`), which is how a deploy would apply the exact build manifest ahead of traffic instead of relying on runtime auto-migration.
  - [x] local `--check --database <sqlite>` refuses with "A valid Cloudflare account ID is required for D1 migrations" — the command is D1-oriented, so local migration state is best read from `site:doctor` instead.
  - [x] noted: `.emdash/migrations.json` is the build manifest (`schemaVersion`, `emdashVersion: 1.1.0`, `migrationSet.names`, `i18n`), written by the dev server — the "exact build manifest" the deployment docs refer to.
- [ ] **`emdash site export|import` → a whole-site package**
  - [x] exported the local site once: 14 files, 38912 bytes, `sha256:2c154ed4…`
  - [ ] document the package as the backup path
