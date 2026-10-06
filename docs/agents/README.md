# Agent guide — emdash-run

**What this repo is:** the thinnest thing that lets any repo develop and run EmDash through `mise`.
EmDash already ships the tooling. This repo adds a task only where EmDash has a gap that has been
proven by running EmDash's own command first.

## EmDash first — read this before you touch anything

On 2026-10-06 a full day and about 1,200 lines of code were spent wrapping and rebuilding things
EmDash already does, by an agent that had never read EmDash's skills, did not know how many CLIs it
ships, and built a site's languages by hand while a guide and a plugin for it existed. These rules
exist so that does not happen again. They come before every other rule in this file.

1. **Know what EmDash ships before you build.** Three command-line programs, and nothing here may
   duplicate them:

   | program | what it is for | run it here as |
   |---|---|---|
   | `create-emdash` | scaffold a project: `--template blog\|starter\|marketing\|portfolio`, `--platform node\|cloudflare`, `--pm`, `--sandboxed-plugins`, `--yes` | `pnpm dlx create-emdash@<version> --help` |
   | `emdash` (alias `em`) | everything on a site: `content`, `schema`, `media`, `taxonomy`, `menu`, `search`, `types`, `seed`, `export-seed`, `site export\|import`, `migrate`, `doctor`, `secrets`, `login` | `mise run emdash -- <command>` |
   | `emdash-plugin` | plugins: `init`, `validate`, `build`, `dev`, `bundle`, `publish`, `search`, `info`, `release setup` | `mise run emdash-plugin -- <command>` |

   Run `--help` on the command you are about to wrap. If it has the option, use it.

2. **Read the skill for the area before working in it.** EmDash writes them for agents; they are in
   this repo at `.github/skills/`:
   - `emdash-cli/` — the CLI, sign-in, the editing flow, site export and import
   - `building-emdash-site/` — config, schema and seed, querying, rendering, site features
   - `creating-plugins/` — plugins, capabilities, hooks, testing, publishing

   Then the guide: `mise run source` puts EmDash's docs at `.src/emdash/docs/src/content/docs/` —
   23 guides, 10 deployment pages. `guides/internationalization.mdx` and
   `deployment/schema-evolution.mdx` are two that the harness contradicted because nobody read them.

3. **Search the registry before building a feature into a site:**
   `mise run emdash-plugin -- search <words>`.

4. **A harness task needs a proven gap.** Before adding or keeping a task, run the official command
   for that job on a real site and write down what it could not do. "It would be convenient" is not
   a gap. A task that is one official command with a wrapper around it gets deleted.

5. **Who owns what — EmDash's rule, not ours.** The live database owns the content *and* the
   content model. The repo owns the code. The seed only makes a *fresh* database. People change a
   site in the admin by their role; agents change the same things through the CLI or MCP. See
   `deployment/schema-evolution.mdx` before doing anything that moves a model or content between
   the repo and a site.

6. **Say only what you ran.** "Works" means you ran the real thing and read its output — name the
   command. A test of a mechanism is not the feature working; say which one you ran. If you have
   not run it, say "not run".

### What EmDash does with one command — run on 2026-10-06, EmDash 1.1.0, macOS

A project made by `create-emdash`, started with `pnpm dev`, nothing from this repo involved. Every
row exited 0.

| job | official command | time |
|---|---|---|
| make a project, installed | `pnpm dlx create-emdash@1.1.0 site --template cloudflare:blog --pm pnpm --install --yes` | 39s |
| start it; migrate, seed, sign in | `pnpm dev`, then open `/_emdash/api/setup/dev-bypass` | 17s |
| use the CLI locally with no token | `emdash whoami` → "Client will use dev bypass for localhost" | 1s |
| read the model, list content, media, menus | `emdash schema list`, `content list posts`, `media list`, `menu list` | ≤1s each |
| change the model | `emdash schema add-field posts subtitle --type string --label Subtitle` | 1s |
| types from the running site | `emdash types` | 1s |
| the live model back into the repo | `emdash export-seed --database <file> > seed/seed.json` | 1s |
| the whole site as a package | `emdash site export --output site.emdash` | 1s |
| database health | `emdash doctor -d <file>` | 1s |

Not seen in that run: the dev server rewriting `emdash-env.d.ts` after the field was added (the
skill says it does; it had not within a second).

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

- **A task is a flow — and only where EmDash has none.** One command for a whole job that EmDash's
  own commands do not cover (see *EmDash first*, rule 4). The steps are functions in `nu/`, not tasks.
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
- **EmDash skills** are vendored at `.github/skills/` so they exist on a fresh clone — *EmDash
  first*, rule 2, says when to read them. `dev` refreshes them from EmDash's source at the version the site is pinned to (`.src/emdash/skills`) —
  not from the template's copy in `site/`, which stays at whatever the template was synced from.
  Nothing checks them: after an EmDash upgrade, commit what `dev` changed there.
- **mise skills are machine-level** (`~/.claude/skills/`), not this repo's.
