# 2026-10-05 — Point the registry UI at the local registry

**Status:** active

`apps/plugins-site` — the registry's own web UI, `plugins.emdashcms.com` — calls
`registryLoader()` with **no options**, so it is hardcoded to the hosted registry.
`https://registry.emdashcms.com` is baked into `@emdash-cms/registry-loader`, and the
client has no environment override.

So we can run the UI, but it shows the hosted registry's packages, not ours.

## Items

### 1. Patch the loader

`src/live.config.ts` in the clone needs:

```ts
registryLoader({ aggregatorUrl: process.env.EMDASH_REGISTRY_URL })
```

Editing `.src/` by hand is not allowed — it is regenerated. So this needs a **scripted,
idempotent patch** applied by a task after `src:clone-emdash`, and it must **fail loudly**
if the upstream line has changed shape.

**Done means:** the UI on `:4330` lists packages from our local registry, proven by the
registry's own log showing the `searchPackages` request at page-load time.

### 2. Keep it honest

If the patch cannot be applied, the task must say so — not silently serve the hosted
registry while claiming to be local.
