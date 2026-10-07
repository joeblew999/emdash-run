# 2026-10-07 — Loose ends: everything raised while the stages were built

**Status:** active — **0 of 4 stages done.**

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

- [ ] **Stage 1 — what can be fixed here, now**
  - [ ] (1) `stages.yml` adds the two lines and a runner to `astro.config.mjs` after `plugin:new`,
    starts the site and gets `{"greeting":"hello"}` from the plugin's route — on three OSes, on
    Cloudflare and on Node
  - [ ] (2) decided and written down: which variables a task takes from the shell on purpose, and
    a test that a stray `SITE_FOLDER`-style variable of the old harness changes nothing
  - [ ] (3) the Remy-Sport branch pins `?ref=v0.7.0`; its tasks still list and `site:start` works

- [ ] **Stage 2 — the reports, written so they can be sent as they are**
  - [ ] `docs/upstream.md`: one entry per finding — what was run, what it printed, what the docs
    say, the versions — for:
    `emdash whoami` exits 0 with no site running ·
    `emdash export-seed` and `emdash doctor` cannot be pointed at a Cloudflare template's local
    database (G3) ·
    the backup guide's `wrangler d1 export` refuses a database with search on (G13) ·
    the skills `create-emdash` writes cannot be refreshed by `skills update` (G14) ·
    the plugin scaffolder's `EPERM … rename` on Windows beside a running dev server ·
    deploy guards no command checks (G6) ·
    `wrangler types --check` fails on a freshly scaffolded template
  - [ ] each entry was run again on the day it is written, not copied from memory

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
