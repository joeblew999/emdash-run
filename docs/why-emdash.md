# Why EmDash

## The problem we are solving

plat-trunk needs a project/content management layer. Without it we have to build:

- User management and auth
- Admin UI for non-technical users (Max)
- File upload pipeline to R2
- Revision history and draft/publish workflow
- OAuth server for CLI and agent tokens
- MCP server for AI agent access to content

That is 3-4 months of work that is not CAD geometry.

## What EmDash gives us for free

- Auth (WebAuthn passkey, OAuth, magic links)
- Role-based access control (Admin, Editor, Author, Contributor)
- Admin UI — schema builder, content editor, media library, revision history
- REST API with OpenAPI spec (codegen a typed client)
- MCP server at `/_emdash/api/mcp` (agents can manage content directly)
- OAuth device flow (CLI and agent token auth)
- R2/S3 file pipeline with signed upload URLs
- SQLite locally, D1 on Cloudflare — same code

## The split we are evaluating

**EmDash owns:**
- Projects, assemblies, parts as CMS collections
- Users, invites, roles
- File references (BREP/STEP in R2)
- Revision history, draft/publish workflow
- Admin UI
- MCP server for content-side agent operations

**plat-trunk owns:**
- Geometry — WASM kernel, BREP operations
- CRDT sync (Automerge/R2)
- Scene graph
- MCP tools for geometry operations

**The join:**
- A `part` record in EmDash carries a `geometry_meta` JSON field and file fields pointing to R2
- The Hono Worker reads/writes geometry, calls EmDash REST API to update part status/version
- Single OAuth token layer for both systems
- EmDash MCP + plat-trunk geometry MCP present as one tool surface to agents

## Why this matters for RICOS

Fukumitsu's team needs API access to specific geometry and mesh data.
EmDash gives us scoped API tokens out of the box — no custom auth to build.
We can give RICOS a token scoped to `content:read media:read` and nothing else.
