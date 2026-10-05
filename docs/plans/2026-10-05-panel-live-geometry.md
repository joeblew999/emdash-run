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

- [x] **Decide the join: `parts` → `models/<id>`** — decided and implemented
  - [x] a new `model_id` field on `parts`, rather than reusing `geometry_meta.model`: the id is the *reference*, and `geometry_meta` is a *snapshot of that reference's metadata*. Merging them would leave it ambiguous which is authoritative.
  - [x] the fabricated `geometry_meta.model` path is gone
  - [x] the panel reads it **indirectly**, through the entry. A browser component cannot use an R2 binding, and there is no endpoint — reading `cad-documents` directly needs one of those. Recorded as a deliberate deferral, not an oversight.
- [x] **Drop the fiction from the seed** — done, verified in the admin
  - [x] every `geometry_meta` value is a real manifest field from a real model (`model_name`, `objects`, `model_version`, `model_updated`, `format`, `source`, `synced`)
  - [x] the fabricated tessellation stats are **deleted**, not relabelled — nothing can source them yet
  - [x] `brep_file` and `step_file` **deleted** from the collection: `null` on every entry, and no STEP/BREP object exists in any of the account's 20 buckets
  - [x] `format` is `automerge`, which is what is actually stored
  - [x] verified: the panel renders Part number / Material / Model / Objects / Model version / Model updated / Format / Source / Synced, and the content API returns the same
  - [x] the sandboxed twin's test asserts the same rows, so both models stay equivalent
  - [x] **made the seed actually reachable** — see the seed-apply gap in [`repo-checks`](2026-10-05-repo-checks.md); a seed edit previously could not reach the running site at all
- [ ] **Validation badge** — now blocked rather than readyable
  - deleting the fabricated stats removed the only `validation` value the panel had. `manifest.json` has no validation field, so a real one needs whatever can read `scene.json`
  - [ ] (unblock) find a real source for validation status
- [ ] **Deep link into the CAD viewport** — needs a URL pattern, not an API
  - [ ] obtain the plat-trunk viewer URL pattern for a model id, and confirm a model id alone addresses it
  - [ ] render it and confirm in a browser that it opens the right model
- [ ] **Fetch live stats** — the manifest half is now shown; only the scene half is missing
  - [x] answered: a model's `manifest.json` yields name, description, objectCount, version and `updatedAt`. Those are now rendered — from a snapshot taken 2026-10-05, and the panel says so via `synced`
  - [ ] (unblock) decide whether the panel should read the manifest live instead of from a snapshot. That needs an endpoint or a binding, so it is the same question as the worker
  - [ ] (unblock) confirm whether tessellation stats (vertices/faces/bbox/volume) can be computed anywhere today, or whether that is what the worker is for
  - [ ] make staleness visible: `synced` is shown, but nothing warns when it is old
