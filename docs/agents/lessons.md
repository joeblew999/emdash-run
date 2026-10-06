# Lessons — what building this taught us

Each of these cost real time on 2026-10-06. They are here so nobody pays for them twice. Where a
lesson is enforced by a check, it says so — those cannot regress quietly. The rest are on you.

## About claims

- **A claim is a hypothesis until something ran.** The first author's comments said a failing
  command does not abort a nushell script (it does), that sandboxed plugins are D1-only (they run
  on Node too), that the CLI exits 0 on errors (it exits 1), that a checker caught a pattern (it did
  not). An audit found eleven such claims still in the repo. Read the source, or run it.
- **"No known blocker" is not "works".** Windows was described that way while three things were
  broken on it. A platform works when `mise run verify` has passed on it. *Enforced: CI.*
- **A check that cannot fail is worse than none.** Two of ours could not: one piped its command
  into `ignore`, one only matched programs written with `^`. *Enforced: `check` plants known
  faults in a copy of the harness and requires each to be caught. Add a plant with every new rule.*
- **Know the thing you are wrapping.** The harness was built by fixing breakage, without anyone
  reading EmDash. `docs/emdash.md` is the result of finally reading it — sourced, line by line.
  Start there before changing how the harness talks to EmDash.

## About portability

- **Every task runs on macOS, Linux and Windows, on Cloudflare or Node.js.** That is the product.
- **Call nothing that is not on all three OSes.** `curl`, `find`, `printenv`, `open`, `sh -c`,
  `/dev/null` — all were here, all are gone. Use nushell's own commands. *Enforced: `check`.*
- **mise does not append task arguments on Windows.** They arrive through the `usage` mechanism
  and `nu/task.nu`. *Enforced: `check` sends awkward arguments through mise and wants them back.*
- **A glob pattern treats `\` as an escape, and `path join` produces `\` on Windows.** Use
  `files-in`. *Enforced: `check`.*
- **npm tools installed as mise tools cannot find their dependencies on Windows.** Run them
  through `dlx` (pnpm) at a pinned version.
- **Windows keeps a stopped process's files locked for a moment.** Clean up best-effort; never
  reuse a directory a site just ran in.
- **Bind the dev server to `127.0.0.1`.** Astro's default is IPv6 only, and Linux resolves
  `localhost` to IPv4 first — so the CLI was refused while curl worked.
- **No symlinks.** *Enforced: `check`.*

## About the harness

- **Nothing waits without a limit.** A readiness wait with no timeout hung a release for fifteen
  minutes. Use `wait-for`. *Enforced by test.*
- **Every optional setting has an empty default in `harness.toml`.** Otherwise a project inherits
  another project's value from the shell that ran the task — one built its site with the wrong seed.
- **`EMDASH_TOKEN`, `EMDASH_REGISTRY_URL` are unset on purpose.** A stale value in an old shell
  silently redirects every CLI call.
- **`^cmd | ignore` swallows the exit code.** Use `| complete`. *Enforced: `check`.*
- **Inside `$"…"`, `(word)` runs a command.** *Enforced: `check`.*
- **A project is `mise.toml` and `site/`. The harness is `harness.toml` and `nu/`.** Nothing
  project-specific goes in the harness half, or `mise run upgrade` would destroy it.
- **A real site owns its source.** The first design kept the site as a throwaway copy of the
  template with two config files laid over it. That suits trying EmDash, not building on it:
  EmDash's own site changed nearly every file of its template, and every page edit would have cost a
  restart. The site is `site/`, the project's, edited in place.
- **Let EmDash do what EmDash does.** Its `dev-bypass` call migrates, sets up, seeds into the right
  storage and returns an admin token. We were doing each of those by hand, and worse.

## About working

- **Local first; CI is not the edit loop.** `mise run check` (seconds), `mise run verify -- --full`,
  `verify:template -- starter --full`, `verify:linux`. A push runs only `check` on three OSes; a
  release tag runs everything. Push once per finished piece of work.
- **A release is a tag, and must be cheap.** The harness is a small tarball. Gating every release
  on a 15-job matrix turned a one-minute act into a quarter of an hour, six times in one day, and
  tied all other work to CI. A tag now runs the fast check and publishes; the full matrix is run by
  hand when the cross-platform layer changes.
- **Do not wait in the foreground.** A CI run, a container, a slow install: start it in the
  background, or hand it to an agent with a read-only brief, and keep working.
- **Agents need boundaries.** Give each one the files it may touch and say who owns the running
  site and its port — two flows on port 4321 corrupt each other, and so does a check run while
  another flow is installing a plugin. `verify:template` builds its throwaway project on the
  checkout's own `SITE_PORT`, and leaves other checkouts' recent throwaway projects alone.
- **Plans are checkboxes with proofs** (`docs/plans/`). A plan says what was verified and what is a
  guess. When it is done it moves to `done/`; when it is dropped it says why.
- **Comments say what; docs say why; git says when.**
