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

Receives the JSON field value (contains R2 key, vertex/face/edge counts, bounding box, validation status).
Fetches geometry thumbnail/stats from `cad.ubuntusoftware.net` (our Hono Worker).
Renders inline stats + validation badge + link to full CAD viewport.

### What the widget does NOT do

No geometry processing. No WASM. No CRDT. No writes to plat-trunk.
Read-only display + deep link. The actual geometry lives in plat-trunk.

## Status
- **Done.** `plugins/plat-trunk/src/index.ts` — native descriptor + `createPlugin`
- **Done.** `plugins/plat-trunk/src/admin/index.tsx` — `contentEditorPanels` geometry panel
- **Done.** Registered in `config/site.astro.config.mjs` as `platTrunkPlugin()`
- **Verified.** Renders in the Parts editor: "Geometry" → Part number / Material (plus
  any keys on `geometry_meta`)

## Next step

Fetch live geometry stats from the plat-trunk worker (`cad.ubuntusoftware.net`) in the
panel, and add a validation badge + deep link to the CAD viewport. The panel currently
renders only what is stored on the entry.

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

| | native (`plugins/plat-trunk`) | sandboxed (`plugins/plat-trunk-sandboxed`) |
|---|---|---|
| Registered as | `plugins: [platTrunkPlugin()]` | `sandboxed: [platTrunkSandboxed]` + `sandboxRunner` |
| Manifest | none | `emdash-plugin.jsonc` — `capabilities` / `allowedHosts` / `storage` are a consent contract |
| Code shape | a React component the host imports | `SandboxedPlugin`: `routes` + hooks the host invokes |
| UI | `contentEditorPanels` → React | `admin.editorPanels` → a route the sandbox serves |
| Build | none — the host compiles the source | `emdash-plugin build` → `dist/{index,plugin}.mjs` + `manifest.json` |
| Test | none | `@emdash-cms/plugin-test`: `createPluginTestHost()` → `host.invokeRoute(…)`, in EmDash's production sandbox |
| Privileges | whatever the host has | only what the manifest declares — by default just logging, KV and route/hook registration |
| Release | npm only | registry + npm with provenance; changing the trust contract **requires** a version bump |

The scaffold also gave us things we had nowhere: a passing test through the sandbox harness,
`vitest.config.ts`, and `skills/creating-plugins/SKILL.md` with `.claude/skills` +
`.claude/CLAUDE.md` symlinks — the same AGENTS.md pattern we chose independently.

Tracked in [`plans/2026-10-05-plugin-sandbox-model.md`](plans/2026-10-05-plugin-sandbox-model.md).
