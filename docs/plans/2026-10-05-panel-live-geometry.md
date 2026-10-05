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
- **Two of the three items need no server at all** (below), so most of this plan is not
  actually blocked.

The one question that unblocks the rest: **does the geometry worker exist, and at what
hostname?**

## Items

- [ ] **Validation badge** — no server needed
  - [ ] drive it from `geometry_meta.validation`, which every seeded part already carries (`ok` / `warn`)
  - [ ] once the worker exists, let its status supersede the stored one
- [ ] **Deep link into the CAD viewport** — needs a URL pattern, not an API
  - [ ] obtain the CAD viewport URL pattern for a part (by id? slug? the `model` R2 key?)
  - [ ] render it and confirm in a browser that it lands on the right part
- [ ] **Fetch and render live stats** — genuinely blocked
  - [ ] (unblock) confirm the worker exists and record its hostname here
  - [ ] (unblock) record the endpoint path, response shape, and auth
  - [ ] fetch the entry's part stats and render them, replacing or augmenting the stored `geometry_meta`
  - [ ] verified in the admin — the values change when the geometry changes
