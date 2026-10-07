# 2026-10-06 — Lean on EmDash: delete what it already does

**Status:** closed 2026-10-06 — everything that could be done without a deployment is done and merged. The boxes still open below are carried, in one place, by [`2026-10-06-open.md`](2026-10-06-open.md), itself superseded by [`../2026-10-07-stages.md`](../2026-10-07-stages.md).

Reading EmDash's source turned up things the harness does by hand that EmDash does itself, a
workaround for a problem that no longer exists, and one flow that the source says cannot work.
Each item removes code or makes a flow true. None adds a feature.

Two things on the first draft of this list were fixed by 0.4.2 while it was being written and are
not here: `--url` no longer has to come last, and the comment claiming the CLI exits 0 on errors is
gone. A third is half done (commit `c9efc63`): `apply-seed` skips an unchanged seed.

Sources for every claim: [`../emdash.md`](../emdash.md) § Capability map (W1–W12, A1–A17).

## What is verified, and what is a guess

**Verified by reading `emdash@1.1.0`:**

- `POST /_emdash/api/setup/dev-bypass` applies the seed **with content** through the site's
  **configured storage**, and `?content=0` leaves the content out.
  `packages/core/src/astro/routes/api/setup/dev-bypass.ts:14-15,61-70`
- `?token=1` on the same call returns a personal access token with the `admin` scope and deletes
  the previous one of that name. `dev-bypass.ts:146-168`
- `emdash seed` always writes `$media` to a local directory, and `--on-conflict=update` downloads
  and inserts every `$media` again. `packages/core/src/cli/commands/seed.ts:202-209`,
  `packages/core/src/seed/apply.ts:856-863,2310,2389`
- `update` replaces entry data and rebuilds menus and widget areas. `docs/themes/seed-files.mdx:503,557,638`
- A site with any entry in a seeded collection cannot receive an import.
  `packages/core/src/transfer/domain.ts:120-131`
- Core never reads `EMDASH_REGISTRY_URL`. `packages/plugin-cli/src/config.ts:39` is the only reader.
- With `--json` or a pipe, the CLI's progress output goes to stderr.
  `packages/core/src/cli/output.ts:13-19`

**Verified by running read-only commands against the local site (2026-10-06, macOS):**

- `schema list --json` and `content get … --json` write only JSON to stdout.
- Six failing invocations all exit 1.
- The local site's `transfer/capabilities` reports `empty: false`, `collection_has_entries`.

**Guesses — each has a step below that settles it:**

- That `restore --wipe --confirm` fails today. Predicted from the two facts above; not run.
- ~~That the first `dev-bypass` call finishes inside `restart`'s request timeout when the seed has
  media to download.~~ Settled: 13.10s on `blog-cloudflare`, and the call now has five minutes.
- That on a fresh database the CLI pass after `dev-bypass` stores every `$media` a second time.
- ~~That `pnpm add file:` suits Windows and the no-symlink rule.~~ Settled on other grounds: it
  edits committed files. See the item below.

## Items

- [x] **`restore --wipe` restores** — the wiped site must come up without sample content
  - [x] first, run `mise run snapshot` then `mise run restore -- <package> --wipe --confirm` as it is today and record the outcome here: it either confirms A1 or corrects `docs/emdash.md` — done after the change rather than before: the pre-change flow was not re-run, so A1 stays a prediction
  - [x] `restart` takes a "no content" switch that calls `dev-bypass?content=0`; `restore --wipe` uses it — `restart --empty`
  - [x] proof: the round trip exits 0 and `doctor` passes afterwards — `verify --full --restore`, locally, exit 0
  - [x] `verify --full` runs snapshot **and** restore, so this cannot regress unseen — behind `--restore`, because it wipes local users and tokens; CI's full verification passes it
- [ ] **The token comes from the call that already signs in** — delete the rest of `mint-token`
  - [x] one `POST setup/dev-bypass?token=1`; write `data.token` to `run/token-admin.txt` and `run/token-admin.env` — done inside `restart`
  - [x] delete the session-cookie, list, delete and create requests in `mint-token` — `mint-token` is deleted
  - [ ] remove the stale `token-admin` row once, or leave it and say so
  - [ ] proof: `plugin:probe` and an MCP `tools/list` both succeed with the new token; `docs/auth.md` names the right token
