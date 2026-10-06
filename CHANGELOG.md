# Changelog

## 0.3.0 — 2026-10-06

- **Not locked into Cloudflare.** The harness runs on the plain Node.js templates (`starter`,
  `blog`, …) as well as the `*-cloudflare` ones: a SQLite file and local uploads instead of D1 and
  R2. Same tasks. Sandboxed plugins work on both — under `workerd` on Node.js.
- **Windows works**, with macOS and Linux — proven by CI, which runs the same `mise run verify`
  a dev runs, on all three, on a Cloudflare template and a Node.js one.
- **Portable by construction.** The harness runs only programs mise installs: `curl`, `find`,
  `printenv`, `open` and friends are replaced by nushell's own commands, and `check` fails on any
  other program, on `/dev/null`, and on a Windows-unsafe glob.
- New: `mise run verify` (does it work on this machine), `verify:template -- <template>`,
  `verify:linux` (a clean container).
- `install.sh` takes a template: `… | sh -s -- starter`.

## 0.2.2 — 2026-10-06

- **`mise run report`** — when something breaks, it prints your OS, versions, status and the recent
  site log, ready to paste into an issue. There is an issue template for it.
- A Windows installer (`install.ps1`). It has not been run on Windows yet.

## 0.2.1 — 2026-10-06

- **Plugins work on a new project with no manual edits.** The harness switches on plugin loading
  in your site config when it creates it from a template. Run on `starter-cloudflare` and
  `blog-cloudflare`: `setup`, then `plugin:roundtrip`, both exit 0.
- Proven in a clean Linux container, starting from the published one-line installer: install,
  `status`, `check` and `doctor` all pass.

## 0.2.0 — 2026-10-06

- **One command to start:** `curl -fsSL https://raw.githubusercontent.com/joeblew999/emdash-run/main/install.sh | sh`
  fetches the harness, creates your settings, and runs `setup`.
- **`setup` finishes by checking the site** and tells you it is running, on what, and what to do next.
- **`mise run status`** — what is running, and on what, at a glance.
- **Linux: `doctor`, `content:set`, `schema:diff` and every CLI call now work.** The dev server
  listened on IPv6 only, and on Linux `localhost` resolves to IPv4 first, so the CLI was refused.
  It binds 127.0.0.1 now.

## 0.1.1 — 2026-10-06

- The no-symlinks check no longer calls the `find` program, which on Windows is a text search. It
  uses nushell's own file matching. No Unix-only program is called anywhere in the harness now.

## 0.1.0 — 2026-10-06

The first release meant for other repos. Everything below was run, not reasoned about.

### What you get

- **Flows, not steps.** 27 tasks, each one whole job: `setup`, `dev`, `check`, `doctor`, `deploy`,
  `rollback`, `snapshot`, `restore`, `reset`, `logs`, `open`, `upgrade`, the plugin flows,
  `content:set`, `schema:diff`, `seed:export`, `registry:up|down`, `source`, and passthroughs for
  the official CLIs (`mise run emdash -- …`, `emdash-plugin`, `skills`).
- **A project is 40 lines.** `mise.toml` holds only your settings. The harness is
  `.config/mise/conf.d/harness.toml` and `nu/`, and `mise run upgrade` replaces it.
- **Plugins, round trip.** `mise run plugin:new -- <name>` scaffolds with the official CLI, fits
  the scaffold to your site, loads it, and has the running site call it. `plugin:roundtrip` proves
  the toolchain with a throwaway plugin.
- **Deploy that verifies.** `deploy` refuses to ship when `check` fails, then checks what is live:
  core migrations, content model, content. `rollback` puts the previous version back.
- **Backup that restores.** `snapshot`, and `restore -- <package> --wipe --confirm`.
- **Checks that can fail.** `check` runs in about 4 seconds, and plants known faults in a copy of
  the harness to prove its own checkers catch them.

### Changed from before

- The logic moved out of `mise.toml` (2,582 lines, 130 tasks) into a nushell module with unit
  tests. `check` 10.8s → 4.4s.
- Renamed: `repo:apply` → `dev`; `repo:verify` and `check:deployed` → `doctor` / `doctor -- --url`;
  `site:reset` → `reset`; `site:deploy-dry` → `deploy -- --dry`; `site:check` → `check -- --site`;
  the daemon `emdash` → `site`.
- Removed: the 34 per-subcommand relay tasks (use the passthroughs), the registry web UI, the two
  example plugins, and the per-repo mise skill.

### Fixed

- `setup` could not work on a fresh clone.
- A failed build or type-check left the dev server stopped.
- A stale `EMDASH_TOKEN` or `EMDASH_REGISTRY_URL` in the shell silently broke every CLI call.
- Plugin discovery pointed at a local registry that is not part of the default flow.

### Known limits

- **`snapshot` fails on the blog template locally** with `TRANSFER_MEDIA_BLOB_MISSING`: its seed
  declares sample media whose files are not in local storage. `starter-cloudflare` is unaffected.
- **Targeting a deployment is a flag, not a variable**: `doctor -- --url <url>`, `snapshot -- --url`,
  `schema:diff -- --url`. An exported `EMDASH_URL` is ignored on purpose.
- **Windows is unproven.** The logic is nushell and nothing uses a symlink, but nobody has run it there.
- `plugin:dev` is a file watcher and was not exercised end to end.
