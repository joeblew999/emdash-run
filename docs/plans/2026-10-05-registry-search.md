# 2026-10-05 — Use the registry's search filters

**Status:** active — **0 of 3 done**

`plugin:catalog` calls `searchPackages` with **no query**, so it only ever fetches every
package. The endpoint also takes: `q` (full-text, or a handle/DID, or `handle/slug`),
`capability`, `cursor` (offset pagination), `limit` (default 25, max 100).

## Items

- [ ] **`plugin:search -- <query>`**
  - [ ] a script verb + task that queries the registry and prints name / slug / author / description
  - [ ] `mise run plugin:search -- cad` returns matching packages
  - [ ] `mise run plugin:search -- @handle/slug` resolves that exact package
- [ ] **Let the catalog take a filter**
  - [ ] `plugin:catalog` accepts a `q` and/or `capability`
  - [ ] `mise run plugin:catalog -- <query>` writes a filtered catalog
- [ ] **Record the capability vocabulary**
  - [ ] list the distinct `capability` values across the registry
  - [ ] visible in the catalog or in `plugin:search` output
