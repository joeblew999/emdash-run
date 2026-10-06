# Writing tasks in `mise.toml`

Everything here was learned by getting it wrong first. If you are editing `mise.toml`, read this
before you write a task body — most of these fail in ways that look like something else.

`mise.toml` is the interface **and** the implementation. There are no scripts: every task body is
**nushell** (`[task_config] shell`), so a task is one readable thing that behaves the same on every
machine.

## The shape of a good task

- **A task body beats a helper file.** `cp`, `rm`, `git`, `pnpm`, `curl` and `emdash` need no
  wrapper — mise already provides the argument parser (`usage`), the working directory (`dir`), the
  runner, and `sources`/`outputs` for skipping work already done.
- **mise is for configuration and composition; nushell is for logic.**
  - shared *data* → `[env]` (`CODE_PATHS`, `DEPLOY_URL`), or `[task_config]` (`shell`, `dir`)
  - shared *logic* → a hidden helper task (`hide = true`), called as `mise run ns:_helper`
  - the flows a human types live at the top; helpers live at the end under their own banner
- **A hidden helper owns one concern.** The ones here: `emdash:_json` (the only thing that talks
  JSON to the CLI), `site:_devdb` (which database is the dev one), `site:_pause`/`_resume`,
  `plugin:_dirs`/`_require`, `mcp:_login`, `skills:_shipped`, `fs:_link`, `plugin:_sweep`,
  `site:_deploy`, `registry:_admin`.
- **`hide = true` hides a task — a leading `_` in the name does NOT.** And hidden tasks do not
  appear in `mise tasks ls`, so when you are checking whether one exists, grep the *file*.

## Check your work — do not reason about it

| command | what it catches |
|---|---|
| `mise run check` | everything before a commit; composes the rest |
| `mise run repo:nu` | **nushell's own checker** over every task body |
| `mise tasks validate` | mise's own checks on the task definitions (composed into `repo:check`) |
| `mise fmt --check` | `mise.toml` is formatted by mise's own formatter (composed into `repo:check`) |
| `repo:docs` | `docs/tasks.md` is exactly what the tasks are — generated, never hand-edited |
| `mise run repo:sync` | a daemon in `pitchfork.toml` naming a task that does not exist |
| `mise run doctor` | the live state: site database, plugin consistency, `repo:verify` |
| `mise run site:check` | the site type-checks, including that `astro.config.mjs` loads |

`repo:nu` matters most: task bodies live inside TOML, so **nothing parses them until they run**. A
typo stays invisible until someone happens to hit that path. It writes each body out and runs
`nu --ide-check`, which reports parse errors, type mismatches and unknown variables, and does not
resolve externals — so `^cmd` and a bare `pnpm` raise no false alarm.

It has already caught, in tasks that had never been run:

- `&&` — **not a nushell operator**;
- a command wrapped across two lines — **a parse error**;
- `let nu = …` — `nu` is not a usable variable name.

**What none of them check: `usage` specs.** mise validates a usage spec only when the task is
invoked, so a malformed one fails at *use*, not at check time — `mise tasks ls`, `mise tasks info`
and `mise tasks validate` all accept a broken spec (verified). Keep usage specs simple, and treat
the first invocation of a task you just wrote as the check.

**`mise fmt` formats `mise.toml`** — it sorts keys and normalises whitespace. oxfmt does not touch
TOML, so before this was wired in, the file the whole repo depends on was the one file nothing
formatted. Run `mise run repo:format` to fix it; `repo:check` fails if it drifts.

**`mise watch`** reruns a task when files change. Unused: the plugin watch is `plugin:dev`.

### `mise daemons` — the daemons live in `mise.toml`

There used to be a second file (`pitchfork.toml`) holding the same three daemons, whose `run` lines
were `mise run <task>` — duplication that needed a guard to stop it drifting. mise owns them now:

```toml
[settings]
experimental = true          # in the repo's config, so it travels with the repo

[daemons.emdash]
run = "mise run site:dev"
dir = "."
auto = ["start", "stop"]
ready_http = "http://localhost:4321/"
```

`run`, `dir`, `auto` and `ready_http` are all accepted. `mise daemons start|stop|status|logs`
replaces every hand-rolled `pitchfork` call, and **no task calls pitchfork directly any more**.

**If you ever see this**, the state is stale, not the config:

```
mise ERROR daemons … are registered under namespace "emdash-run" but the configuration now
asks for "emdash-run-3d00ac2258349554"; stop them before changing the namespace
```

mise namespaces daemons `<label>-<hash>`, and pitchfork had them registered under the bare label.
Stopping the daemons is not enough — the *registration* persists and every `mise daemons` call
fails, so the site cannot start. Clear both sides:

```
pitchfork stop -a
# remove [daemons."<label>/…"] blocks from ~/.local/state/pitchfork/state.toml
# remove [namespaces.<label>] from ~/.config/pitchfork/config.toml
rm -rf ~/.local/state/mise/daemons
mise daemons ls        # should list <label>-<hash>/<daemon> … available
```

`mise daemons prune` does **not** help — it only clears state for *deleted* project directories.

**And one thing mise does not check:** `mise tasks validate` passes with a daemon whose `run` names
a task that does not exist (verified by planting one). `repo:sync` is the guard for that; it reads
`[daemons]` out of `mise.toml` and checks each task resolves.

### Generated artefacts, and hooks

Two things mise generates, both composed into the checks so they cannot drift:

