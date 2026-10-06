# Agent guide — emdash-run

**What this repo is:** a way to develop and run every part of EmDash from any repo, built on the
official CLIs (`emdash`, `emdash-plugin`). It is a harness, not a product. Judge any change by
whether it makes the harness more reusable or more trustworthy.

**Read [`lessons.md`](lessons.md) first.** It is what a day of getting this wrong taught us, and
which of those lessons a check now enforces.

## How it is built

- **`mise.toml`** — the project's settings, and nothing else. It is the only file that names a
  project.
- **`.config/mise/conf.d/harness.toml`** — the harness's mise config: tools, task names, daemons.
  mise loads it alongside `mise.toml`. A consumer repo never edits it; `mise run upgrade` replaces
  it together with `nu/`. So nothing project-specific may ever go in it, or in `nu/`.
- **`nu/`** — the logic, in nushell. `main.nu` has one command per task; `lib.nu`, `site.nu`,
  `plugin.nu` and `checks.nu` hold what they are made of; `task.nu` hands a task its
  arguments; `tests.nu` tests the pure parts. Read [`nushell.md`](nushell.md) before editing any of it.
- **`site/`** — the project's own site: pages, config, seed. `setup` creates it once from the
  template; the harness never overwrites it. It is where a real site is built.
- **`.src/`** — gitignored reference checkouts: the templates, the EmDash source, EmDash's own
  site (`mise run source -- <name>`). Read them; nothing runs from there.

## Rules

- **A task is a flow.** One command does a whole job: `dev` applies config, builds the seed, loads
  plugins, restarts the site when it has to, applies the seed and mints a token. If a dev would have to remember two tasks, it is
  one task. The steps are functions in `nu/`, not tasks.
- **Use the tasks.** `mise tasks ls` is the list. For anything the official CLIs do, use the
  passthroughs: `mise run emdash -- …`, `mise run emdash-plugin -- …`.
- **Write logic once.** If two flows need it, it goes in `lib.nu`. No copied blocks.
- **Run it and read the output.** Reasoning about a change is not validation. After a change:
  `mise run dev`, then `mise run check`, and for anything user-facing look at the actual behaviour.
- **A check must be able to fail.** `check` plants known faults in a copy of the module and
  requires its own checkers to catch them. When you add a check, prove it fires.
- **Every task runs on every OS — macOS, Linux, Windows.** That is why this is mise and nushell.
  Use nushell's own commands: `request` (in `lib.nu`, over nushell's `http`) not curl; `files-in`
  (in `lib.nu`, over nushell's `glob`), `ls`, `cp`, `rm` not the programs; `start` to open a
  browser; no `/dev/null`, no `sh -c`. The only programs
  the harness runs are the ones mise installs, the site's own `emdash`, plus git and docker — the
  `PORTABLE` list in `nu/checks.nu` — and `check` fails on any other. Do not say a platform
  works until `mise run verify` has run on it; CI runs it on all three.
- **CI is not a second system, and not the test loop.** Verify locally. A push runs only
  `mise run check` on the three OSes; a tag publishes; the full matrix is manual. Push once per
  finished piece of work, and never add a CI-only step.
- **No symlinks.** git writes the target path into a file on Windows. Copy instead; `check` fails
  on one.
- **Comments say what; docs say why.** A comment is a line or three. History goes in git.
- **Plugins are scaffolded, not hand-written:** `mise run plugin:new -- <name>`. See
  [`../plugin.md`](../plugin.md).
- **Releasing is a tag, and it is fast.** Bump `HARNESS_VERSION` in `harness.toml`, add a
  `## x.y.z` section to `CHANGELOG.md`, commit, `git tag vx.y.z && git push origin main vx.y.z`. The
  `release` workflow runs `mise run check` and publishes the tarball — about a minute. Verify
  locally first (`mise run verify -- --full`). Run the slow `full verification` workflow by hand
  only when the cross-platform layer changed. Never create a release by hand, and never tag to test.
- **Plans live in `docs/plans/`** — read the active one before structural changes.

## The checks

| command | what it tells you |
|---|---|
| `mise run check` | the harness holds together: modules parse, tasks and commands agree, checkers catch planted faults, task arguments arrive, unit tests, formatting, generated docs, no symlinks, plugins |
| `mise run check -- --site` | also type-checks the site — a running site is not touched |
| `mise run doctor` | the **running** site matches the repo: database health, plugins, content, and the settings-driven cross-checks |
| `mise run doctor -- --url <url>` | the same for a deployment: core migrations (Cloudflare), content model, content |
| `mise run verify` | does it work on this machine: site up, check, doctor — what CI runs on every OS. `--full` adds plugins, snapshot, build |
| `mise run verify:linux` | `verify -- --full` in a clean Linux container, from any host with docker |
| `mise run plugin:roundtrip` | plugin development works against this EmDash: scaffold, load, the site calls it, remove |

## Tools

- **MCP servers:** `emdash` (`.mcp.json`) — content, schema, media, taxonomy on the running site,
  authenticated by the token `dev` mints.
- **A browser:** Playwright, configured once per machine (user scope) as headless and isolated, so
  several agents can each drive their own browser without fighting over one window:
  `claude mcp add --scope user playwright -- mise exec node@24 -- npx -y @playwright/mcp@latest --headless --isolated`.
  Prefer `curl` for "is it server-rendered" proofs; use the browser for the admin UI. Sign in
  through `/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`. Set a tall viewport
  (`page.setViewportSize({ width: 1400, height: 4000 })`) before clicking below the fold. A
  saved-entry plugin panel loads through the host —
  `POST /_emdash/api/content/<collection>/<id>/plugin-extensions/<plugin-id>`.
- **EmDash skills** are vendored at `.github/skills/` (`building-emdash-site`, `creating-plugins`,
  `emdash-cli`) so they exist on a fresh clone. Read them before working on EmDash itself. `dev`
  refreshes them from EmDash's source at the version the site is pinned to (`.src/emdash/skills`) —
  not from the template's copy in `site/`, which stays at whatever the template was synced from.
  Nothing checks them: after an EmDash upgrade, commit what `dev` changed there.
- **mise skills are machine-level** (`~/.claude/skills/`), not this repo's.