- [ ] **The site seeds itself; the CLI only carries seed edits** — finishes the "duplicate media rows" item in [`2026-10-06-hardening.md`](2026-10-06-hardening.md)
  - [ ] first, measure: `reset` on `blog-cloudflare`, then `emdash media list --json | length` against the number of `$media` in the seed. Twice as many confirms A10; record the numbers here
  - [x] on a fresh database, do not run `emdash seed` at all — `dev-bypass` has just applied the seed into the right storage; write the hash mark instead
  - [x] the hash gate from `c9efc63` stays; the mark is written on the fresh-database path too, so the next `dev` does not treat the seed as changed
  - [x] proof on `blog-cloudflare` (the template whose snapshot used to fail): `mise run verify:template -- blog-cloudflare --full` exits 0 — setup, a plugin round trip (three more `dev` runs), snapshot, wipe, restore, doctor. The export refuses any media row without a file, so a passing snapshot is the proof that none was created. Media counts were not read out separately
  - [ ] proof: edit a seeded entry in the admin, run `dev` — the edit is still there
  - [ ] say in the README what still happens when the seed **does** change: seeded entries are overwritten and their media is duplicated, until upstream items 2 and 3 are fixed
  - [x] measure the first `dev-bypass` call on `blog-cloudflare`; if it can exceed the request timeout, give that one call a longer one — `mise run verify:template -- blog-cloudflare` (macOS arm64, exit 0) printed "the site answered its setup call 13.10 sec after it was started" (11.06 on a second run): a fresh database, the seed and its media, counted from the daemon's start. `restart` gives the call five minutes and makes it once, so there is no retry to apply the seed twice. `dev` now prints the figure every time
- [ ] **Remove a workaround for a problem that is gone**
  - [x] `emdash-json`: parse stdout directly and fail on a non-zero exit, instead of scanning for the line where JSON starts
  - [x] `restore` does the same for `site import --analyze --json` (it searches for the first `{`)
  - [ ] proof: `doctor`, `schema:diff`, `content:set`, `snapshot`, `restore` each exit 0, then each exits non-zero against a stopped site
- [x] **`registry:up` does what it says on a template's config**
  - [x] `enable-local-plugins` also writes a `registry:` line that reads `EMDASH_REGISTRY_URL` and falls back to EmDash's default (`docs/reference/configuration.mdx:274-276`) — or the harness stops claiming the site is pointed at the local registry — `registry:up` writes it (`enable-local-registry` in `nu/site.nu`), not `plugin:new`: a project that never runs a local registry keeps its config as it was. `undefined` falls through to the default (`packages/core/src/registry/config.ts:16-27`). The flow then reads `/_emdash/api/manifest` and fails unless `registry.aggregatorUrl` is the local one
  - [x] proof on a throwaway `starter-cloudflare` project: after `registry:up`, the admin's Registry page lists what the local aggregator holds — run in this checkout with `site/astro.config.mjs` and `site/wrangler.jsonc` replaced by the pristine template's, not in a separate project (one monorepo build). `mise run registry:up` exit 0, both files edited; a headless browser on `/_emdash/admin/plugins/registry` got `200 http://localhost:8833/xrpc/com.emdashcms.experimental.aggregator.searchPackages?limit=20`, listed the plugins, and made no request to `registry.emdashcms.com`; the aggregator's log shows the same request. `registry:down` → the manifest names `https://registry.emdashcms.com` again
  - [x] the registry's port follows `REGISTRY_PORT` the way the site's follows `SITE_PORT` — proved by the run above, on 8833 from `mise.local.toml`
  - [x] found by running it: the label replay took 171s and `registry:up` allowed 60 — it failed on a fresh registry. It has ten minutes now. macOS and `starter-cloudflare` only; a Node.js template and the other two OSes were not run
