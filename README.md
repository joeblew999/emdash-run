# emdash-run

Local runner for [emdash-cms/emdash](https://github.com/emdash-cms/emdash) with a preconfigured CAD schema (projects → assemblies → parts) for evaluating EmDash as a content/project layer for [plat-trunk](https://cad.ubuntusoftware.net).

## Prerequisites

- [mise](https://mise.jdx.dev/) installed

## Run

```bash
mise install     # installs node 22 + pnpm 10.28.0
./run.sh         # clones, installs, builds, seeds, starts dev server
```

Then open http://localhost:4321/_emdash/admin

## What you get

- EmDash admin UI running locally on SQLite — no Cloudflare account needed
- Three CAD collections pre-defined:
  - **Projects** — top-level container, draft/revision support
  - **Assemblies** — hierarchy node, references project + optional parent assembly
  - **Parts** — leaf node, references assembly, BREP/STEP file fields, geometry metadata JSON field with `plat-trunk:preview` widget stub
- Audit log, webhook notifier, and embeds plugins wired in

## Re-running

```bash
./run.sh   # pulls latest emdash, re-applies config, starts dev server
```

The `emdash/` directory is gitignored — it is always cloned/pulled fresh by `run.sh`.
The SQLite database lives at `emdash/demos/plugins-demo/data.db`.

## Next steps

- Use the schema builder in the admin UI to extend the collections
- Install the color plugin to see how field widgets work — the `geometry_meta` field is stubbed with `widget: "plat-trunk:preview"` ready for your own React widget
- Wire the REST API (`/api/content/parts`) to your Hono Worker
