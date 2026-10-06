# EmDash, for someone using this harness

What EmDash is, how a site lives and changes, and where this harness fits it or fights it.
Written from EmDash's own source and docs at tag `emdash@1.1.0`, not from this repo's comments.

**How to read the citations.** Every statement about EmDash ends with its source:

| prefix | means |
|---|---|
| `docs:` | `.src/emdash/docs/src/content/docs/` — EmDash's own documentation |
| `core:` | `.src/emdash/packages/core/src/` — the `emdash` package |
| `pkg:` | `.src/emdash/packages/` |
| `tpl:` | `.src/templates/` — the official templates checkout |

Get the source with `mise run source`. "Ran" means a read-only command was run against the local
site on 2026-10-06 (macOS, `starter-cloudflare`). Everything else was read, not run.
[What could not be verified](#unverified) is listed at the end.

- [The pieces](#the-pieces)
- [Two targets](#two-targets)
- [The life of a site](#the-life-of-a-site)
- [What a real site needs](#what-a-real-site-needs)
- [Capability map](#capability-map) — EmDash against the harness
- [To report upstream](#to-report-upstream)

---

## The pieces

EmDash is one Astro application. The public pages and the admin share one runtime, one database
and one media store; there is no separate CMS service. `docs:concepts/architecture.mdx:8-10`

| piece | what it is | source |
|---|---|---|
| `emdash` (core) | The runtime, the Astro integration, the REST API, the `emdash` CLI (also `em`) | `pkg:core/package.json`, `docs:reference/cli.mdx:12-18` |
| Astro integration | `emdash({...})` in `astro.config.mjs`. Needs `output: "server"`, an adapter, and `react()` — without `react()` the admin stays on "Loading EmDash..." | `docs:concepts/architecture.mdx:34-39` |
| Admin | A React app at `/_emdash/admin` | `.src/emdash/AGENTS.md:246` |
| Content model | Lives **in the database**, not in code. Each collection is a real table `ec_<slug>` | `.src/emdash/AGENTS.md:60` |
| Database adapters | SQLite, libSQL, PostgreSQL (Node); D1, Hyperdrive→PostgreSQL (Workers) | `docs:deployment/database.mdx:12-18` |
| Storage adapters | R2 binding (Workers), S3-compatible, local directory (Node) | `docs:deployment/storage.mdx:12-16` |
| `@emdash-cms/cloudflare` | `d1()`, `r2()`, `sandbox()`, `access()`, `kvCache()`, the Worker entry, the cron handler. Same version number as `emdash`, exact dependency | `docs:deployment/cloudflare.mdx:54-90`, `docs:deployment/updating.mdx:17` |
| `@emdash-cms/sandbox-workerd` | The plugin sandbox for Node. Own version number (0.9.2 at this tag) | `pkg:workerd/package.json`, `docs:deployment/plugin-sandbox.mdx:78-99` |
| Plugins | **Native** (`plugins: []`, in-process, full access, needs a deploy) or **sandboxed** (`sandboxed: []` or installed from the registry, isolated, declared capabilities only) | `docs:plugins/overview.mdx:33-40` |
| `@emdash-cms/plugin-cli` | `emdash-plugin`: scaffold, build, validate, bundle, publish. Own version number (0.13.2) | `docs:plugins/creating-plugins/cli.mdx:8-44` |
| Registry | The catalog for sandboxed plugins. Default `https://registry.emdashcms.com` once a sandbox runner is configured. Publishing identity is an AT Protocol account | `docs:reference/configuration.mdx:274-278`, `docs:deployment/secrets.mdx:123-129` |
| MCP server | `/_emdash/api/mcp`, on by default, bearer token required; session cookies do not work | `docs:reference/configuration.mdx:417-419`, `docs:reference/mcp-server.mdx:16-24` |
| `create-emdash` | The scaffolder. Downloads a template, names the project, writes an encryption key to `.env`, switches the Worker Loader on or off | `pkg:create-emdash/src/index.ts:373-422` |
| Templates | `blog`, `starter`, `marketing`, `portfolio`, each for Node and (`-cloudflare`) for Workers. Authored in the monorepo under `templates/`, synced to `emdash-cms/templates` | `pkg:create-emdash/src/index.ts:48-68`, `tpl:README.md:3` |
| Skills | `building-emdash-site`, `creating-plugins`, `emdash-cli`. Published per release in `emdash-cms/skills`; the copy in a template stays at the version the project was created with | `docs:agent-skills.mdx:18-24` |

Three rules that shape everything else:

- **State-changing API calls need the header `X-EmDash-Request: 1`.** `.src/emdash/AGENTS.md:141`
- **The CLI has two kinds of command.** `init`, `seed`, `export-seed` and `doctor` open a **local
  SQLite file**. `content`, `schema`, `media`, `search`, `taxonomy`, `menu`, `site`, `types` and
  `whoami` talk to a **running site** over HTTP. `migrate` talks to the deployment's database.
  `docs:reference/cli.mdx:31,52,84,104,656`
- **CLI auth, in order:** `--token`, `EMDASH_TOKEN`, stored credentials from `emdash login`, then —
  on localhost only — the dev bypass. `core:cli/client-factory.ts:45-49,56-103`

## Two targets

| | Cloudflare Workers | Node.js |
|---|---|---|
| Database | D1 (default in the templates) or Hyperdrive | SQLite file (default), libSQL, PostgreSQL |
| Storage | R2 binding. No signed uploads | Local directory or S3-compatible |
| Plugin sandbox | Worker Loader binding `LOADER` + `PluginBridge` export. **Needs the Workers Paid plan.** Enforces CPU, subrequests, wall time | `@emdash-cms/sandbox-workerd` + `workerd`. Enforces wall time only. Under `astro dev` it uses Miniflare |
| Sandbox database | Always the D1 binding named `DB`. **Not available on Hyperdrive** | The configured database |
| Scheduled work | Only from the Worker's `scheduled()` handler, which needs a Cron Trigger. Locally `astro dev` uses a timer, so "works locally" proves nothing about the deployment | A built-in scheduler, alive only while a Node process runs |
| Migrations at runtime | Default `auto`: applied on the first request | Same |
| Secrets | `wrangler secret put`; `.env` locally (`.dev.vars` wins if present) | The process environment. The built server does **not** load `.env` |
| Sessions | Workers KV | Filesystem |
| Site URL at setup | Recorded from the hostname the Worker runs on | `siteUrl` or `EMDASH_SITE_URL` must be set first on a non-loopback host, or setup fails with `SITE_URL_REQUIRED` |
| Build artefact | `astro build && wrangler deploy` | `astro build`, then `node ./dist/server/entry.mjs` |

Sources, in row order: `docs:deployment/database.mdx:12-20`; `docs:deployment/storage.mdx:12-16`;
`docs:deployment/plugin-sandbox.mdx:14-23,103,119-124`; `docs:deployment/plugin-sandbox.mdx:18,74-76`;
`docs:deployment/cloudflare.mdx:113-118`, `docs:deployment/nodejs.mdx:69-71`;
`docs:deployment/core-migrations.mdx:10`; `docs:deployment/secrets.mdx:10,99`,
`docs:deployment/nodejs.mdx:60-63`; `docs:deployment/secrets.mdx:81`;
`docs:reference/configuration.mdx:433,454`; `tpl:starter-cloudflare/package.json`,
`docs:deployment/nodejs.mdx:46-58`.

The templates' Cloudflare `wrangler.jsonc` ships the Worker Loader **commented out**, so a new
project deploys on the free plan; the scaffolder asks, and defaults to off.
`tpl:starter-cloudflare/wrangler.jsonc`, `pkg:create-emdash/src/index.ts:306-318`

## The life of a site

### 1. First boot and setup

A request to a fresh database does three things, in this order:

1. **Core migrations run** (mode `auto`). `docs:deployment/core-migrations.mdx:10`
2. **The seed's schema and structure are applied once** — collections, fields, taxonomies, menus,
   widget areas, sections. **Not content.** `core:emdash-runtime.ts:1692-1723`,
   `docs:reference/cli.mdx:20`
3. **The setup wizard** asks for a title, creates the first user as Admin (passkey by default), and
   applies the seed's sample content **only if the administrator ticks the box**.
   `core:astro/routes/api/setup/index.ts:99-110`, `docs:guides/authentication.mdx:29-46`

In development there is a shortcut, refused with 403 in a production build:
`/_emdash/api/setup/dev-bypass`. It applies the seed **with content**, through the site's
**configured storage**, creates `dev@emdash.local` as Admin, marks setup complete and opens a
session. `?content=0` skips the sample content. `?token=1` also returns a personal access token
with the `admin` scope, replacing the previous one of the same name.
`core:astro/routes/api/setup/dev-bypass.ts:14-15,45-49,61-70,146-168`

### 2. The seed

A seed is a JSON file describing the starting model and optional sample data. It is **read at build
time and inlined into the bundle**, from the first of `.emdash/seed.json`, `package.json#emdash.seed`,
`seed/seed.json`; otherwise a built-in default. `core:astro/integration/virtual-modules.ts:569-633`

Its root keys are `settings`, `blockTypes`, `collections`, `relations`, `taxonomies`, `bylines`,
`content`, `menus`, `redirects`, `widgetAreas`, `sections`, plus `version`, `defaultLocale`, `meta`.
`docs:themes/seed-files.mdx:35-74`

What matters when you apply one twice:

- The runtime always applies with `onConflict: "skip"`. A changed seed does nothing to an existing
  database. `core:emdash-runtime.ts:1721`, `docs:deployment/schema-evolution.mdx:21`
- `emdash seed <file> --on-conflict=update` is the only way to push seed edits into an existing
  database, and it is blunt: content `data` is **replaced**, menu items and widgets are **deleted
  and recreated** whatever the mode. `docs:themes/seed-files.mdx:503,557,638`
- `emdash seed` only opens a **local SQLite file**, and resolves `$media` into a **local directory**
  whatever storage the site uses. `core:cli/commands/seed.ts:185,202-209`
- `$ref:` values that do not resolve stay as literal strings; validation does not catch them.
  Order entries so targets come first. `docs:themes/seed-files.mdx:443`
- `--validate` checks structure, not that `data` matches the fields.
  `docs:themes/seed-files.mdx:658`

### 3. Changing the model of a live site

Not by deploying a new seed. Through the admin (**Content Types**) or `emdash schema … --url <site>`.
Changes take effect immediately. `docs:deployment/schema-evolution.mdx:21,34,46-60`

- The commands are **not idempotent**: `create` or `add-field` on something that exists fails.
  `docs:deployment/schema-evolution.mdx:62`
- `remove-field` deletes the column and its values. `docs:deployment/schema-evolution.mdx:66-70`
- Afterwards, bring the seed back in line so a fresh environment boots to the same model:
  `wrangler d1 export` → SQLite → `emdash export-seed`. `docs:deployment/schema-evolution.mdx:78-86`
- Order: add fields, then ship code that uses them; ship code that stops using a field, then remove
  it. `docs:deployment/schema-evolution.mdx:126`

### 4. Content

Admin, REST API, CLI (`emdash content …`) or MCP. `content update` needs the `_rev` from a prior
`get` and publishes unless `--draft`. An entry open in the admin is locked; `--override-lock`
writes anyway. `docs:reference/cli.mdx:275,299,317-325`

### 5. Deploy

Cloudflare: `astro build && wrangler deploy`. Wrangler creates the D1 database and R2 bucket named
in `wrangler.jsonc` if they do not exist. `docs:deployment/cloudflare.mdx:18,98-103`

A first deploy gives a site with the seed's **model but no content**, waiting for the setup wizard.
`docs:deployment/cloudflare.mdx:107`

To migrate **before** new code takes traffic, EmDash's sequence is: build → `emdash migrate
--status` (read the target) → `emdash migrate` → deploy → `emdash migrate --check`. The build writes
`.emdash/migrations.json`; the command refuses a manifest from another version. D1 needs
`CLOUDFLARE_API_TOKEN` and an account id. `--status` always exits 0 after a report; `--check` exits
2 on pending, 3 on unknown records. `docs:deployment/core-migrations.mdx:14-41`,
`docs:reference/cli.mdx:117-145`, `pkg:cloudflare/src/db/d1-migration-target.ts:355-359`

After a deploy EmDash's own checklist is: a public page, sign in, upload and fetch a media file,
and the cron handler in `wrangler tail`. `docs:deployment/cloudflare.mdx:407-409`

### 6. Upgrading EmDash

EmDash's procedure: `docs:deployment/updating.mdx`

1. Read the release entries between your version and the target; breaking changes are marked.
   `:19`
2. **Back up first.** Core migrations are forward-only; there is no undo. `:27`,
   `docs:deployment/core-migrations.mdx:12,251`
3. Move `emdash` and `@emdash-cms/cloudflare` **together** — they share one version. Plugin packages
   have their own versions and declare a minimum `emdash`. `:17,48-51`
4. Build (writes the new migration manifest), run locally, deploy, check. `:53-81`
5. **Template files are not updated.** An update changes packages only; compare your files with the
   current template yourself. `:21-23`
6. **Going back** means reinstalling the old packages and redeploying — which does not undo
   migrations. If the old build cannot run on the migrated database, restore the database and the
   build together. `:123`

### 7. Backup and restore

Four different things, easily confused: `docs:guides/site-transfer.mdx:16-24`

| | restores a site? | has media files? | has users, plugin data, secrets? |
|---|---|---|---|
| Seed file | Bootstraps a model and samples | No | No |
| JSON backup (admin → Settings → Backups) | **No — there is no import** | No | No |
| Site package (`emdash site export`, `.emdash`) | Into a **new, empty** site | Yes | **No** |
| Raw database + media copy | Yes, same database type | Separate copy | Yes |

- **Disaster recovery is the last row**: D1 Time Travel or `wrangler d1 export`, or SQLite's
  `.backup`; plus a copy of the bucket or uploads directory; plus `EMDASH_ENCRYPTION_KEY`, which is
  in none of them. `docs:guides/backups.mdx:8-12,102-148`
- A site package "does not replace a database backup for disaster recovery".
  `docs:guides/backups.mdx:155-158`
- A package imports only into a site with **no entries** — not even trashed ones. Seeded structure
  is fine and is removed; seeded **content** is a blocker. `docs:guides/site-transfer.mdx:80`,
  `core:transfer/domain.ts:120-131`
- While an import runs, all writes are refused, and the public site is **not** hidden.
  `docs:guides/site-transfer.mdx:414-424`

## What a real site needs

| need | how EmDash does it | harness |
|---|---|---|
| Users and login | Passkeys by default; GitHub, Google, Microsoft, Atmosphere as `authProviders`; Cloudflare Access as an exclusive `auth` mode. Five roles, 10–50. Passkeys are bound to the domain setup ran on. `docs:guides/authentication.mdx:18,27,259-271`, `docs:deployment/cloudflare.mdx:218` | Local only, through the dev bypass. Nothing for a deployment |
| Email (invites, magic links, recovery) | A provider plugin. In dev a console provider logs mail; in production nothing is sent until one is active. `docs:guides/email.mdx:14-24` | No flow |
| Scheduled publishing | See [Two targets](#two-targets). `emdash doctor` checks the Cron Trigger and handler in the project files. `docs:deployment/cloudflare.mdx:120-126` | `doctor` runs it locally |
| i18n | Astro's own `i18n` block; without it EmDash is single-language. Do not prefix the default locale — the admin 404s. `docs:guides/internationalization.mdx:14,39,41-42` | Project config; no flow needed |
| Media | Storage adapter; 50 MB default limit; R2 images are transformed through the `IMAGES` binding. `docs:reference/configuration.mdx:593-595`, `docs:deployment/cloudflare.mdx:233-237` | `dev` moves seeded files into local R2 |
| Search | Full-text, on SQLite and D1 only. `docs:guides/site-transfer.mdx:480` | Passthrough (`emdash search`) |
| Redirects | In the seed (`redirects`) and the admin; 301/302/307/308. `docs:themes/seed-files.mdx:505-524` | Project seed — but see [A12](#assumptions) |
| Import from WordPress | In the admin, `/_emdash/admin/import/wordpress`: a WXR file or the EmDash Exporter plugin. No CLI command is registered. `docs:migration/content-import.mdx:8-20`, `core:cli/index.ts:27-45` | None needed |
| Preview deployments | A separate Wrangler environment with its **own** D1 and R2; bindings are not inherited. `docs:deployment/cloudflare.mdx:360-405` | Not covered |
| Secrets | `EMDASH_ENCRYPTION_KEY` encrypts plugin secret settings. Operator-supplied, never in the database; lose it and those settings are unreadable. `docs:deployment/secrets.mdx:27-47` | Not covered — see [A15](#assumptions) |
| Types | `emdash-env.d.ts` is generated when the dev server starts. `emdash types` is a second, standalone output. `docs:reference/cli.mdx:742-772` | Automatic / passthrough |

---

## Capability map

### Every `emdash` command

`core:cli/index.ts:27-45` is the list.

| command | harness |
|---|---|
| `init` | Not covered, not needed: the dev server migrates and seeds |
| `seed --validate` | `dev`, `setup`, `deploy` (in `configure`) |
| `seed` (apply) | `dev`, `setup` — with `--on-conflict=update`, when the seed changed or the database is new |
| `export-seed` | `seed:export` (local only) |
| `doctor` | `doctor` (local only) |
| `migrate --status` | `doctor --url`, so also `deploy` and `rollback`. Cloudflare only |
| `migrate`, `--check`, `--release-lock` | Passthrough only |
| `types` | Passthrough only |
| `secrets generate`, `fingerprint` | Passthrough only |
| `login`, `logout`, `whoami` | Passthrough only — yet every `--url` flow depends on `login` (see [A14](#assumptions)) |
| `content list`, `get` | `doctor` (the `VERIFY_*` checks) |
| `content update` | `content:set` |
| `content create`, `delete`, `publish`, `unpublish`, `schedule`, `restore`, `translations` | Passthrough only |
| `schema list`, `get` | `schema:diff`, `doctor --url` |
| `schema create`, `delete`, `add-field`, `remove-field` | Passthrough only |
| `media *`, `search`, `taxonomy *`, `menu *` | Passthrough only |
| `site export` | `snapshot` |
| `site import --analyze`, `--plan --confirm` | `restore` |
| `site import status`, `resume`, `receipt`, `cancel`, `abandon` | Passthrough only. An interrupted `restore` has no flow to finish it |

### Every `emdash-plugin` command

`docs:plugins/creating-plugins/cli.mdx:26-44`

| command | harness |
|---|---|
| `init` | `plugin:new` |
| `validate`, `build` | `plugin:new`, `dev` (build), `plugin:release` |
| `dev` | `plugin:dev` — rebuilds only; the site still needs `mise run dev` to pick it up |
| `bundle` | `plugin:release` |
| `publish`, `login`, `logout`, `whoami`, `switch`, `search`, `info`, `update-package`, `profile setup`, `release *` | Passthrough only |

### Capabilities

| capability | harness |
|---|---|
| Scaffold a site (`create-emdash`) | Re-implemented: `clone-templates` + `copy-template` + `install` |
| Dev server | `dev` |
| Setup wizard | Bypassed locally. Not covered for a deployment |
| Cloudflare deploy | `deploy` |
| Node deploy | `deploy` builds; hosting is the project's |
| Core migrations before traffic | Not covered (runtime `auto` is relied on) |
| Preview environment | Not covered |
| Roll back | `rollback` (the Worker only — see [A7](#assumptions)) |
| Disaster-recovery backup | **Not covered.** `snapshot` is a site package |
| Upgrade EmDash | Change `EMDASH_VERSION`, run `dev`: database copied, packages and plugins re-pinned in place, the updating notes that changed and the template comparison printed |
| Registry (local aggregator) | `registry:up`, `registry:down` |
| MCP | `dev` mints the token; `.mcp.json` reads it |
| Skills | `dev` vendors them from `.src/emdash/skills` at the tag of `EMDASH_VERSION` |
| Secrets, email, auth providers, i18n, object cache | Project config; no flow |

### Where the harness works around EmDash

The harness described here is 0.4.2 plus commit `c9efc63` (an unchanged seed is not re-applied).
Its code is cited by **function name**: `nu/` changed three times while this was written and line
numbers did not survive.

| # | workaround | why it exists | does EmDash offer a proper way? |
|---|---|---|---|
| W1 | `uploads-to-r2` in `nu/site.nu` — moves seeded media from `./uploads` into local R2 | `emdash seed` hard-codes `LocalStorage` (`core:cli/commands/seed.ts:202-209`) | **For the first apply, yes**: the runtime seeds through the configured storage (`core:astro/routes/api/setup/dev-bypass.ts:66-70`). For `update`, no — [upstream](#to-report-upstream) |
| W2 | `mint-token` in `nu/site.nu` — session cookie, list tokens, delete, create | A token is shown once | **Yes.** `POST …/setup/dev-bypass?token=1` returns a fresh `admin` token and drops the old one (`dev-bypass.ts:146-168`) |
| W3 | `devdb` in `nu/lib.nu` — finds Miniflare's D1 file under `.wrangler/state/v3/d1/` | `seed`, `export-seed`, `doctor` only open a SQLite file | No. EmDash's own docs reach local D1 through `wrangler d1 execute --local` (`docs:deployment/core-migrations.mdx:209-213`). The path is Miniflare's, not a contract |
| W4 | `fit` in `nu/plugin.nu` — rewrites the scaffold's `emdash` and `plugin-test` versions, removes links | The scaffold asks for `emdash >=0.12.0 <1.0.0` and `plugin-test ^0.1.0` (`pkg:plugin-cli/src/init/templates.ts:255-261`) | No — [upstream](#to-report-upstream). The links have no off switch (`pkg:plugin-cli/src/init/scaffold.ts:101-105,228-251`) |
| W5 | `link` in `nu/plugin.nu` — copies each plugin into the site's `node_modules` | The repo allows no symlinks | The documented way is `pnpm add file:../plugin` in the site (`docs:plugins/creating-plugins/your-first-plugin.mdx:184-188`). **Tried on macOS, 2026-10-06, and not adopted.** Neither `file:` nor `link:` leaves a symlink outside `node_modules`, but both write the plugin into `site/package.json` and `site/pnpm-lock.yaml`, which are committed — so adding and removing a plugin would each become a `pnpm` call that edits the project's files. `file:` hard-links the plugin's files into the store: a rebuild that rewrites a file in place shows through, a file it adds or removes does not until the next `pnpm install`. `link:` follows rebuilds, but the plugin then resolves its own `node_modules/emdash` instead of the site's. The copy is ten lines and touches nothing committed |
| W6 | `clone-templates` + `copy-template` in `nu/site.nu` | — | `pnpm create emdash … --template cloudflare:starter --yes --no-install` does it, and also writes the encryption key (`pkg:create-emdash/src/flags.ts:258-290`). It fetches the same unpinned branch |
| W7 | `enable-local-plugins` in `nu/site.nu` — string edits to the config | Templates ship without a sandbox runner | Only the `wrangler.jsonc` half: `create-emdash --sandboxed-plugins` (`pkg:create-emdash/src/utils.ts:126-162`) |
| W8 | `emdash-json` in `nu/lib.nu` scans stdout for the line where JSON starts | It once saw progress lines before the payload | Not needed at 1.1.0: with `--json` or a pipe, everything but the result goes to stderr (`core:cli/output.ts:13-19`). Ran: stdout starts with `[` / `{`. Harmless |
| W9 | ~~`url-flag` put `--url` last~~ | — | **Removed in 0.4.2.** Flows set `EMDASH_URL`, which the CLI reads (`core:cli/client-factory.ts:38-40`) |
| W10 | `sync-skills` in `nu/checks.nu` copies the skills from `.src/emdash/skills/` at the matching tag (the names are the ones the template ships) | Agents need them in git; `emdash-cms/skills` has no release tags, so `skills add` cannot pin a version | `skills add emdash-cms/skills`, `skills update` (`docs:agent-skills.mdx:34,80`), or `.src/emdash/skills/` at the matching tag |
| W11 | `install` in `nu/site.nu` adds `@emdash-cms/sandbox-workerd` + `workerd` and allows its build on Node | Node templates do not ship the runner and set `workerd: false` (`tpl:starter/pnpm-workspace.yaml`) | This **is** the proper way (`docs:deployment/plugin-sandbox.mdx:82-88`) |
| W12 | `schema-diff` in `nu/checks.nu` | — | EmDash has no diff command. Keep |

<a id="assumptions"></a>
### Assumptions in `nu/` that the source contradicts or does not guarantee

**Contradicted**

- **A1 — `restore --wipe` assumes a restarted site is empty.** `restart` (`nu/site.nu`) waits by
  calling `setup/dev-bypass`, which seeds **content** by default (`dev-bypass.ts:61-70`). Any entry
  in a seeded collection blocks an import (`core:transfer/domain.ts:120-131`). Ran, read-only: the
  local site's `/_emdash/api/admin/transfer/capabilities` reports `empty: false` with
  `collection_has_entries` for the seeded collections. Predicted:
  `restore … --wipe --confirm` fails with "the plan has blockers" on any template whose seed has
  content. `restore` itself was not run. The fix is in EmDash already: `dev-bypass?content=0`.
- **A2 — ~~"The CLI only accepts `--url` as the LAST argument."~~ Fixed in 0.4.2.** For the record:
  ran `schema list --url … --json` and `content list --url … pages --json`; both exit 0 with JSON.
- **A3 — ~~"The CLI reports errors as text while still exiting 0."~~ Comment corrected in 0.4.2.**
  For the record: ran six failing invocations — unknown entry, unknown collection, unknown command,
  missing argument, missing seed file, unreachable host — all exit 1. Every `content`/`schema`
  command ends its `catch` with `process.exit(1)` (`core:cli/commands/content.ts:103-105`,
  `schema.ts:27-29`). The real exit-0 cases are [upstream](#to-report-upstream).
- **A4 — `registry:up` "points the site at it".** `serve` (`nu/site.nu`) sets `EMDASH_REGISTRY_URL`
  for the dev server. Core does not read that variable; only the plugin CLI does
  (`pkg:plugin-cli/src/config.ts:39`), and a template's config has no `registry:` line
  (`tpl:starter-cloudflare/astro.config.mjs`). **Fixed:** `registry:up` writes
  `registry: process.env.EMDASH_REGISTRY_URL,` into `site/astro.config.mjs` — unset, EmDash falls
  back to its hosted default (`core:registry/config.ts:16-27`) — and fails unless the site's
  manifest then names the local registry. Run on a pristine `starter-cloudflare` config: the
  admin's Registry page fetched `…/xrpc/…aggregator.searchPackages` from the local aggregator.
- **A5 — A fresh project gets the Worker Loader switched on** (`configure` calls
  `enable-local-plugins` when `config/` is new). EmDash ships it off because it needs the Workers
  Paid plan (`docs:deployment/plugin-sandbox.mdx:23`). What a free-plan deploy does with the
  binding is [unverified](#unverified).
- **A6 — `doctor --url` "checks core migrations"** with `emdash migrate --status` (`main doctor`).
  `--status` exits 0 whatever it finds (`docs:reference/cli.mdx:120`). The check cannot fail.
  `--check` is the one that can.
- **A7 — `rollback` then `doctor` "verifies what is live".** A Worker rollback does not reverse a
  migration (`docs:deployment/core-migrations.mdx:251`), and the status it prints is computed from
  the **local** build's manifest, not from the Worker that is now live (`:16`).
- **A8 — The template at `main` matches `EMDASH_VERSION`** (`clone-templates`). The checkout's head
  is "sync templates from emdash v1.0.1" while the site runs 1.1.0. The monorepo's own
  `templates/starter-cloudflare` at `emdash@1.1.0` differs in four page files. The vendored skills
  are the template's, so they are 1.0.1 too: 11 files differ from `.src/emdash/skills/`.
  (`git -C .src/templates log -1`; `diff -rq`.)
- **A9 — `snapshot` is a backup** ("treat it like a database backup", `main snapshot`;
  "Backup that restores", `CHANGELOG.md`). It is a site package: no users, API tokens, plugin data
  or secrets, and it restores only into an empty site (`docs:guides/backups.mdx:155-158`).

**Not guaranteed**

- **A10 — The CLI seed pass still runs on a fresh database, and whenever the seed changes.**
  `apply-seed` (`nu/site.nu`) now skips an unchanged seed, which ends the growth on every `dev`.
  Two cases remain. On a fresh database `restart` has just seeded content and media through
  `dev-bypass`; the CLI pass then runs with `update`, downloads every `$media` a second time and
  repoints the entries at the new rows — one orphaned set per fresh database
  (`core:seed/apply.ts:856-863,2310,2389`). Predicted, not run. And when the seed does change,
  `update` replaces the `data` of **every** seeded entry and rebuilds every seeded menu and widget
  area, not only the ones that changed (`docs:themes/seed-files.mdx:503,557,638`).
- **A11 — `emdash seed` writes to a database the dev server has open.** `refresh` (`nu/main.nu`)
  calls `apply-seed` after `restart`, so two processes write Miniflare's SQLite file. EmDash
  documents `seed` for "a local SQLite database" (`docs:reference/cli.mdx:84`) and says nothing of
  this.
- **A12 — `merge-seeds` drops the project's lists when the template has the same key.** `menus`,
  `widgetAreas`, `settings`, and every key it does not name — `blockTypes`, `relations`, `bylines`,
  `redirects`, `sections` — are "the template's, falling back to the project's" (`pick`, in
  `merge-seeds`). They are lists of independent items in the seed format
  (`docs:themes/seed-files.mdx:35-74`). A project's redirects vanish on a template that has any.
- **A13 — `devdb` takes the first `.sqlite` it finds.** Right for one D1 binding.
- **A14 — `EMDASH_TOKEN` is unset on purpose** (`EMDASH_TOKEN = false` in `harness.toml`). Then the
  `--url` flows can only authenticate from `emdash login`, an interactive device flow
  (`core:cli/client-factory.ts:56-61`). EmDash's answer for CI is a token in `EMDASH_TOKEN`
  (`docs:deployment/schema-evolution.mdx:52`). That mise's `false` unsets it is this repo's claim,
  not checked here.
- **A15 — No `EMDASH_ENCRYPTION_KEY`, anywhere.** `create-emdash` writes one to `.env`
  (`pkg:create-emdash/src/index.ts:413-421`); the harness copies the template instead, so none
  exists locally and `deploy` sets none. Without it, operations on encrypted plugin settings fail
  closed (`docs:deployment/secrets.mdx:29`). This project loads two plugins.
- **A16 — "publish with: `mise run emdash-plugin -- publish`"** (`main plugin release`). `publish`
  reads `./emdash-plugin.jsonc` from the current directory unless given `--manifest <dir>`
  (`pkg:plugin-cli/src/commands/publish.ts:118-120`). The hint needs `--manifest plugins/<name>`.
  EmDash also says to run repeated commands with the plugin's own pinned CLI, not `dlx`
  (`docs:plugins/creating-plugins/cli.mdx:20`).
- **A17 — Installs are not reproducible.** `install` (`nu/site.nu`) pins only `emdash` and
  `@emdash-cms/cloudflare`. `copy-template` deletes the site and its lockfile, and `.src/` is
  ignored, so Astro, the adapters, `workerd` and every plugin package re-resolve on each `setup`.

### What to do about it

Three plans, each stating what it verified and what it guesses:

- [`plans/2026-10-06-lean-on-emdash.md`](plans/2026-10-06-lean-on-emdash.md) — delete what EmDash
  already does; make `restore` true (W1, W2, W5, W8, A1, A4, A10, A12, A16).
- [`plans/2026-10-06-emdash-upgrade.md`](plans/2026-10-06-emdash-upgrade.md) — upgrading EmDash as
  one flow (A8, A17, W10).
- [`plans/2026-10-06-deploy-on-knowledge.md`](plans/2026-10-06-deploy-on-knowledge.md) — the
  sandbox default, the encryption key, a migration check that can fail, honest rollback and backup
  (A5–A7, A9, A14, A15).

---

## To report upstream

Each is against `emdash@1.1.0`. Line numbers are in that tag. Items 1–3 were filed while this was
being written — `docs/plans/done/2026-10-06-platforms.md` records them as emdash#3918 (types) and
emdash#3919 (seed media); the issues themselves were not opened from here to check. What follows
for those three is the root cause and what a fix needs, to add to the issues. Items 4–7 are new.

### 1. `emdash types` writes a file that does not type-check (filed: emdash#3918)

`GET /_emdash/api/schema?format=typescript` emits a fixed header that imports only
`PortableTextBlock` (`packages/core/src/astro/routes/api/schema/index.ts:57-62`), then calls
`generateTypeScript`, which writes `byline?: BylineSummary | null`, `bylines?: ContentBylineCredit[]`
and `terms?: Record<string, TaxonomyTerm[]>` into **every** interface
(`packages/core/src/schema/zod-generator.ts:382-386`). The sibling generator for `emdash-env.d.ts`
imports all three (`zod-generator.ts:469-478`).

Reproduce: `emdash types` against any site, then `tsc --noEmit .emdash/types.ts`. Seen here in
`.src/site/.emdash/types.ts:5,17-19`.

The docs know about it, as a caution telling the user to hand-edit the import, and name only two of
the three types — `BylineSummary` is missing from the note
(`docs/src/content/docs/reference/cli.mdx:774-778`). The same route also skips
`generateBlockTypeDeclarations`, so `blocks` fields lose their types (not run).

Fix: build the header in the route the way `generateTypesFile` does.

### 2. `emdash seed` ignores the site's storage (filed: emdash#3919)

`packages/core/src/cli/commands/seed.ts:202-209` always constructs `LocalStorage` on
`--uploads-dir` (default `./uploads`). On a site configured with `r2()` or `s3()` the media rows
point at files the site cannot read: broken images in the admin, and `emdash site export` refuses
them. The runtime paths pass `emdash.storage`
(`packages/core/src/astro/routes/api/setup/dev-bypass.ts:66-70`).

Reproduce: a `blog-cloudflare` project; `emdash seed seed/seed.json --database <miniflare d1>`; open
Media in the admin.

### 3. `emdash seed --on-conflict=update` duplicates media on every run (filed: emdash#3919)

For an existing entry, `update` calls `resolveReferences` again
(`packages/core/src/seed/apply.ts:856-863`). `resolveMedia` only consults a cache that lives for one
call (`apply.ts:309,2310`), so it downloads the URL and inserts a new `media` row every time
(`apply.ts:2345,2389`). The old rows and files are orphaned.

Reproduce: run the command above twice with `--on-conflict=update`; `emdash media list` grows by the
number of `$media` references each run.

Fix, either: reuse a media row by source URL; or expose the existing `skipMediaDownload` option
(`packages/core/src/seed/types.ts:401`) as a CLI flag — the CLI has none
(`seed.ts:88-130`).

### 4. Errors printed, exit code 0

The claim "the CLI prints errors while exiting 0" is **not** generally true at 1.1.0 (see
[A3](#assumptions)). These cases are:

- **`emdash login`** — when discovery returns 404, both branches log an error ("Could not
  authenticate. Is the dev server running?" / "Auth discovery endpoint not found. Is this an EmDash
  instance?") and then `return`: exit 0 (`packages/core/src/cli/commands/login.ts:228-244`). Read,
  not run.
- **`emdash seed`** — a `$media` download that fails is caught, warned about and counted as
  "skipped"; the field becomes `null`, the command prints "Seed applied successfully!" and exits 0
  (`packages/core/src/seed/apply.ts:2352-2355,2419-2426`). A seed can lose every image silently.
  Read, not run.
- `emdash media repair-usage` exits 0 for `partial` and `stale` — documented, by design
  (`docs/src/content/docs/reference/cli.mdx:508`).
- `emdash login` uses exit code 2; the reference says commands use 0 and 1
  (`login.ts:247,279,361`; `cli.mdx:827`).

### 5. The plugin scaffold targets EmDash 0.x

`@emdash-cms/plugin-cli@0.13.2`, released from the same commit as `emdash@1.1.0`, scaffolds
`devDependencies.emdash: ">=0.12.0 <1.0.0"` and `"@emdash-cms/plugin-test": "^0.1.0"`
(`packages/plugin-cli/src/init/templates.ts:255-261`). plugin-test is 0.2.7 at that commit. A new
plugin's tests therefore run against EmDash 0.x.

Reproduce: `pnpm dlx @emdash-cms/plugin-cli@0.13.2 init x --yes --publisher did:plc:x
--author-name x --security-url https://x`, then read `x/package.json`.

### 6. Templates are not versioned with EmDash

`create-emdash` downloads `github:emdash-cms/templates/<dir>` with no ref
(`packages/create-emdash/src/index.ts:373`), so `create-emdash@1.1.0` gives whatever that repo's
default branch holds. On 2026-10-06 its head was "sync templates from emdash v1.0.1"
(`git -C .src/templates log -1`) while 1.1.0 was released. The update guide then asks operators to
diff their files against `main` (`docs/src/content/docs/deployment/updating.mdx:23`), which has no
relation to the version they are moving to. Ask: tag the templates repo per release, and have
`create-emdash@X` fetch tag X.

### 7. Smaller

- `emdash --help` reports "emdash v0.0.0": the version is a literal
  (`packages/core/src/cli/index.ts:24`). Ran.
- The update guide still opens "EmDash is released before version 1.0" and explains 0.x caret
  ranges, at 1.1.0 (`docs/src/content/docs/deployment/updating.mdx:12-15,45`).
- `packages/core/src/cli/commands/import/wordpress.ts` exists (1056 lines) but no `import` command
  is registered (`packages/core/src/cli/index.ts:27-45`). Dead code or a missing registration.
- `emdash seed` has no way to target anything but a local SQLite file, so there is no supported way
  to push seed edits into local D1 short of opening Miniflare's file (`seed.ts:185`).
- `emdash-plugin init` always creates `.agents/skills`, `.claude/skills` and `.claude/CLAUDE.md` as
  links (`packages/plugin-cli/src/init/scaffold.ts:101-105,228-251`); there is no flag to skip
  them, which hurts repos that forbid symlinks.

---

<a id="unverified"></a>
## Unverified

- **Nothing here was proven by running a flow.** Only read-only commands were run. Every "predicted"
  above needs the flow run once — first of all A1 (`restore --wipe`).
- What Cloudflare does when a free-plan account deploys a `worker_loaders` binding (A5).
- ~~Whether the `emdash-cms/templates` and `emdash-cms/skills` repos carry release tags.~~ Ran
  `git ls-remote --tags --refs` on both, 2026-10-06: neither has any.
- Whether `--url` must come last for `emdash site import` (A2).
- Anything about Astro or Vite that `nu/` works around — `ASTRO_DEV_BACKGROUND`, clearing
  `node_modules/.vite`, binding `127.0.0.1`. Those are not EmDash's and were not checked.
- The registry flow (`registry:up`) on a Node.js template, and on Linux or Windows: run on macOS
  with `starter-cloudflare` only.
- Whether the Cloudflare template needs a `SESSION` KV namespace declared. This project's
  `wrangler.jsonc` has one; the template has none.
