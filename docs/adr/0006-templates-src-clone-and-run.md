---
id: "0006"
title: "Clone emdash-cms/templates into .src and run via mise + pitchfork"
status: "proposed"
date: "2026-04-02"
---

# ADR-0006 — Clone emdash-cms/templates into .src and run via mise + pitchfork

## Status

Proposed

## Context

The [emdash-cms/templates](https://github.com/emdash-cms/templates) repository contains official starter templates for building EmDash-powered Astro sites. Today, `emdash-run` uses the bundled `demos/plugins-demo` site from inside the cloned emdash monorepo (`emdash/`) as its front-end host. This is a deep dependency on internal demo code that is not meant for production use.

There are two problems with the current approach:

1. **Wrong audience**: `demos/plugins-demo` is an integration test fixture, not a reference for how a real EmDash site should be structured. Using it as the live front-end conflates testing the CMS internals with validating a real content site.

2. **No template coverage**: The official templates are never exercised locally. Bugs in template scaffolding, Astro config defaults, or EmDash client integration are only discovered downstream by users, not here in the test harness.

The solution is to clone `emdash-cms/templates` into a `.src/` directory at the project root and add mise tasks + a pitchfork daemon so that one or more templates can be run alongside the EmDash server as a full end-to-end stack.

`.src/` follows the same convention as `emdash/` — a gitignored working checkout managed entirely by mise tasks, not committed to this repo.

## Decision

### 1. Add `.src/` to `.gitignore`

```
.src/
```

### 2. Add `TEMPLATES_DIR` to mise.toml `[env]`

```toml
TEMPLATES_DIR = "{{config_root}}/.src/templates"
```

### 3. Add `templates:clone` task

Clones the repo on first run; skips if already present (idempotent).

```toml
[tasks."templates:clone"]
description = "Clone emdash-cms/templates into .src/templates"
run = """
  set -euo pipefail
  if [ -d "$TEMPLATES_DIR/.git" ]; then
    echo "templates already cloned, pulling latest"
    git -C "$TEMPLATES_DIR" pull --ff-only
  else
    mkdir -p "$(dirname "$TEMPLATES_DIR")"
    git clone https://github.com/emdash-cms/templates "$TEMPLATES_DIR"
  fi
"""
```

### 4. Add `templates:install` task

Installs dependencies for all templates in the monorepo (or a specific one).

```toml
[tasks."templates:install"]
description = "Install dependencies for all templates"
depends = ["templates:clone"]
run = """
  set -euo pipefail
  cd "$TEMPLATES_DIR"
  pnpm install
"""
```

### 5. Add `templates:build` task

Builds a specific template (default: `blog`) so it can be served statically or in dev mode.

```toml
[tasks."templates:build"]
description = "Build the default template (blog)"
depends = ["templates:install"]
run = """
  set -euo pipefail
  cd "$TEMPLATES_DIR/blog"
  pnpm build 2>&1 | tee -a "$LOGS_DIR/templates-build.log"
"""
```

### 6. Add `templates:dev` task (ad-hoc, foreground)

Runs the template dev server in the foreground. Used for interactive work.

```toml
[tasks."templates:dev"]
description = "Run template dev server in foreground (Ctrl-C to stop)"
depends = ["templates:install"]
run = """
  set -euo pipefail
  cd "$TEMPLATES_DIR/blog"
  pnpm dev
"""
```

### 7. Add pitchfork daemon for templates dev server

Add a `[processes.templates]` entry to `pitchfork.toml` so the template dev server runs alongside the EmDash server as a managed daemon.

```toml
[processes.templates]
command = "pnpm dev"
cwd = "${TEMPLATES_DIR}/blog"
env = { PORT = "4322" }
```

Port `4322` is one above the EmDash default (`4321`) to avoid conflicts.

### 8. Update `server:build` to depend on `templates:install`

Add `templates:install` as a dependency of `server:build` so the full stack is ready after a single `mise run server:build`.

## Consequences

- `.src/templates` is a live clone of the official templates repo. `templates:clone` can be re-run to pull updates at any time.
- The pitchfork `templates` daemon runs the blog template's dev server on port `4322`. Both servers start together with `pitchfork:start`.
- Playwright tests can now target `http://localhost:4322` to validate front-end rendering against real EmDash content — covering a path that `demos/plugins-demo` never exercised.
- `templates:clone` is idempotent: safe to re-run, pulls latest if already present.
- Only one template (`blog`) is wired up initially. Additional templates can be added as separate pitchfork processes or by parameterising `templates:dev` with a `TEMPLATE_NAME` env var.
- `.src/` is gitignored — the clone is ephemeral, like `emdash/` and `logs/`. Nothing in `.src/` should be edited directly; patches belong upstream in the templates repo.
