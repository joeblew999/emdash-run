# 2026-10-05 — Live content: export a seed, re-seed production

**Status:** active — **0 of 4 done**

The deployed D1 was seeded **before** `geometry_meta` was added to `config/cad.seed.json`, and
a seed only applies to a fresh database. The live part editor shows only Part number and
Material; local shows the full geometry block.

## Items

- [ ] **Learn the `emdash export-seed` round trip**
  - [ ] run `emdash export-seed --with-content` against the **local** site
  - [ ] diff the result against `config/cad.seed.json`
  - [ ] every difference understood — the drift either fixed or explained
- [ ] **Re-seed the live D1**
  - [ ] choose the path: push a seed, or edit through the live admin (there is no dev-bypass in production)
  - [ ] if scripted: mint an MCP token on the live site, or use `wrangler d1 execute --remote`
  - [ ] the live part editor shows Vertices / Faces / Bounding box / Validation
- [ ] **Check production secrets**
  - [ ] establish whether the live Worker has `EMDASH_ENCRYPTION_KEY` (`emdash secrets generate` creates one)
  - [ ] set it with `wrangler secret put` if it is missing
  - [ ] written down
- [ ] **Live logs**
  - [ ] a documented way to `wrangler tail` the live Worker
  - [ ] used once to watch a real request
