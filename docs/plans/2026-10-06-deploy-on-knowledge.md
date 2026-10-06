# 2026-10-06 — Deploy and recover the way EmDash documents

**Status:** active — **0 of 7 done**

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
- That mise's `false` removes a variable the developer exported, rather than only clearing a
  default.
- That a package made by `snapshot` locally imports cleanly into a freshly set-up deployment.

## Items

- [ ] **The sandbox is a choice, made knowingly**
  - [ ] find out what a free-plan deploy does with the binding (a throwaway account, or Cloudflare's docs) and record it in `docs/emdash.md` § Unverified
  - [ ] a fresh project keeps the template's default — Worker Loader off; `plugin:new` switches it on, as it already can, and says "this needs the Workers Paid plan to deploy"
  - [ ] `deploy` prints one line when the binding is on: sandboxed plugins, paid plan
  - [ ] proof: a fresh `starter-cloudflare` project's `config/site.wrangler.jsonc` equals the template's until the first `plugin:new`
- [ ] **An encryption key exists, and reaches the deployment**
  - [ ] `setup` generates one with `emdash secrets generate` into a gitignored file the project owns (not under `.src/`, which `setup` deletes), and `configure` puts it where the dev server reads it
  - [ ] `deploy` compares fingerprints: the local key's (`emdash secrets fingerprint`) against what the deployment has; it refuses a first deploy with no key and says the `wrangler secret put` command
  - [ ] on Node, `deploy`'s closing message says the built server does not read `.env` (`docs/deployment/nodejs.mdx:60-63`)
  - [ ] proof: save a secret setting in a plugin locally, restart, read it back
- [ ] **A migration check that can fail**
  - [x] `doctor --url` runs `emdash migrate --check` and fails on a non-zero exit, printing the pending and unknown lines. Run against production: "Pending: none", exit 0. (It does not request the site first — `doctor` only runs after a deploy has been verified reachable)
  - [ ] proof it blocks: point it at a database one migration behind (a throwaway D1 seeded from an older build) and see it fail
  - [ ] decide, and write down, whether `deploy` should offer EmDash's pre-traffic order (build → `migrate` → deploy → `--check`) or stay on runtime `auto`; `auto` is supported and is the default
- [ ] **`rollback` tells the truth**
  - [ ] before rolling back, compare the migrations the deployed database has with the ones the previous build knew; if the database is ahead, stop and print EmDash's rule: restore the database and the build together (`docs/deployment/updating.mdx:123`)
  - [x] the message says "the previous Worker is live" and that a rollback does not undo database migrations
  - [ ] proof: roll back across a build with no migration — passes; across one with a migration — stops with the rule
- [ ] **A backup that is one**
  - [ ] `backup` for a Cloudflare deployment: the D1 Time Travel bookmark, a `wrangler d1 export` into `run/backups/`, and the exact restore commands printed (`docs/guides/backups.mdx:102-138`)
  - [ ] for Node and for the local site: stop the process, copy the database with its `-wal` and `-shm`, and the uploads directory (`backups.mdx:142-148`)
  - [ ] it states what it did **not** take: the media bucket (say how), and the encryption key
  - [ ] `deploy` takes the bookmark before shipping
  - [ ] proof: back up, delete an entry, restore into a throwaway database, the entry is there
- [ ] **Content reaches a new deployment**
  - [ ] document the path EmDash provides: finish the setup wizard on the deployment without sample content, then `mise run snapshot` locally and `mise run restore -- <package> --url <deployment> --confirm`
  - [ ] `restore` gains the ability to finish an interrupted import: it finds the operation and calls `emdash site import resume` (`docs/reference/cli.mdx:638-642`)
  - [ ] proof on a throwaway Worker: after the restore, `doctor --url` passes its `VERIFY_*` checks
- [ ] **The `--url` flows can run without a person**
  - [ ] confirm what `EMDASH_TOKEN = false` does to a token exported in CI
  - [ ] give the deployed site's token its own setting (so a stale local token still cannot leak into a remote call) and pass it as `--token` only when `EMDASH_URL` is set
  - [ ] proof: `doctor --url` passes in a shell with no `~/.config/emdash/auth.json`
