# TODO

- [ ] Local registry aggregator (`apps/aggregator` in the emdash monorepo) is
      **blocked upstream**: `miniflare@4.20260507.1` + its bundled `workerd` crash on
      Durable Object SQLite — `table _cf_ALARM has 3 columns but 2 values were
      supplied`. Repro: clone the monorepo, `pnpm --filter "@emdash-cms/aggregator^..."
      build` (its `prebuild`), `pnpm --dir apps/aggregator run db:migrate:local`, then
      `pnpm --dir apps/aggregator exec vite dev --port 8788`. Until that is fixed the
      site uses the hosted registry (`registry.emdashcms.com`), which works.

## Done

- [x] Geometry preview in the Parts editor — native `@plat-trunk/emdash-plugin` with a
      `contentEditorPanels` panel (ADR-0003), verified in the admin.
- [x] First Cloudflare deploy → **https://emdash-run.gedw99.workers.dev** (D1 + KV + R2
      provisioned; ids recorded in `config/site.wrangler.jsonc`).
- [x] Use a `.src/` folder and clone sources into it — templates + site + emdash
      monorepo. Done in ADR-0007.
- [x] Where is the data stored? Local D1/miniflare state under
      `.src/site/.wrangler/state` (wiped by `mise run site:reset`); production is a
      D1 database + R2 bucket.
- [x] Generated skills are no longer tracked: `/.agents/skills/` and `/.claude/skills/`
      are gitignored and untracked (`skills-lock.json` + `mise run skills:add:all`
      reproduce them). `.claude/skills/<name>` symlinks into the shared
      `.agents/skills/` store, so that store stays — but the per-agent dirs
      (`.crush/`, `.goose/`, `.cursor/`, …) are already pruned.
- [x] Removed the legacy marketplace and the emdash monorepo clone entirely — the
      harness is now 100% on the published `emdash` package + the hosted registry.
