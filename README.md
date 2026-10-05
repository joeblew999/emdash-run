# emdash-run

**A working EmDash instance for plat-trunk, plus a full local copy of the EmDash plugin
registry.**

plat-trunk is a browser-native B-Rep CAD platform (Truck kernel → WASM on Cloudflare
Workers). Its geometry engine is done; the project, user, file and API layer around it is
not — and that is months of work that is *not* CAD. This repo is the bet that
[EmDash](https://github.com/emdash-cms/emdash), a Cloudflare-native CMS on the same stack,
carries that layer so plat-trunk stays a geometry engine.

It is not a mock-up: it runs the real published `emdash`, the real admin, the real
registry, and it deploys to Cloudflare. See [`docs/why.md`](docs/why.md).

## What it can do today

| | |
|---|---|
| **Host site** | An official EmDash template (`starter-cloudflare`) run against the published `emdash` package — admin UI, auth, revisions, media, schema builder. |
| **CAD content model** | `projects → assemblies → parts` as collections, seeded from `config/cad.seed.json`, with `geometry_meta` (vertices, faces, bbox, validation) on each part. |
| **Native plugin** | `plugins/plat-trunk` — `@plat-trunk/emdash-plugin` renders a **Geometry panel** in the Parts editor (`contentEditorPanels`). |
| **Local plugin registry** | EmDash's aggregator runs on `:8788` — the plugin marketplace as a service. Backfilled from the ATProto network and projected, so reads return real packages. |
| **Registry web UI** | The registry's own site (`apps/plugins-site`) runs on `:4330`. |
| **Live plugin catalog** | `docs/plugin-catalog/` is generated from the registry — currently **38 published packages**, with authors and licences. |
| **Agent access** | EmDash's MCP endpoint with scoped admin/user tokens, plus a mise MCP server for tasks. |
| **Deploy** | Cloudflare Workers + D1 + KV + R2 → **https://emdash-run.gedw99.workers.dev** |

## How it is put together

```
config/     our config (astro.config, wrangler.jsonc, cad.seed.json)
            written into .src/site by config:apply
plugins/    plat-trunk — the native plugin, symlinked into the site
.src/       gitignored checkouts: templates/, site/, emdash/ (optional)
scripts/    one script per mise noun; helpers in scripts/lib/
docs/       why.md, plugin.md, auth.md, plans/, plugin-catalog/
```

`mise.toml` is the interface and the **single source of truth**. Every task is one line
calling `scripts/<noun>.mjs`, and every task is named `noun:verb` — so `mise run site:dev`
maps mechanically to `scripts/site.mjs dev`. `mise tasks ls` lists them; `mise run repo:urls`
prints every URL it serves. Nothing else restates the commands.

Daemons are managed by [pitchfork](https://pitchfork.jdx.dev/), tasks by
[mise](https://mise.jdx.dev/).

## Where to look

- [`docs/why.md`](docs/why.md) — the problem, the bet, the architecture, and what is proven vs open
- [`docs/plugin.md`](docs/plugin.md) — the plugin and its Geometry panel
- [`docs/auth.md`](docs/auth.md) — EmDash's auth model and our token strategy
- [`docs/plans/`](docs/plans/) — what is left · [`done/`](docs/plans/done/) — closed (incl. the former ADRs)
- [`docs/plugin-catalog/`](docs/plugin-catalog/) — generated from the registry
