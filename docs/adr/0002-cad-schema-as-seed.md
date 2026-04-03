---
id: "0002"
title: "Commit CAD schema as seed to eliminate server:setup from rebuild flow"
status: "implemented"
date: "2026-04-02"
---

# ADR-0002 — Commit CAD schema as seed to eliminate server:setup from rebuild flow

## Status

Implemented

## Context

The from-nothing sequence required a manual `server:setup` step after every teardown + rebuild:

```
server:teardown → server:build → pitchfork:start → mcp:token-admin → server:setup → done
```

`server:setup` used the emdash CLI to create the `projects`, `assemblies`, and `parts` collections with their fields. It was idempotent but also the only place the CAD schema was defined — as shell commands in `mise.toml`, not as a declarative file.

## Decision

Export the CAD schema (collections + fields + sample content) using `emdash:export-seed` and commit it to `config/seed.json`. Add a `server:seed` mise task that applies it explicitly on a fresh DB.

The seed is applied via the `emdash seed` local CLI command, which runs from `$HOST_DIR` where `data.db` lives. It is idempotent (`onConflict: "skip"`) — safe to re-run on an existing DB.

```toml
[tasks."server:seed"]
description = "Apply committed CAD seed (schema + sample content) — run once after pitchfork:start on a fresh DB"
dir = "{{config_root}}"
run = """
set -euo pipefail
cd "$HOST_DIR"
node "$EMDASH_DIR/packages/core/dist/cli/index.mjs" seed "$ROOT/config/seed.json"
"""
```

The seed lives at `config/seed.json` (not inside the gitignored `emdash/` clone). It encodes:
- 5 collections (`projects`, `assemblies`, `parts`, `pages`, `posts`), with `parts` having `supports: ["drafts", "revisions"]` per ADR-0001
- 20 fields across those collections
- 9 sample content items (2 projects, 2 assemblies, 5 parts) — all published

The from-nothing sequence is now:

```
server:teardown → server:build → pitchfork:start → mcp:token-admin → server:seed → done
```

`server:setup` is retained but marked as superseded — kept only as a reference for future schema changes. `README.md` and the QUICK REFERENCE in `mise.toml` both point to `server:seed` as the bootstrap step.

The seed must be re-exported and re-committed whenever `server:setup` changes the schema:

```bash
mise run emdash:export-seed    # writes to logs/seed-export.json
cp logs/seed-export.json config/seed.json
# review and commit
```

## Consequences

- `server:seed` is the single idempotent step that bootstraps the full CAD schema + sample content on a fresh DB.
- The CAD schema is version-controlled as a declarative JSON file (`config/seed.json`), not as imperative shell commands.
- `server:setup` is only needed when the schema itself changes and is no longer in the rebuild flow.
- `pages` and `posts` collections are present in the seed (EmDash defaults) and are skipped on existing DBs.
- The seed includes sample content. This is intentional — it gives a meaningful starting point without an extra step.
- The seed must be kept in sync with any `server:setup` schema changes.
