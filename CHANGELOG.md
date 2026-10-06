# Changelog

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

### Not proven

- A machine with nothing installed: `setup` is proven on a fresh clone, on a machine that already
  had the tools cached.
- Windows.
- `logs -- --deployed` and `plugin:dev` are long-running and were not exercised end to end.
