# 2026-10-05 — Adopt the sandboxed plugin model

**Status:** active — **0 of 8 done**

`plugins/plat-trunk` is a **native** plugin: the host imports it and it renders a React panel
directly. Published plugins are **sandboxed** — a manifest declaring what they may do, plus a
dev and release loop. Reference:
[`swissky/emdash-plugin-linguadash`](https://github.com/swissky/emdash-plugin-linguadash).

The harness already runs a sandboxed plugin: `config/site.astro.config.mjs` has
`sandboxed: [webhookNotifier]` and `sandboxRunner: sandbox()`. Only ours is native.

## Items

- [ ] **Scaffold with the real tooling** — both packages are published (`plugin-cli` 0.13.2, `plugin-test` 0.2.7)
  - [ ] add `@emdash-cms/plugin-cli` and `@emdash-cms/plugin-test` as devDependencies
  - [ ] add the scripts: `validate`, `build`, `dev`, `typecheck`, `test`, `bundle`
  - [ ] `pnpm run validate && pnpm run typecheck && pnpm run test` all pass
- [ ] **Write the manifest** — `emdash-plugin.jsonc`
  - [ ] `slug`, `publisher` (DID), `license`, `author`, `security`, `name`, `keywords`
  - [ ] `capabilities` — only what the code uses (`network:request` if the panel fetches)
  - [ ] `allowedHosts` — the geometry worker host and nothing else
  - [ ] `storage` — only if we actually add tables
  - [ ] `emdash-plugin validate` passes
- [ ] **Add a settings page**
  - [ ] `admin.settingsSchema` with the geometry worker URL as a setting
  - [ ] the panel reads the setting instead of hardcoding it
  - [ ] seen in the admin, saved, and used
- [ ] **Decide native vs sandboxed**
  - [ ] write the decision and its cost into `docs/plugin.md`
  - [ ] if sandboxed: list exactly what we lose (React panels, direct host access)
- [ ] **Public-site components** (`./astro`) — sandboxed plugins cannot add markup, so they ship components
  - [ ] one component that renders part/assembly data
  - [ ] rendered on the public site
- [ ] **A custom admin page** (`admin.pages`)
  - [ ] a geometry / validation page
  - [ ] appears in the admin sidebar and lists something real
- [ ] **The release path**
  - [ ] `emdash-plugin bundle` produces a bundle
  - [ ] a publisher DID obtained and recorded
  - [ ] the version-bump rule written down: changing `capabilities` / `allowedHosts` / `storage` **requires** a version bump
- [ ] **Carry the plugin-authoring skill**
  - [ ] `skills/creating-plugins/SKILL.md` in the repo, or the reason it is not, written down
