# 2026-10-05 — Point the registry UI at the local registry

**Status:** active — **0 of 2 done**

`apps/plugins-site` (the registry's own web UI) calls `registryLoader()` with **no options**,
so it is hardcoded to the hosted registry — `https://registry.emdashcms.com` is baked into
`@emdash-cms/registry-loader`, with no environment override. We can run the UI, but it shows
*their* packages, not ours.

## Items

- [ ] **Patch the loader**
  - [ ] `src/live.config.ts` in the clone uses `registryLoader({ aggregatorUrl: process.env.EMDASH_REGISTRY_URL })`
  - [ ] the patch is a scripted, idempotent step run after `src:clone-emdash` — never a hand-edit of `.src/`
  - [ ] the step **fails loudly** if the upstream line has changed shape
  - [ ] the UI on `:4330` lists our packages — proven by the registry's own log showing the `searchPackages` request at page-load time
- [ ] **Keep it honest**
  - [ ] if the patch cannot be applied, the task says so rather than silently serving the hosted registry
