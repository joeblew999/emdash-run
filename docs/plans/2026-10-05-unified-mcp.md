# 2026-10-05 — One MCP surface for content and geometry

**Status:** active — **blocked** — **0 of 3 done**

An agent should manage EmDash content *and* plat-trunk geometry from a single tool surface.
EmDash's MCP server is proven here (content, schema, media, taxonomy, menus). The geometry
worker's MCP surface does not exist in this repo yet.

This is the key architectural question for the RICOS integration — the last of the three
questions this harness was built to answer.

## Blocked on — investigated

The geometry worker having an MCP surface, or a contract for one. Investigated, and the
blocker is upstream of a contract:

- **The host in every doc does not resolve.** `ubuntusoftware.net` resolves over Cloudflare
  NS, but `cad.ubuntusoftware.net` has no DNS record — so it is not established that the
  geometry worker is deployed anywhere.
- **No geometry MCP server is configured here either.** `.mcp.json` registers only `emdash`
  (`http://localhost:4321/_emdash/api/mcp`) and `playwright`.
- The **content half is demonstrably ready**: EmDash's MCP server is proven for content,
  schema, media, taxonomy and menus.

So the join cannot be designed until the geometry half exists. This is the same root cause as
[`panel-live-geometry`](2026-10-05-panel-live-geometry.md) — one missing worker blocks both.

## Items

- [ ] **Enumerate the geometry tools**
  - [ ] (unblock) obtain the geometry MCP surface, or its contract
  - [ ] list its tools and compare them with EmDash's
- [ ] **Decide the join**
  - [ ] one server proxying both, or two servers presented as one
  - [ ] the decision written down, with its trade-offs
- [ ] **Prove it end to end**
  - [ ] a single agent call that touches content *and* geometry
  - [ ] the transcript recorded here
