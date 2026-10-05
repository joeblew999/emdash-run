# 2026-10-05 — Live content: export a seed, re-seed production

**Status:** active

The deployed D1 was seeded **before** `geometry_meta` was added to `config/cad.seed.json`,
and a seed only applies to a fresh database. So the live part editor shows only Part number
and Material, while local shows the full geometry block. The CLI has a command for exactly
this that we have never run.

## Items

### 1. Learn the `emdash export-seed` round trip

`emdash export-seed --with-content` dumps the database's schema and content as a seed. Run
it against the **local** site first and diff the result against `config/cad.seed.json` —
that also tells us whether the local database has drifted from the seed it was built from.

**Done means:** the exported seed is compared with ours and every difference is understood.

### 2. Re-seed the live D1

Either push a seed to the live database, or update the live entries through the admin.
There is no dev-bypass in production, so a scripted path needs either an MCP token minted
on the live site or `wrangler d1 execute --remote`.

**Done means:** the live part editor shows Vertices / Faces / Bounding box / Validation.

### 3. Check production secrets

Establish whether the live Worker needs secrets the local one does not (an encryption key
for secret settings fields is the likely one), and document the `wrangler secret put` path.

**Done means:** either nothing is needed, or the secrets are set and written down.
