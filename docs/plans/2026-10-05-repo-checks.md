# 2026-10-05 — Repo checks: typecheck and lint

**Status:** active

Nothing in this repo is typechecked or linted. `plugins/plat-trunk` has a `tsconfig.json`
that has never been run, and there is no formatter or linter — so mistakes surface only
when something breaks at runtime. That is the biggest gap in the harness.

## Items

### 1. `plugin:typecheck`

`tsc` is already available in the site's `node_modules`. Add `typescript` as a devDependency
of `plugins/plat-trunk` and a task that runs `tsc --noEmit` against its tsconfig.

**Done means:** `mise run plugin:typecheck` exits 0 — and fails on a deliberately
introduced type error.

### 2. `repo:check` — lint and format

Pick a tool (the emdash monorepo uses `oxlint`/`oxfmt`; biome is the alternative), add it
as a devDependency, and add a task covering `scripts/` and `plugins/`.

**Done means:** `mise run repo:check` exits 0; the first run's findings are either fixed or
explicitly silenced with a reason.

### 3. Wire both into the loop

Add them to `repo:apply`'s `depends`, so a broken type or a lint error cannot pass unnoticed.

**Done means:** `repo:apply` fails when either check fails.
