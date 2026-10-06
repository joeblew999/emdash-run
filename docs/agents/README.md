# Agent guide — emdash-run

**What this repo is:** a way to develop and run every part of EmDash from any repo, built on the
official CLIs (`emdash`, `emdash-plugin`). It is a harness, not a product. Judge any change by
whether it makes the harness more reusable or more trustworthy.

## How it is built

- **`mise.toml`** — the project's settings, and nothing else. It is the only file that names a
  project.
- **`.config/mise/conf.d/harness.toml`** — the harness's mise config: tools, task names, daemons.
  mise loads it alongside `mise.toml`. A consumer repo never edits it; `mise run upgrade` replaces
  it together with `nu/`. So nothing project-specific may ever go in it, or in `nu/`.
- **`nu/`** — the logic, in nushell. `main.nu` has one command per task; `lib.nu`, `site.nu`,
  `plugin.nu`, `checks.nu` and `registry.nu` hold what they are made of; `tests.nu` tests the pure
  parts. Read [`nushell.md`](nushell.md) before editing any of it.
- **`config/`** — the project's site config and seed, copied over the template by `mise run dev`.
- **`.src/`** — gitignored checkouts: the template, the site, the EmDash source. **Never edit
  anything under `.src/`** — it is overwritten. Change `config/` or `nu/` and run `mise run dev`.

## Rules

- **A task is a flow.** One command does a whole job: `dev` applies config, builds the seed, loads
  plugins, restarts the site and mints a token. If a dev would have to remember two tasks, it is
  one task. The steps are functions in `nu/`, not tasks.
- **Use the tasks.** `mise tasks ls` is the list. For anything the official CLIs do, use the
  passthroughs: `mise run emdash -- …`, `mise run emdash-plugin -- …`.
- **Write logic once.** If two flows need it, it goes in `lib.nu`. No copied blocks.
- **Run it and read the output.** Reasoning about a change is not validation. After a change:
  `mise run dev`, then `mise run check`, and for anything user-facing look at the actual behaviour.
- **A check must be able to fail.** `check` plants known faults in a copy of the module and
  requires its own checkers to catch them. When you add a check, prove it fires.
- **Every task runs on every OS — macOS, Linux, Windows.** That is why this is mise and nushell.
  Use nushell's own commands: `request` (in `lib.nu`, over nushell's `http`) not curl; `glob`, `ls`,
  `cp`, `rm` not the programs; `start` to open a browser; `fnox get` for a secret; no `/dev/null`,
  no `sh -c`. The only programs the harness runs are the ones mise installs, plus git and docker —
  the `PORTABLE` list in `nu/checks.nu` — and `check` fails on any other. Do not say a platform
  works until `mise run verify` has run on it; CI runs it on all three.
- **CI is not a second system.** `.github/workflows/verify.yml` installs mise and runs
  `mise run verify` — the same command a dev runs locally. Never add a CI-only step.
- **No symlinks.** git writes the target path into a file on Windows. Copy instead; `check` fails
  on one.
- **Comments say what; docs say why.** A comment is a line or three. History goes in git.
- **Plugins are scaffolded, not hand-written:** `mise run plugin:new -- <name>`. See
  [`../plugin.md`](../plugin.md).
- **Releasing is a tag.** Bump `HARNESS_VERSION` in `harness.toml`, add a `## x.y.z` section to
  `CHANGELOG.md`, commit, then `git tag vx.y.z && git push origin main vx.y.z`. The `full
  verification` workflow runs everything on every OS and both platforms, runs the installers, and
  publishes the release with its tarball **only if all of it passes**. Never create a release by hand.
- **Plans live in `docs/plans/`** — read the active one before structural changes.

## The checks

| command | what it tells you |
|---|---|
| `mise run check` | the harness holds together: modules parse, tasks and commands agree, checkers catch planted faults, unit tests, formatting, generated docs, skills, plugins |
| `mise run check -- --site` | also type-checks the site (it restarts it) |
| `mise run doctor` | the **running** site matches the repo: database health, content, and the settings-driven cross-checks |
| `mise run doctor -- --url <url>` | the same for a deployment: core migrations, content model, content |
| `mise run verify` | does it work on this machine: site up, check, doctor — what CI runs on every OS. `--full` adds plugins, snapshot, build |
| `mise run verify:linux` | the same in a clean Linux container, from any host with docker |
| `mise run plugin:roundtrip` | plugin development works against this EmDash: scaffold, load, the site calls it, remove |

## Tools

- **MCP servers** (`.mcp.json`): `emdash` — content, schema, media, taxonomy on the running site,
  authenticated by the token `dev` mints; `playwright` — the admin UI in a real browser.
- **Playwright and the admin:** use `browser_run_code_unsafe` with
  `page.setViewportSize({ width: 1400, height: 4000 })`; the default window cannot scroll, so
  anything below the fold is unclickable. Sign in through
  `/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`. A saved-entry plugin panel loads through
  the host — `POST /_emdash/api/content/<collection>/<id>/plugin-extensions/<plugin-id>` — not
  through the plugin's own route.
- **EmDash skills** are vendored at `.github/skills/` (`building-emdash-site`, `creating-plugins`,
  `emdash-cli`) so they exist on a fresh clone. Read them before working on EmDash itself. `dev`
  refreshes them from the site; `check` fails if they drift.
- **mise skills are machine-level** (`~/.claude/skills/`), not this repo's.
