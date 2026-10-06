# Plugin Design Notes

## What the plugin is

A thin EmDash plugin that adds a geometry preview widget to the Parts content editor.
Max (industrial designer) sees geometry stats inline when editing a part — without being an admin.

## How EmDash plugins work (two surfaces)

**Sandboxed (server-side)**
Runs in a Dynamic Worker isolate. Has a capability manifest.
Used for hooks (`content:afterSave` etc), KV storage, Block Kit admin pages.
Cannot talk to internal CF Workers — only declared external hostnames.

**Admin React bundle (browser-side)**
Plain React components. NOT sandboxed. No capability restrictions.
Can fetch anything. Registered as an editor panel on the `parts` collection.
This is where our geometry preview lives.

## Our plugin

```
plugins/plat-trunk/
  package.json      @plat-trunk/emdash-plugin
  src/
    index.ts        descriptor factory (native) + createPlugin runtime
    admin/
      index.tsx     React geometry preview panel (contentEditorPanels)
```

### What the widget does

Field: `geometry_meta` (type: json) on the `parts` collection
Widget id: `plat-trunk:preview`

Receives the JSON field value (vertex/face/edge counts, bounding box, volume, validation
status, model path) and renders it as a label/value grid.

**It makes no network calls.** This section used to claim it "fetches geometry
thumbnail/stats from `cad.ubuntusoftware.net`" — it does not, and never has. There is no
`fetch`, no `XMLHttpRequest` and no `ctx.http` anywhere in either plugin; the hostname
appeared only in prose. The panel renders what is stored on the entry and nothing else.

### What the widget does NOT do

No geometry processing. No WASM. No CRDT. No writes to plat-trunk. No fetching.
Read-only display of the entry's stored fields.

## Status
- **Done.** `plugins/plat-trunk/src/index.ts` — native descriptor + `createPlugin`
- **Done.** `plugins/plat-trunk/src/admin/index.tsx` — `contentEditorPanels` geometry panel
- **Done.** Registered in `config/site.astro.config.mjs` as `platTrunkPlugin()`
- **Done.** `plugins/plat-trunk-sandboxed` — the same panel as a sandboxed plugin: Block Kit
  from the private `editor/geometry` route, declared via `admin.editorPanels`, reading the
  saved part through capability-gated `ctx.content`
- **Verified.** Both panels render on the same Part in the admin — the native `<dl>` expanded
  with the seeded values, the sandboxed panel alongside it (collapsed, as sandboxed panels
  start closed and call their route only when opened)
- **Verified.** The dev server logs
  `Loaded sandboxed plugin plat-trunk-sandboxed:0.1.0 with capabilities: [content:read]`

## Next step

See [`plans/2026-10-05-panel-live-geometry.md`](plans/2026-10-05-panel-live-geometry.md).
In short: the **validation badge** can be driven by `geometry_meta.validation`, which the
entries already store, and the **deep link** needs a URL pattern rather than an API — only
**live** stats need the geometry worker. And that worker is not reachable:
`ubuntusoftware.net` resolves over Cloudflare NS, but `cad.ubuntusoftware.net` has no DNS
record at all, so no call could succeed even once written.

## Publishing — native vs sandboxed
This plugin is **native**: it ships as an npm package and is installed into the site
(`plugins: []` in `astro.config`). There is no registry-publish step for it.

Publishing to the registry is the **sandboxed** flow and lives in a *different* package:
`@emdash-cms/plugin-cli` (binary `emdash-plugin`), which requires an `emdash-plugin.jsonc`
manifest. The site's own `emdash` CLI has **no** `plugin` command.

```bash
pnpm dlx @emdash-cms/plugin-cli init my-plugin    # scaffold (one-off)
pnpm add -D @emdash-cms/plugin-cli                # then use the pinned copy
pnpm exec emdash-plugin validate | bundle | publish | login <handle>
```

See `.claude/skills/emdash/creating-plugins` (shipped with the site).

## The two models, side by side

We run **both**, deliberately. The harness exists to evaluate EmDash, so implementing the
same panel two ways is the finding. `plugins/plat-trunk` is native;
`plugins/plat-trunk-sandboxed` is the scaffolded sandboxed twin (`emdash-plugin init`).

One constraint is worth stating before the table, because it is easy to design past:
**sandboxed plugins are D1-only.** The sandbox plugin bridge talks to a D1 binding directly,
independent of the configured database adapter, so a Node.js or PostgreSQL deployment cannot
run them at all. Since this repo chose Cloudflare + D1, both models are available here — but
the sandboxed one is not portable to the other deployment target, which is a real limitation
of the model and not just of our setup.

