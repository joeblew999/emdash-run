# 2026-10-06 — Other platforms, and what 0.1.0 left open

**Status:** active — **2 of 5 done**

0.1.0 is proven on macOS. These are what the first runs elsewhere found, and what nobody has run.

## Items

- [x] **`doctor` on Linux** — fixed in 0.2.0. The dev server listened on `[::1]` only, and on Linux `localhost` resolves to `127.0.0.1` first, so the emdash CLI was refused while curl worked. It binds `127.0.0.1` now.
  - [x] in a clean Debian arm64 container, from the published one-line installer: install, `status`, `check`, `doctor` exit 0
- [x] **Say what a bare Linux needs** — the README names `libatomic1` for minimal Debian; the container run installs exactly that
- [ ] **Windows** — the logic is nushell and nothing uses a symlink, but it has never been run there
  - [x] the one call known to be wrong there is gone: the symlink check used the `find` program, which on Windows is a text search. It uses nushell's `glob` now. No other POSIX-only program is called — what remains external is `git`, `curl`, `pnpm`, `mise`
  - [ ] `setup`, `dev`, `check`, `doctor` on a Windows machine; the unknowns are the daemon manager (pitchfork) and the local Workers runtime, not nushell
- [ ] **`snapshot` on the blog template** — fails locally with `TRANSFER_MEDIA_BLOB_MISSING`: the seed declares sample media whose files are not in local storage
  - [ ] work out whether the seed should fetch them or the export should skip them, and report upstream if it is EmDash's
- [ ] **Report the `emdash types` bug upstream** — written up in [`done/2026-10-05-emdash-cli-surface.md`](done/2026-10-05-emdash-cli-surface.md), ready to paste. A public post under the owner's account, so theirs to file
