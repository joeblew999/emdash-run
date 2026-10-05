# 2026-10-05 — Repo checks: typecheck and lint

**Status:** active

Nothing in this repo is typechecked or linted. `plugins/plat-trunk` has a `tsconfig.json`
that has never been run, and there is no formatter or linter — so mistakes surface only
when something breaks at runtime. That is the biggest gap in the harness.

## Items

### 1. Typecheck the plugin — **done 2026-10-05**

`tsc --noEmit` passes, wired in as `plugin:typecheck` and run by `repo:apply`. The first
run found three real faults — the plugin had never been checked:

- `tsconfig.json` had **no `jsx`**, so the TSX panel could never have typechecked.
- no **`skipLibCheck`** — `emdash`'s optional storage drivers (`unstorage` → mongodb,
  ioredis, @vercel/kv, @deno/kv…) flooded the output.
- no **`@types/react`** — `react/jsx-runtime` had no declarations.

Remaining here: the repo-level lint (item 2) and wiring that into `repo:apply` (item 3).

### 2. `repo:check` — lint and format

Pick a tool (the emdash monorepo uses `oxlint`/`oxfmt`; biome is the alternative), add it
as a devDependency, and add a task covering `scripts/` and `plugins/`.

**Done means:** `mise run repo:check` exits 0; the first run's findings are either fixed or
explicitly silenced with a reason.

### 3. Wire both into the loop

Add them to `repo:apply`'s `depends`, so a broken type or a lint error cannot pass unnoticed.

**Done means:** `repo:apply` fails when either check fails.

### 4. Typecheck the site too

`@astrojs/check` is already a dependency of the site, so `astro check` can typecheck the
Astro project. The site itself is currently unchecked.

**Done means:** `mise run site:check` runs `astro check` against `.src/site` and exits 0.

### 5. Test the scripts

There are no tests anywhere, and `scripts/*.mjs` is the largest untested surface: JSON
parsing, `fetch`, symlinks, path handling. Even a few unit tests over the pure helpers
(shaping the catalog, resolving plugin names, merging the seed) would catch real regressions.

**Done means:** `mise run repo:test` runs a suite over `scripts/` and exits 0.
