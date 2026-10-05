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
