# 2026-10-05 — Repo checks: typecheck, lint, tests

**Status:** active — **2 of 6 done** (and the proof in item 6 is partly done: the structural
checks have been proven to block)

Nothing in this repo was verified automatically: no typecheck, no lint, no tests. Wiring the
plugin typecheck into `repo:apply` immediately found three real faults, so the rest of this
is worth doing.

## Recorded result — `plugin:audit` blocks

All three structural bugs reintroduced deliberately at once:

```
plugin:audit found 3 problem(s):
  ✗ @plat-trunk/emdash-plugin: script "validate" runs emdash-plugin but the plugin has no
    emdash-plugin.jsonc — it can never succeed
  ✗ plat-trunk-sandboxed: exports "./sandbox" → ./dist/plugin.mjs, which does not exist —
    run `mise run plugin:build`
  ✗ plat-trunk-sandboxed: declares network:request but allowedHosts is empty — the
    bundle-time check will reject it
```

Restored → `✓ 2 plugins consistent`. Each message names the plugin, the fault, and the fix.

The reason these four rules exist: every one is a bug that was found **by hand** during the
sandboxed-plugin work, and every one presented as "the feature is broken" when the real fault
was a file describing a setup that did not exist.

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
- [x] **Structural checks across plugins** — `mise run plugin:audit`, wired into `repo:apply`
  - [x] a script the toolchain can never run: a `scripts` entry invoking `emdash-plugin` while the plugin has no `emdash-plugin.jsonc`. This was real: the native plugin declared `validate`/`build`/`bundle`/`test` that could never succeed, and nobody noticed until a sweep tried to run one.
  - [x] an unbuilt sandbox bundle: `exports["./sandbox"]` pointing at a file that does not exist. Also real — `plugin:link` without `plugin:build` leaves the site importing a file that is not there.
  - [x] emdash drift from the site: a plugin with a different `emdash` installed than the site runs. Also real — the scaffold installed 0.42.0 while the site ran 1.1.0, so its green test was evidence about a different CMS.
  - [x] `network:request` declared with an empty `allowedHosts` — fails the bundle-time check, so failing here fails earlier with a better message.
- [ ] **Prove the checks actually block**
  - [x] prove the structural checks: reintroduced all three structural bugs at once and `plugin:audit` reported each by name, then passed again once restored (see the note below)
  - [ ] prove a type error fails `repo:apply`
  - [ ] prove a lint error fails `repo:apply`
