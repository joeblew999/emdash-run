# 2026-10-05 — Harness rework onto emdash@1.1.0 (completed)

**Status:** done

The original rework: move the harness onto the published `emdash` package and an official
template, drop the legacy marketplace, and get a local site + a native plugin working.

Archived here because every item is finished; the active plan is one level up.

## Done

- [x] **Host the official template.** `.src/site` is a copy of `starter-cloudflare`,
      running against the published `emdash` npm package. No monorepo clone on the
      default path. See docs/plans/done/0007-emdash-1.1-templates-src-rework.md.
- [x] **Registry, not marketplace.** `emdash@1.1.0` deprecated the Marketplace; discovery
      and installs go through the plugin registry. No `marketplace:` option, no `:8787`
      worker.
- [x] **Geometry preview in the Parts editor.** Native `@plat-trunk/emdash-plugin` with a
      `contentEditorPanels` panel for the `parts` collection (docs/plans/done/0003-register-geometry-plugin.md). Verified in the
      admin: `Housing Body` renders Vertices 5124 / Faces 2688 / bbox 150 × 110 × 65 /
      Watertight No / Validation warn.
- [x] **Seed validation.** EmDash silently skips an invalid seed, so `config:apply` runs
      `seed:validate` and fails loudly. Negative-tested.
- [x] **First Cloudflare deploy** → https://emdash-run.gedw99.workers.dev. D1 + KV + R2
      provisioned; ids recorded in `config/site.wrangler.jsonc`.
- [x] **Where the data lives.** Local: miniflare D1 state under `.src/site/.wrangler/state`
      (wiped by `mise run site:reset`). Production: a D1 database + an R2 bucket.
- [x] **Generated skills are not tracked.** `.agents/skills/` and `.claude/skills/` are
      gitignored; `skills-lock.json` + `mise run skills:add-all` reproduce them.
- [x] **Builds clean up after themselves.** A production build dirties the dev server's
      Vite cache (stale `deps_ssr` URLs → 500s), so the build tasks wipe `.vite` + `.astro`
      and tell you to re-run `apply`.
- [x] **Docs have one source of truth.** `mise.toml`'s QUICK REFERENCE + `mise tasks ls`;
      README is orientation only, CLAUDE.md is agent rules. Neither restates the commands.
