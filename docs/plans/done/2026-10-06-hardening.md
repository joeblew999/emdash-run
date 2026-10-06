# 2026-10-06 — Hardening: what the first releases showed is still soft

**Status:** done — closed 2026-10-06, **5 of 5**

Found while shipping 0.1.0 to 0.4.2. Each is something that worked on the day and can still bite.

## Items

- [x] **A push no longer runs the site matrix.** `verify.yml` runs `mise run check` on three OSes;
  the full matrix runs on a release tag (`full.yml`). Local runs are the evidence for everything else.
- [x] **No unbounded waits anywhere.** Every wait goes through `wait-for` (`nu/lib.nu`), which has a limit.
  - [x] `[daemons.registry]` has no `ready_http`; `registry:up` waits 120 seconds and fails with the registry's log
  - [x] `with-site-paused` waits up to 90 seconds for the site it restarted and warns if it is not answering
  - [x] proven in `nu/tests.nu`: `wait-for` on a dead port returns false within its limit, and a request to it reports status 0 instead of throwing
- [x] **Why did the dev server stop answering?** — it had not. We were starving it. A cold dev server takes many seconds to answer its first request after a plugin load; the readiness probe asked every second with a 2-second timeout, abandoning each request while the server was still compiling it and piling on the next. Reproduced locally under load (`GET /` answered in 4 seconds to a patient client while the harness sat "waiting").
  - [x] `wait-for` and `restart` now make one patient request at a time (30 seconds, and 5 minutes for the setup call), never overlapping
  - [x] `mise run verify -- --full --restore` passes locally, 121 seconds, with the machine under load
- [x] **Duplicate media rows on every `dev`** — `dev` applies the seed through the CLI only when the seed has changed since it was last applied to that database (a hash in `run/seed-applied.txt`; `reset` clears it). An unchanged seed adds nothing, and no longer overwrites edits made in the admin. A *changed* seed with images still adds one duplicate row per image until [emdash#3919](https://github.com/emdash-cms/emdash/issues/3919) is fixed.
  - [x] run twice locally: the second `dev` prints "seed unchanged since it was last applied"
- [x] **`verify:template` leaves a temp directory behind on Windows** — each run removes earlier runs' directories first, best effort.
