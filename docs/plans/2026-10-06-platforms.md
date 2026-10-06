# 2026-10-06 — Other platforms, and what 0.1.0 left open

**Status:** active — **4 of 6 done**

0.1.0 is proven on macOS. These are what the first runs elsewhere found, and what nobody has run.

## Items

- [x] **`doctor` on Linux** — fixed in 0.2.0. The dev server listened on `[::1]` only, and on Linux `localhost` resolves to `127.0.0.1` first, so the emdash CLI was refused while curl worked. It binds `127.0.0.1` now.
  - [x] in a clean Debian arm64 container, from the published one-line installer (0.2.2): install, `status`, `check`, `doctor`, `plugin:roundtrip`, `snapshot`, `deploy --dry` and `report` all exit 0
- [x] **Say what a bare Linux needs** — the README names `libatomic1` for minimal Debian; the container run installs exactly that
- [x] **Windows** — works. CI runs `mise run verify` on `windows-latest`: the toolchain installs, the site builds, starts and seeds, `check` and `doctor` pass.
  - [x] what it took: no program that is not on every OS (`curl`, `find`, `printenv`, `open` → nushell's own), and glob patterns built with forward slashes — `path join` gives backslashes, which a glob reads as escapes
  - [x] `check` now fails on any of those, so it cannot regress unseen
- [x] **Not only Cloudflare** — the Node.js templates work: `mise run verify:template -- starter --full` passes (site, checks, doctor, a sandboxed plugin under `workerd`, snapshot, build). CI runs it on every OS
- [ ] **`snapshot` on the blog template** — fails locally with `TRANSFER_MEDIA_BLOB_MISSING`: the seed declares sample media whose files are not in local storage
  - [ ] work out whether the seed should fetch them or the export should skip them, and report upstream if it is EmDash's
- [ ] **Report the `emdash types` bug upstream** — written up in [`done/2026-10-05-emdash-cli-surface.md`](done/2026-10-05-emdash-cli-surface.md), ready to paste. A public post under the owner's account, so theirs to file
