# Reports for upstream — written, not sent

Things in EmDash, its scaffolders and wrangler that behaved differently from their docs, or that a
task here has to work around. Each was run on 2026-10-07 on macOS (and where said, in CI on
Windows) with EmDash 1.2.0, `@emdash-cms/plugin-cli` 0.13.3, `create-emdash@latest`, Astro 7.3.5,
wrangler 4.147.0, Node 26, pnpm 12.

**None of these has been sent.** Sending one is posting in public under the owner's name: the owner
says which. Until then the workaround in the last line of each entry is what `tasks.toml` does.

## 1. `emdash whoami` exits 0 when no site is running

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
- **Here:** `site:admin` and `live:admin` drive the wizard with Playwright and a simulated passkey
  device, and put a do-nothing `open` first on the PATH while `emdash login` runs.

## 8. `emdash migrate` cannot use wrangler's own sign-in

- **Run:** signed in with `wrangler login`, in a deployed Cloudflare project:
  `pnpm exec emdash migrate --status`.
- **Got:** "A valid Cloudflare account ID is required for D1 migrations", exit 1. It wants
  `CLOUDFLARE_ACCOUNT_ID` and a `CLOUDFLARE_API_TOKEN`, though `wrangler d1 …` in the same folder
  works with the stored login.
- **Here:** no migration step; EmDash's default mode migrates on the first request, which
  `live:ship` makes.
