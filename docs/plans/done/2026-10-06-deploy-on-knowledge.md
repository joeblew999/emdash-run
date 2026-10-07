# 2026-10-06 — Deploy and recover the way EmDash documents

**Status:** closed 2026-10-06 — everything that could be done without a deployment is done and merged. The boxes still open below are carried, in one place, by [`2026-10-06-open.md`](2026-10-06-open.md), itself superseded by [`../2026-10-07-stages.md`](../2026-10-07-stages.md).

`deploy` builds, ships and checks that the URL answers. EmDash's own deployment docs ask for more
than that, and in four places the harness currently says something that is not so: a migration
check that cannot fail, a rollback that implies the database went back, a "backup" that is not one,
and a default that needs a paid plan.

Sources for every claim: [`../emdash.md`](../emdash.md) § Two targets, § The life of a site,
and A5–A9, A14, A15.

## What is verified, and what is a guess

**Verified by reading `emdash@1.1.0`:**

- The Worker Loader needs the Workers Paid plan; templates ship it commented out; the scaffolder
  defaults to off. `docs/deployment/plugin-sandbox.mdx:23`,
  `packages/create-emdash/src/index.ts:306-318`
- `EMDASH_ENCRYPTION_KEY` is operator-supplied, never stored in the database, and the scaffolder
  writes one to `.env`. `docs/deployment/secrets.mdx:27-47`,
  `packages/create-emdash/src/index.ts:413-421`
- `emdash secrets generate --write .env` and `emdash secrets fingerprint <key>` exist.
  `docs/reference/cli.mdx:711-737`
- `emdash migrate --status` always exits 0; `--check` exits 2 or 3. `cli.mdx:117-145`
- A Worker rollback does not reverse a migration. `docs/deployment/core-migrations.mdx:251`
- A production first boot applies the seed's model, not its content.
  `packages/core/src/emdash-runtime.ts:1692-1723`
- A site package holds no users, tokens, plugin data or secrets; disaster recovery is a raw
  database backup plus a media copy plus the key. `docs/guides/backups.mdx:8-12,155-158`
- For CI, EmDash expects an API token in `EMDASH_TOKEN`. `docs/deployment/schema-evolution.mdx:52`
- Scheduled publishing on Workers needs both a Cron Trigger and the `scheduled` handler, and
  `emdash doctor` checks both in the project files. `docs/deployment/cloudflare.mdx:113-126`

**Verified by reading this repo:**

- A fresh project gets `worker_loaders` uncommented and `sandboxRunner: sandbox()` added
  (`configure` → `enable-local-plugins`, `nu/site.nu`).
- `doctor --url` runs `emdash migrate --status` and ignores the result (`main doctor`).
- Nothing in `nu/` generates, stores or deploys an encryption key.
- `harness.toml` sets `EMDASH_TOKEN = false`.

**Guesses — each has a step below that settles it:**

- What a free-plan account sees when it deploys a `worker_loaders` binding: a refused deploy, or a
  Worker whose sandbox is unavailable.
- That `wrangler secret list` is a usable, read-only way to see whether the key is deployed.
- ~~That mise's `false` removes a variable the developer exported.~~ It does — see the last item.
- That a package made by `snapshot` locally imports cleanly into a freshly set-up deployment.

## Items

