# emdash-run

**Develop and run [EmDash](https://docs.emdashcms.com) from any repo, with one set of mise tasks.**

The real published `emdash`, an official template, the official CLIs — wired together so that each
job is one command: bring a site up, model content, build a plugin, deploy and verify, back up and
restore. You own about 40 lines of settings; the rest is the harness, and it updates itself.

## Get started — in your own repo

You need [mise](https://mise.jdx.dev) and git. In your repo (or an empty folder):

```sh
curl -fsSL https://raw.githubusercontent.com/joeblew999/emdash-run/main/install.sh | sh
```

That is the whole install. It fetches the harness, gives you a `mise.toml` of settings, installs the
toolchain, builds a site from the official starter template, starts it, checks it, and prints:

```
✓ EmDash 1.1.0 is running — the starter-cloudflare template, on your settings
  site    http://localhost:4321
  admin   http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
```

From then on:

```
mise run open        the admin, signed in
mise run status      what is running, and on what
mise run dev         after you change anything — your settings, config/, a plugin
```

<details><summary>What the installer does, if you would rather run it by hand</summary>

```sh
curl -fsSL https://github.com/joeblew999/emdash-run/releases/latest/download/emdash-harness.tar.gz | tar xz
cp nu/project.example.toml mise.toml
mise trust --all
mise run setup
```
</details>

**Why you can trust it**

- It is the real thing: the published `emdash` package, an official template, the official CLIs.
  The harness only does what they leave to you.
- `mise run check` (4 seconds) proves the harness itself holds together — including planting known
  faults to make sure its own checks can fail.
- `mise run doctor` proves the *running* site matches your repo; `doctor -- --url` does the same
  for a deployment. `deploy` will not ship if `check` fails, and verifies what is live.
- Every release is run end to end first: on macOS, in a clean Linux container, on a second project
  with a different template, and against a live Cloudflare deployment.

**Platforms.** macOS and Linux are proven (minimal Debian needs `apt install libatomic1`).
Windows has no known blocker but has not been run — tell us what you find.
**Deploying** needs Cloudflare credentials in [fnox](https://fnox.jdx.dev)
(`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) and `DEPLOY_URL` in your `mise.toml`. Local
development needs neither.

## Every day

```
mise run status                   what is running, and on what
mise run dev                      after any change: config, seed, plugins, restart — prints the URLs
mise run check                    before a commit (the git hook runs it)        --fix repairs
mise run doctor                   is the running site what the repo says?       --url <deployment>
mise run deploy                   check, build, ship to Cloudflare, verify      --dry
mise run rollback                 put the previous deployment back
mise run snapshot                 the whole site as a package
mise run restore -- <package>     …and back again                               --wipe --confirm
mise run reset                    wipe the local database, back up on the seed
mise run logs                     follow the site                               --deployed
mise run plugin:new -- <name>     scaffold a plugin and load it into the running site
mise run emdash -- <anything>     the official CLI: schema, content, media, taxonomy, menu, search…
mise run upgrade                  take a newer harness
```

Each task is a **flow** — one command for a whole job. `mise tasks ls` lists all 28;
[`docs/tasks.md`](docs/tasks.md) is the same list. Add `-- --help` to any of them.

## What is yours, and what is the harness's

| | whose | what |
|---|---|---|
| `mise.toml` | **yours** | your settings: template, EmDash version, seed, deploy URL, what `doctor` checks |
| `config/` | **yours** | your site config and seed. `setup` starts you from the template's own files |
| `plugins/` | **yours** | your plugins, made by `plugin:new` |
| `.config/mise/conf.d/harness.toml`, `nu/` | the harness's | tools, tasks, daemons, and the logic. Don't edit — `mise run upgrade` replaces them |
| `.src/`, `run/` | generated | the template, the site, tokens, snapshots. Gitignored; never edit |

To change the site, edit `config/` and run `mise run dev`. Never edit `.src/site` — it is rebuilt.

## Plugins

```
mise run plugin:new -- my-plugin      scaffold (official CLI), install, test, build, load, call it
mise run plugin:dev -- my-plugin      rebuild on change
mise run plugin:probe -- my-plugin    ask the running site to call it
mise run plugin:release               validate, typecheck, test, build, bundle
mise run plugin:roundtrip             prove the whole toolchain with a throwaway plugin
```

It works on a new project with no setup: the harness switches on plugin loading in your site
config when it creates it. [`docs/plugin.md`](docs/plugin.md) explains what happens at each step,
what the official scaffold gets wrong, and how the harness fixes it.

## More

- [`CHANGELOG.md`](CHANGELOG.md) — what each release changed, and its known limits
- [`docs/plugin.md`](docs/plugin.md) — the plugin round trip
- [`docs/auth.md`](docs/auth.md) — EmDash's auth model and tokens
- [`docs/agents/`](docs/agents/README.md) — working on the harness itself, for people and agents
- [`docs/plans/`](docs/plans/) — what is left

This repo is also a working project: its own `mise.toml` and `config/` are an example (a CAD parts
catalogue whose `doctor` checks need its owner's Cloudflare bucket). Start from the release above,
not from a clone, unless you are working on the harness.
