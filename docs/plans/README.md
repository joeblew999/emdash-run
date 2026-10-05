# Plans

Where work is planned before it is done, and archived once it is.

## How it works

- **One file per plan**: `docs/plans/YYYY-MM-DD-slug.md`.
- A plan is **active** while it sits in `docs/plans/`. When every item in it is done,
  **move the file into `docs/plans/done/`** — do not delete it, and do not leave a
  finished plan in the active folder.
- `TODO.md` is only an **index** of the active plans. It is not a place for detail; the
  detail belongs in the plan.
- A plan states its **status** at the top and, for each item, what "done" means and how
  it was verified. "Done" means executed and observed, not reasoned about.
- If a plan is abandoned, say so at the top and move it to `done/` with the reason —
  a plan that quietly disappears is worse than one marked dead.

## Why

Plans that live in a chat or an issue drift from reality; plans that live in the repo can
be read, corrected and archived. Keeping active and finished separate means the active
folder is always the true list of what is left.
