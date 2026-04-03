---
id: "0003"
title: "Register the geometry preview plugin in astro.config.mjs"
status: "proposed"
date: "2026-04-02"
---

# ADR-0003 — Register the geometry preview plugin in astro.config.mjs

## Status

Proposed

## Context

The stated objective of this project is: an industrial designer (Max) opens a CAD part in the EmDash admin UI and sees geometry stats inline — vertex count, face count, bounding box, validation status — without needing to be an admin or open a separate CAD tool.

The plugin that delivers this exists:

```
plugin/
  package.json      @plat-trunk/emdash-plugin
  src/
    index.ts        plugin descriptor — registers widget id plat-trunk:preview
    admin.tsx       React component — fetches + renders geometry stats
```

The widget is bound to the `geometry_meta` JSON field on the `parts` collection. It fetches geometry data from `cad.ubuntusoftware.net` and renders inline stats plus a link to the full CAD viewport.

However, `config/astro.config.mjs` does not import or register the plugin. The widget is written but never loaded. Max sees a plain JSON editor for `geometry_meta` instead of the geometry preview.

No build step for the plugin is set up either — `plugin/src/` contains TypeScript/TSX source that needs to be compiled before EmDash can load it.

## Decision

1. Set up a build step for the plugin (`tsup` or `tsdown`) so `plugin/src/` compiles to `plugin/dist/`.
2. Add the plugin build to `server:build` in `mise.toml` so it is always compiled before the server starts.
3. Import and register the plugin in `config/astro.config.mjs`.
4. Restart the server and verify the plugin loads without errors.
5. Verify the widget renders in the Parts editor using `agent-browser`.

The plugin is admin-bundle side (React, browser) — not sandboxed. It can fetch `cad.ubuntusoftware.net` directly. No capability manifest changes are needed.

## Consequences

- Max sees geometry stats inline when editing any part that has a `geometry_meta` value.
- Parts without `geometry_meta` show nothing (the widget renders empty gracefully).
- The plugin rebuild is part of `server:build` — changes to `plugin/src/` trigger a Vite hot reload via the `watch` directive in `pitchfork.toml` (`plugin/src/**`).
- This is the step that makes the project useful for its intended user.
