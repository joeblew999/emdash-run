# Agent guide — emdash-run

**What this repo is:** the thinnest thing that lets any repo develop and run EmDash through `mise`.
EmDash already ships the tooling. This repo adds a task only where EmDash has a gap that has been
proven by running EmDash's own command first.

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
   | `emdash-plugin` | plugins: `init`, `validate`, `build`, `dev`, `bundle`, `publish`, `search`, `info`, `release setup` | `mise run emdash-plugin -- <command>` |

   Run `--help` on the command you are about to wrap. If it has the option, use it.

2. **Read the skill for the area before working in it.** EmDash writes them for agents; they are in
   the site at `site/.agents/skills/` (the scaffolder puts them there):
   - `emdash-cli/` — the CLI, sign-in, the editing flow, site export and import
   - `building-emdash-site/` — config, schema and seed, querying, rendering, site features
   - `creating-plugins/` — plugins, capabilities, hooks, testing, publishing

   Then the guide: `mise run source` puts EmDash's docs at `.src/emdash/docs/src/content/docs/` —
   23 guides, 10 deployment pages. `guides/internationalization.mdx` and
   `deployment/schema-evolution.mdx` are two that the harness contradicted because nobody read them.

3. **Search the registry before building a feature into a site:**
   `mise run emdash-plugin -- search <words>`.

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
  stages. There is no script underneath: if a step seems to need logic, that is a gap to write in
  the plan, not code to add.
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
- **CI is the three-OS proof, not the test loop.** Lint a workflow with `actionlint` and run its
  steps locally before pushing. On a runner `CI=true` makes mise answer every prompt with yes.
- **Plans live in `docs/plans/`** — the open one is `2026-10-07-stages.md`.

## Tools

- **A browser:** Playwright, configured once per machine as headless and isolated. Sign in through
  `/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`.
- **EmDash's docs MCP** (`.mcp.json`): `emdash-docs`, for looking things up in the current docs.
- **EmDash's skills** come with the site: `site/.agents/skills/`. *EmDash first*, rule 2, says when
  to read them. `pnpm dlx skills update` refreshes them.
- **mise skills are machine-level** (`~/.claude/skills/`), not this repo's.
