# 2026-10-06 — What this repo is for: develop and run EmDash from any repo

**Status:** active — **2 of 6 done**

The goal: a known-good way to develop and run every part of EmDash from any repo, built on the
official CLIs, so nobody re-derives the plumbing. Two things make that trustworthy — the tasks
have to *work*, and the checks on the tasks have to be able to *fail*.

## Done

- [x] **Plugin round trip, with the official tools** — `mise run plugin:new -- <name>` scaffolds
  (`emdash-plugin init`), fits the scaffold to the site, installs, validates, typechecks, tests,
  builds, registers, links, restarts the site, and has the **running site** call the plugin.
  - [x] `mise run plugin:roundtrip` runs that with a throwaway plugin and removes it: exit 0, the site answered `{"greeting":"hello","pluginId":"harness-probe"}`, nothing left behind
  - [x] registration is generated (`local-plugins.mjs`), so no hand edit of the site config
  - [x] the repo passes `check`, `repo:apply` and `doctor` with **zero** plugins
  - [x] the old example plugins are deleted — they depended on a geometry service that does not exist
- [x] **The checkers are proven able to fail** — `mise run repo:selftest`, part of `check`
  - [x] plants a `&&`, an undefined variable, `problem(s)` and a call to a missing task; `repo:nu` and `repo:sync` must each reject theirs
  - [x] its first run found `repo:nu` did **not** catch `problem(s)`, though the docs said it did; `repo:nu` now has a rule for it

## Left

- [ ] **Fresh setup on a bare machine.** A fresh *clone* is proven (`setup`, `check`, `doctor` exit 0),
  but on this machine, with tools and pnpm's store cached and Cloudflare credentials in fnox.
  - [ ] run `mise run setup` in a clean container or VM and record what was missing
  - [ ] `doctor` without Cloudflare credentials reports the R2 check as unavailable, not as a failure of the site
- [ ] **Decide how another repo gets the harness** — much easier once the logic is a nushell module rather than 2400 lines of TOML: see [`lean-mise`](2026-10-06-lean-mise.md), which comes first
  - [ ] pick one and write down why: copy `mise.toml` (simple, drifts), include the tasks from this repo through mise, or a template repo
  - [ ] a second repo can take a harness update without hand-merging 2000 lines
- [ ] **Prove it on a second project** — a different template and a different seed
  - [ ] a scratch repo with only its own settings and seed: `setup`, `dev`, `check`, `plugin:roundtrip` pass
  - [ ] record every edit needed outside PROJECT SETTINGS — each one is a bug in the claim
- [ ] **Take the first project out of the task bodies**
  - [ ] `repo:verify` hardcodes the R2 path `models/<id>/manifest.json` and four manifest fields — the generic part (site answers, content reads, join field present) should stand alone, with the R2 part optional
  - [ ] `site:install` hardcodes two first-party plugins (`plugin-forms`, `plugin-webhook-notifier`), and `config/site.astro.config.mjs` imports them
  - [ ] the example seed (`config/cad.seed.json`) is replaceable: delete it in a scratch clone and `setup` still works on the template's seed alone
