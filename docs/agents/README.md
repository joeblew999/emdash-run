# Agent guide — emdash-run

**What this repo is:** the thinnest thing that lets any repo develop and run EmDash through `mise`.
EmDash already ships the tooling. This repo adds a task only where EmDash has a gap that has been
proven by running EmDash's own command first.

## How the owner wants the work done — standing instructions

Said by the owner on 2026-10-07, after the stages were built. They hold until the owner says
otherwise; an agent that has not read them repeats the mistakes they came from.

1. **Use the three CLIs for everything they can do — always.** The mise approach works *because*
   a task is EmDash's own commands in order. Before writing any step, run `--help` on `emdash`,
   `emdash-plugin` (`mise run plugin -- --help`) and `create-emdash`, then Astro's and wrangler's,
   and use the command that exists. A line of `node -e` in `tasks.toml` is allowed only where no
   command exists and the plan names the gap.
2. **One plan, in stages, and it stays one.** On 2026-10-07 three plans grew to 42 open boxes and
   27 tasks by reacting to each finding; the owner called it out of control and it was. A finding
   goes into the open plan as a box or under "Watch" — it does not start a new plan or a new
   task. No new task while a release is owed.
   **Work from a plan, in stages.** Plans are `docs/plans/*.md`, written as numbered stages of
   checkboxes. When a plan is ready, do it — do not wait to be told again — and prove each stage
   works before the next. Finish a plan: tick, close, move to `done/`, and write the next plan for
   what is left. Everything raised along the way goes into a plan, not only into chat.
3. **Tell the owner about problems, unasked, and fix them.** A fault found in something already
   called proven is said plainly, with what was wrong. Never leave the owner to find it by
   running a task.
4. **Prove it on new sites and existing sites, on Cloudflare and on Node, with plugins** — on this
   machine. "Works" means that run, today.
5. **Do not use CI unless it is really, really needed.** It takes far too long. The three-OS run
   is green as of `v0.7.0`; a new task built the same way is likely to pass there too. A push that
   touches `tasks.toml` or `stages.yml` starts it: put `[skip ci]` in the commit message unless a
   cross-OS proof is the point (a change to quoting or shell behaviour, a Windows fix, a release).
6. **Cloudflare: the account is on the Workers Paid plan, and deploying to preview and
   `workers.dev` addresses is allowed** — said 2026-10-07. So sandboxed plugins (the Worker
   Loader binding) can be deployed, and the `live:` tasks can be proven on a throwaway Worker. A
   real domain, the Remy-Sport site's names, deleting anything, and posting under the owner's name
   (issues, a plugin release) still need the owner's yes each time. Never type or print a secret:
   pass the file by path.
7. **Decide what is reversible yourself; do not get ahead on what is not.**
8. **Nothing waits on a person at a browser.** A machine becomes a full user of a built site with
   `mise run signin:token` — this machine's built site by default, the deployed one with
   `-- --live` under `fnox exec`. The other ways (`signin:access`, `signin:passkey`, `signin:open`)
   are kept beside it on purpose, to be tried; the table above them in `tasks.toml` says what each
   is for and which need Playwright. One rule for where: no flag is this machine, `--live` is the
   deployed site (`LIVE_URL`). Security of these test sites is deliberately a later job (the owner,
   2026-10-07) — do not switch things off or add guards while exploring.
9. **A sign-in must never quietly hold the work up.** The moment a task needs one, say which,
   who can do it and the exact command or address — and keep the table of them current in the
   open plan (`docs/plans/done/2026-10-07-live.md` § Sign-ins). An agent does not make accounts,
   passkeys or tokens; it starts the flow and the owner approves.

## EmDash first — read this before you touch anything

On 2026-10-06 a full day and about 1,200 lines of code were spent wrapping and rebuilding things
EmDash already does, by an agent that had never read EmDash's skills, did not know how many CLIs it
ships, and built a site's languages by hand while a guide and a plugin for it existed. These rules
exist so that does not happen again. They come before every other rule in this file.

1. **Know what EmDash ships before you build.** Three command-line programs, and nothing here may
   duplicate them:

   | program | what it is for | run it here as |
   |---|---|---|
   | `create-emdash` | scaffold a project: `--template blog\|starter\|marketing\|portfolio`, `--platform node\|cloudflare`, `--pm`, `--sandboxed-plugins`, `--yes` | `pnpm dlx create-emdash@<version> --help` |
   | `emdash` (alias `em`) | everything on a site: `content`, `schema`, `media`, `taxonomy`, `menu`, `search`, `types`, `seed`, `export-seed`, `site export\|import`, `migrate`, `doctor`, `secrets`, `login` | `mise run emdash -- <command>` |
   | `emdash-plugin` | plugins: `init`, `validate`, `build`, `dev`, `bundle`, `publish`, `search`, `info`, `release setup` | `mise run plugin -- <command>` |

   Run `--help` on the command you are about to wrap. If it has the option, use it.

2. **Read the skill for the area before working in it.** EmDash writes them for agents; they are in
   the site at `site/.agents/skills/` (the scaffolder puts them there):
   - `emdash-cli/` — the CLI, sign-in, the editing flow, site export and import
   - `building-emdash-site/` — config, schema and seed, querying, rendering, site features
   - `creating-plugins/` — plugins, capabilities, hooks, testing, publishing

   Then the guide: EmDash's docs are at `.src/emdash/docs/src/content/docs/` when its source is
   cloned into `.src/` (gitignored), and always through the `emdash-docs` MCP server —
   23 guides, 10 deployment pages. `guides/internationalization.mdx` and
   `deployment/schema-evolution.mdx` are two that the harness contradicted because nobody read them.

3. **Search the registry before building a feature into a site:**
   `mise run plugin -- search <words>`.

