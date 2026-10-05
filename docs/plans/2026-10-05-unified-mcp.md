# 2026-10-05 — One MCP surface for content and geometry

**Status:** active — **blocked**

An agent should manage EmDash content *and* plat-trunk geometry from a single tool surface.
EmDash's MCP server is proven here (content, schema, media, taxonomy, menus). The geometry
worker's MCP surface does not exist in this repo yet.

This is the key architectural question for the RICOS integration — the last of the three
questions this harness was built to answer.

## Blocked on

The geometry worker having an MCP surface, or a contract for one.

## Items (once unblocked)

### 1. Enumerate the geometry tools

List the geometry worker's tools and compare them with EmDash's.

### 2. Decide the join

One server proxying both, or two servers presented as one.

### 3. Prove it end to end

A single agent call that touches content *and* geometry.

**Done means:** one MCP endpoint through which an agent reads a part's content and its
geometry in the same session.
