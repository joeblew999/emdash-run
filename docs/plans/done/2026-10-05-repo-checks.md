# 2026-10-05 — Repo checks: typecheck, lint, tests

**Status:** done — closed 2026-10-06, superseded in part

## Closing note (2026-10-06)

The checks exist and block: `mise run check` runs lint, format, `repo:nu`, `repo:sync`, `repo:docs`,
`skills:check`, the plugin typecheck, audit and tests; `doctor` covers the live state.

What this plan built that **no longer exists**: `repo:test` and its 10 vitest tests of the seed
merge. They were deleted with `scripts/` when the merge became a nushell task body. The merge was
shown byte-identical at the time, but nothing tests it now — carried forward in
[`harness-gaps`](../2026-10-06-harness-gaps.md).

---

*Everything below is the record as it was written. Where it names `scripts/…`, `lib/…`, `repo:test` or vitest, read it as history: the scripts were replaced by nushell task bodies in `mise.toml` on 2026-10-06.*

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
- [x] **Lint and format** — the tools emdash uses: `oxlint --type-aware` + `oxfmt`
  - [x] picked `oxlint`/`oxfmt` (what the emdash monorepo uses) rather than biome — we consume emdash's types and packages, so agreeing on style costs nothing
  - [x] pinned in mise `[tools]`, not a devDependency: this repo has **no root package.json**, and mise `[tools]` is already how `npm:skills` is provided
  - [x] versions matched to what emdash has **installed** (oxlint 1.74.0 / oxfmt 0.59.0 / oxlint-tsgolint 0.25.0), not to latest. The three are coupled and fail badly when mixed: oxlint 1.86.0 + tsgolint 0.25.0 dies with `panic: unknown rule: no-generated-empty-object-type` rather than failing cleanly.
  - [x] configs mirror emdash's, including `no-await-in-loop: off` — several scripts poll sequentially on purpose and emdash already made that call
  - [x] `repo:check` (lint + `oxfmt --check`) and `repo:format` (the fix), covering `scripts/` and the plugins
  - [x] first run's findings fixed, not silenced: unused `ROOT` in site.mjs, a useless `?? {}` in a spread, two variable shadows, and four type assertions in the panels replaced with an `isRecord` **type predicate** — a real improvement, since `x as Record<string, unknown>` silently accepts an array or a primitive
  - [x] formatting scoped to code, deliberately not `.`: oxfmt also formats TOML and Markdown, and `mise.toml` is this repo's declared source of truth (already broken once by an over-eager edit)
  - [x] **why this earns its place beyond style:** nothing validated `scripts/` until it ran. An unclosed template literal introduced during this session stayed invisible until that exact code path executed. Lint parses every file, so that class dies at check time.
  - [x] found while proving it: `repo.mjs` statically imported its helpers, so a syntax error in **any** helper aborted **every** subcommand at module load with a raw Node stack — a typo in `verify.mjs` made `repo:apply` refuse to restart the site. Helpers are now imported lazily, so the blast radius is one subcommand.
- [x] **Typecheck the site** — `mise run site:check`, two passes
  - [x] `astro check` against `.src/site`: 14 files, 0 errors, 0 warnings, 0 hints. It also **loads** `astro.config.mjs`, so a config that throws on load fails here — the class that actually bit us when the sandboxed import was wrong.
  - [x] `tsc --checkJs astro.config.mjs`, because `astro check` **executes** the config rather than analysing it. Proved complementary by injection: a JSDoc type error gives `astro check` 0 errors and `tsc` `TS2322`.
  - [x] **removed a stale `// @ts-nocheck`** from `config/site.astro.config.mjs`. It claimed "TS errors for missing modules are false positives" and described the pre-rework layout; with it gone the file typechecks clean, so it was only hiding real errors from editors.
  - [x] `--ignoreConfig` is required: the site has a `tsconfig.json`, and tsc refuses to combine it with explicit file arguments.
  - [x] **it takes the dev server down, and now handles that itself.** `astro check` re-runs the Vite optimizer in `.src/site`, re-hashing the `deps_ssr/*?v=…` URLs; a dev server already running there keeps serving the OLD hashes and returns 500s — `The file does not exist at .../deps_ssr/emdash_n_croner.js?v=…`. That is the same failure `repo:apply` already guards against by clearing `.vite` and restarting, and it is easy to mistake for the site being down. `site:check` now stops the daemon, checks, and restarts it in a `finally`, so a failing check does not also cost you the site. Found by running it: the first version left the site up and serving 500s.
  - [x] **not wired into `repo:apply`**, because it is not a 30ms lint — it restarts the site. `plugin:typecheck` is wired in because it runs inside its own package and touches nothing else.
