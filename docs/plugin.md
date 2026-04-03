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
Can fetch anything. Registered as field widgets.
This is where our geometry preview lives.

## Our plugin

```
plugin/
  package.json      @plat-trunk/emdash-plugin
  src/
    index.ts        plugin descriptor — registers the widget
    admin.tsx       React geometry preview component
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

- `plugin/src/index.ts` — written, not tested
- `plugin/src/admin.tsx` — written, not tested
- `config/astro.config.mjs` — does NOT yet import or register the plugin
- No build step set up yet

## Next step

Register the plugin in `config/astro.config.mjs` and verify it loads
without errors when `mise run server:start` starts.