- [x] **A project's seed lists are merged, not dropped**
  - [x] `merge-seeds` unions `redirects` (by `source`), `sections` (by `slug`), `blockTypes` (by `slug`), `relations` (by `slug`), `bylines` (by `id`), `menus` and `widgetAreas` (by `name`) — keys per `docs/themes/seed-files.mdx`
  - [x] a test in `nu/tests.nu` for each: a project redirect survives a template that has redirects — one test covers the shared code path: redirects from both seeds are kept, and a collision goes to the template
  - [x] `check`'s planted-fault test covers one of them — obsolete: 0.6.0 deleted the seed merge with the `config/` overlay; the site's seed is `site/seed/seed.json`, edited in place
- [x] **Try the documented way to load a local plugin** — tried, not adopted
  - [x] spike on macOS, Linux and Windows: `pnpm --dir .src/site add file:<plugin>` instead of copying into `node_modules`; record whether it leaves a symlink outside `node_modules` and whether a rebuilt plugin is picked up — macOS only (`pnpm --dir site add file:../plugins/spike`, then `link:`); Linux and Windows were not run, because what rules it out does not depend on the OS. No symlink outside `node_modules` with either. Both add the plugin to `site/package.json` and `site/pnpm-lock.yaml`, which are committed. `file:` hard-links the files into pnpm's store: a rebuild that rewrote `dist/plugin.mjs` in place showed through (same inode), a file removed from `dist/` stayed in the site until `pnpm install`. `link:` follows every rebuild, but the plugin then resolves its own `node_modules/emdash`, not the site's
  - [x] if it holds on all three, delete `plugin link` and `plugin delete`'s `node_modules` half; if not, write the reason next to `link` and close this item — not simpler: it would trade a ten-line copy for `pnpm add`/`pnpm remove` calls that edit the project's committed files. The reason is beside `link` in `nu/plugin.nu` and in `docs/emdash.md` W5
- [x] **`restart` restarts on every OS** — added after a Linux container run reported "is already running, use --force to restart" and a site that was not restarted
  - [x] establish what is true — `mise daemons stop --help` says nothing; `pitchfork stop --help`: SIGTERM to the process group, wait up to 5s, then SIGKILL. A daemon slow to exit (4s), run as `mise run <task>` the way ours are: on macOS the stop took 4.22s and nothing survived it; in a Debian container it took 0.02s, the daemon read "stopped", and the process lived 4 more seconds — there `mise run` gives the task a process group of its own (pgid 3531 under 3492), which pitchfork does not signal or wait for
  - [x] a bounded wait — `daemon-stop` in `nu/lib.nu` waits up to 30s until the daemon is not running **and** its port is free, then fails naming the port
  - [x] proof a change is picked up after a restart — the same container, the real site: a stand-in registry answering `/health` was started and stopped between three `mise run dev` runs, and the manifest's registry followed each time (hosted → `localhost:8788` → hosted → `localhost:8788`), with new server pids each run. The reported failure itself did **not** reproduce: the dev server exited within 0.07s of the stop, so the old `daemon-stop` passed the same test. The wait guards the window the slow daemon showed. Windows was not run
- [x] **The CLI talks to this checkout's site** — found while proving the above on port 4333
  - [x] `emdash` with no `--url` asks `http://localhost:4321` (`packages/core/src/cli/client-factory.ts:39`), so with `SITE_PORT` moved, `doctor` failed with "fetch failed" — or, with another checkout's site on 4321, passed against that one. `emdash`, `emdash-json` and `restore` now set `EMDASH_URL` to this site unless a deployment is named (`cli-target` in `nu/lib.nu`)
  - [x] proof, both on ports other than 4321 with nothing listening there: `mise run verify -- --full` here (4333) exit 0; `mise run verify:template -- blog-cloudflare --full` (a free port; plugin round trip, snapshot, wipe, restore, doctor) exit 0
- [x] **Small truths**
  - [x] the release hint becomes `mise run emdash-plugin -- publish --manifest plugins/<name>` (`packages/plugin-cli/src/commands/publish.ts:118-120`)
  - [x] `snapshot`'s message and task description say "site package — content and media, not users, tokens, plugin data or secrets" instead of "backup"
  - [x] `nu/checks.nu`'s closing hint stays: "a seed only applies at first boot" is correct
