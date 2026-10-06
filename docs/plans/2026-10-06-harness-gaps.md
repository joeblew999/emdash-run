# 2026-10-06 — Harness gaps found by running it

**Status:** active — **0 of 5 done**

Found on 2026-10-06 by running every check and planting failures. The ones that were bugs are
already fixed (a failing build left the site down; `site:_pause` never paused; a stale
`EMDASH_TOKEN` made `repo:verify` read nothing). These are what is left.

## Items

- [ ] **The seed merge has no tests.** `seed:build` is ~90 lines of merge rules in a task body; its
  vitest suite was deleted with `scripts/`.
  - [ ] a fixture pair (template seed + project seed) and an expected output, checked by a task in `mise run check`
  - [ ] prove it blocks: flip the collision rule and watch it fail
- [ ] **`seed:build` still names this project.** `dep_order = ["projects" "assemblies" "parts"]` and
  the `+ CAD` site-name suffix are hardcoded, against the rule that only PROJECT SETTINGS names a site.
  - [ ] move both into the PROJECT SETTINGS block
- [ ] **`usage` specs are checked by nothing.** mise validates one only when the task is invoked.
  - [ ] a check that invokes each task that declares `usage` with `--help` and fails on a malformed spec
- [ ] **`repo:verify` leaves temp files** — one `mktemp` per model, never removed — and crashes
  rather than reports if `curl` returns no status code.
  - [ ] clean up, and report an unreachable R2 as a failed check
- [ ] **A fresh clone has never been proven.** `mise run setup` on a machine with nothing installed
  is the README's first promise.
  - [ ] run it in a clean checkout and record the result here
