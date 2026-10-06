# 2026-10-06 — Upgrading EmDash is one flow

**Status:** active — **5 of 8 done**; the other three each wait on something outside this repo: an upstream issue, a deployment, a CI run

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
- `clone-source templates` takes `main`. Its head today is "sync templates from emdash
  v1.0.1" while the site runs 1.1.0.
- `PLUGIN_CLI_VERSION` is in the harness-owned `harness.toml`; `EMDASH_VERSION` is in the project's
  `mise.toml`. Nothing ties them.
- ~~No lockfile outlives `setup`.~~ Since 0.6.0 `site/pnpm-lock.yaml` is the project's, committed.

**Guesses — each has a step below that settles it:**

- That the tags on the `emdash@X` commit are the right companions for X in every release.
- ~~That the templates and skills repos can be fetched at a ref matching X.~~ Settled: they cannot — neither has tags. The skills for X are in the EmDash monorepo at `emdash@X`.
- That `pnpm install` after re-pinning, without deleting the site, leaves a working install.
- That 1.0.1 → 1.1.0 has at least one migration, making it a usable test pair.

## Items

- [x] **Settle what "version X" means** — EmDash tags every package it releases on one commit, so `EMDASH_VERSION` alone decides the set. `version-set` (`nu/lib.nu`) reads it from the tags once and remembers it in `run/`.
  - [x] checked for both releases: `emdash@1.0.1` goes with plugin-cli 0.13.1, plugin-test 0.2.6, sandbox-workerd 0.9.1; `emdash@1.1.0` with 0.13.2, 0.2.7, 0.9.2
  - [x] `PLUGIN_CLI_VERSION` is deleted — it is derived, so it cannot disagree. The plugin CLI, plugin-test and (on Node) sandbox-workerd all come from the set
- [ ] **Settle where a version-matched template comes from** — nowhere: neither repo is versioned, so the harness says so instead of pretending
  - [x] `git ls-remote --tags emdash-cms/templates`: **no tags.** The head says "sync templates from emdash v1.0.1" while EmDash is at 1.1.0. `emdash-cms/skills`: no tags either (`git ls-remote --tags --refs`, empty)
  - [x] `status` shows the version the templates were synced from when it is not `EMDASH_VERSION`; `setup` says it when it creates `site/`, and `dev` says it when it upgrades (`template-lag`, `nu/site.nu`). Not on every `dev`: the site is the project's once made, so it would be noise. Proof: `mise run status` → "template  starter-cloudflare — the templates are synced from EmDash 1.0.1, not 1.1.0: upstream does not version them"; the upgrade run below prints the same line
  - [ ] file upstream item 6 (`docs/emdash.md` § To report upstream) — written up, not filed: it is an issue on someone else's repository, the owner's to send
  - [x] the same for skills: they are vendored from EmDash's source at the tag of `EMDASH_VERSION` (`.src/emdash/skills`, fetched by `dev` when it is not at that version), not from the template's copy; the template only decides which ones. Proof: with `.src/emdash` at 1.1.0 and the old vendored copy, `mise run check` → "✗ vendored EmDash skills match the site's EmDash"; after `mise run dev`, 11 files under `.github/skills/` changed and `check` passes (15 of 15). Where `.src/emdash` is absent — a fresh clone, CI — the check has nothing to compare and passes
- [x] ~~**A lockfile the project owns**~~ — obsolete since 0.6.0: the site is the project's own `site/`, never deleted, and `site/pnpm-lock.yaml` is simply committed (`git ls-files site/pnpm-lock.yaml`). `config/` is gone, so there is nothing to restore or save back
- [x] **Upgrade in place — the local database survives.** No new command: change `EMDASH_VERSION`, run `mise run dev`. When the installed version differs, `dev` copies the local database to `run/backups/emdash-<old>-<time>/`, re-pins and installs without deleting the site, and carries on (`sync-version`, `nu/site.nu`).
  - [x] proof: `mise run verify:template -- starter-cloudflare --from 1.0.1` — a throwaway project comes up on 1.0.1, an entry is edited, `dev` moves it to 1.1.0, the edit is still there, and `emdash doctor` reports "90 applied, none pending". Exit 0, macOS
  - [x] it prints how to go back: the old version **and** the copied database, together
  - [x] `dev` no longer carries on silently on the wrong version — it upgrades. (The plan said "refuse"; doing the upgrade is the same information with one fewer step)
