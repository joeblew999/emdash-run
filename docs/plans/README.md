---
title: Plans
nav_order: 5
has_children: true
---

# Plans

Where work is planned before it is done, and archived once it is.

## How it works

- **One file per plan**: `docs/plans/YYYY-MM-DD-slug.md`.
- **Items are checkboxes** (`- [ ]`), with nested checkboxes for the concrete steps. A plan
  is only done when every box is ticked — prose items let you drift, boxes do not. Tick a
  box in the same commit as the work it describes, never in a batch at the end.
- A plan is **active** while it sits in `docs/plans/`. When every box is ticked,
  **move the file into `docs/plans/done/`** — do not delete it, and do not leave a finished
  plan in the active folder.
- The **active folder is the to-do list.** There is no `TODO.md` and no separate ADR
  folder — `ls docs/plans/` answers "what is left?". Closed plans live in
  `docs/plans/done/`, including the former ADRs (kept with their `000N-` prefix).
- State the **status** at the top: `active`, `active — blocked`, or `done`, with a count
  like `3 of 7 done`.
- Each step must be **verifiable** — a command that exits 0, something seen in the admin,
  a value that changes. "Done" means executed and observed, not reasoned about.
- If a plan is abandoned, say so at the top and move it to `done/` with the reason —
  a plan that quietly disappears is worse than one marked dead.

## Why

Plans that live in a chat or an issue drift from reality; plans that live in the repo can
be read, corrected and archived. Keeping active and finished separate means the active
folder is always the true list of what is left.

## Open

- [Next: release, then the first real site](2026-10-07-next.md)

## Done

- [2026-10-07 — The stages: everything a dev or agent does on an EmDash site, as a few mise tasks](done/2026-10-07-stages.md)
- [2026-10-07 — Sign-in: nothing may wait on a person at a browser](done/2026-10-07-sign-in.md)
- [2026-10-07 — Loose ends: everything raised while the stages were built](done/2026-10-07-loose-ends.md)
- [2026-10-07 — Live: deploying, undoing, logs and backups as mise tasks](done/2026-10-07-live.md)
- [2026-10-06 — What this repo is for: develop and run EmDash from any repo](done/2026-10-06-use-from-any-repo.md)
- [2026-10-06 — Other platforms, and what 0.1.0 left open](done/2026-10-06-platforms.md)
- [2026-10-06 — What is left](done/2026-10-06-open.md)
- [2026-10-06 — Lean on EmDash: delete what it already does](done/2026-10-06-lean-on-emdash.md)
- [2026-10-06 — A lean mise: flows a dev remembers, logic that is DRY and tested](done/2026-10-06-lean-mise.md)
- [2026-10-06 — Know EmDash properly, then make the harness fit it](done/2026-10-06-know-emdash.md)
- [2026-10-06 — Harness gaps found by running it](done/2026-10-06-harness-gaps.md)
- [2026-10-06 — Hardening: what the first releases showed is still soft](done/2026-10-06-hardening.md)
- [2026-10-06 — Upgrading EmDash is one flow](done/2026-10-06-emdash-upgrade.md)
- [2026-10-06 — Deploy and recover the way EmDash documents](done/2026-10-06-deploy-on-knowledge.md)
