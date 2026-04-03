# The Big Picture

## What plat-trunk is

A browser-native B-Rep CAD platform built on the Truck Rust kernel compiled to WASM.
Deployed on Cloudflare Workers. Target user: industrial designers like Max Kusterman.
The geometry engine is done. What is missing is the layer around it.

## What is missing

- Project management (who owns what, versioning, approval workflows)
- User management and auth
- Admin UI for non-technical users
- File management (BREP, STEP, mesh files in R2)
- API access for partners like RICOS
- Agent-friendly interfaces (MCP, CLI)

Building all of this is months of work that is not the CAD product.

## The bet

EmDash is a Cloudflare-built open source CMS that runs on the same stack
(Workers, D1, R2) and ships most of what is missing for free.

The bet is: use EmDash as the project/content layer, keep plat-trunk as the
geometry engine, wire them together via REST API and shared MCP surface.

## The architecture if the bet pays off

```
Max (designer)
  ↓
EmDash admin UI
  ↓ creates/edits parts, uploads files, manages projects
EmDash (content layer)
  - projects, assemblies, parts as collections
  - users, roles, auth
  - file refs pointing to R2 (BREP, STEP)
  - revision history, draft/publish
  - REST API + MCP server
  ↕ REST API calls
plat-trunk Hono Worker (geometry layer)
  - WASM kernel, BREP operations
  - CRDT sync, scene graph
  - geometry MCP tools
  ↕ shared R2 bucket
AI agent (Claude Code, RICOS)
  - single MCP surface spanning both systems
  - manage content AND geometry from one interface
```

## Why RICOS cares

Fukumitsu's team at RICOS needs access to geometry and mesh data for IsoGCN AI training.
EmDash gives scoped API tokens out of the box.
RICOS gets a token with `content:read media:read` and nothing else.
No custom auth to build.

## What this evaluation is

This repo (`emdash-run`) is a local test harness to answer three questions:

1. Does the EmDash MCP server expose tools that are actually useful for
   managing CAD content? Or do we need to build custom MCP tools on top?

2. Does the plugin field widget system work well enough to show Max
   geometry stats inline in the part editor without him being an admin?

3. Can the two MCP surfaces (EmDash content + plat-trunk geometry) unify
   into one tool surface that an agent can use coherently?

If the answer to all three is yes, EmDash replaces 3-4 months of infrastructure work.
If not, we know exactly what gaps to fill.

## What we have learned so far

- EmDash runs locally on SQLite with no Cloudflare account needed
- The schema builder creates real SQL tables — projects, assemblies, parts all work
- The admin UI is functional and non-technical users could use it
- The MCP endpoint exists and requires a Bearer token
- The plugin field widget system is real and runs React in the browser (not sandboxed)
- The auth system is well-built — scoped tokens, RBAC, OAuth device flow all solid
- The 4-role RBAC is too coarse for CAD (filed as issue #52)

## What is still unknown

- Exactly which MCP tools ship out of the box (blocked on token auth issue)
- Whether the plugin widget actually wires up in our config
- Whether agent + EmDash MCP + plat-trunk MCP can work as one surface
