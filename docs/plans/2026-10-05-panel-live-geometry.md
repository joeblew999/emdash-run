# 2026-10-05 — Live geometry in the Parts panel

**Status:** active — **blocked** — **0 of 3 done**

The panel (`plugins/plat-trunk/src/admin/index.tsx`) renders only what is stored on the entry
(`geometry_meta`). It should fetch live stats from the plat-trunk geometry worker
(`cad.ubuntusoftware.net`), and add a validation badge plus a deep link into the CAD viewport.

## Blocked on

The geometry worker's contract: endpoint path, response shape, auth. Not startable without it.

## Items

- [ ] **Fetch and render live stats**
  - [ ] (unblock) obtain the worker's endpoint contract and record it here
  - [ ] fetch the entry's part stats and render them, replacing or augmenting the stored `geometry_meta`
- [ ] **Validation badge**
  - [ ] driven by the worker's status
- [ ] **Deep link**
  - [ ] opens the CAD viewport on that part
  - [ ] verified in the admin — the values change when the geometry changes, and the link lands on the right part
