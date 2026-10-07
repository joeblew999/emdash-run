# 2026-10-07 — Loose ends: everything raised while the stages were built

**Status:** active — **2 of 4 stages done.** Stage 3 is the owner's moves; nothing in it can be done by an agent.

Every problem, doubt and unproven claim that came up in
[`done/2026-10-07-stages.md`](done/2026-10-07-stages.md), with who has to move. Nothing here needs a
deployment; what does is in [`2026-10-07-live.md`](2026-10-07-live.md).

## The list

| # | what | found how | whose move |
|---|---|---|---|
| 1 | "A plugin answers on a site" was checked by hand, on macOS only | `plugin:new`, then the two config lines by hand, then a request | mine — stage 1 |
| 2 | A variable left in a shell redirects a task. `EMDASH_REGISTRY_URL` from the old harness sent `plugin -- search` to a dead local address | `plugin -- search forms` failed until the variable was unset | mine — stage 1 |
| 3 | The Remy-Sport repo's include points at `main`, which never updates by itself | written before there was a tag | mine — stage 1 |
| 4 | `plugin:publish` has never published | it needs a registry login | owner — stage 3 |
| 5 | `plugin:new` was only run with a placeholder publisher on `example.com` | EmDash's scaffolder refuses without publisher, author and security contact, and a handle must resolve | owner — stage 3 |
| 6 | The Remy-Sport repo's move to the include line and to EmDash 1.2.0 is on a local branch, `stages`, not pushed | that repo is the owner's to push | owner — stage 3 |
| 7 | The owner's `remy-sport-emdash` pitchfork daemon was defined by the harness config that branch removes | read from the config | owner — stage 3 |
| 8 | This VS Code window's shell still carries the old harness's variables, among them an old local EmDash token, which was printed into an agent session's tool output when the environment was listed | `env` | owner — stage 3 |
| 9 | Seven things in EmDash, Astro's tooling or wrangler that behave differently from their docs, or that a task has to work around | each run, see stage 2 | mine to write up, the owner's to send — stages 2 and 3 |
| 10 | No git hook runs `site:check` | decided: 20 seconds or more per commit, and an include cannot carry a hook file | closed, unless the owner wants one |

## The stages

- [x] **Stage 1 — what can be fixed here, now**
  - [x] (1) proven again from nothing, locally, after the tasks were changed to stop the site
    first: `site:new` → `site:start` → `plugin:new save-log` → the two lines and a runner in
    `astro.config.mjs` → `site:start` → `{"greeting":"hello","pluginId":"save-log"}` [200], then
    `site:check` passes — on `node:blog` (runner packages added with `plugin:add`) and on
    `cloudflare:starter`. Not added to CI: the owner's instruction is to keep CI for when it is
    really needed
  - [x] (2) decided and written in `docs/agents/README.md` § Rules: a task's settings come from the
    project's `[env]`, else the shell; EmDash's own variables pass through to its CLIs. The test
    was every run of 2026-10-07: they were all made in a shell still carrying the old harness's
    `SITE_DIR`, `SEED_FILE`, `TEMPLATES_DIR`, `EMDASH_VERSION` and an empty `EMDASH_URL`, and no
    task was moved by them. Only `EMDASH_REGISTRY_URL` had an effect, on `plugin -- search`
  - [x] (3) the Remy-Sport branch pins `?ref=v0.7.0` (its commit b75b508): 17 tasks listed,
    `site:start` exit 0, home 200

- [x] **Stage 2 — the reports, written so they can be sent as they are**
  - [x] [`docs/upstream.md`](../upstream.md): eight entries — what was run, what it printed, what
    was expected, what the tasks do instead. The seven listed when this plan was written, and an
    eighth found while deploying: `emdash migrate` cannot use wrangler's sign-in
  - [x] every one was run on 2026-10-07, the day it was written; entry 5 is from a CI run of the
    same day

- [ ] **Stage 3 — the owner's moves**, each a single action
  - [ ] (6) push the Remy-Sport branch: `git -C ../remy-sport-emdash push -u origin stages`, then
    merge it
  - [ ] (7) the `remy-sport-emdash` daemon entry: keep it, or remove it — it is the owner's state
  - [ ] (8) reopen the VS Code window; if the site that token belonged to still exists, revoke the
    token in its admin
  - [ ] (5) a real publisher: `PLUGIN_PUBLISHER` and `PLUGIN_SECURITY_EMAIL` in the Remy-Sport
    `mise.toml`
  - [ ] (4) `mise run plugin -- login <handle>`, then `plugin:publish` on a real plugin, when
    there is one worth publishing
  - [ ] (9) say which of the reports in `docs/upstream.md` to send; sending them is posting in
    public under the owner's name

- [ ] **Stage 4 — close**
  - [ ] every row of the list is done, or marked as decided against with the reason
  - [ ] this file moves to `done/`
