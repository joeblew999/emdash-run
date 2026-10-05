# Architecture Decision Records

Decisions about how this project is built and operated.

| ID | Title | Status |
|----|-------|--------|
| [0001](0001-parts-drafts-and-revisions.md) | Enable drafts and revisions on CAD collections | Implemented |
| [0002](0002-cad-schema-as-seed.md) | Commit CAD schema as seed — `server:seed` replaces `server:setup` | Superseded by 0007 |
| [0003](0003-register-geometry-plugin.md) | Register the geometry preview plugin in astro.config.mjs | Proposed |
| [0004](0004-mcp-token-invalidated-after-teardown.md) | MCP token is invalidated after teardown — Claude Code restart required | Accepted |
| [0005](0005-emdash-local-cli-task.md) | Separate mise tasks for remote vs local emdash CLI commands | Superseded by 0007 |
| [0006](0006-templates-src-clone-and-run.md) | Clone emdash-cms/templates into .src and run via mise + pitchfork | Superseded by 0007 |
| [0007](0007-emdash-1.1-templates-src-rework.md) | Rework onto emdash@1.1.0 using `.src/` and official templates | Accepted |

> **Note:** ADRs 0001–0006 predate [ADR-0007](0007-emdash-1.1-templates-src-rework.md).
> Their commands and paths are historical: `server:setup`, `server:seed`, `HOST_DIR`,
> `emdash:local` and `config/seed.json` no longer exist. The seed is now
> `config/cad.seed.json`, merged into `.src/site/seed/seed.json` (see ADR-0007).
