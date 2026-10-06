# Changelog

## 0.6.0 — 2026-10-06

- **Your site is yours: `site/`.** `setup` creates it once from the template and the harness never
  overwrites it again. Build there — pages, layouts, components, `astro.config.mjs`, the seed —
  and the dev server reloads your edits. Before this the site was a throwaway copy under `.src/`
  with two config files laid over it, which was enough to try EmDash and not enough to build on it.
- **Gone with the overlay:** `config/`, the seed merge and its `SEED_*` settings, `SITE_PACKAGES`
  (add dependencies to `site/package.json`), and `reset -- --site/--all` (`reset` wipes local data;
  it never touches your site).
- **`doctor` is simpler.** It checks that the site answers and that the collection named in
  `VERIFY_COLLECTION` has entries carrying data. The R2 cross-check and its five settings, written
  for one old project, are gone.
- **Coming from 0.5.0 or earlier:** move `.src/site` to `site/` (leave out `node_modules`,
  `.wrangler` and `dist`), delete `config/`, remove the `SEED_*` and `SITE_PACKAGES` lines from
  `mise.toml`, then `mise run setup`.

## 0.5.0 — 2026-10-06

- **Upgrading EmDash is one line and one command.** Change `EMDASH_VERSION`, run `mise run dev`:
  it copies the local database to `run/backups/`, re-pins and installs in place, re-pins your
  plugins, and carries on. The plugin CLI, plugin-test and the Node sandbox runner versions are
  derived from the EmDash release — there is nothing else to keep in step.
- **One setup call instead of five requests.** EmDash's own `dev-bypass` migrates, seeds through the
  site's storage and returns the admin token; the harness now just makes that call.
- **`restore -- <package> --wipe --confirm` works** — the wiped site comes up empty, as an import
  requires. `verify -- --restore` proves the round trip.
- **Seeded images work on every template**, and an unchanged seed is no longer re-applied on each
  `dev` (which overwrote admin edits and duplicated media).
- **A cold dev server is no longer starved.** Readiness probes are patient and never overlap; that
  was the "hang" that blocked 0.4.0 and 0.4.2.
- **`doctor --url` fails on a pending migration** (`emdash migrate --check`); `rollback` says that it
  does not undo migrations.
- **An encryption key from the start.** `dev` generates `EMDASH_ENCRYPTION_KEY` into your gitignored
  `.env` and the site reads it; `deploy` refuses a Worker that has none.
- **A new project stays on the free plan's defaults.** The Worker Loader binding (Workers Paid plan)
  is switched on by your first `plugin:new`, which says so — not by `setup`.
- A seed's `redirects`, `sections`, `blockTypes`, `relations`, `bylines`, `menus` and `widgetAreas`
  are merged from both seeds.
- Leaner: the task shape is declared once; about 100 lines of repeats and dead branches removed.
- A push runs only `mise run check` on three OSes; the full matrix runs on a release tag.
- `mise run source -- emdashcms.com` clones EmDash's own production site as a reference, beside the
  templates and the EmDash source; `status` lists the reference checkouts.
- New docs: `docs/emdash.md` (EmDash, read from its source), `docs/emdashcms-com.md` (what a
  production EmDash site does that no template shows) and `docs/agents/lessons.md`.

## 0.4.2 — 2026-10-06

- **A site that will not answer can no longer hang a flow.** Starting the dev server waited on its
  readiness check with no time limit; a release run sat for fifteen minutes on it. `dev` now waits
  90 seconds, restarts once, and then fails showing the site's log.
- **Two checks that could not fail now can**: the task-definition check swallowed its exit code,
  and the portability rule missed programs called without `^`. `check` plants both faults on itself.
- `--url` handling is simpler: the EmDash CLI reads `EMDASH_URL` itself.
- Comments and `docs/auth.md` corrected against EmDash's source.

## 0.4.1 — 2026-10-06

- **Seeded images work on Cloudflare templates.** `emdash seed` writes a seed's media to `./uploads`,
  which a Cloudflare site never reads, so on `blog-cloudflare` every seeded image was broken locally
  and `snapshot` failed. `dev` now moves them into local R2. Known and upstream: each `dev` still
  adds duplicate media rows for a seed that has images.
- **`upgrade` takes the latest release** (not `main`) and runs `check` afterwards, as it claimed to.
- **`rollback` refuses to run without a `DEPLOY_URL`** instead of verifying the local site.
- The linters and the skills CLI run through `pnpm dlx`: mise installs five tools, not nine.
- Docs audited line by line against the code and corrected.

## 0.4.0 — 2026-10-06

- **Releases are gated by full verification.** Tagging a version runs 12 verification jobs — every OS, Cloudflare
  and Node.js, the whole dev loop including a plugin round trip, a snapshot and a production build,
  plus the installers in an empty folder — and the release is published only if all pass.
- **The installers are proven**, `install.ps1` on Windows included, for both the Cloudflare and the
  Node.js template.
- **Plugins on Windows.** The plugin CLI is run through `pnpm dlx`, as EmDash's docs do; installed
  as a mise tool it could not load its own dependencies on Windows. One fewer tool to install.

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
- **Task arguments work on Windows.** mise does not append a task's arguments to its command there,
  so `plugin:new -- demo` arrived with no `demo`. Every task now receives them through mise's
  `usage` mechanism, which behaves the same on all three OSes — and `check` sends spaces, JSON,
  a quote and a flag through and requires them back intact.
- **CI answers fast.** `check` runs alone per OS (about 10–30 seconds); the site verifications run
  in parallel beside it. All of it is `mise run …` — nothing is CI-only.
- `install.sh` takes a template: `… | sh -s -- starter`.
- Not yet run by anyone: the PowerShell installer script itself (`install.ps1`). The harness it
  installs is proven on Windows by CI.

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
