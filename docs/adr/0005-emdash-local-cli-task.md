---
id: "0005"
title: "Separate mise tasks for remote vs local emdash CLI commands"
status: "implemented"
date: "2026-04-02"
---

# ADR-0005 — Separate mise tasks for remote vs local emdash CLI commands

## Status

Implemented

## Context

The emdash CLI has two categories of command:

**Remote** — talk to a running server over HTTP. Require `--url` and optionally `--token`. Examples: `content`, `schema`, `media`, `search`, `taxonomy`, `menu`, `whoami`, `login`.

**Local** — open the SQLite file directly. Do not use `--url` or `--token`. Find `data.db` by looking in the current working directory. Examples: `export-seed`, `doctor`, `types`, `init`, `seed`.

The `emdash:cli` mise task (`scripts/emdash.mjs`) appends `--url http://localhost:4321` after user args. Auth is handled automatically — the CLI picks up `EMDASH_TOKEN` from the environment (mise auto-loads `run/token-admin.env` via `_.file`) or falls back to dev-bypass for localhost. This works correctly for remote commands.

For local commands it is silently wrong: the flags are ignored, but the CWD is `$ROOT` (the repo root) instead of `$HOST_DIR` (`emdash/demos/plugins-demo/`). Local commands then look for `data.db` at `$ROOT/data.db` which does not exist, producing empty or incorrect output.

This was observed with `export-seed`: running via `emdash:cli` exported an empty seed from the wrong path. Running directly from `$HOST_DIR` produced the correct full export.

## Decision

Add a second task `emdash:local` that:
- Sets `dir` to `$HOST_DIR` so CWD is correct for SQLite lookup
- Passes args straight through without appending HTTP flags
- Uses the same `node "$EMDASH_DIR/packages/core/dist/cli/index.mjs"` invocation

```toml
[tasks."emdash:local"]
description = "Run local emdash CLI commands (export-seed, doctor, types) — usage: mise run emdash:local -- export-seed --with-content"
dir = "{{config_root}}/emdash/demos/plugins-demo"
run = "node \"$EMDASH_DIR/packages/core/dist/cli/index.mjs\""
```

The existing `emdash:export-seed` task (which already sets `dir` to `$HOST_DIR`) is the correct pattern and is kept as a named convenience. `emdash:local` is the general escape hatch.

Update `README.md` to document both tasks with examples.

## Consequences

- `mise run emdash:cli -- content list parts` — remote, talks to server, works as before.
- `mise run emdash:local -- export-seed --with-content` — local, reads SQLite from `$HOST_DIR`, works correctly.
- `mise run emdash:local -- doctor` — checks database health directly.
- `mise run emdash:local -- types` — generates TypeScript types from the live schema.
- The distinction is explicit in task names — no silent wrong-path behaviour.
