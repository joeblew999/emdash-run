# 2026-10-05 — Live geometry in the Parts panel

**Status:** active — **blocked**

The panel (`plugins/plat-trunk/src/admin/index.tsx`) renders only what is stored on the
entry (`geometry_meta`). It should fetch live stats from the plat-trunk geometry worker
(`cad.ubuntusoftware.net`), and add a validation badge plus a deep link into the CAD
viewport.

## Blocked on

The geometry worker's contract: endpoint path, response shape, auth. This is not startable
without it.

## Items (once unblocked)

### 1. Fetch and render live stats

Fetch the entry's part stats from the worker and render them, replacing or augmenting the
stored `geometry_meta`.

### 2. Validation badge

A badge driven by the worker's status.

### 3. Deep link

A link that opens the CAD viewport on that part.

**Done means:** the panel shows values that change when the geometry changes, and the link
opens the right viewport — verified in the admin, not reasoned about.
