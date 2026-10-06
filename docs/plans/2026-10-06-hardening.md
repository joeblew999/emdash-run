# 2026-10-06 — Hardening: what the first releases showed is still soft

**Status:** active — **4 of 5 done**

Found while shipping 0.1.0 to 0.4.2. Each is something that worked on the day and can still bite.

## Items

- [x] **A push no longer runs the site matrix.** `verify.yml` runs `mise run check` on three OSes;
  the full matrix runs on a release tag (`full.yml`). Local runs are the evidence for everything else.
- [x] **No unbounded waits anywhere.** Every wait goes through `wait-for` (`nu/lib.nu`), which has a limit.
  - [x] `[daemons.registry]` has no `ready_http`; `registry:up` waits 120 seconds and fails with the registry's log
  - [x] `with-site-paused` waits up to 90 seconds for the site it restarted and warns if it is not answering
  - [ ] prove it: point the readiness URL at a dead port and confirm each flow fails within its limit, with the log
- [ ] **Why did the dev server stop answering?** After a plugin was loaded and Vite reloaded, `GET /` never came back on a macOS runner (once in three runs). The retry hides it; the cause is unknown.
  - [ ] reproduce locally by looping `plugin:roundtrip`; capture the site log when it happens
  - [ ] report upstream (Astro or EmDash) if it reproduces
- [x] **Duplicate media rows on every `dev`** — `dev` applies the seed through the CLI only when the seed has changed since it was last applied to that database (a hash in `run/seed-applied.txt`; `reset` clears it). An unchanged seed adds nothing, and no longer overwrites edits made in the admin. A *changed* seed with images still adds one duplicate row per image until [emdash#3919](https://github.com/emdash-cms/emdash/issues/3919) is fixed.
  - [x] run twice locally: the second `dev` prints "seed unchanged since it was last applied"
- [x] **`verify:template` leaves a temp directory behind on Windows** — each run removes earlier runs' directories first, best effort.
