# 2026-10-06 — Upgrading EmDash is one flow

**Status:** active — **0 of 8 done**

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

- `copy-template` runs `rm -rf $env.SITE_DIR` (`nu/site.nu:46`); the local database is inside it
  (`nu/lib.nu:106,111`).
- `dev` does not reinstall when `EMDASH_VERSION` changes; only `install` (in `setup`) pins it.
- `clone-templates` takes `main` (`nu/site.nu:29`). Its head today is "sync templates from emdash
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

- [ ] **Settle what "version X" means** — one function returns the whole set for an EmDash version
  - [ ] `git ls-remote --tags $EMDASH_REPO` lists the tags; write down, for `emdash@1.0.1` and `emdash@1.1.0`, which `plugin-cli`, `sandbox-workerd` and `plugin-test` tags point at the same commit
  - [ ] if that holds for both, the set is derived from `EMDASH_VERSION`; if not, record here what the rule really is
  - [ ] decide where `PLUGIN_CLI_VERSION` lives so that it cannot disagree with `EMDASH_VERSION`, and make `check` fail when the two are not a set
  - [ ] `install` pins `@emdash-cms/sandbox-workerd` to the set's version on Node (it is `latest` today, `nu/site.nu:65`)
- [ ] **Settle where a version-matched template comes from**
  - [ ] `git ls-remote --tags $TEMPLATES_REPO`: are there release tags? Record the answer in `docs/emdash.md` § Unverified
  - [ ] if yes: `clone-templates` checks out the tag for `EMDASH_VERSION`
  - [ ] if no: `clone-templates` records the head's "sync templates from emdash vX" in `status`, and the upgrade flow says plainly when the template is older than EmDash; file upstream item 6
  - [ ] the same question and answer for skills (`emdash-cms/skills`, or `.src/emdash/skills/` at the tag): `check`'s "vendored skills" compares against the version the site runs, not the template's copy
- [ ] **A lockfile the project owns** — so that only this flow changes what is installed
  - [ ] `install` restores `config/site.pnpm-lock.yaml` into the site before installing and saves it back after
  - [ ] proof: `setup` twice a day apart, `git diff config/site.pnpm-lock.yaml` is empty
- [ ] **Upgrade in place — the local database survives**
  - [ ] a new command (name it in this step) that: stops the site, copies the local database to `run/backups/<old>-<timestamp>/`, re-pins and installs **without** deleting the site, refreshes template files, runs `refresh`
  - [ ] proof on a throwaway project: start on 1.0.1, add an entry in the admin, upgrade to 1.1.0 — the entry is still there and `emdash doctor` reports migrations "none pending"
  - [ ] when the new version fails to start, the command says how to go back: the old version **and** the copied database, together (`updating.mdx:123`)
  - [ ] `dev` refuses, with that command's name, when the installed EmDash is not `EMDASH_VERSION` — today it carries on silently
- [ ] **Show what changed, before it bites**
  - [ ] print the template's diff, old ref to new, for the two files `config/` was copied from (`astro.config.mjs`, `wrangler.jsonc`) and for `seed/seed.json` — these are the project's now and nothing else will update them
  - [ ] print the diff of `docs/src/content/docs/deployment/updating.mdx` between the two EmDash tags: its "Notes for specific releases" section is where EmDash says what needs action
  - [ ] print the releases URL for the range
- [ ] **Plugins move with it**
  - [ ] every plugin under `plugins/`: set its `emdash` to the new version, install, then `validate`, `typecheck`, `test`, `build` — `plugin audit` already detects the mismatch (`nu/plugin.nu:87-88`)
  - [ ] `SITE_PACKAGES`: after install, list any whose `peerDependencies.emdash` the new version does not satisfy
  - [ ] `plugin:roundtrip` runs as the last step of the flow
- [ ] **The deployed side: migrate knowingly**
  - [ ] before `deploy` ships a build whose EmDash differs from the last deployed one: record the D1 Time Travel bookmark and print the restore command (`backups.mdx:102-116`); on Node, say which file to copy
  - [ ] `emdash migrate --status` runs before the deploy and its pending list is shown
  - [ ] after the deploy and one request to the site, `emdash migrate --check` must exit 0 — see the deploy plan for making `doctor --url` use it
  - [ ] proof: deploy 1.0.1 to a throwaway Worker, upgrade, deploy 1.1.0; the flow shows the pending migrations before and "none pending" after
- [ ] **Prove it in CI**
  - [ ] a `verify:upgrade -- <from> <to>` in the shape of `verify:template`: throwaway project, `setup` on `<from>`, create an entry, upgrade to `<to>`, assert the entry and a clean `doctor`
  - [ ] the full-verification workflow runs it for the last two EmDash releases, on every OS
