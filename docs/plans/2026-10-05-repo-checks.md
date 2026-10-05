# 2026-10-05 — Repo checks: typecheck, lint, tests

**Status:** active — **1 of 5 done**

Nothing in this repo was verified automatically: no typecheck, no lint, no tests. Wiring the
plugin typecheck into `repo:apply` immediately found three real faults, so the rest of this
is worth doing.

## Items

- [x] **Typecheck the plugin** — `tsc --noEmit` passes, wired in as `plugin:typecheck`.
  - [x] add `jsx: "react-jsx"` to `plugins/plat-trunk/tsconfig.json` — the TSX panel could never have typechecked without it
  - [x] add `skipLibCheck` — `emdash`'s optional `unstorage` drivers (mongodb, ioredis, @vercel/kv, @deno/kv…) flooded the output
  - [x] add `@types/react` — `react/jsx-runtime` had no declarations
  - [x] `typecheck` script plus `typescript` / `@types/react` devDeps
  - [x] `plugin:typecheck` task, added to `repo:apply`'s `depends`
- [ ] **Lint and format**
  - [ ] pick a tool — `oxlint`/`oxfmt` (what the emdash monorepo uses) or biome
  - [ ] add it as a devDependency of the repo
  - [ ] `repo:check` task covering `scripts/` and `plugins/`
  - [ ] fix or explicitly silence the first run's findings, each with a reason
- [ ] **Typecheck the site**
  - [ ] `site:check` task running `astro check` against `.src/site` (`@astrojs/check` is already installed)
  - [ ] wire it into `repo:apply`
- [ ] **Test the scripts** — 13 `scripts/*.mjs`, zero tests today: JSON parsing, `fetch`, symlinks, paths
  - [ ] pick a runner (vitest, as the plugin ecosystem uses)
  - [ ] unit tests for the pure helpers — catalog shaping, plugin-name resolution, seed merge
  - [ ] `repo:test` task
  - [ ] wire it into `repo:apply`
- [ ] **Prove the checks actually block**
  - [ ] break one deliberately (a type error, then a lint error) and confirm `repo:apply` fails
  - [ ] record the result here
