---
title: Upstream bugs
nav_order: 60
---

# Reports for upstream

Things in EmDash, its scaffolders and wrangler that behaved differently from their docs, or that a
task here has to work around. Each was run on macOS (and where said, in CI on Windows) with EmDash
1.2.0, `@emdash-cms/plugin-cli` 0.13.3, `create-emdash@latest`, Astro 7.3.5, wrangler 4.147.0,
Node 26, pnpm 12.

**Four are sent** (2026-10-08, to EmDash's tracker — each entry says so, with its issue). Their
workarounds in the code carry an `Upstream:` tag, and `mise run upstream` (charter) lists them
with the state of each issue: when one closes, the tag says what to take out. The rest are
written and not sent: features go to EmDash's Discussions, not its tracker, and some need running
again first.

## 1. `emdash whoami` exits 0 when no site is running

**Sent 2026-10-08:** [emdash-cms/emdash#3995](https://github.com/emdash-cms/emdash/issues/3995). The workaround in the code carries an `Upstream:` tag; `charter upstream` says when it is fixed.

- **Run:** stop the dev server, then `EMDASH_URL=http://localhost:4321 pnpm exec emdash whoami`.
- **Got:** "Auth method: dev-bypass … Client will use dev bypass for localhost", exit 0.
  `emdash schema list` in the same state: "fetch failed", exit 1.
- **Expected:** a non-zero exit when the instance cannot be reached — the command is the obvious
  health check, and the CLI reference lists it first.
- **Here:** `site:start` ends on `emdash schema list`.

## 2. The backup guide's SQL dump fails on any site with search

- **Run:** `pnpm exec wrangler d1 export DB --remote --output backup.sql` on a deployed starter
  site (and `--local` on a dev one) — the command in `guides/backups` § "Create an offsite D1 dump".
- **Got:** "D1 Export error: cannot export databases with virtual tables (like FTS5)", exit 1. The
  database has `_emdash_fts_posts` and `_emdash_fts_pages`, which EmDash creates.
- **Expected:** the guide to say so, and to give the way that works.
- **Here:** `live:backup` takes the Time Travel bookmark and a site package, and says there is no dump.

## 3. `emdash export-seed` and `emdash doctor` cannot reach a Cloudflare template's local database

- **Run:** in a `cloudflare:*` template, `pnpm exec emdash doctor`.
- **Got:** "database: not found at …/data.db — run emdash init". The local D1 file is
  `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite`; `export-seed` reads SQLite
  files only and has no option for D1.
- **Expected:** a way to point both at the project's D1 binding, as `emdash migrate` has
  (`--d1`, `--wrangler-config`).
- **Here:** the model is recorded with `emdash types` (`model:sync`); the seed is not refreshed
  from a database.

## 4. The skills `create-emdash` writes cannot be refreshed

- **Run:** in a freshly scaffolded site, `pnpm dlx skills update`.
- **Got:** "No project skills to update. Install project skills with npx skills add <package>".
  `agent-skills` in the docs gives `npx skills update` as the way to refresh them.
- **Here:** `emdash:update` says the skills are not updated.

## 5. `emdash-plugin init` fails on Windows beside a running dev server

- **Run:** on `windows-latest`, with `astro dev` running in the site,
  `pnpm dlx @emdash-cms/plugin-cli init save-log --dir plugins/save-log --yes …` inside the site.
- **Got:** `Error: EPERM: operation not permitted, rename '…\plugins\.save-log-HiijVy' ->
  '…\plugins\save-log'` (GitHub Actions run 37564933270). Passed on macOS and Linux, and on
  Windows in the run before.
- **Expected:** a retry on `EPERM`/`EBUSY`, as tools that rename on Windows usually do.
- **Here:** `plugin:new` stops the site first.

## 6. Nothing checks a project before its first deploy

- **Seen:** a scaffolded site deploys under the template's names (`my-emdash-site`,
  `my-emdash-media`) unless `wrangler.jsonc` is edited by hand; nothing warns about a stray
  `.dev.vars`, a missing site address, or the Worker Loader binding on a free plan.
  `emdash doctor` already reads `wrangler.jsonc` for its scheduler check.
- **Proposed:** the same command checks these.
- **Here:** `live:check` is wrangler's dry run; the names are the developer's to change.

## 7. `wrangler types --check` fails on a freshly scaffolded template

- **Run:** `pnpm dlx create-emdash@latest site --template cloudflare:starter --pm pnpm --install
  --yes`, then in it `pnpm exec wrangler types --check`.
- **Got:** "Types at worker-configuration.d.ts are out of date. Run `wrangler types` to
  regenerate.", exit 1.
- **Expected:** the template's committed file to match its own config.
- **Here:** not used as a check.

## 9. No setup, and no CLI sign-in, without a browser — and `emdash login` always opens one

- **Seen:** a site that is not in development mode can only get its first administrator through
  the setup wizard, and the CLI can only be signed in by a person approving a code. Every
  `EMDASH_*` variable in the source was listed: none bootstraps an administrator or a token.
  `emdash login` runs `open` / `xdg-open` / `cmd /c start` on its approval page unconditionally
  (`cli/commands/login.ts`), so an automated run pops up the default browser.
- **Proposed:** `emdash login --no-browser`; and a first-run bootstrap an operator can script —
  for example a one-time setup token given as a secret.
- **Here:** `signin:token` writes an administrator and an API token into the site's database, the
  way EmDash's own `dev-bypass?token=1` does in development. `signin:passkey` drives the wizard
  with Playwright and a simulated passkey, with a do-nothing `open` first on the PATH while
  `emdash login` runs.

## 8. `emdash migrate` cannot use wrangler's own sign-in

- **Run:** signed in with `wrangler login`, in a deployed Cloudflare project:
  `pnpm exec emdash migrate --status`.
- **Got:** "A valid Cloudflare account ID is required for D1 migrations", exit 1. It wants
  `CLOUDFLARE_ACCOUNT_ID` and a `CLOUDFLARE_API_TOKEN`, though `wrangler d1 …` in the same folder
  works with the stored login.
- **Here:** no migration step; EmDash's default mode migrates on the first request, which
  `live:ship` makes.

## 10. `emdash whoami` does not send `EMDASH_HEADERS`

**Sent 2026-10-08:** [emdash-cms/emdash#3994](https://github.com/emdash-cms/emdash/issues/3994). The workaround in the code carries an `Upstream:` tag; `charter upstream` says when it is fixed.

- **Run:** a site behind Cloudflare Access; `EMDASH_TOKEN` and `EMDASH_HEADERS` (the Access service
  token) set; `emdash whoami --url <site>`.
- **Got:** "Unexpected token '<', \"<!DOCTYPE \"… is not valid JSON" — Cloudflare's login page.
  `emdash schema list` with the same environment works.
- **Why:** every other command builds its client with `createClientFromArgs`, which merges headers
  from the stored sign-in, `EMDASH_HEADERS` and `--header`. `whoami` (`cli/commands/login.ts`)
  makes its own request with headers from the stored sign-in only.
- **Here:** `signin:token -- --live` also writes EmDash's sign-in store; and the `emdash` task
  answers `whoami` itself when the token is only in the environment.

## 11. A local sign-in is stored per project folder, and outlives the database

- **Run:** `emdash login --url http://localhost:4322`; empty the local database; start the dev
  site on port 4321; `emdash whoami`.
- **Got:** "Token is invalid or expired. Run: emdash login" — on a dev site that needs no sign-in.
  The store keys a localhost sign-in by project path (`path:/…/site`), not by address, so one
  made for the built site is used for the dev site, and survives the database it belonged to.
- **Expected:** on localhost, fall back to the dev sign-in when the stored token is refused.
- **Here:** `signin:token` does not use `emdash login`; the tasks run `emdash logout` where it matters.

## 12. A Node build takes itself to be on port 4321

- **Run:** a `node:*` template, `astro build`, `astro preview --port 4410`; create a passkey in the
  setup wizard.
- **Got:** "Invalid origin: http://localhost:4410 not in [http://localhost:4321]".
- **Here:** `site:preview` sets `EMDASH_SITE_URL` to the address it serves on.

## 13. Under Cloudflare Access a machine cannot sign in by any documented route

- **Seen:** `emdash login` → "Device Flow is not available for this instance. Generate an API token
  in Settings > API Tokens". A service token gets through Access (`/_emdash/api/setup/status` →
  200) and is not a user (`/_emdash/api/auth/me` → 401): the Access module asks Cloudflare for an
  identity with an email, which a service token does not have.
- **Proposed:** map a service token to a named machine user, or document the API-token route as
  the way for CI.
- **Here:** `signin:token -- --live`.

## 14. Two sign-ins at the same moment, and one is lost

**Sent 2026-10-08:** [emdash-cms/emdash#3996](https://github.com/emdash-cms/emdash/issues/3996). The workaround in the code carries an `Upstream:` tag; `charter upstream` says when it is fixed.

- **Run:** three sites side by side on one machine, each doing `emdash login` against its own built
  site (the full test, 2026-10-07).
- **Got:** on one of the three, the next command: "Invalid or expired token". Every sign-in is kept
  in one file, `~/.config/emdash/auth.json`; `cli/credentials.ts` reads it, changes one entry and
  writes the whole file back, with no lock — so the slower of two writers puts the other's old
  entry back.
- **Expected:** write to a temporary file and rename, under a lock; or one file per site.
- **Here:** `signin:token` keeps one file per site. The test gives each of its three sites a config
  folder of its own. Agents working side by side: use `signin:token`, not `emdash login`.

## 15. The welcome dialog has no setting

- **Seen:** the admin opens a welcome dialog on top of the page for every new user
  (EmDash's admin package, src/components/Shell.tsx, while `/_emdash/api/auth/me` says `isFirstLogin`). A fresh
  local database means a new user, so a developer sees it after every `site:reset`.
- **Proposed:** an option on `emdash()` to leave it out, or not showing it to the dev sign-in's user.
- **Here:** `site:start` and `signin:token` close it with the call its own button makes
  (`POST /_emdash/api/auth/me`, `{"action":"dismissWelcome"}`) — `admin/welcome.mjs`.

## 16. With Cloudflare Access configured, the CLI cannot sign in to the dev site

**Sent 2026-10-08:** [emdash-cms/emdash#3993](https://github.com/emdash-cms/emdash/issues/3993). The workaround in the code carries an `Upstream:` tag; `charter upstream` says when it is fixed.

- **Run:** `auth: access({…})` in `astro.config.mjs`; `astro dev`; `emdash schema list`.
- **Got:** "Not authenticated". `emdash whoami` says "Client will use dev bypass for localhost",
  and the address it uses, `/_emdash/api/auth/dev-bypass`, answers 404: with an external sign-in
  the built-in sign-in routes are left out (`injectBuiltinAuthRoutes`), that one among them. The
  browser's dev sign-in, `/_emdash/api/setup/dev-bypass`, still works.
- **Expected:** the dev sign-in route present in development whatever `auth` is; the middleware
  already falls back to it there ("In dev mode, fall back to passkey auth").
- **Here:** the `emdash` task takes a token from `/_emdash/api/setup/dev-bypass?token=1` when the
  CLI's route is missing, keeps it for the site, and `site:start` checks the site through it.

