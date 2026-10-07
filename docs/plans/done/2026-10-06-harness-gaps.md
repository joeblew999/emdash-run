---
title: "Done · 2026-10-06 — Harness gaps found by running it"
nav_order: 13
parent: Plans
---

# 2026-10-06 — Harness gaps found by running it

**Status:** done — closed 2026-10-06, **5 of 5**

Found on 2026-10-06 by running every check and planting failures. The ones that were bugs are
already fixed (a failing build left the site down; `site:_pause` never paused; a stale
`EMDASH_TOKEN` made `repo:verify` read nothing). These are what is left.

## Items

- [x] **The seed merge has no tests.** `seed:build` is ~90 lines of merge rules in a task body; its
  vitest suite was deleted with `scripts/`.
  - [x] a fixture pair (template seed + project seed) and an expected output, checked by a task in `mise run check` — `seed:test`, over `tests/seed/`, running the same `seed:_merge` body `seed:build` uses
  - [x] prove it blocks: three faults planted one at a time (template loses a collection collision; content collision goes to the template; dependency order ignored) — each failed `seed:test`, and it passed again once restored
- [x] **`seed:build` still names this project.** Its hardcoded collection order and site-name suffix moved to settings; the whole seed merge was later deleted (0.6.0), when the site became the project's own.
- [x] **`usage` specs are checked by nothing.** — **wrong, and closed without a change.** `mise tasks validate` rejects a malformed spec and `repo:check` already runs it.
  - [x] planted one: `mise tasks validate` exits 1 and names the task. The doc that claimed otherwise is corrected
- [x] **`repo:verify` leaves temp files** — one `mktemp` per model, never removed — and crashes
  rather than reports if `curl` returns no status code.
  - [x] the manifest is read from curl's output, so nothing is written to disk, and a curl that cannot connect is reported as `<id> unreachable`. Verified on the passing path (5 of 5); the unreachable branch has not been exercised
- [x] **A fresh clone has never been proven.** `mise run setup` on a machine with nothing installed
  is the README's first promise.
  - [x] run it in a clean checkout and record the result here — **it could not work, and now does.**
    Every task defaulted to running in `.src/site`, which a fresh clone does not have, so mise
    failed to start the first task ("No such file or directory") before any body ran. The
    bootstrap, the repo's own checks and the skills tasks now run from the repo root, and `setup`
    runs its three steps in order. In a clean clone: `mise run setup`, `check` and `doctor` all
    exit 0, and the tree is left clean.
  - [x] found on the way: `skills add` links `.claude/skills/mise-guide` into `.agents/skills`, so a
    freshly set-up clone failed its own no-symlink check. The per-repo mise skill is gone — the mise
    skills are machine-level — and `skills:add` copies.

Caveat on "nothing installed": the clone was made on this machine, so mise's tools and pnpm's store
were already cached, and the Cloudflare credentials `doctor` needs were in fnox. A truly bare
machine is still unproven.