- [x] **Test the scripts** — `mise run repo:test`, vitest, 10 tests
  - [x] picked vitest, at the version the sandboxed plugin already uses (4.1.11), so there is one test runner in the story rather than two
  - [x] pinned in mise `[tools]` like oxlint/oxfmt, for the same reason: no root package.json
  - [x] **the refactor was the real work.** `merge-seed.mjs` was a top-level script — it read files, wrote output and called `process.exit` at import time, so its rules could only be exercised by running the whole of `config:apply` against the real template. Split into a pure `mergeSeeds(base, cad)` plus the I/O in `config.mjs`.
  - [x] what the tests pin, including what was previously only discoverable by reading the code: the collision rules are **not uniform** (collections/taxonomies go to the template, content goes to CAD), content is emitted dependency-first so `$ref:` values resolve, `menus`/`widgetAreas`/`settings` come from the template with a CAD fallback, and `version` falls back `base → cad → "1"`
  - [x] a real bug fixed on the way: the dedupe key was `` `${key}:${id}` ``, which built `parts:parts:motor-housing` and so could not catch a cross-collection duplicate. Ids are already namespaced, so it is now the id alone, and a test covers it.
  - [x] `vitest.config.mjs` is a **plain object**, not `defineConfig` — `vitest/config` cannot resolve with no root `node_modules`, and vitest dies at startup with `ERR_MODULE_NOT_FOUND`
  - [x] **proven to block**: removed the "base wins" loop from `union()` and two tests failed with `expected 'Posts (CAD)' to be 'Posts (template)'` — then passed again once restored
  - [ ] still uncovered: the other lib helpers (`get-mcp-token`, `clean-tokens`) do `fetch` and token cleanup, so they need a different testing approach than pure functions
- [x] **Structural checks across plugins** — `mise run plugin:audit`, wired into `repo:apply`
  - [x] a script the toolchain can never run: a `scripts` entry invoking `emdash-plugin` while the plugin has no `emdash-plugin.jsonc`. This was real: the native plugin declared `validate`/`build`/`bundle`/`test` that could never succeed, and nobody noticed until a sweep tried to run one.
  - [x] an unbuilt sandbox bundle: `exports["./sandbox"]` pointing at a file that does not exist. Also real — `plugin:link` without `plugin:build` leaves the site importing a file that is not there.
  - [x] emdash drift from the site: a plugin with a different `emdash` installed than the site runs. Also real — the scaffold installed 0.42.0 while the site ran 1.1.0, so its green test was evidence about a different CMS.
  - [x] `network:request` declared with an empty `allowedHosts` — fails the bundle-time check, so failing here fails earlier with a better message.
- [x] **Make a seed edit actually reachable** — `mise run seed:apply`
  - [x] found by hand, and it is the worst of the set because it reports success: `emdash seed <file>` writes a **file** database (`./data.db`) while the dev server reads miniflare's D1 under `.wrangler/state/v3/d1`. So it printed "Content: 11 created / Seed applied successfully" and changed nothing the site could see.
  - [x] `repo:apply` *does* apply the seed (via dev-bypass on first request) but with **skip-on-conflict**: an entry that already exists is left alone. New seed content lands; **edits to existing content never do**, with no error anywhere. Change a part, run `repo:apply`, and the admin keeps showing the old values.
  - [x] `seed:apply` empties the local D1 and reapplies — the only path that picks up content edits. Destructive to local state, and now says so.
- [x] **Verify the LIVE state, not just the files** — `mise run repo:verify`
  - [x] the centrepiece: follow every part's `model_id` to the real object in `cad-documents` and compare it **field for field** against the stored snapshot. This is the check that would have caught the fabricated seed on its first run rather than six commits later.
  - [x] also asserts the site answers, the content API returns parts, and every part declares a `model_id`
  - [x] **proven to block**: drifted `top-plate.geometry_meta.model_name` in the seed, reapplied, and it reported `model_name is "Definitely Not The Real Name", live is "Default Cube"` — then passed again once restored
  - [x] credentials go through a new `secret()` helper in `lib/exec.mjs`, which prefers the ambient environment and falls back to asking fnox. A missing credential is reported as a **failure**, not a silent skip — the whole point is that a green run means something.
  - [x] found while using it: `config:apply` writes files **Vite watches** (`astro.config.mjs`, `wrangler.jsonc`, `seed/seed.json`), so the dev server restarts underneath you and a verify run straight afterwards raced it — reporting `site responds — fetch failed` for what was really "not ready yet". The liveness check now retries for 20s. A check that cries wolf is worse than no check.
- [ ] **Prove the checks actually block**
  - [x] prove the structural checks: reintroduced all three structural bugs at once and `plugin:audit` reported each by name, then passed again once restored (see the note below)
  - [x] prove the live-state check: drifted one stored field and `repo:verify` named the part, the model, the key, and both values
  - [x] prove the lint check: reintroduced the same unclosed template literal and `repo:check` reported `scripts/lib/verify.mjs:40:16: error: Expected a semicolon…` — file, line, column — while `repo:urls` kept working, confirming the lazy-import fix
  - [x] prove a **type** error: injected `/** @type {string} */ const neverUsed = 123;` into the config copy. `astro check` reported 0 errors — it only loads the config, and that line runs fine — while `tsc --checkJs` reported `TS2322: Type 'number' is not assignable to type 'string'`. The two passes are complementary, not redundant.
  - [x] decided: **`repo:check` does not gate `repo:apply`.** Speed is not the reason (it is ~30ms) — the reason is that a restart is also the *recovery* path, so gating it on a lint pass means a style finding can leave you unable to bring the site up. `plugin:audit` does gate it, because it catches faults that would make the restart produce a *wrong* site. `plugin:typecheck` also gates it, which is arguably inconsistent with this reasoning — worth revisiting if a type error ever blocks a recovery that was needed.
