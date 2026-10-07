---
title: "Done · 2026-10-06 — What this repo is for — develop and run EmDash from any r"
nav_order: 19
parent: Plans
---

# 2026-10-06 — What this repo is for: develop and run EmDash from any repo

**Status:** done — closed 2026-10-06, **6 of 6**. Platform leftovers moved to
[`platforms`](2026-10-06-platforms.md).

The goal: a known-good way to develop and run every part of EmDash from any repo, built on the
official CLIs, so nobody re-derives the plumbing.

## Items

- [x] **Plugin round trip, with the official tools** — `mise run plugin:new -- <name>` scaffolds
  (`emdash-plugin init`), fits the scaffold to the site, installs, validates, typechecks, tests,
  builds, registers, restarts the site, and has the **running site** call the plugin.
  `plugin:roundtrip` does it with a throwaway plugin and removes it.
- [x] **The checkers are proven able to fail** — `check` plants a `&&`, an undefined variable,
  `problem(s)` and a task that runs a missing command in a copy of the harness, and requires its
  own checkers to reject each.
- [x] **How another repo gets the harness: through mise.** Everyone here uses mise, and mise loads
  `.config/mise/conf.d/*.toml` beside `mise.toml`. So a project owns `mise.toml` (settings, 40
  lines) and `config/`; the harness is `.config/mise/conf.d/harness.toml` and `nu/`, shipped as a
  release tarball and replaced by `mise run upgrade`. Copying one 2,500-line file was the
  alternative, and it could not be updated.
  - [x] the README's four adoption commands, run in an empty repo from the tarball: 27 tasks, `check` passes
  - [x] `mise run upgrade -- --from <repo>` replaced the harness in a second project and changed nothing of the project's
- [x] **Proven on a second project** — a fresh repo, the `blog-cloudflare` template, no seed, no
  doctor settings: `setup`, `check`, `doctor`, `plugin:roundtrip`, `deploy --dry` and `upgrade` all
  exit 0. It found three faults, all fixed:
  - the seed merge dropped every top-level key it had no rule for — the blog seed's `bylines` — so the merged seed failed validation
  - settings the project left out were inherited from the shell that ran the task: it built its site with another project's seed
  - the generated plugin module failed the site's type-check when empty
  - edits needed outside settings: three lines in the project's own `config/` to enable plugins, which `plugin:new` now names when they are missing
- [x] **The first project is out of the harness** — what the site config imports
  (`SITE_PACKAGES`), the R2 object key and field map `doctor` compares (`VERIFY_OBJECT_KEY`,
  `VERIFY_SNAPSHOT_MAP`), the seed (`SEED_FILE`, optional). Every `doctor` check is skipped when
  its setting is empty. `nu/` and `harness.toml` name no project.
- [x] **Fresh setup on a bare machine** — a clean Debian container with nothing but curl and git:
  `mise install`, then `setup`, `check` and `plugin:roundtrip` exit 0. `doctor` does not — its
  content read fails there. That, and the one system package Node needed, are in
  [`platforms`](2026-10-06-platforms.md).
