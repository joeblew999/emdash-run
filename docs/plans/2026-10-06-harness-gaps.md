# 2026-10-06 — Harness gaps found by running it

**Status:** active — **4 of 5 done**

Found on 2026-10-06 by running every check and planting failures. The ones that were bugs are
already fixed (a failing build left the site down; `site:_pause` never paused; a stale
`EMDASH_TOKEN` made `repo:verify` read nothing). These are what is left.

## Items

- [x] **The seed merge has no tests.** `seed:build` is ~90 lines of merge rules in a task body; its
  vitest suite was deleted with `scripts/`.
  - [x] a fixture pair (template seed + project seed) and an expected output, checked by a task in `mise run check` — `seed:test`, over `tests/seed/`, running the same `seed:_merge` body `seed:build` uses
  - [x] prove it blocks: three faults planted one at a time (template loses a collection collision; content collision goes to the template; dependency order ignored) — each failed `seed:test`, and it passed again once restored
- [x] **`seed:build` still names this project.** `dep_order = ["projects" "assemblies" "parts"]` and
  the `+ CAD` site-name suffix are hardcoded, against the rule that only PROJECT SETTINGS names a site.
  - [x] move both into the PROJECT SETTINGS block — `SEED_ORDER` and `SEED_LABEL`; the real merged seed is byte-identical before and after
- [x] **`usage` specs are checked by nothing.** — **wrong, and closed without a change.** `mise tasks validate` rejects a malformed spec and `repo:check` already runs it.
  - [x] planted one: `mise tasks validate` exits 1 and names the task. The doc that claimed otherwise is corrected
- [x] **`repo:verify` leaves temp files** — one `mktemp` per model, never removed — and crashes
  rather than reports if `curl` returns no status code.
  - [x] the manifest is read from curl's output, so nothing is written to disk, and a curl that cannot connect is reported as `<id> unreachable`. Verified on the passing path (5 of 5); the unreachable branch has not been exercised
- [ ] **A fresh clone has never been proven.** `mise run setup` on a machine with nothing installed
  is the README's first promise.
  - [ ] run it in a clean checkout and record the result here
