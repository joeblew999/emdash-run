# Why — the plat-trunk bet on EmDash

## The problem

plat-trunk's geometry engine is done. What is missing is everything around it:

- project management — ownership, versioning, approval
- users, roles, auth
- an admin UI for designers who are not admins
- file management — BREP, STEP, mesh in R2
- API access for partners such as RICOS
- agent-friendly interfaces — MCP, CLI

That is months of work that is not CAD geometry.

## The bet

EmDash is a Cloudflare-native open-source CMS on the same stack (Workers, D1, R2), and it
ships most of that list already:

- auth — WebAuthn passkey, OAuth (code + device flow), magic links
- roles — Admin / Editor / Author / Contributor / Subscriber
- admin UI — schema builder, content editor, media library, revision history
- a REST API with an OpenAPI spec
- an MCP server at `/_emdash/api/mcp`
- an R2/S3 file pipeline with signed uploads
- SQLite locally, D1 on Cloudflare — the same code

So: use EmDash as the project/content layer, keep plat-trunk as the geometry engine, and
join the two.

## The architecture

```
Max (designer)
  → EmDash admin UI: creates/edits parts, uploads files, manages projects
EmDash (content layer)
  projects, assemblies, parts · users, roles, auth · file refs into R2
  revisions, draft/publish · REST API + MCP
        ↕ REST
plat-trunk Hono Worker (geometry layer)
  WASM kernel, BREP operations, CRDT sync, geometry MCP tools
        ↕ shared R2
Agent (Claude Code, RICOS)
  one MCP surface spanning content and geometry
```

**The join:** a `part` record in EmDash carries a `geometry_meta` JSON field plus file
fields pointing at R2; the geometry worker reads and writes geometry and calls EmDash's
REST API to update status and version.

## Why RICOS cares

RICOS needs scoped API access to specific geometry and mesh data for IsoGCN training.
EmDash issues scoped tokens out of the box — RICOS gets `content:read media:read` and
nothing else, with no custom auth to build. See [`auth.md`](auth.md).

## Status

**Proven in this repo**

- EmDash runs locally and deploys to Cloudflare (D1 + KV + R2).
- CAD collections seed and render; schema builder, revisions, media and auth all work.
- A **native plugin** adds a Geometry panel to the Parts editor — the plugin question is
  answered, and the undocumented `fieldWidgets` was not needed.
- The EmDash **MCP** server exposes useful tools for content, schema, media, taxonomy and
  menus — the content-side agent question is answered.
- The **registry** runs locally, populated from the real ATProto network, and the site's
  Plugin Registry page lists its packages.

**Open**

- The unified MCP surface — content *and* geometry as one tool set for agents — has not
  been started.
- The Geometry panel renders stored values; it does not yet fetch live stats from the
  geometry worker.

What is left lives in [`plans/`](plans/); what is finished is in
[`plans/done/`](plans/done/).
