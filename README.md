# emdash-run

Local runner for [emdash-cms/emdash](https://github.com/emdash-cms/emdash) with a CAD
schema (projects → assemblies → parts).

The host site is an official EmDash template — **`starter-cloudflare`** — copied into
`.src/site` and run against the published `emdash` npm package. There is no emdash
monorepo clone. See [ADR-0007](docs/plans/done/0007-emdash-1.1-templates-src-rework.md).

Process manager: [pitchfork](https://pitchfork.jdx.dev/) · task runner: [mise](https://mise.jdx.dev/).

## `mise.toml` is the source of truth

The workflow — first-time setup, the daily loop, recovery, updating and deploy — lives in
the **QUICK REFERENCE** block at the top of [`mise.toml`](mise.toml), and every task (with
its description) is listed by:

```bash
mise tasks ls
```

This README deliberately does **not** restate commands: duplicated command lists drift
from the tasks they describe. If this file and `mise.toml` ever disagree, `mise.toml` wins.

## Where things are

```
config/   site.astro.config.mjs, site.wrangler.jsonc, cad.seed.json
          ← source config, written into .src/site by config:apply
logs/     pitchfork daemon logs              ← gitignored
run/      token-admin.txt, token-admin.env,
          token-user.txt                    ← gitignored
.src/     templates/, site/                 ← gitignored working checkouts
          emdash/                           ← optional, on-demand (src:clone-emdash)
plugins/  plat-trunk/                       ← local plugin, symlinked into .src/site
docs/     adr/, plugin.md, exploring.md, big-picture.md
```

Never edit files under `.src/` — they are generated. Change `config/` instead and re-run `apply`.

## Live

**https://emdash-run.gedw99.workers.dev** — deployed to Cloudflare Workers.

Provisioned resources (recorded in `config/site.wrangler.jsonc`):

| Binding | Resource | Name / Id |
|---------|----------|-----------|
| `DB` | D1 | `emdash-run` — `115eb6d3-43df-4139-95bb-7900512ced12` |
| `SESSION` | KV | `29c6fd5b70644857a4ffbcf359973841` |
| `MEDIA` | R2 | `emdash-run-media` |

## Docs

- `docs/plans/` — active plans · `docs/plans/done/` — closed ones (incl. the former ADRs, `000N-`)
- `docs/plugin.md` — the plat-trunk plugin and its geometry panel in the Parts editor
- `docs/big-picture.md`, `docs/exploring.md` — why this exists, and what was explored
