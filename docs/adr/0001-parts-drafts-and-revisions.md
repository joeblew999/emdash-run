---
id: "0001"
title: "Enable drafts and revisions on CAD collections"
status: "implemented"
date: "2026-04-02"
---

# ADR-0001 — Enable drafts and revisions on CAD collections

## Status

Implemented

## Context

The CAD schema has three collections: `projects`, `assemblies`, `parts`. All were created with `supports: []` — no drafts, no revisions. This means every update to a part overwrites the previous state with no recoverable history.

In a CAD workflow, part versions are first-class concepts. "Top Plate Rev A" and "Top Plate Rev B" are different things that need to coexist. An engineer needs to:

- Edit a part without immediately publishing the change live
- Review a proposed change before it becomes the active version
- Look back at what a part was before a given change

The `_rev` token present on every content item is only an optimistic lock — it prevents two simultaneous writers from clobbering each other. It is not version history.

Without `drafts` and `revisions`, the system cannot model the actual CAD review process.

## Decision

Add `supports: ["drafts", "revisions"]` to the `parts` collection.

`projects` and `assemblies` are structural containers — they change rarely and don't need the same review workflow. Leave them as-is.

The emdash CLI `schema create` command has no `--supports` flag. The feature is exposed via the HTTP API only: `PUT /_emdash/api/schema/collections/{slug}` with `{ "supports": [...] }`. The live DB was patched directly:

```bash
TOKEN=$(cat run/token-admin.txt)
curl -X PUT http://localhost:4321/_emdash/api/schema/collections/parts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-EmDash-Request: 1" \
  -d '{"supports": ["drafts", "revisions"]}'
```

`server:setup` was updated to call the same `PUT` after creating the `parts` collection, so fresh DBs get this automatically. The seed (`config/seed.json`, see ADR-0002) was re-exported after the patch and also encodes `supports: ["drafts", "revisions"]` for `parts`.

## Consequences

- Parts gain a publish/draft lifecycle. Editing a published part creates a draft revision. The live version stays live until explicitly published.
- `content list parts --status draft` and `--status published` become meaningful filters.
- The `emdash:cli` and MCP tools can create parts as `--draft` for review before publishing.
- Revision history is queryable via `revision_list` MCP tool.
- `projects` and `assemblies` remain simple — no draft workflow overhead for structural nodes.
- Any future schema change to `parts` must preserve `supports: ["drafts", "revisions"]` in the exported seed.
