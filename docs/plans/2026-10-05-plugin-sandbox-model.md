# 2026-10-05 — Adopt the sandboxed plugin model

**Status:** active — **2 of 8 top-level items done** (items 2 and 4 carry done sub-items but
stay open: item 2 needs a publisher DID, and item 4 needs that DID, the `fields` truncation fix,
and the written comparison)

`plugins/plat-trunk` is a **native** plugin: the host imports it and it renders a React panel
directly. Published plugins are **sandboxed** — a manifest declaring what they may do, plus a
dev and release loop. Reference:
[`swissky/emdash-plugin-linguadash`](https://github.com/swissky/emdash-plugin-linguadash).

The harness already runs a sandboxed plugin: `config/site.astro.config.mjs` has
`sandboxed: [webhookNotifier]` and `sandboxRunner: sandbox()`. Only ours is native.

## What running it actually taught us

Four things were wrong in config files, not missing in code. Each one reads as "the feature
doesn't work" but is really a file lying about the setup:

1. **The scaffolder targets EmDash 0.x.** `emdash-plugin init` wrote `emdash: ">=0.12.0
   <1.0.0"` and installed **0.42.0**, while the site runs **1.1.0** — so the scaffold's green
   test proved nothing about our stack. Pinned to `^1.1.0`; only then is a passing test
   evidence.
2. **The capability is `content:read`, not `read:content`.** A stale comment inside emdash's
   own `plugin-types` says `read:content`; the documented name (and the one the bundle-time
   check enforces) is `content:read`.
3. **Import the package root, not `/sandbox`.** `emdash-plugin build` generates a *descriptor*
   at the root that names `<pkg>/sandbox` as its own entrypoint. Importing `/sandbox` directly
   hands EmDash the implementation and it refuses: *Plugin "undefined" uses the native format
   and cannot be placed in `sandboxed: []`*. Pass the root in as-is — no factory call (unlike
   the native plugin's `platTrunkPlugin()`).
4. **`plugin:link` is not enough.** The descriptor points at a built bundle, so linking
   without building leaves the site importing a file that does not exist. `plugin:build` now
   runs in `repo:apply` before link.

Plus one that was hiding the others: the **native** plugin declared `validate` / `build` /
`dev` / `bundle` / `test` scripts pointing at the sandboxed CLI, and it has no
`emdash-plugin.jsonc` and no `tests/` — so none could ever run. That went unnoticed until the
plugin sweep became generic, at which point one of them broke `repo:apply`.

## Items

- [x] **Scaffold with the real tooling** — both packages are published (`plugin-cli` 0.13.2, `plugin-test` 0.2.7)
  - [x] add `@emdash-cms/plugin-cli` and `@emdash-cms/plugin-test` as devDependencies
  - [x] add the scripts: `validate`, `build`, `dev`, `typecheck`, `test`, `bundle`
  - [x] fix `pnpm-workspace.yaml` — it still held the scaffold's placeholder `workerd: set this to true or false`, so **every `pnpm install` failed** with `ERR_PNPM_IGNORED_BUILDS`. Set to `true` (the sandbox test harness needs workerd's binary).
  - [x] **pin `emdash` to the version the site runs** — the scaffold asked for `>=0.12.0 <1.0.0` and got 0.42.0 while the site is on 1.1.0, so `validate`/`typecheck`/`test` were passing against a different EmDash.
  - [x] `pnpm run validate && pnpm run typecheck && pnpm run test` all pass — in the **sandboxed** twin, which is the only plugin that can run this toolchain.
  - [x] settle the native plugin's `validate`/`build`/`bundle`/`test` scripts: **removed**. They invoked the sandboxed CLI on a plugin with no manifest, so none of them could ever succeed. What remains is `typecheck`, which does. (A script that can't run is worse than no script — it hid a broken `repo:apply`.)
  - [x] generalise the sweep so it can't recur: `scripts/plugin.mjs` runs each plugin's **own** script if it declares one, for `validate`/`build`/`bundle`/`publish`/`login`, exactly as it already did for `typecheck`.
- [ ] **Write the manifest** — `emdash-plugin.jsonc`
  - [ ] `slug`, `publisher` (DID), `license`, `author`, `security`, `name`, `keywords` — all set except `publisher`
  - [x] `capabilities` — `["content:read"]`, exactly what populates `ctx.content` for the panel. Nothing declared "for later": every entry appears in the operator's consent dialog.
  - [x] `allowedHosts` — `[]`. The panel reads local content only, so there is nothing to allow. (Add the geometry worker host here when the panel starts fetching.)
  - [x] `storage` — `{}`. No tables used.
  - [x] `emdash-plugin validate` passes
