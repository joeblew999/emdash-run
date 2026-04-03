---
id: "0004"
title: "MCP token is invalidated after teardown — Claude Code restart required"
status: "accepted"
date: "2026-04-02"
---

# ADR-0004 — MCP token is invalidated after teardown — Claude Code restart required

## Status

Accepted

## Context

Claude Code reads `run/token-admin.env` once at startup and passes `EMDASH_TOKEN` to the emdash MCP HTTP server as a Bearer token in `.mcp.json`:

```json
"headers": { "Authorization": "Bearer ${EMDASH_TOKEN}" }
```

When `server:teardown` wipes the database, all API tokens are deleted. `mcp:token-admin` then generates a new token and writes it to `run/token-admin.env`. But the MCP server that Claude Code is already running keeps the old token — environment variables are not re-read after startup.

Subsequent MCP calls return 401. The emdash MCP client then attempts an OAuth discovery flow, calls `POST /register`, which does not exist, and returns an opaque 404 error. The actual cause (stale token) is not visible.

This has already caused confusion during development — `schema_list_collections` failed with a 404 on `/register` with no obvious explanation.

## Decision

Document this as a known operational constraint. No code change is needed or appropriate — the behaviour is correct, the gap is documentation.

Add to `README.md` "When things break" table:

| Symptom | Fix |
|---------|-----|
| MCP tools return 404 on `/register` after teardown | Restart Claude Code to reload the new `EMDASH_TOKEN` |

No attempt to make the MCP token stable across teardowns (e.g. fixed token value, token seeding). The teardown wipes the DB by design and a fresh token is the correct outcome. The constraint is purely operational.

## Consequences

- After any `server:teardown` + `server:build` cycle, Claude Code must be restarted before MCP tools are usable.
- The `emdash:cli` task is not affected — it reads `run/token-admin.txt` fresh on every invocation.
- `playwright:validate` is not affected — it uses a session cookie, not the API token.
- This constraint does not affect normal daily use (no teardown, token stays valid).
