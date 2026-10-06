# 2026-10-06 — Know EmDash properly, then make the harness fit it

**Status:** active — **0 of 4 done**

The harness was built by fixing what broke. Nobody working on it has read EmDash end to end, and
the gaps show: we assumed it was Cloudflare-only, that sandboxed plugins were D1-only, that the
seed CLI handled media the way the site does. Each was wrong, and each cost a release.

This plan is done by reading EmDash's own source and docs (`.src/emdash`, tag `emdash@1.1.0`, and
the vendored skills in `.github/skills/`) — not this repo's comments, which inherit an earlier
author's untested claims.

## Items

- [ ] **Write `docs/emdash.md` — what EmDash is, for someone using this harness**
  - [ ] the pieces and how they fit: core, the Astro integration, admin, auth, the database and storage adapters, the CLIs, templates, plugins, the registry, MCP
  - [ ] every deployment target and what differs between them (database, storage, sandbox runner, migrations, scheduled work, auth)
  - [ ] the lifecycle of a site: first boot and setup, seed, schema evolution, content, deploy, upgrade to a new EmDash version, backup and restore
  - [ ] every statement carries its source (`file:line` in `.src/emdash`, or the skill it comes from). Nothing from memory
- [ ] **Map EmDash's surface against the harness**
  - [ ] a table: each EmDash capability and CLI command → the flow that covers it, or "passthrough only", or "not covered"
  - [ ] each place the harness works AROUND EmDash rather than with it (`nu/` is the code to read), and whether EmDash offers a proper way
  - [ ] each assumption in `nu/` that EmDash's source contradicts or does not guarantee
- [ ] **Propose plans** — one file each in `docs/plans/`, in this repo's format (checkboxes, verifiable steps, a status line)
  - [ ] upgrading EmDash: what `EMDASH_VERSION` + `mise run upgrade` should do when EmDash itself moves — migrations, template drift, plugin compatibility — as one flow
  - [ ] anything a developer building a real site needs that has no flow today (candidates to test against the source, not to assume: auth and users, scheduled publishing, i18n, media, search, redirects, import from WordPress/Contentful, preview deployments, secrets)
  - [ ] anything in the harness that should be deleted because EmDash already does it
  - [ ] each plan says what was verified by reading or running, and what is a guess
- [ ] **List what to report upstream** — bugs and gaps found while reading, each with a minimal reproduction or the source lines, ready to paste
