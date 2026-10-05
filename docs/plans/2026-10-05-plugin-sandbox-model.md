# 2026-10-05 — Adopt the sandboxed plugin model

**Status:** active

`plugins/plat-trunk` is a **native** plugin: the host imports it and it renders a React
panel directly. That works — but it is not the model the ecosystem ships. Published plugins
are **sandboxed**, with a manifest declaring what they may do, and a dev/release loop that
proves it.

Reference: [`swissky/emdash-plugin-linguadash`](https://github.com/swissky/emdash-plugin-linguadash)
— a real, published sandboxed plugin (registry + npm), with a manifest, tests and a release
pipeline.

## What it has that we do not

| | LinguaDash | us |
|---|---|---|
| Manifest | `emdash-plugin.jsonc`: `capabilities`, `allowedHosts`, `storage`, `admin.*`, `release.*` | none |
| Admin surfaces | settings page (`settingsSchema`, incl. `type: "secret"`), a custom admin page (`admin.pages`), an editor panel | one editor panel |
| Exports | `.` host · `./sandbox` bundle · `./astro` public-site components | `.` and `./admin` |
| Dev loop | `validate` · `build` · `dev` · `typecheck` · `test` | none |
| Release | GitHub Actions → registry publish + npm with provenance | none |

## Why the manifest matters

`capabilities`, `allowedHosts` and `storage` are a **trust contract**: a user consents to it
when they install. Changing any of them requires a version bump, or new behaviour slips past
that consent. A plugin with no manifest cannot make that promise at all.

## What this implies elsewhere — it is not only about the plugin

Studying a real sandboxed plugin exposes how this repo differs everywhere:

- **We already run sandboxed plugins.** `config/site.astro.config.mjs` has
  `sandboxed: [webhookNotifier]` and `sandboxRunner: sandbox()`. The harness *is* a sandbox
  host — only our own plugin is native.
- **Almost nothing we author is verified automatically.** There are no tests anywhere — not
  for the plugin, not for the 13 `scripts/*.mjs`. The only automated guard is `mise:check`.
  The ecosystem runs `@emdash-cms/plugin-test` (a sandbox harness) plus vitest. Wiring
  `plugin:typecheck` into `repo:apply` already caught three real faults on its first run.
- **We declare nothing machine-readable.** Capabilities / hosts / storage are a manifest
  concept; we have no equivalent statement of what our code is allowed to touch.
- **Our secrets are dev-only.** `run/token-admin.env` is injected by mise for local work.
  The ecosystem's settings use `type: "secret"`, encrypted with `EMDASH_ENCRYPTION_KEY` —
  which also gives production a path.
- **We ship unbuilt source.** Our plugin exports `./src/*.ts(x)` straight from the repo;
  published plugins ship a built `dist` with declarations.
- **We only read the registry, never write to it.** `plugin:catalog` fetches; the other half
  is publishing (`emdash-plugin login` + `publish`, with a publisher DID).

## Items

### 1. Scaffold with the real tooling

Add `@emdash-cms/plugin-cli` and `@emdash-cms/plugin-test` as devDependencies, plus the
generated scripts: `validate`, `build`, `dev`, `typecheck`, `test`, `bundle`.

**Done means:** `pnpm run validate && pnpm run typecheck && pnpm run test` all pass.

### 2. Write the manifest

`emdash-plugin.jsonc` declaring exactly what plat-trunk uses and nothing more: the
capabilities it needs, the geometry worker host, any storage.

**Done means:** `emdash-plugin validate` passes, and every capability and host the code
actually uses is declared — with nothing extra.

### 3. Add a settings page

`admin.settingsSchema` with the geometry worker's URL as a setting, so it is configurable
rather than baked into the code. Secrets use `type: "secret"` (encrypted — see
`2026-10-05-live-content.md`).

**Done means:** the setting appears in the admin, saves, and the panel reads it.

### 4. Decide native vs sandboxed

Native gives React panels and direct host access; sandboxed gives the trust contract, the
registry release path and the dev loop. Record the decision and what it costs us.

**Done means:** the choice is written down in `docs/plugin.md`, with its consequences.
