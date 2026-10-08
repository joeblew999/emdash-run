# Changelog

## Unreleased

- **The repo is kept by [charter](https://github.com/joeblew999/charter)**, like the owner's other
  repos: the docs in its layout (Getting started, Guides, Reference, How to help), the rules in
  `docs/rules.md`, the issue forms and labels, and this repo's own tasks (`repo`, `docs:check`,
  `issues`, `upstream:status`) included from charter instead of written here. The README is
  short and points at the docs. Nothing changes for a project that includes `tasks.toml`.

## 1.2.0 — 2026-10-08

Plugins from EmDash's registry, and previews. The full test on a Mac: 133 steps, every one of the
35 tasks, three sites at once and a deployed site with a preview. Not yet seen on Linux or Windows.

- **`live:preview`** deploys the site as a preview: an address of its own, with its own database,
  bucket and sessions, beside the live site (Cloudflare's Worker Previews). `LIVE_PREVIEW=<name>`
  makes every task that takes `--live` act on that preview. `signin:access` covers the preview
  addresses.
- **Sites start one at a time.** Two Cloudflare sites started in the same moment took the same
  debugger port, and one answered 500 to everything.
- **`signin:token` waits for a new site's tables** instead of failing on a site that has just
  been started or deployed.
Plugins from EmDash's registry: find one, install it with no clicking, and know it works. Run on
macOS on a Cloudflare and a Node site; not yet against a deployed site, nor on Windows or Linux.

- **`plugin:install -- <publisher>/<slug>`** installs a registry plugin as the admin's Install
  button does, with the token `signin:token` saved. From a site that is not even running it
  switches the sandbox on, builds, starts, signs in and installs. `plugin:remove` takes one out.
- **`plugin:favourites`** installs five chosen plugins in one go — or a project's own list
  (`PLUGINS`). The list, why, and what was rejected: [`docs/favourite-plugins.md`](docs/favourite-plugins.md).
- **`plugin:works`** says whether a plugin works, one line per check: builds, starts, listed,
  routes, admin pages in a real browser, log, sandbox. With no name: every plugin in the site.
- **`plugin:sandbox`** makes the edits a sandboxed plugin needs (Cloudflare: deploying then needs
  the Workers Paid plan).
- **`plugin:new` and `plugin:add` write the plugin's lines in `astro.config.mjs`** — nothing is
  left to edit by hand.
- **`site:stop` on a Node site** also stops the sandbox process EmDash leaves running, which
  otherwise blocks the next start. Six new entries in [`docs/upstream.md`](docs/upstream.md).
- **One source for each thing in the docs.** What a task does is its description in `tasks.toml`:
  `docs/tasks.md` (written by mise, in the order you use the tasks) and every list of tasks in the
  README are filled from it. The README says only what is not a task.

## 1.1.0 — 2026-10-08

From the first real deployment (the Remy-Sport site) and from running several sites at once. The
full test on a Mac: 101 steps, every task, three sites side by side and a deployed site, mise
2026.10.4. Not yet seen on Windows at the full level (the 1.0.1 run hit its time limit with no
failing step).

- **`site:ports`** gives a project two free ports of its own, in `mise.local.toml` — so several
  sites, or several agents, run on one machine without meeting. The full test now runs three sites
  at once, and holds a lock while it uses the deployed test Worker.
- **EmDash's welcome dialog no longer appears**: `site:start` and `signin:token` close it for the
  user they make, with the call the dialog's own button makes. EmDash has no setting for it.
- **A site set to Cloudflare Access works with the CLI on this machine again.** After
  `signin:access` and its `auth: access(…)` line, `site:start` failed and every `mise run emdash`
  on the dev site said "Not authenticated": EmDash leaves out the address its CLI signs in at. The
  `emdash` task now takes the dev sign-in's token instead.
- **Emptying the local database removes the token saved for it** (`site:reset`, `site:admin`).
  Left behind, the CLI sent it to the new database and was told "Invalid or expired token".
- **`docs/tasks.md` is written by mise itself** (`mise generate task-docs`): every task with its
  description, arguments and flags, rebuilt on every test run, by `mise run docs` and by the
  commit check.
- **Working on emdash-run:** `mise run hooks` turns on a commit check — a task without a test step,
  a test step for a task that is gone, or stale generated pages, and the commit is refused.

## 1.0.1 — 2026-10-07

Proven on macOS, Linux and Windows (the `stages` workflow), and by the full test on a Mac: 91 steps,
every task, both templates and a deployed site.

- **Windows:** `mise run emdash -- …` with a quoted argument, and `signin:token`, were broken in
  1.0.0 — a shell took the argument apart. EmDash's CLI and wrangler are now run by Node itself.
- **Every task is safe to run again.** `site:new` leaves an existing site alone, `site:delete` with
  no site has nothing to delete, `plugin:new` does not scaffold twice. The test runs them twice.
- **`plugin:search`** is its own task.
- **`tasks.toml` is in order:** the tasks by group, then every hidden step.
- **The test:** two levels (`test`, `test:full`); one task alone (`mise run test -- <task>`); it
  refuses to run unless every task has a step; the README's table of tasks is written from it.
- The docs site: <https://joeblew999.github.io/emdash-run/>. Issue forms and labels.

## 1.0.0 — 2026-10-07

The first release with signing in, deploying and a test whose result is a file:
[`docs/status.md`](docs/status.md) says what works, task by task.

- **Signing in**, four ways side by side: `signin:token` (a machine, no browser: an administrator
  and an EmDash API token written to the site's database — D1 or a Node site's SQLite file),
  `signin:access` (Cloudflare Access in front of a deployed site's admin, plus a pass for
  machines), `signin:passkey` and `signin:open` (EmDash's real wizard, and a signed-in window;
  the only tasks that need Playwright).
- **One rule for where a task acts:** this machine by default, the deployed site (`LIVE_URL`) with
  `-- --live` — on `signin:*`, `model:sync` and `emdash`. `emdash -- … --preview` is this
  machine's built site. Every task prints where it is acting first.
- **Deploying:** `live:ship` (checks, deploys with the site's `.env` as secrets, waits for the site
  to answer), `live:undo`, `live:logs`, `live:backup`. No SQL dump: `wrangler d1 export` refuses
  an EmDash database.
- **`site:preview`**: the built site on this machine, which signs in the way a deployed one does.
- **`emdash:update`**: the site on the newest EmDash, type-checked and built.
- **The test, and a status that matches the tasks.** Two levels: `mise run test` (quick) and `test:full`
  (everything — both templates, then the deployed-site tasks). Each runs
  as another developer would — a clean environment, an empty config folder. Every step is
  recorded against the task it tests; `docs/status.md` has one row for every task in
  `tasks.toml`, and says NOT TESTED where there is none. The CI workflow runs the same thing, by
  hand or on a tag.
- **`plugin:search`** is its own task.
- The build is skipped when nothing it is made from has changed. Nothing is downloaded to delete
  a folder. A task run where there is no site says so.
- `emdash whoami` behind Cloudflare Access is handled two ways, because EmDash's does not send
  the Access pass: the token is put in EmDash's own sign-in store, and the `emdash` task answers
  it when the token is only in the environment.
- fnox is in the setup snippet. Only `signin:access` needs it — for a Cloudflare token that can
  change Access — and reads it by itself: no task needs a `fnox exec` prefix.
- **Gone:** the nushell harness (`reference/`), its lint configs, `plugins/README.md`.

## 0.7.0 — 2026-10-07

The first release of the stages. A project pins it with `?ref=v0.7.0`.

- **More stages:** `site:check`, `site:reset`, `model:sync`, `content:pull`, `plugin:new`,
  `plugin:check`, `plugin:add`, `plugin:publish`, `plugin` and `live:check`. Each proven on a new
  site and on an existing site at a project's root, on Cloudflare and Node.js.
- **`emdash:update`**: the site on the newest EmDash, type-checked and built. Proven on the
  Remy-Sport site, 1.1.0 → 1.2.0.
- **`site:start` now really checks the site answers.** Its last step was `emdash whoami`, which
  exits 0 with nothing running; it is `emdash schema list` now, which does not.
- **A task run where there is no site says so**, instead of mise's "No such file or directory".

- **The repo is now the stages, in pure mise.** `tasks.toml` holds `site:new`, `site:start`,
  `site:stop`, `site:logs`, `site:delete` and `emdash` — EmDash's own commands in order, hidden
  `step:*` tasks reused between them, no script underneath. A project gets them with one include
  line; nothing is copied in. Proven from an empty folder on macOS, Linux and Windows, on a
  Cloudflare and a Node.js template (`stages.yml`).
- **The nushell harness is reference only**, in `reference/nushell-harness/`: its tasks, its
  installers, its workflows, its git hook and the pitchfork daemon are no longer loaded or run.
  Release 0.6.1 is the last of it.
- **This repo's `site/`** is a fresh `cloudflare:starter` made by `mise run site:new`, on EmDash 1.2.0.
- **`dev` is the one way in.** The first time it creates and installs the site as well; `setup`
  still exists for the installer. `mise run emdash -- <command> --help` works (the flag was lost).
- **Fewer tasks: 18 where there were 32**, each described by the job it does. `mise tasks ls` now lists the flows and the two official
  CLIs. Gone: `registry:up` and `registry:down` (the local plugin registry — it built the EmDash
  monorepo and edited the site's committed config; the hosted registry is what a site uses),
  `plugin:dev`, `content:set`, `schema:diff` and `skills` (each one line around a CLI that
  `mise run emdash --` or `mise run emdash-plugin --` already runs). Hidden, still runnable:
  `plugin:probe`, `plugin:roundtrip`, `verify:template`, `verify:linux`.
- **`check` in a project checks the project.** The harness's tests of itself — its modules, its
  planted faults, argument passing, unit tests — run only in the repo where the harness is
  developed. A project's `check` is its settings and its plugins: seven checks, not fourteen.
- **`dev` leaves a running site alone.** It restarts the server only when something changed that
  the server cannot pick up by itself — `mise.toml`, the harness, the site's `package.json`,
  lockfile, `astro.config.mjs`, `wrangler.jsonc`, `.env` or `.dev.vars`, a plugin — or when it is
  not running or not answering. Otherwise it does the cheap steps and prints the URLs.
- **`check -- --site` no longer restarts a running site.** It type-checks beside it.
- **A restored site keeps its content.** After `restore -- <package> --wipe --confirm`, the next
  `dev` wrote the seed over what had just been restored. The seed is now applied only to a database
  it was applied to before, and only when the seed has changed.
- **An upgrade cannot stick half done.** What `dev` prints about an upgrade can no longer stop it
  (it read the network after the install), it no longer refreshes `.src/templates`, and a re-run of
  `dev` re-pins any plugin still on the old EmDash.
- **Going back to an older EmDash keeps what it replaces.** `restore -- <backup directory>
  --confirm` with `EMDASH_VERSION` set back first copies the current data to
  `run/backups/emdash-<the version it is on>-…`, then installs, then puts the backup in place.
- `dev` clones EmDash's source only when the site ships skills to vendor, and carries on offline.
- `check` no longer claims the vendored skills match EmDash: that check compared against a
  gitignored checkout and could not fail in CI. `dev` still refreshes them — commit what changes.
- `verify -- --restore` proves the database backup by editing an entry, wiping the data after the
  backup, and requiring the edit after the restore.

- **A backup that is one: `mise run snapshot -- --database`.** Locally and on Node.js it stops the
  site, copies the database with its `-wal` and `-shm` files and the uploads into `run/backups/`,
  and starts the site again; `mise run restore -- <that directory> --confirm` puts it back — users,
  tokens and plugin data included, which a site package never holds. For a Cloudflare deployment
  (`--url`) it records the D1 Time Travel bookmark and writes a `wrangler d1 export` dump, with the
  restore commands beside it; `deploy` prints the bookmark before it ships. The Cloudflare half is
  written from EmDash's backup guide and has not yet been run against a deployment.
- `dev` keeps the same full copy — database and media — before it moves the site to another EmDash
  version, where it used to copy the database file alone.
- **`restore` finishes an import that was cut off.** Run it again on the same package.
- **The `--url` flows run without a person.** Set `DEPLOY_TOKEN` (in the CI job, or in
  `mise.local.toml`) to an API token of the deployment; it is handed to the CLI only by a flow
  given `--url`. `EMDASH_TOKEN` stays removed from every task, exported or not.
- The README says how content reaches a new deployment: `snapshot`, then `restore -- <package>
  --url <deployment> --confirm` into the freshly set-up site.
- **An EmDash upgrade says what it did not do for you.** When `dev` moves the site to a new
  `EMDASH_VERSION` it prints the compare link for the two releases, the lines EmDash's own updating
  notes gained between them, and how to compare a file in `site/` with the current template (`mise run source -- templates`
  refreshes it).
- **`status` and `setup` say when the templates trail EmDash.** The templates repo has no tags; its
  head names the release it was synced from, and the harness reads that.
- **The vendored skills are the ones for the EmDash you run** — from EmDash's source at that tag,
  not the template's older copy. `dev` fetches `.src/emdash` when it is not at that version.
- `verify:template -- <template> --from <version>` now also scaffolds a plugin on the old version
  and has the upgraded site call it.
- **`registry:up` really points the site at the local registry.** EmDash takes its registry from
  the site config, not from the environment, and a template's config names none — so the task
  started the registry and the site went on using the hosted one. It now adds
  `registry: process.env.EMDASH_REGISTRY_URL,` to `site/astro.config.mjs` (once; unset, EmDash uses
  its hosted default), and fails unless the running site then reports the local registry.
- **`REGISTRY_PORT`** (default 8788) moves the local registry the way `SITE_PORT` moves the site.
  `REGISTRY_URL` is gone; it was derived from the port and did not follow an override.
- **A restart restarts, on Linux too.** There `mise daemons stop` can report the site stopped while
  the server is still shutting down, and a start in that moment meets the old one. Stopping now
  waits, up to 30 seconds, until the port is free — and says so if something else holds it.
- **A checkout on its own `SITE_PORT` talks to its own site.** The emdash CLI assumes port 4321, so
  with the port moved `doctor`, `snapshot`, `restore`, `content:set` and `mise run emdash -- …` asked
  nobody, or another checkout's site. Every flow now aims it at this checkout's port, and `check`
  fails on the CLI run any other way.
- `registry:up` gives the registry's label replay the minutes it takes; at 60 seconds it failed on a
  fresh registry.
- `verify:template` gives its throwaway project a free port, so it runs beside your site instead of
  stopping it, and no longer deletes another checkout's throwaway project that is still running —
  both collided when several checkouts verified at once.
- `dev` prints how long the site took to answer its setup call.

## 0.6.1 — 2026-10-06

The first published release of the 0.6 line; 0.6.0 was tagged and never published.

- **Two sites side by side.** `SITE_PORT` (default 4321) sets the dev server's port; give a second
  checkout its own in `mise.local.toml`.
- **A release is fast.** A tag runs the fast check and publishes — about a minute. The full
  cross-platform matrix is a manual workflow, for when the cross-platform layer changes.
- The installers trust the new config before changing it: choosing a template (`| sh -s -- blog`)
  failed on any machine that was not CI.
- `verify` installs a fresh clone's site instead of assuming it.

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
