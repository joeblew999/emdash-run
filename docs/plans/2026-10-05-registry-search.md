# 2026-10-05 — Use the registry's search filters

**Status:** active

`plugin:catalog` calls `searchPackages` with **no query**, so it only ever fetches every
package. The endpoint supports more than that:

- `q` — full-text (FTS5), or a handle, a DID, or `handle/slug` (which resolves the
  publisher first)
- `capability` — filter by a declared capability
- `cursor` — offset pagination
- `limit` — default 25, max 100

## Items

### 1. `plugin:search -- <query>`

A task that queries the registry and prints the matches (name, slug, author, description).

**Done means:** `mise run plugin:search -- cad` returns matching packages, and
`mise run plugin:search -- @handle/slug` resolves that exact package.

### 2. Let the catalog take a filter

`plugin:catalog` should accept a `q` and/or `capability`, so a subset can be generated —
for example only packages declaring a geometry capability.

**Done means:** `mise run plugin:catalog -- <query>` writes a filtered catalog.

### 3. Record the capability vocabulary

List the distinct `capability` values across the registry, so filtering is discoverable
rather than guesswork.

**Done means:** the capability list is visible in the catalog or in `plugin:search` output.
