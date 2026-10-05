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