- [ ] **Add a settings page**
  - [ ] `admin.settingsSchema` with the geometry worker URL as a setting
  - [ ] the panel reads the setting instead of hardcoding it
  - [ ] seen in the admin, saved, and used
- [ ] **Build both — keep the native plugin, add a sandboxed twin**
  - [x] decide: **both, not either.** The harness exists to evaluate EmDash, so implementing the same panel both ways is the strongest comparison — and it forces us to learn both models.
  - [x] scaffold the second plugin — `emdash-plugin init` wrote 14 files into `plugins/plat-trunk-sandboxed`; its full loop (install/validate/typecheck/test/build) passes against emdash 1.1.0.
  - [x] write its `emdash-plugin.jsonc`: `capabilities` / `allowedHosts` / `storage` — only what it uses
  - [x] register it in `config/site.astro.config.mjs` under `sandboxed: []`, leaving the native one in `plugins: []` — **verified**: the dev server logs `Loaded sandboxed plugin plat-trunk-sandboxed:0.1.0 with capabilities: [content:read]` and the site starts.
  - [x] implement the same geometry panel as a sandbox route (`admin.editorPanels` → the private `editor/geometry` route returning Block Kit), reading the saved entry through capability-gated `ctx.content` and the host-attested `routeCtx.ui.entry`
  - [x] `pnpm run validate && pnpm run typecheck && pnpm run test` pass in the new plugin — 2 tests, run through EmDash's production sandbox wrapper
  - [x] **both panels appear on the same Part in the real admin** — the native `<dl>` and the
    sandboxed `Geometry` panel on the same entry, with the sandboxed one starting collapsed and
    calling its private route only when opened, as documented. (The values quoted here used to be
    the seed's old fabricated ones — `HB-001`, `Vertices 5124`, `cad/parts/hb-001.step` — which no
    longer exist; the real, verified values are in the visual-verification item below.)
  - [ ] replace the placeholder publisher DID (`did:plc:REPLACE-WITH-YOUR-PUBLISHER-DID`) with a real one before any release
  - [x] prove the route runs in the **real site** sandbox, not only the test host — `POST /_emdash/api/plugins/plat-trunk-sandboxed/editor/geometry` with the admin token returns `{"success":true,"data":{"blocks":[{"type":"context","text":"No saved entry in context."}]}}`. That confirms the route is mounted, that it returns **Block Kit**, and that it **refuses to be told which entry to read** — identity comes only from the host-attested `routeCtx.ui.entry`.
  - [x] **read the panel's rendered Block Kit in the browser** — done. It required abandoning the
    integrated browser for the **Playwright MCP** one, whose viewport is controllable via
    `page.setViewportSize()`; a full-page screenshot then reaches the below-fold panels. Method
    recorded in AGENTS.md, because the integrated browser genuinely cannot do this.
  - [x] **and the earlier "the route was never called" conclusion was WRONG.** A saved-entry panel
    fetches through the HOST — `POST /_emdash/api/content/<collection>/<entry-id>/plugin-extensions/<plugin-id>`
    — not through `/_emdash/api/plugins/<slug>/editor/geometry`. Grepping the plugin path finds
    nothing, and looks exactly like a panel that never loaded. The panel had worked all along; the
    diagnostic was reading the wrong endpoint. Both exist: the direct plugin route is what a `curl`
    hits, and it returns the same Block Kit the panel renders.
  - [x] **verified visually**: on `top-plate`, both panels render the same data side by side — the
    native `<dl>`, and the sandboxed Block Kit `fields` grid (`TP-001 | Aluminum`,
    `Default Cube | 1`, `0.7.0 | 2026-02-28T11:24:…`, `automerge | cad-documents`,
    `Synced 2026-10-05`). The two-model comparison is now something seen, not inferred.
  - [ ] observed while verifying: the `fields` block **truncates long values** — `Model updated`
    renders as `2026-02-28T11:24:…`. An ISO timestamp is a poor fit for a two-column grid; format
    it before returning it.
  - [ ] compare them in `docs/plugin.md`: what the sandboxed one could not do, and what the native one cannot
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
- [x] **Carry the plugin-authoring skill**
  - [x] `emdash-plugin init` ships `skills/creating-plugins/SKILL.md` plus `.claude/skills` and `.claude/CLAUDE.md` symlinks — the sandboxed twin has all three (and uses the same AGENTS.md + symlink pattern we chose independently)
