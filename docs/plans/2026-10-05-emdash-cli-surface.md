# 2026-10-05 — Use more of the emdash CLI

**Status:** active — **0 of 4 done**

We call exactly **one** subcommand of the site's CLI: `seed --validate`. The others do things
this repo currently does by hand, or not at all.

## Items

- [ ] **`emdash doctor` → `site:doctor`** — database health, scheduler wiring, diagnostics
  - [ ] `site:doctor` task
  - [ ] reports a healthy local site
  - [ ] fails loudly when something is wrong (prove it by breaking something)
- [ ] **`emdash types` → generated schema types** — `geometry_meta` is `Record<string, unknown>` today
  - [ ] generate types from the live schema
  - [ ] the panel uses them — no `unknown` casts left
- [ ] **`emdash migrate` → understand production migrations** — locally we rely on dev-bypass auto-migrating
  - [ ] find out what deployment-managed migrations mean for production
  - [ ] write it down *before* the next schema change
  - [ ] exercise it once
- [ ] **`emdash site export|import` → a whole-site package**
  - [ ] export the local site once
  - [ ] document the package as the backup path
