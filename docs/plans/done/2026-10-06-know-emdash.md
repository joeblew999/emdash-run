---
title: "Done · 2026-10-06 — Know EmDash properly, then make the harness fit it"
nav_order: 14
parent: Plans
nav_exclude: true
---

# 2026-10-06 — Know EmDash properly, then make the harness fit it

**Status:** done — **4 of 4 done**

The harness was built by fixing what broke. Nobody working on it has read EmDash end to end, and
the gaps show: we assumed it was Cloudflare-only, that sandboxed plugins were D1-only, that the
seed CLI handled media the way the site does. Each was wrong, and each cost a release.

This plan is done by reading EmDash's own source and docs (`.src/emdash`, tag `emdash@1.1.0`, and
the vendored skills in `.github/skills/`) — not this repo's comments, which inherit an earlier
author's untested claims.

**What "done" means here.** The reading and the writing are done. Only read-only commands were run
(`mise run status`, `mise run emdash -- …` for `schema list`, `content list|get`, `--help`, and six
deliberately failing invocations; one GET of the local site's transfer capabilities). No flow was
run. Every prediction in `docs/emdash.md` is marked as one, and each follow-up plan starts by
running the thing. One correction to this plan's own premise: the vendored skills in
`.github/skills/` are the template's copy, which is at EmDash 1.0.1; the 1.1.0 skills are in
`.src/emdash/skills/`.

## Items

- [x] **Write `docs/emdash.md` — what EmDash is, for someone using this harness** — `../emdash.md` (a document since deleted)
  - [x] the pieces and how they fit: core, the Astro integration, admin, auth, the database and storage adapters, the CLIs, templates, plugins, the registry, MCP — § The pieces
  - [x] every deployment target and what differs between them (database, storage, sandbox runner, migrations, scheduled work, auth) — § Two targets
  - [x] the lifecycle of a site: first boot and setup, seed, schema evolution, content, deploy, upgrade to a new EmDash version, backup and restore — § The life of a site
  - [x] every statement carries its source (`file:line` in `.src/emdash`, or the skill it comes from). Nothing from memory — what has no source is in § Unverified
- [x] **Map EmDash's surface against the harness** — § Capability map
  - [x] a table: each EmDash capability and CLI command → the flow that covers it, or "passthrough only", or "not covered" — three tables: `emdash`, `emdash-plugin`, capabilities
  - [x] each place the harness works AROUND EmDash rather than with it (`nu/` is the code to read), and whether EmDash offers a proper way — W1–W12
  - [x] each assumption in `nu/` that EmDash's source contradicts or does not guarantee — A1–A17
- [x] **Propose plans** — one file each in `docs/plans/`, in this repo's format (checkboxes, verifiable steps, a status line)
  - [x] upgrading EmDash: what `EMDASH_VERSION` + `mise run upgrade` should do when EmDash itself moves — migrations, template drift, plugin compatibility — as one flow — [`2026-10-06-emdash-upgrade.md`](2026-10-06-emdash-upgrade.md)
  - [x] anything a developer building a real site needs that has no flow today — tested against the source in `docs/emdash.md` § What a real site needs. Four have a real gap and are in [`2026-10-06-deploy-on-knowledge.md`](2026-10-06-deploy-on-knowledge.md): secrets (the encryption key), a real backup, getting content onto a deployment, and `--url` flows without a person. Auth, scheduled publishing, i18n, media, search, redirects and WordPress import need no flow: EmDash does them in config or in the admin. Preview deployments are not covered and no plan is proposed — nothing in the source says the harness is in the way
  - [x] anything in the harness that should be deleted because EmDash already does it — [`2026-10-06-lean-on-emdash.md`](2026-10-06-lean-on-emdash.md)
  - [x] each plan says what was verified by reading or running, and what is a guess — the second section of each
- [x] **List what to report upstream** — `docs/emdash.md` § To report upstream: seven entries, each with source lines and a reproduction. The `emdash types` and `emdash seed` entries supersede the write-ups in `2026-10-06-platforms.md` and `done/2026-10-05-emdash-cli-surface.md`