- [x] **Show what changed, before it bites** — printed by `sync-version` after the install (`what-changed`, `nu/site.nu`)
  - [x] ~~the template's diff for the files `config/` was copied from~~ — `config/` is gone and no old template ref exists to diff from (no tags). Instead it refreshes `.src/templates`, says which EmDash it was synced from, and prints the command that compares a file in `site/` with it
  - [x] the lines `docs/src/content/docs/deployment/updating.mdx` gained between the two EmDash tags (the older tag is fetched shallow beside `.src/emdash`), at most 30, with the path of the whole file
  - [x] the compare URL for the two releases
  - [x] proof: the upgrade run below printed "releases:  https://github.com/emdash-cms/emdash/compare/emdash@1.0.1...emdash@1.1.0", "EmDash's updating notes gained 2 lines" followed by the new "Template files are not updated" section, the templates warning, and `git diff --no-index .src/templates/starter-cloudflare/astro.config.mjs site/astro.config.mjs`
- [x] **Plugins move with it**
  - [x] every plugin under `plugins/` is re-pinned to the new version and installed before `dev` builds it; `audit` still fails on any mismatch
  - [x] ~~`SITE_PACKAGES` peer check~~ — obsolete since 0.6.0: `SITE_PACKAGES` is gone; extra packages are ordinary dependencies in `site/package.json`, and pnpm reports an unmet peer at install
  - [x] proof: `mise run verify:template -- starter-cloudflare --from 1.0.1` now scaffolds a plugin on 1.0.1 (`plugin:new -- upgraded`), upgrades, and ends with `plugin:probe -- upgraded` → "the site ran upgraded/hello → {"greeting":"hello","pluginId":"upgraded"}", entry still there, doctor healthy. Exit 0, macOS
- [ ] **The deployed side: migrate knowingly** — nothing is deployed (the Worker was deleted on purpose, `DEPLOY_URL` is empty), so none of this can be proven here. The bookmark and the pre-traffic order are the deploy plan's items ([`2026-10-06-deploy-on-knowledge.md`](2026-10-06-deploy-on-knowledge.md) § A backup that is one, § A migration check that can fail); they are not duplicated in code from this plan
  - [ ] before `deploy` ships a build whose EmDash differs from the last deployed one: record the D1 Time Travel bookmark and print the restore command (`backups.mdx:102-116`); on Node, say which file to copy
  - [ ] `emdash migrate --status` runs before the deploy and its pending list is shown
  - [x] after the deploy, `emdash migrate --check` must exit 0 — in the code: `deploy` ends in `doctor --url`, which runs `--check` and fails on a non-zero exit (`main doctor`, `nu/main.nu`). Read, not run: there is no deployment
  - [ ] proof, pending a deployment: deploy 1.0.1 to a throwaway Worker, set `EMDASH_VERSION` to 1.1.0, `mise run dev`, `mise run deploy`; the flow shows the pending migrations before and `mise run doctor -- --url <worker>` prints "Pending: none" after
- [ ] **Prove it in CI**
  - [x] not a new task: `verify:template -- <template> --from <version>` does it — throwaway project, `setup` on the old version, a plugin, edit an entry, `dev` on the new one, assert the entry, the plugin and a clean `doctor`
  - [x] it runs beside other checkouts: the throwaway project takes the checkout's own `SITE_PORT`, and the sweep of earlier runs leaves anything younger than six hours alone. Proof: the run above, on port 4331 while other checkouts held 4321
  - [ ] the full-verification workflow runs it on every OS — the matrix entry is added (`.github/workflows/full.yml`, "Upgrade"); proof pending: `gh workflow run "full verification"`, three Upgrade jobs green. Not run: only macOS is proven
