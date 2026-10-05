# 2026-10-05 — Live content: export a seed, re-seed production

**Status:** active — **2 of 4 done**, 1 blocked on a production token

The deployed D1 was seeded **before** `geometry_meta` was added to `config/cad.seed.json`, and
a seed only applies to a fresh database. The live part editor shows only Part number and
Material; local shows the full geometry block.

## Confirmed: the deployed site is up but does not have our content

`https://emdash-run.gedw99.workers.dev/` → **200**, but `/parts/mounting-plate` → **404**, and its content API returns `NOT_AUTHENTICATED`. So the plan's premise holds: the deployed D1 was seeded before `geometry_meta` and `model_id` existed, and a seed only applies to a fresh database. **EmDash as the content layer is currently proven locally only.**

## Items

- [x] **Learn the `emdash export-seed` round trip**
  - [x] run `emdash export-seed --with-content=all` against the local site — **and learn the trap**: it reads a database *file* (`-d`, default `./data.db`), the same file-vs-D1 confusion as `emdash seed`. `-d .wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite` reads the dev server's real DB.
  - [x] diff the result against `config/cad.seed.json` — **no drift.** Both exports (default and D1) are byte-identical, and against the applied seed: same 5 collections, identical `parts` field list, identical content counts (`projects:2 assemblies:2 parts:5 pages:1 posts:1`) and slugs, identical values.
  - [x] every difference understood: the only one is **key order** inside `data` — the `geometry_meta` JSON column round-trips with keys reordered. Not drift.
  - [x] noted: the export re-expresses references as portable `$ref:` (the applied seed stores a raw entry id; the export writes `$ref:assemblies:main-bracket`).
  - [x] **the better portability tool is `emdash site export|import`** — a tar of `manifest.json` + `records/<table>/*.ndjson` covering schema *and* content, with a `packageDigest`. Ran it against local: 14 files, 38912 bytes, `sha256:2c154ed4…`. Critically it is **remote-first** (`-u/--url`, `-t/--token`), so it reads the running instance over HTTP and sidesteps the file-DB trap entirely.
- [ ] **Re-seed the live D1** — **blocked on a production token**
  - [x] choose the path — `emdash site import` is the right tool, but it requires an **empty** site (`import <file> --analyze`, then `--plan <digest> --confirm`), and production is not empty (it has the template's posts and pages). So it is wipe-then-import, or a different path.
  - [x] mint a token — **cannot be done from here.** `emdash whoami -u https://…` → `Token is invalid or expired`, and there is no dev-bypass in production. A token has to be minted by an authenticated admin (passkey) through the live admin UI.
  - [x] considered forging one in SQL: `_emdash_api_tokens.token_hash` exists, but tokens are stored **hashed** (43-char base64), so minting one means guessing the scheme. Deliberately not done.
  - [ ] get a production admin token, then wipe + `site import` the local package
  - [ ] the live part editor shows Model / Objects / Model version / Model updated / Format / Source / Synced
- [x] **Check production secrets** — `wrangler secret list` → `[]`
  - [x] **production has no secrets at all**, so no `EMDASH_ENCRYPTION_KEY`
  - [x] local does not have one either (no `.env`), and the exported package contains **no encrypted values** — settings are plain (`site_title`, `site:title`, `site:tagline`)
  - [x] so nothing is broken *today*. But the moment any plugin setting is declared `type: "secret"`, encryption has no key in either environment. Worth setting before that, not after.
- [x] **Live logs** — `wrangler tail` connects
  - [x] the recipe: `fnox exec -- sh -c 'cd .src/site && pnpm exec wrangler tail --format pretty'`. It must run from `.src/site` — from the repo root it fails with `ERR_PNPM_NO_PKG_MANIFEST`, because there is no root package.json for `pnpm exec` to resolve against.
  - [x] used it: `Successfully created tail`, `Connected to emdash-run, waiting for logs...`
  - [x] gotcha recorded: the tail takes a few seconds to establish, and requests sent during that window are **not** captured. Drive traffic only after it says it is connected — otherwise it looks like tailing is broken.
  - [ ] capture one real request end to end, in a second terminal
