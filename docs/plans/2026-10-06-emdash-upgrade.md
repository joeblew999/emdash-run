# 2026-10-06 — Upgrading EmDash is one flow

**Status:** active — **2 of 8 done**, two more partly

`mise run upgrade` upgrades the harness. Nothing upgrades EmDash. Today the only way to move
`EMDASH_VERSION` is to edit it and run `setup`, and `setup` deletes the site copy — which is where
the local database lives. So a core migration never runs against existing data on a developer's
machine; the first database it meets is production's. EmDash's migrations are forward-only.

The developer should change one line in `mise.toml` and run one command. That command should end
either with "✓ on 1.2.0, your data intact, plugins pass" or with exactly what is in the way.

Background and sources: [`../emdash.md`](../emdash.md) § Upgrading EmDash, and its A8 and A17.

## What is verified, and what is a guess

**Verified by reading EmDash's source and docs at `emdash@1.1.0`:**

- `emdash` and `@emdash-cms/cloudflare` share one version and must move together; plugin packages
  have their own. `docs/deployment/updating.mdx:17`
- Core migrations are forward-only; reinstalling the old version does not undo them.
  `docs/deployment/core-migrations.mdx:12,251`, `updating.mdx:123`
- With the default mode `auto`, pending migrations run on the first request, locally and deployed.
  `core-migrations.mdx:10`
- The build writes `.emdash/migrations.json`; `emdash migrate --check` exits 2 on pending and 3 on
  unknown records, `--status` always exits 0. `docs/reference/cli.mdx:117-145`
- An update changes packages only; template files are the operator's to compare.
  `updating.mdx:21-23`
- D1 Time Travel gives a restore point: `wrangler d1 time-travel info <db>`.
  `docs/guides/backups.mdx:102-116`
- The commit tagged `emdash@1.1.0` also carries `@emdash-cms/plugin-cli@0.13.2`,
  `@emdash-cms/sandbox-workerd@0.9.2` and `@emdash-cms/plugin-test@0.2.7`
  (`git -C .src/emdash log -1 --format=%d`).

**Verified by reading this repo:**

- `copy-template` (`nu/site.nu`) deletes the whole site directory; the local database is inside it
  (`devdb`, `nu/lib.nu`).
- Harness code is cited by function name: line numbers in `nu/` moved while this was written.
- `dev` does not reinstall when `EMDASH_VERSION` changes; only `install` (in `setup`) pins it.
- `clone-templates` takes `main`. Its head today is "sync templates from emdash
  v1.0.1" while the site runs 1.1.0.
- `PLUGIN_CLI_VERSION` is in the harness-owned `harness.toml`; `EMDASH_VERSION` is in the project's
  `mise.toml`. Nothing ties them.
- No lockfile outlives `setup`.

**Guesses — each has a step below that settles it:**

- That the tags on the `emdash@X` commit are the right companions for X in every release.
- That the templates and skills repos can be fetched at a ref matching X.
- That `pnpm install` after re-pinning, without deleting the site, leaves a working install.
- That 1.0.1 → 1.1.0 has at least one migration, making it a usable test pair.

## Items

- [x] **Settle what "version X" means** — EmDash tags every package it releases on one commit, so `EMDASH_VERSION` alone decides the set. `version-set` (`nu/lib.nu`) reads it from the tags once and remembers it in `run/`.
  - [x] checked for both releases: `emdash@1.0.1` goes with plugin-cli 0.13.1, plugin-test 0.2.6, sandbox-workerd 0.9.1; `emdash@1.1.0` with 0.13.2, 0.2.7, 0.9.2
  - [x] `PLUGIN_CLI_VERSION` is deleted — it is derived, so it cannot disagree. The plugin CLI, plugin-test and (on Node) sandbox-workerd all come from the set
- [ ] **Settle where a version-matched template comes from**
  - [x] `git ls-remote --tags emdash-cms/templates`: **no tags.** The head says "sync templates from emdash v1.0.1" while EmDash is at 1.1.0
  - [ ] `status` shows the template's sync version, and `dev` says plainly when the template is older than EmDash; file upstream item 6
  - [ ] the same for skills: `check`'s "vendored skills" compares against the version the site runs, not the template's copy
- [ ] **A lockfile the project owns** — so that only this flow changes what is installed
  - [ ] `install` restores `config/site.pnpm-lock.yaml` into the site before installing and saves it back after
  - [ ] proof: `setup` twice a day apart, `git diff config/site.pnpm-lock.yaml` is empty
- [x] **Upgrade in place — the local database survives.** No new command: change `EMDASH_VERSION`, run `mise run dev`. When the installed version differs, `dev` copies the local database to `run/backups/emdash-<old>-<time>/`, re-pins and installs without deleting the site, and carries on (`sync-version`, `nu/site.nu`).
  - [x] proof: `mise run verify:template -- starter-cloudflare --from 1.0.1` — a throwaway project comes up on 1.0.1, an entry is edited, `dev` moves it to 1.1.0, the edit is still there, and `emdash doctor` reports "90 applied, none pending". Exit 0, macOS
  - [x] it prints how to go back: the old version **and** the copied database, together
  - [x] `dev` no longer carries on silently on the wrong version — it upgrades. (The plan said "refuse"; doing the upgrade is the same information with one fewer step)
- [ ] **Show what changed, before it bites**
  - [ ] print the template's diff, old ref to new, for the two files `config/` was copied from (`astro.config.mjs`, `wrangler.jsonc`) and for `seed/seed.json` — these are the project's now and nothing else will update them
  - [ ] print the diff of `docs/src/content/docs/deployment/updating.mdx` between the two EmDash tags: its "Notes for specific releases" section is where EmDash says what needs action
  - [ ] print the releases URL for the range
- [ ] **Plugins move with it**
  - [x] every plugin under `plugins/` is re-pinned to the new version and installed before `dev` builds it; `audit` still fails on any mismatch
  - [ ] `SITE_PACKAGES`: after install, list any whose `peerDependencies.emdash` the new version does not satisfy
  - [ ] proof: the upgrade run above with a plugin present, ending in `plugin:probe`
- [ ] **The deployed side: migrate knowingly**
  - [ ] before `deploy` ships a build whose EmDash differs from the last deployed one: record the D1 Time Travel bookmark and print the restore command (`backups.mdx:102-116`); on Node, say which file to copy
  - [ ] `emdash migrate --status` runs before the deploy and its pending list is shown
  - [ ] after the deploy and one request to the site, `emdash migrate --check` must exit 0 — see the deploy plan for making `doctor --url` use it
  - [ ] proof: deploy 1.0.1 to a throwaway Worker, upgrade, deploy 1.1.0; the flow shows the pending migrations before and "none pending" after
- [ ] **Prove it in CI**
  - [x] not a new task: `verify:template -- <template> --from <version>` does it — throwaway project, `setup` on the old version, edit an entry, `dev` on the new one, assert the entry and a clean `doctor`
  - [ ] the full-verification workflow runs it for the last two EmDash releases, on every OS