| | native (`plugins/plat-trunk`) | sandboxed (`plugins/plat-trunk-sandboxed`) |
|---|---|---|
| Registered as | `plugins: [platTrunkPlugin()]` | `sandboxed: [platTrunkSandboxed]` + `sandboxRunner` |
| Import | a **factory call** — `platTrunkPlugin()` | the package **root**, as-is (no call). `/sandbox` is the entrypoint the root's descriptor names, not something you import |
| Manifest | none | `emdash-plugin.jsonc` — `capabilities` / `allowedHosts` / `storage` are a consent contract |
| Code shape | a React component the host imports | `SandboxedPlugin`: `routes` + hooks the host invokes |
| UI | `contentEditorPanels` → React `<dl>` | `admin.editorPanels` → a private route returning Block Kit (`fields` is the two-column grid) |
| Panel behaviour | renders with the editor | collapses until opened, then calls the route |
| Reading the entry | `entry.data` handed to the component | `routeCtx.ui.entry` (host-attested) → `ctx.content.get(collection, id)` |
| Build | none — the host compiles the source | `emdash-plugin build` → `dist/{index,plugin}.mjs` + `manifest.json` |
| Test | none | `@emdash-cms/plugin-test`: `createPluginTestHost()` → `invokeRoute(…)`, `createPluginRuntimeTestHost()` → `admin.loadEditorPanel(…)`, both through EmDash's production sandbox |
| Privileges | whatever the host has | only what the manifest declares — here just `content:read` |
| Release | npm only | registry + npm with provenance; changing the trust contract **requires** a version bump |
| Ships browser code | yes | **no** — the host renders the blocks |

The scaffold also gave us things we had nowhere: a passing test through the sandbox harness,
`vitest.config.ts`, and `skills/creating-plugins/SKILL.md` with `.claude/skills` +
`.claude/CLAUDE.md` copies — the same AGENTS.md pattern we chose independently.

## Known limitations of the panel

Reading `creating-plugins/references/admin-ui.md` confirmed the saved-entry implementation is
correct — private route, host-attested `routeCtx.ui.entry`, capability-gated `ctx.content`, and
`createPluginRuntimeTestHost().admin` as the test boundary — but it also named two limits worth
stating rather than discovering later:

- **The panel shows SAVED values only, and cannot show unsaved edits.** `panel_load` never
  carries draft data, by design. Reading unsaved fields needs `admin.editor-draft:read` plus an
  explicit interaction (a button or form submit), because the host only attaches a draft
  snapshot after the editor asks for one. So an editor who changes `geometry_meta` and has not
  saved sees the panel's old values. That is the host's safety model, not a bug in our panel —
  but it is a real UX consequence, and the fix would be an explicit "recompute from unsaved"
  action rather than anything implicit.
- **A `secret` settings field needs `EMDASH_ENCRYPTION_KEY`, and fails closed without it.** The
  docs are explicit that missing, wrong, or tampered key material fails closed. This repo has no
  encryption key in **either** environment (see [`plans/2026-10-05-live-content.md`](plans/2026-10-05-live-content.md)),
  so nothing is broken today — but the first `secret` setting will not work until that is set.
  `emdash secrets generate` is the documented way to create one.

## What actually bit us

All four were files lying about the setup, not missing features:1. **The scaffolder targets EmDash 0.x.** It wrote `emdash: ">=0.12.0 <1.0.0"` and installed
   **0.42.0** while the site runs **1.1.0** — so its green test proved nothing about our stack.
   Pinned to `^1.1.0` before trusting anything it said.
2. **The capability is `content:read`.** A stale comment inside emdash's own `plugin-types`
   says `read:content`; the documented name is what the bundle-time check enforces.
3. **The import is the package root.** Importing `/sandbox` directly hands EmDash the
   implementation and it refuses: *Plugin "undefined" uses the native format and cannot be
   placed in `sandboxed: []`*.
4. **`plugin:link` alone is not enough** — the descriptor points at a built bundle, so
   `plugin:build` has to run before the site resolves it. It now runs in `repo:apply`.

And one that hid the rest: the **native** plugin had `validate` / `build` / `bundle` / `test`
scripts pointing at the sandboxed CLI, with no manifest and no tests to run them. They went
unnoticed until the plugin sweep became generic, where one of them broke `repo:apply`.

Tracked in [`plans/2026-10-05-plugin-sandbox-model.md`](plans/2026-10-05-plugin-sandbox-model.md).
