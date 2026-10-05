# 2026-10-05 — Live geometry in the Parts panel

**Status:** active — **blocked** — **0 of 3 done**

The panel (`plugins/plat-trunk/src/admin/index.tsx`) renders only what is stored on the entry
(`geometry_meta`). It should fetch live stats from the plat-trunk geometry worker
(`cad.ubuntusoftware.net`), and add a validation badge plus a deep link into the CAD viewport.

## Blocked on — investigated

The blocker is narrower and harder than "we lack a contract":

- **No call was ever written.** Grepping both plugins for `fetch`, `XMLHttpRequest`,
  `ctx.http` and the hostname returns nothing but comments. The integration exists only in
  prose — and `docs/plugin.md` stated it in the present tense, which was false. Corrected.
- **The host does not resolve.** `ubuntusoftware.net` resolves over Cloudflare NS
  (`104.21.41.186`, `172.67.166.150`), but **`cad.ubuntusoftware.net` has no DNS record**, and
  neither does `api.ubuntusoftware.net`. A request could not succeed even if one were written.
- **Two of the three items need no server at all** (below).
- **And the seeded geometry is fiction.** See the next section — this is the real finding.

## What R2 actually holds — the real contract

Checked both buckets and the whole account.

- **The site's own bucket is empty.** `emdash-run-media` (bound as `MEDIA`) contains **0
  objects**; the local wrangler state holds only miniflare's metadata SQLite and nothing else.
- **`brep_file` and `step_file` are `null` on all five seeded parts**, and there are no
  `.step` or `.brep` objects in any bucket on the account.
- **`geometry_meta.model` points at nothing.** All five parts reference
  `cad/parts/<x>.step` — a path that exists in no bucket. The stats beside it (vertices 1842,
  faces 964, `watertight: true`, volume 48.2) therefore have **no source**; they are
  illustrative seed data, not measurements.
- **But the real geometry does exist**, in a different bucket, in a different shape:

  **Bucket `cad-documents`** — 33 objects, keyed `models/<model-id>/…`

  ```
  models/<id>/manifest.json    ~250–480 B   metadata
  models/<id>/scene.json       6 KB–7.6 MB  the scene itself
  models/<id>/automerge.bin    ~180 B–9 KB  Automerge CRDT (collaboration)
  ```

  Real ids: `all-primitives`, `cube-and-cylinder`, `default-cube`, `merged-cubes`,
  `punched-cube`, `solo-sphere`, `solo-torus`, `sphere-grid`, `stacked-cubes`,
  `tower-assembly`, plus opaque ids. **None of them is a part in our seed.**

  `manifest.json` (the closest thing to a geometry contract):

  ```json
  {
    "id": "tower-assembly",
    "name": "Tower Assembly",
    "description": "All four primitive types stacked — a multi-shape tower.",
    "objectCount": 4,
    "version": "0.7.0",
    "createdAt": "2026-02-28T11:24:27.907Z",
    "updatedAt": "2026-03-17T04:20:21.125Z",
    "hasThumbnail": false,
    "actors": { "<user-uuid>": "User", "<user-uuid>": "User" }
  }
  ```

  Note what it does **not** contain: no vertices, faces, edges, bounding box, volume or
  watertight flag. Those are properties of the scene, not the manifest — so computing them
  needs something that reads `scene.json` (or runs the WASM kernel). That is the honest scope
  of a geometry worker here, and it is a smaller ask than "an API that returns stats".

  Also: `cad-docs` (26 objects) holds only screenshots and lesson videos — not geometry.
  And `actors` + `automerge.bin` confirm plat-trunk's real collaboration model is CRDT, which
  matches `docs/why.md`'s diagram.

**The question that now unblocks this plan is not "where is the worker" but: how does a
`parts` entry map to a `models/<id>` document?** Once that join exists, most of this plan is
reachable with zero servers.

## Items

- [ ] **Decide the join: `parts` entry → `models/<id>`** — this is the real blocker now
  - [ ] replace the fabricated `geometry_meta.model` paths with real model ids
  - [ ] decide whether to add a `model_id` field or reuse `geometry_meta.model`
  - [ ] decide whether the panel reads `cad-documents` directly or indirectly
- [ ] **Drop the fiction from the seed**
  - [ ] either derive `geometry_meta`'s stats from a real model, or label them clearly as sample data
  - [ ] delete or populate `brep_file` / `step_file` — they are `null` on every entry, so they currently declare a capability nothing uses
- [ ] **Validation badge** — no server needed
  - [ ] drive it from `geometry_meta.validation`, which the seed carries (`ok` / `warn`), and state plainly that the value is seed data until the join exists
- [ ] **Deep link into the CAD viewport** — needs a URL pattern, not an API
  - [ ] obtain the plat-trunk viewer URL pattern for a model id
  - [ ] render it and confirm in a browser that it opens the right model
- [ ] **Fetch live stats** — genuinely blocked, but smaller than it read
  - [ ] (unblock) find out whether the panel can read the model's `manifest.json` as-is — that alone yields name, description, objectCount, version and `updatedAt` with no worker
  - [ ] (unblock) confirm whether tessellation stats (vertices/faces/bbox/volume) can be computed anywhere today, or whether that is what the worker is for
  - [ ] fetch and render, replacing or augmenting the stored `geometry_meta`
  - [ ] verified in the admin — the values change when the model changes