4. **A harness task needs a proven gap.** Before adding or keeping a task, run the official command
   for that job on a real site and write down what it could not do. "It would be convenient" is not
   a gap. A task that is one official command with a wrapper around it gets deleted.

5. **Who owns what — EmDash's rule, not ours.** The live database owns the content *and* the
   content model. The repo owns the code. The seed only makes a *fresh* database. People change a
   site in the admin by their role; agents change the same things through the CLI or MCP. See
   `deployment/schema-evolution.mdx` before doing anything that moves a model or content between
   the repo and a site.

6. **Say only what you ran.** "Works" means you ran the real thing and read its output — name the
   command. A test of a mechanism is not the feature working; say which one you ran. If you have
   not run it, say "not run".

### What EmDash does with one command — run on 2026-10-06, EmDash 1.1.0, macOS

A project made by `create-emdash`, started with `pnpm dev`, nothing from this repo involved. Every
row exited 0.

| job | official command | time |
|---|---|---|
| make a project, installed | `pnpm dlx create-emdash@1.1.0 site --template cloudflare:blog --pm pnpm --install --yes` | 39s |
| start it; migrate, seed, sign in | `pnpm dev`, then open `/_emdash/api/setup/dev-bypass` | 17s |
| use the CLI locally with no token | `emdash whoami` → "Client will use dev bypass for localhost". **It exits 0 even with no site running** — to know a site answers, use `emdash schema list` | 1s |
| read the model, list content, media, menus | `emdash schema list`, `content list posts`, `media list`, `menu list` | ≤1s each |
| change the model | `emdash schema add-field posts subtitle --type string --label Subtitle` | 1s |
| types from the running site | `emdash types` | 1s |
| the live model back into the repo | `emdash export-seed --database <file> > seed/seed.json` | 1s |
| the whole site as a package | `emdash site export --output site.emdash` | 1s |
| database health | `emdash doctor -d <file>` | 1s |

Not seen in that run: the dev server rewriting `emdash-env.d.ts` after the field was added (the
skill says it does; it had not within a second).

## How it is built

- **`tasks.toml`** — everything. Visible tasks are the stages, named `<what>:<verb>` (`site:new`,
  `site:start`). Hidden `step:*` tasks are single EmDash commands, written once and reused by the
  stages. If a step seems to need logic, that is a gap to write in the plan, not code to add.
- **`admin/`** — the four scripts, each for a gap no command closes: `token.mjs` (`signin:token`),
  `access.mjs` (`signin:access`), `first-admin.mjs` (`signin:passkey`, `signin:open` — the only
  Playwright), `emdash.mjs` (what the `emdash` task runs: the CLI, plus what is saved for the site). A task reaches a
  file that came with the include through `{{ env.MISE_TASK_DIR }}` — which works inside `run`,
  not inside `dir`.
- **`mise.toml`** — this repo's own settings, and the line that includes `tasks.toml`. Another
  project has the same line, pointing at this repo on GitHub at a tag.
- **`site/`** — this repo's own site, made by `mise run site:new`. It is what the stages are run
  against here.
- **`.github/workflows/stages.yml`** — the proof: the stages from an empty folder, on macOS, Linux
  and Windows, on a Cloudflare and a Node.js template.
- **`reference/nushell-harness/`** — what this repo was before 2026-10-07. Not loaded, not tested.
  Read it for the EmDash rough edges it worked around; do not extend it.
- **`.src/`** — gitignored: EmDash's source and docs, for reading.

## Rules

- **Run it and read the output.** After changing `tasks.toml`: run the stage in an empty folder
  (`/tmp/emdash-try` has a `mise.toml` for that) and in this repo. Reasoning about it is not proof.
- **A setting is read as `{{ env.NAME | default(value='…') }}`.** `get_env()` does not see the
  project's settings; a stage once ran on the wrong port and wrote to another project's site.
- **Every step is a plain `program arguments` line**, so it means the same under mise's shell on
  every OS. No pipes, no `&&`, no shell variables.
- **No `tools =` on a task.** The project's `[tools]` block is the one place. A hidden step does not
  inherit its task's tools, so a per-task declaration that misses one step runs it on the machine's Node.
- **Add files to a commit by name.** `git add -A` once swept a deleted `site/` into a commit about
  something else.
- **CI is the three-OS proof, not the test loop** — and is not run unless really needed (standing
  instruction 5). Lint a workflow with `actionlint` and run its steps locally before pushing. On
  a runner `CI=true` makes mise answer every prompt with yes.
- **Stop the site before changing its packages.** On Windows a running dev server broke, and
  broke EmDash's plugin scaffolder, when packages changed under it. `plugin:new` and `plugin:add`
  do this themselves.
- **A variable in the shell is a setting.** A task reads `SITE_FOLDER`, `SITE_PORT`, `TEMPLATE`,
  `SITE_SEED`, `LIVE_URL` and `PLUGIN_*` from the project's `[env]`, and from the shell when the
  project does not set them. EmDash's own variables (`EMDASH_REGISTRY_URL`, …) pass through to its
  CLIs. A window opened under the old harness still carries its variables: reopen it.
- **Plans live in `docs/plans/`** — `ls docs/plans/` is what is left. How the tasks were arrived at,
  with every command that was run, is `done/2026-10-07-stages.md`.

## Tools

- **A browser:** Playwright, configured once per machine as headless and isolated. Sign in through
  `/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`.
- **EmDash's docs MCP** (`.mcp.json`): `emdash-docs`, for looking things up in the current docs.
- **EmDash's skills** come with the site: `site/.agents/skills/`. *EmDash first*, rule 2, says when
  to read them. `skills update` does not refresh them on a scaffolded site (it finds none).
- **mise skills are machine-level** (`~/.claude/skills/`), not this repo's.