- **`mise generate task-docs`** → `docs/tasks.md`, the task reference a newcomer reads. There is no
  hand-written task list anywhere; `repo:docs` fails unless regenerating produces exactly what is
  committed, and `repo:docs:write` is the fix.
- **`mise generate git-pre-commit`** → a hook that exports the staged files as `STAGED` and runs
  `mise run pre-commit`. It is committed in `.githooks/` (not `.git/hooks/`, which nobody else
  has) and `repo:hooks` points git at it with `core.hooksPath`.

**Inside a task, a `mise` command that reads the config needs `mise --cd $env.ROOT`.** Tasks run in
`.src/site`, so `mise fmt` said "No config file found in current directory" and
`mise generate task-docs --output docs/tasks.md` wrote to `.src/site/docs/`. Both are fixed that
way, and it is the first thing to try when a mise command behaves oddly inside a task.

## mise facts that are not obvious

- **`usage` is a validated signature, not appended text.** mise sets `$env.usage_<name>`, and extra
  bare words are **rejected** ("unexpected word: beta") rather than appended. So a variadic is not
  available — pass one space-joined string and split it (`emdash:_json` does this).
- **`[task_config] dir` sets the default working directory** for every task in the file. Ours is
  `.src/site`, because the CLI looks for a project root (a `package.json`) and the repo root has
  none. A task that needs elsewhere overrides it (`registry:*`, `plugin:init`).
- **`mise run` writes its banner to stderr**, so a helper task's stdout is clean and a helper can
  return a value: `let db = (^mise run site:_devdb | str trim)`. On failure, have the helper
  `print --stderr "…"` and `exit 1`, and let the caller test for empty.
- **`mise tasks info <name>` is the existence test** — it exits non-zero for an unknown task. That
  is how `repo:sync` checks `pitchfork.toml`, and it is more reliable than parsing `mise tasks ls`,
  whose descriptions wrap.
- **`{{config_root}}` resolves when the config loads**, so use it for script paths instead of a
  shell variable — no quoting, absolute on every platform.
- `depends` runs in **parallel**; use a body when order matters.

## nushell traps

- **Environment variables are `$env.VAR`**, never `$VAR`. Usage arguments included:
  `$env.usage_<name>`.
- **Inside `$"...($x)..."`, parentheses are subexpressions.** A literal `(text)` is parsed as a
  command: `token(s)` fails as "Command `s` not found", and `problem(s)` is a *static* "Variable not
  found". Phrase messages without brackets. (A bare `(committed)` is not caught — it looks like an
  external command.)
- **A regex in a double-quoted string is a parse error** (`unrecognized escape sequence '\s'`).
  Regexes go in single quotes. In TOML, a block containing `\s` needs `'''`, because `"""`
  rejects the escape.
- **There is no `set -e`.** A failing external command does not abort the body. Check
  `$env.LAST_EXIT_CODE` for the ones you care about and `exit` non-zero yourself. To collect several
  results and fail once, keep the codes and test them together — that is how `repo:check` shows you
  every problem in one run.
- **`insert` errors when the column already exists; `upsert` is the overwrite.** A JavaScript
  `Map.set` union is `upsert`.
- **A record literal cannot define a field that `...$spread` already supplied** — `upsert` twice.
- **A closure cannot capture a `mut` binding.** Copy it into a `let` first.
- **`describe` says `table`, not `list`, for an array of objects.** Guard on `record` instead —
  only a record carries a `.data` envelope, and guarding on "list" silently never matches.
- `get -i` is deprecated → **`get -o`**. `str downcase` → **`str lowercase`**.
- `sort-by` is **not** case-insensitive; JavaScript's `localeCompare` was. Use `str lowercase` on
  the sort key.
- A failing external with `^` still sets `LAST_EXIT_CODE`; `| complete | ignore` is how to tolerate
  one on purpose.

## Editing `mise.toml` safely

- **A regex that runs to the next `"""` can eat tasks.** `\[tasks\."X"\][\s\S]*?\n"""` looks
  bounded, but when X's body is a *one-liner* it runs past X and deletes every task up to the next
  multi-line one. That happened here. After any bulk edit, diff the task list against the last
  commit:

  ```sh
  git show HEAD:mise.toml | grep -oE '^\[tasks\."[^"]+"\]' | sort > /tmp/before
  grep -oE '^\[tasks\."[^"]+"\]' mise.toml | sort > /tmp/after
  comm -3 /tmp/before /tmp/after
  ```

- **A removal pattern can match the line you just added.** Deleting 27 copies of a `dir = …` line
  also deleted the new default in `[task_config]`, which matched the same text.
- **A Python `'''` heredoc cannot contain a nu `'''` usage spec** — use `"""` for the TOML usage
  block when the script doing the writing is itself triple-quoted.

## Proving a port is equivalent

When replacing working code with new code, capture a baseline from the **old** code first, then
diff. Two of these comparisons were meaningless before they were fixed:

- **Delete the output before running the new code.** A task that fails leaves the previous output on
  disk, so comparing it to the baseline "matches" trivially. This happened twice here.
- Compare **parsed** data (`json.load`) when only formatting differs, and byte-for-byte when the
  file is consumed as text.
- For a check, prove it **fires**: plant the fault it is meant to catch, confirm it names it and
  exits non-zero, then remove the fault. A check that cannot fail is worse than none — `plugin:audit`
  was tested by planting a plugin whose script could never run.
