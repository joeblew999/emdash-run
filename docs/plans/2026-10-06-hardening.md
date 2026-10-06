# 2026-10-06 — Hardening: what the first releases showed is still soft

**Status:** active — **1 of 5 done**

Found while shipping 0.1.0 to 0.4.2. Each is something that worked on the day and can still bite.

## Items

- [x] **A push no longer runs the site matrix.** `verify.yml` runs `mise run check` on three OSes;
  the full matrix runs on a release tag (`full.yml`). Local runs are the evidence for everything else.
- [ ] **No unbounded waits anywhere.** The site daemon's readiness wait hung a release run; it is bounded now (`restart` in `nu/site.nu`). The same shape remains:
  - [ ] `[daemons.registry]` still has a `ready_http` with no limit — `registry:up` can hang the same way. Remove it and wait in `main registry up` with a limit and the log on failure
  - [ ] `with-site-paused` (`nu/lib.nu`) starts the site and returns without knowing it answers; the next flow finds out. Decide whether it should wait, bounded
  - [ ] prove it: point the readiness URL at a dead port and confirm each flow fails within its limit, with the log
- [ ] **Why did the dev server stop answering?** After a plugin was loaded and Vite reloaded, `GET /` never came back on a macOS runner (once in three runs). The retry hides it; the cause is unknown.
  - [ ] reproduce locally by looping `plugin:roundtrip`; capture the site log when it happens
  - [ ] report upstream (Astro or EmDash) if it reproduces
- [ ] **Duplicate media rows on every `dev`** for a seed with images, until [emdash#3919](https://github.com/emdash-cms/emdash/issues/3919) is fixed.
  - [ ] decide whether `dev` should skip the CLI seed pass when the seed file has not changed since the last run (a hash in `run/`) — that removes the growth without waiting for upstream
- [ ] **`verify:template` leaves a temp directory behind on Windows** when the stopped site still holds files. Harmless, but it accumulates.
  - [ ] clean up previous runs' directories at the start of the next one, best effort
