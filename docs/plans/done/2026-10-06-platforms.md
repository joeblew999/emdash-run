---
title: "Done · 2026-10-06 — Other platforms, and what 0.1.0 left open"
nav_order: 18
parent: Plans
nav_exclude: true
---

# 2026-10-06 — Other platforms, and what 0.1.0 left open

**Status:** done — closed 2026-10-06, **7 of 7**

0.1.0 was proven on macOS only. This plan took it to every OS and both platforms; all of it is now checked by CI on every push and before every release.

## Items

- [x] **`doctor` on Linux** — fixed in 0.2.0. The dev server listened on `[::1]` only, and on Linux `localhost` resolves to `127.0.0.1` first, so the emdash CLI was refused while curl worked. It binds `127.0.0.1` now.
  - [x] in a clean Debian arm64 container, from the published one-line installer (0.2.2): install, `status`, `check`, `doctor`, `plugin:roundtrip`, `snapshot`, `deploy --dry` and `report` all exit 0
- [x] **Say what a bare Linux needs** — the README names `libatomic1` for minimal Debian; the container run installs exactly that
- [x] **Windows** — works. CI runs `mise run verify` on `windows-latest`: the toolchain installs, the site builds, starts and seeds, `check` and `doctor` pass.
  - [x] what it took: no program that is not on every OS (`curl`, `find`, `printenv`, `open` → nushell's own), and glob patterns built with forward slashes — `path join` gives backslashes, which a glob reads as escapes
  - [x] `check` now fails on any of those, so it cannot regress unseen
- [x] **The installers** — `install.sh` and `install.ps1` run in an empty folder on all three OSes, for the Cloudflare and the Node.js template, in the `full verification` workflow
- [x] **Not only Cloudflare** — the Node.js templates work: `mise run verify:template -- starter --full` passes (site, checks, doctor, a sandboxed plugin under `workerd`, snapshot, build). CI runs it on every OS
- [x] **`snapshot` on the blog template** — fixed in 0.4.1. `emdash seed` always writes `$media` files to `./uploads`; a Cloudflare site reads local R2, so the rows had no file behind them and the export refused. `dev` moves the files into local R2.
  - [x] reproduced and fixed in a throwaway `blog-cloudflare` project: `dev`, then `snapshot`, exits 0 and the images serve 200
  - [x] upstream: `emdash seed` forces `$media` into local files whatever the site's storage, and under `--on-conflict=update` inserts a new media row on every run — confirmed in EmDash's source (`cli/commands/seed.ts:202-209`, `seed/apply.ts:309`, `2381-2399`) and filed as [emdash-cms/emdash#3919](https://github.com/emdash-cms/emdash/issues/3919). Until it is fixed, each `dev` on a seed with images adds duplicate media rows
- [x] **Report the `emdash types` bug upstream** — reproduced (15 compile errors from the generated file), still present on EmDash's `main`, filed as [emdash-cms/emdash#3918](https://github.com/emdash-cms/emdash/issues/3918). The bad import is emitted at `packages/core/src/astro/routes/api/schema/index.ts:60`
