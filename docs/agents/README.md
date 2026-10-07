# Agent guide — emdash-run

This repo is a set of `mise` tasks for working on an EmDash site. Read this before changing anything.

## How the owner wants the work done

1. **Use EmDash's own commands.** It ships three CLIs — `emdash`, `emdash-plugin`, `create-emdash`
   — and Astro and wrangler have theirs. Run `--help` before writing a step; if a command exists,
   the step is that command. A script is allowed only where no command exists.
2. **Know what works from a file.** After any change to `tasks.toml` or `admin/`, run
   `mise run test` and commit the `docs/status.md` it writes; after a push, `mise run test:published`
   proves what another developer gets. "It works" means the status file
   says so for this commit.
3. **Do the whole job in one pass.** When something changes, fix everything it makes stale in the
   same pass: descriptions, README, plan, changelog. Look ahead for what breaks next.
4. **Say what failed, first, unasked.** Never report something as working that you have not run.
5. **One plan.** `docs/plans/` holds one open plan, in stages. A finding becomes a box in it, not
   a new plan or a new task.
6. **Never wait in silence.** Start a long run in the background and keep working.
7. **No CI unless the owner says.** The workflow runs by hand or on a release tag only.
8. **These are test sites.** Do not switch things off or add security guards while the owner is
   exploring; security is a later job, with the owner.
9. **Keep it short.** Task descriptions are one line. Docs are for someone who wants to use the
   tasks, not a record of how they were made.

## How it is built

| | |
|---|---|
| `tasks.toml` | every task. Visible ones are `<what>:<verb>`; hidden `step:*` ones are single commands, reused |
| `admin/token.mjs` | `signin:token` — an administrator and an API token written to the site's database |
| `admin/access.mjs` | `signin:access` — Cloudflare Access through Cloudflare's API |
| `admin/first-admin.mjs` | `signin:passkey`, `signin:open` — the only Playwright |
| `admin/emdash.mjs` | the `emdash` task — the CLI, plus `--live`, `--preview` and what is saved for the site |
| `tests/replay.sh` | `mise run test`, `test:full`, `test:published` (tasks fetched from GitHub) — always in a clean environment; writes `docs/status.md` |
| `mise.toml` | this repo's settings and its own `test` tasks |
| `site/` | not in the repo. `mise run site:new` makes one here to try tasks on; it is gitignored |

## Rules that came from mistakes

- **Where a task acts:** no flag is this machine; `--live` is the deployed site (`LIVE_URL`).
  Every task prints where it is acting.
- **A setting is read as `{{ env.NAME | default(value='…') }}`.** `get_env()` does not see the
  project's settings.
- **A task finds its own files with `{{ env.MISE_TASK_DIR }}`** — inside `run`, not inside `dir`.
- **No `tools =` on a task.** A hidden step does not inherit them; the project's `[tools]` is the
  one place.
- **Steps are plain `program arguments` lines** so they mean the same on every OS.
- **Stop the site before changing its packages.** On Windows a running site breaks otherwise.
- **`emdash whoami` exits 0 with no site running.** To check a site answers, use
  `emdash schema list`.
- **`emdash login` saves its sign-in per project folder**, and a stale one breaks the dev CLI.
  `signin:token` does not use it.
- **The live tasks use the wrangler login.** Only `signin:access` needs more — wrangler's login
  cannot change Cloudflare Access — and it reads `CLOUDFLARE_API_TOKEN` from the environment or,
  by itself, from fnox. No task needs a `fnox exec --` prefix. fnox is in the README's `[tools]`.
- **Add files to a commit by name.**

## Reading EmDash

- Its skills, in any scaffolded site: `site/.agents/skills/` (`emdash-cli`,
  `building-emdash-site`, `creating-plugins`).
- Its docs: the `emdash-docs` MCP server (`.mcp.json`). Its source, when you need to read the code:
  `git clone https://github.com/emdash-cms/emdash .src/emdash` (`.src/` is gitignored).
- Things in EmDash and wrangler that do not behave as documented: `docs/upstream.md`.
