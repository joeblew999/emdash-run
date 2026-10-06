# Working in `nu/`

The logic of every task is nushell, in `nu/`. `.config/mise/conf.d/harness.toml` only names the
tasks, and `mise.toml` is the project's settings.

## Shape

```
harness.toml     [tasks.deploy]  usage = 'arg "[args]" var=#true'
                                 run = "nu --no-config-file {{config_root}}/nu/task.nu deploy"
nu/task.nu       reads the task's arguments from mise and runs main.nu with them
nu/main.nu       def "main deploy" [--dry, --build-only, --no-check] { … }     one per task
nu/site.nu  plugin.nu  checks.nu  registry.nu                                  what flows are made of
nu/lib.nu        shared helpers — anything two flows need
nu/tests.nu      unit tests for the pure functions
```

- **Adding a flow:** write `def "main <name>"` in `main.nu`, add the task to `harness.toml`, run
  `mise run check -- --fix`. `check` fails if a task names a command that does not exist, or a
  command has no task.
- **Arguments are nushell's.** Positional parameters, `--flags` and `--help` come from the `def`
  signature. They reach it through `task.nu`, not by mise appending them — on Windows mise does not
  append. So every task carries the same line, `usage = 'arg "[args]" var=#true'`, and `check`
  fails on a task without it. Never write a task whose `run` expects appended arguments.
- **Settings are environment variables**, set by mise: the project's from `mise.toml`
  (`$env.EMDASH_VERSION`), paths and defaults from `harness.toml` (`$env.SITE_DIR`). Use
  `setting NAME` for an optional one — it returns `""` when unset.
- **A function that can be pure, is** — records in, records out, no files — and gets a test in
  `tests.nu`. `split-args` and `registration` are the models.

## The helpers in `lib.nu`

| helper | use it for |
|---|---|
| `step`, `ok`, `fail` | output. `fail` prints, optionally says what to do, and exits non-zero |
| `code { … }` | run a block and get its exit code instead of aborting |
| `setting NAME` | an optional setting from the environment, `""` when unset |
| `harness-file` | the path of `harness.toml` |
| `split-args` | a shell-quoted string into its arguments — how `task.nu` reads a task's arguments |
| `emdash …` | the CLI, run in the site directory and aimed at this checkout's site (or the `--url` deployment). `check` fails on `^emdash` anywhere else |
| `emdash-result …` | the same, captured: `{stdout, stderr, exit_code}` |
| `emdash-json …` | the CLI's JSON, parsed. Errors when no JSON comes back |
| `target $url` | aim the rest of a flow at a deployment: sets `EMDASH_URL`, and `EMDASH_TOKEN` from `DEPLOY_TOKEN` |
| `on-cloudflare` | true when the template runs on Cloudflare (it ships a `wrangler.jsonc`), false on Node.js |
| `devdb` | the dev server's real database file, on either platform |
| `wipe-local-data` | stop the site and delete the local database and uploads |
| `backup-local-data LABEL`, `restore-local-data DIR` | stop the site and copy its database and media into `run/backups/`, or back. The caller restarts |
| `request` | one HTTP request: `{status, body}`, status 0 when nothing answered. Never throws |
| `holds FILE TEXT` | does the file hold exactly this text — how `run/` remembers what the seed, or the running server, was last brought up on |
| `emdash-in DIR` | the EmDash installed in the site or a plugin, `""` before an install |
| `files-in DIR PATTERN` | files matching a glob, safe on Windows paths. `check` fails on a bare `glob` outside `lib.nu` |
| `daemon-running`, `daemon-stop`, `answers`, `port-taken` | daemons and "is anything listening". `daemon-stop` returns only when the daemon's port is free |
| `site-url`, `registry-url` | where the site and the local registry answer — they follow `SITE_PORT` and `REGISTRY_PORT` |

## Portable, by construction

Every task has to run on macOS, Linux and Windows. So nothing calls a program that is not on all
three. `check` enforces it: the `PORTABLE` list in `checks.nu` is every program the harness may
run, and anything else fails.

| instead of | use |
|---|---|
| `curl` | `request GET|POST url --headers {…} --timeout 10sec` — returns `{status, body}`, never throws. A POST sends an empty JSON body |
| `find`, `cp`, `rm`, `mkdir`, `cat` | `files-in`, and nushell's `ls`, `cp`, `rm`, `mkdir`, `open` |
| `open` / `xdg-open` / `start` | nushell's `start` |
| `printenv`, `env` | `$env.NAME`, `setting NAME` |
| `/dev/null` | `| ignore`, or `| complete` |
| `sh -c "…"` | write it in nushell |
| building paths with `/` | `path join` |

## Traps — each one cost a session here

- **`^cmd | ignore` can never fail.** The pipe swallows the exit code, so a check written that way
  always passes — one of ours did. Use `| complete` and test `exit_code`. `check` rejects it now.
- **A failing external command aborts the script.** Nothing after it runs — not cleanup, not the
  next check. Wrap it in `code { … }` to keep going, or `| complete` to capture it.
- **Inside `$"…"`, `(word)` runs a command called `word`.** `problem(s)` fails at run time as
  "command `s` not found", and nushell's checker accepts it. `check` has its own rule for it.
  Phrase messages without brackets.
- **Read the emdash CLI's JSON through `emdash-json`.** It fails loudly when the command fails or
  returns no JSON, so a broken call can never read as "0 entries".
- **EmDash's file commands default to `./data.db`**, which a Cloudflare site never uses. `doctor`,
  `seed` and `export-seed` must be given `devdb`, or they report on an empty file.
- **`EMDASH_TOKEN` and `EMDASH_REGISTRY_URL` are unset in `harness.toml` on purpose.** The CLIs read
  them, and a stale value from an old shell silently redirects every call. A deployment's token is
  `DEPLOY_TOKEN`; `target` hands it to the CLI, in `--url` flows only.
- **A closure cannot capture a `mut`.** Copy it into a `let` first.
- **`insert` errors on an existing column; `upsert` overwrites.**
- **A regex goes in single quotes** — `'\s+'`. In double quotes `\s` is a parse error.
- **Read structured output, do not scrape it:** `mise daemons ls --json | from json`.
- **`cd` inside a `def` is scoped to it.** That is how `emdash` and `wrangler` run in the site
  without moving the caller.
- **mise does not expand its `{{templates}}` in `[daemons]`** — pitchfork gets the text and has
  its own, different variables. That is why the ports appear there as literals.

## Proving a change

- Run the flow. `mise run check` takes seconds; use it constantly.
- For a new check, plant the fault it should catch and watch it fail, then add the fault to
  `selftest-problems` in `checks.nu` if it guards the harness itself.
- When replacing working code, capture the old output first, delete it, run the new code, compare.
