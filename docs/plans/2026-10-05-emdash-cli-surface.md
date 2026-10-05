# 2026-10-05 — Use more of the emdash CLI

**Status:** active — **1 of 4 done**

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
- [ ] **`emdash types` → generated schema types** — `geometry_meta` is `Record<string, unknown>` today
  - [ ] generate types from the live schema
  - [ ] the panel uses them — no `unknown` casts left
- [ ] **`emdash migrate` → understand production migrations** — locally we rely on dev-bypass auto-migrating
  - [ ] find out what deployment-managed migrations mean for production
  - [ ] write it down *before* the next schema change
  - [ ] exercise it once
  - [ ] related: the site's `deploy` script is just `astro build && wrangler deploy` — no `emdash migrate`, and production has **no secrets at all** (no `EMDASH_ENCRYPTION_KEY`), which `emdash secrets generate` exists to fix
- [ ] **`emdash site export|import` → a whole-site package**
  - [x] exported the local site once: 14 files, 38912 bytes, `sha256:2c154ed4…`
  - [ ] document the package as the backup path
