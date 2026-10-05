# 2026-10-05 — Use more of the emdash CLI

**Status:** active

We call exactly **one** subcommand of the site's CLI: `seed --validate`. Several others do
things this repo currently does by hand, or not at all.

## Items

### 1. `emdash doctor` → `site:doctor`

Checks database health, scheduler wiring and other diagnostics. Cheap, and it belongs in the
loop next to `plugin:typecheck`.

**Done means:** `mise run site:doctor` reports a healthy local site, and fails loudly when
something is wrong.

### 2. `emdash types` → generated schema types

Generates TypeScript types from the live schema. Today `geometry_meta` is
`Record<string, unknown>`, so the panel's data access is unchecked; generated types would
make it typed.

**Done means:** the types are generated and the panel uses them (no `unknown` casts).

### 3. `emdash migrate` → understand deployment migrations

We rely on dev-bypass auto-migrating the local database. Production migrations are
deployment-managed — find out exactly what that means *before* the next schema change.

**Done means:** the production migration path is written down, and has been exercised once.

### 4. `emdash site export|import` → a whole-site package

Exports and imports a site as a `.emdash` package — a backup, and a way to move content
between the local and live sites.

**Done means:** the local site is exported once, and the package is documented as the backup
path.