- [ ] **The sandbox is a choice, made knowingly**
  - [ ] find out what a free-plan deploy does with the binding (a throwaway account, or Cloudflare's docs) and record it in `docs/emdash.md` § Unverified
  - [x] a fresh project keeps the template's default — Worker Loader off; `plugin:new` switches it on and says deploying with it needs the Workers Paid plan
  - [ ] `deploy` prints one line when the binding is on: sandboxed plugins, paid plan
  - [x] proof: on a fresh `starter-cloudflare` project, `config/site.wrangler.jsonc` is byte-identical to the template's after `setup`, and differs after `plugin:new`
- [ ] **An encryption key exists, and reaches the deployment**
  - [x] `dev` generates one with `emdash secrets generate` into the project's gitignored `.env` (once), and copies it into the site, where the dev server reads it
  - [x] `deploy` refuses when the Worker has no `EMDASH_ENCRYPTION_KEY` secret and prints the commands. It checks presence only: a Worker secret cannot be read back, so fingerprints cannot be compared — the plan's wish, not something Cloudflare allows
  - [ ] on Node, `deploy`'s closing message says the built server does not read `.env` (`docs/deployment/nodejs.mdx:60-63`)
  - [ ] proof: save a secret setting in a plugin locally, restart, read it back
- [ ] **A migration check that can fail**
  - [x] `doctor --url` runs `emdash migrate --check` and fails on a non-zero exit, printing the pending and unknown lines. Run against production: "Pending: none", exit 0. (It does not request the site first — `doctor` only runs after a deploy has been verified reachable)
  - [ ] proof it blocks: point it at a database one migration behind (a throwaway D1 seeded from an older build) and see it fail
  - [ ] decide, and write down, whether `deploy` should offer EmDash's pre-traffic order (build → `migrate` → deploy → `--check`) or stay on runtime `auto`; `auto` is supported and is the default
- [x] **`rollback` tells the truth**
  - [x] ~~compare the migrations the deployed database has with the ones the previous build knew~~ — **dropped, not simple.** The checkout that runs `rollback` holds the *newer* build's migration manifest; what the previous Worker knew is only inside its bundle on Cloudflare. `emdash migrate --check` compares against the installed package (`docs/reference/cli.mdx:113`), so answering the question means checking out and installing the previous build first — a second flow, for a case the message already states plainly
  - [x] the message says "the previous Worker is live" and that a rollback does not undo database migrations
  - [x] ~~proof across a build with a migration~~ — goes with the dropped comparison
- [ ] **A backup that is one** — it is `snapshot -- --database`, not a new task; `restore` takes the directory it makes
  - [ ] for a Cloudflare deployment (`snapshot -- --database --url <deployment>`): the D1 Time Travel bookmark, a `wrangler d1 export` into `run/backups/`, and the exact restore commands printed and saved as `restore.txt` (`docs/guides/backups.mdx:102-138`). **Written, not run** — there is no deployment. Checked without one: `wrangler d1 time-travel info --help` has `--json`, `d1 export --help` has `--remote --output`; with no database the flow stops with "Cloudflare gave no Time Travel bookmark for my-emdash-site". To close: run it against a deployment, then `wrangler d1 execute <new-empty-db> --remote --file=run/backups/<dir>/database.sql`
  - [x] for Node and for the local site: stop the process, copy the database with its `-wal` and `-shm`, and the uploads directory (`backups.mdx:142-148`). One helper, `backup-local-data` in `nu/lib.nu`; `dev` calls it too before an EmDash version change, where it used to copy the database file alone. On Cloudflare locally the copy is miniflare's whole state, so local R2 comes with it
  - [x] it states what it did **not** take: the encryption key (both), and for a deployment the media bucket, with the `aws s3 sync` line from the guide
  - [ ] `deploy` prints the bookmark before shipping. **Written, not run.** To close: `mise run deploy` against a deployment and see the "Time Travel bookmark" line before the deploy step
  - [x] proof, local Cloudflare site (port 4332): `mise run snapshot -- --database` → `run/backups/site-20261006-153144`; `mise run emdash -- content delete posts welcome` → `content list posts` 0 items; `mise run restore -- run/backups/site-20261006-153144 --confirm` → `welcome`, published, same id `01M484FAZT6SMA0W2HQV1GPY05`. Restored in place rather than into a throwaway database: in place is what the flow does
  - [x] proof, Node: `mise run verify:template -- starter --full` — its "back up the database, put it back" step, then `doctor`: healthy. And `verify:template -- starter --from 1.0.1`: "database and media as they were on 1.0.1 → run/backups/emdash-1.0.1-…", the marked entry survived
  - [ ] going **back** an EmDash version with that copy (`EMDASH_VERSION` to the old one, `restore -- <dir> --confirm`) is printed as the way, and was not run
- [ ] **Content reaches a new deployment**
  - [x] the path EmDash provides is in the README (§ Back up, and move content): finish the setup wizard on the deployment without sample content, then `mise run snapshot` locally and `mise run restore -- <package> --url <deployment> --confirm`
  - [x] `restore` finishes an interrupted import. `site import <pkg> --analyze` on a package whose import is executing returns the operation and no plan, exit 0 (`packages/core/src/cli/site/import.ts:621`); `restore` then calls `emdash site import resume <id>`. One cut off earlier — uploading, analysing — the analysis itself picks up. Proof, local: emptied the site, analysed, `POST …/transfer/imports/<id>/execute` and nothing more (state `planned`, stage `reserve`); `mise run restore -- <pkg>` → "an import of this package was started here and never finished — add --confirm to finish it", 0 posts; with `--confirm` → receipt `verified`, `welcome` is back; again → "this package is already imported here"; `mise run doctor` healthy
  - [x] the `--url` path, against the local site standing in for a deployment: emptied it, `DEPLOY_TOKEN=<admin token> mise run restore -- <pkg> --url http://localhost:4332` showed the plan, `--confirm` imported it, `doctor` healthy
  - [ ] proof on a throwaway Worker: after the restore, `mise run doctor -- --url <deployment>` passes its `VERIFY_*` checks. Needs a deployment
- [ ] **The `--url` flows can run without a person**
  - [x] what `EMDASH_TOKEN = false` does to a token exported in CI: removes it. `EMDASH_TOKEN=exported-in-ci DEPLOY_TOKEN=from-ci mise exec -- nu -c …` printed `EMDASH_TOKEN=<unset> DEPLOY_TOKEN=from-ci`. So EmDash's own CI answer cannot work under the harness
  - [x] the deployed site's token is `DEPLOY_TOKEN`. `target` (`nu/lib.nu`) makes it `EMDASH_TOKEN` for the rest of a flow given `--url`, and nothing else does — the CLI reads `--token`, then `EMDASH_TOKEN`, then stored credentials, then the localhost dev bypass (`packages/core/src/cli/client-factory.ts:56-103`), so the variable does what the flag would, in one place. It has no default in `harness.toml`: a default would replace what the CI job exports
  - [x] proof, local site, `XDG_CONFIG_HOME` pointed at an empty directory so there is no `auth.json`: `DEPLOY_TOKEN=bogus mise run schema:diff -- --url http://localhost:4332` → "Invalid or expired token" (it was sent, and the dev bypass was not used); the same with the token from `run/token-admin.txt` → matches; `DEPLOY_TOKEN=bogus mise run schema:diff` (no `--url`) → matches (not sent); `EMDASH_TOKEN=bogus mise run schema:diff -- --url …` → matches (removed). `snapshot -- --url` and `restore -- --url` passed the same way
  - [ ] proof: `DEPLOY_TOKEN=… mise run doctor -- --url <deployment>` passes in a shell with no `~/.config/emdash/auth.json`. `doctor --url` on Cloudflare also reads the deployed D1, so this one needs a deployment
- [x] **Found on the way: the CLI was aimed at port 4321, whatever `SITE_PORT` said**
  - [x] the emdash CLI falls back to `http://localhost:4321` (`client-factory.ts:39`), so in a checkout on another port every flow that used it talked to a different checkout's site. `emdash`, `emdash-result` and `emdash-json` in `nu/lib.nu` now set `EMDASH_URL` to this checkout's site, or the `--url` deployment
  - [x] `check` fails on `^emdash` anywhere outside `lib.nu`, and plants that fault to prove it (15 checks pass with the plant caught). Every proof above ran on port 4332
