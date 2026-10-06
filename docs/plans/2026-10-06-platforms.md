# 2026-10-06 — Other platforms, and what 0.1.0 left open

**Status:** active — **0 of 5 done**

0.1.0 is proven on macOS. These are what the first runs elsewhere found, and what nobody has run.

## Items

- [ ] **`doctor` on Linux** — in a clean Debian arm64 container, `setup`, `check` and
  `plugin:roundtrip` pass, but `doctor` fails: `emdash content list parts --json` returns
  `ERROR fetch failed` while `curl` to the same site answers 200.
  - [ ] find the cause — the dev server binds IPv6 only, and the CLI's `localhost` may resolve to IPv4 first there
  - [ ] `doctor` exits 0 in the container
- [ ] **Say what a bare Linux needs** — Node from mise would not start on `debian:stable-slim` without `libatomic1`
  - [ ] a "prerequisites" line in the README, checked by running the container from it
- [ ] **Windows** — the logic is nushell and nothing uses a symlink, but it has never been run there
  - [x] the one call known to be wrong there is gone: the symlink check used the `find` program, which on Windows is a text search. It uses nushell's `glob` now. No other POSIX-only program is called — what remains external is `git`, `curl`, `pnpm`, `mise`
  - [ ] `setup`, `dev`, `check`, `doctor` on a Windows machine; the unknowns are the daemon manager (pitchfork) and the local Workers runtime, not nushell
- [ ] **`snapshot` on the blog template** — fails locally with `TRANSFER_MEDIA_BLOB_MISSING`: the seed declares sample media whose files are not in local storage
  - [ ] work out whether the seed should fetch them or the export should skip them, and report upstream if it is EmDash's
- [ ] **Report the `emdash types` bug upstream** — written up in [`done/2026-10-05-emdash-cli-surface.md`](done/2026-10-05-emdash-cli-surface.md), ready to paste. A public post under the owner's account, so theirs to file
