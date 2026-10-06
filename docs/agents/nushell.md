# Working in `nu/`

The logic of every task is nushell, in `nu/`. `mise.toml` only names the tasks.

## Shape

```
mise.toml        [tasks.deploy]  run = "nu --no-config-file {{config_root}}/nu/main.nu deploy"
nu/main.nu       def "main deploy" [--dry, --build-only, --no-check] { … }     one per task
nu/site.nu  plugin.nu  checks.nu  registry.nu                                  what flows are made of
nu/lib.nu        shared helpers — anything two flows need
nu/tests.nu      unit tests for the pure functions
```

- **Adding a flow:** write `def "main <name>"` in `main.nu`, add the task to `mise.toml`, run
  `mise run check -- --fix`. `check` fails if a task names a command that does not exist, or a
  command has no task.
- **Arguments are nushell's.** Positional parameters, `--flags` and `--help` come from the `def`
  signature; `mise run plugin:new -- my-plugin` passes them straight through. No `usage` blocks.
- **Settings are environment variables**, set by mise from PROJECT SETTINGS: `$env.SITE_DIR`,
  `$env.EMDASH_VERSION`. Use `setting NAME` for an optional one — it returns `""` when unset.
- **A function that can be pure, is** — records in, records out, no files — and gets a test in
  `tests.nu`. `merge-seeds` and `registration` are the models.

## The helpers in `lib.nu`

| helper | use it for |
|---|---|
| `step`, `ok`, `fail` | output. `fail` prints, optionally says what to do, and exits non-zero |
| `code { … }` | run a block and get its exit code instead of aborting |
| `emdash …` | the CLI, run in the site directory, where it must run |
| `emdash-json …` | the CLI's JSON, parsed. Errors when no JSON comes back |
| `url-flag` | `--url <deployment>` when `EMDASH_URL` is set |
| `devdb` | the dev server's real database file |
| `secret NAME` | a credential from the environment, else fnox, else `""` |
| `with-site-paused { … }` | stop the dev server around a build, and put it back whatever happens |
| `daemon-running`, `daemon-stop`, `answers` | daemons and "is anything listening" |

## Traps — each one cost a session here

- **A failing external command aborts the script.** Nothing after it runs — not cleanup, not the
  next check. Wrap it in `code { … }` to keep going, or `| complete` to capture it.
- **Inside `$"…"`, `(word)` runs a command called `word`.** `problem(s)` fails at run time as
  "command `s` not found", and nushell's checker accepts it. `check` has its own rule for it.
  Phrase messages without brackets.
- **The emdash CLI prints an error and exits 0.** Never parse its output directly; use
  `emdash-json`.
- **EmDash's file commands default to `./data.db`**, which a Cloudflare site never uses. `doctor`,
  `seed` and `export-seed` must be given `devdb`, or they report on an empty file.
- **`EMDASH_TOKEN` and `EMDASH_REGISTRY_URL` are unset in `mise.toml` on purpose.** The CLIs read
  them, and a stale value from an old shell silently redirects every call.
- **A closure cannot capture a `mut`.** Copy it into a `let` first.
- **`insert` errors on an existing column; `upsert` overwrites.**
- **A regex goes in single quotes** — `'\s+'`. In double quotes `\s` is a parse error.
- **Read structured output, do not scrape it:** `mise daemons ls --json | from json`.
- **`cd` inside a `def` is scoped to it.** That is how `emdash` and `wrangler` run in the site
  without moving the caller.
- **Values in `[daemons]` reach pitchfork verbatim** — no `{{templates}}`. That is why the ports
  appear there as literals.

## Proving a change

- Run the flow. `mise run check` is fast (about 4 seconds); use it constantly.
- For a new check, plant the fault it should catch and watch it fail, then add the fault to
  `selftest-problems` in `checks.nu` if it guards the harness itself.
- When replacing working code, capture the old output first, delete it, run the new code, compare.
