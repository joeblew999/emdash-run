# Plugins

This repo ships **no plugin of its own**. It ships the way to make one: the official CLI,
composed into tasks, so a plugin goes from nothing to running inside a live EmDash in one command.

```
mise run plugin:new -- <name>      scaffold → fit → install → validate → typecheck → test → build
                                   → load into the site → the running site calls it
mise run plugin:probe -- <name>    call a plugin's route on the RUNNING site (default: hello)
mise run plugin:dev -- <name>      rebuild on change (official: emdash-plugin dev)
mise run plugin:remove -- <name>   take it out: directory, the site's copy, the registration
mise run plugin:roundtrip          all of the above with a throwaway plugin, leaving nothing behind
```

`plugin:roundtrip` is the answer to "does plugin development work against this EmDash, today?".
Run it after changing `EMDASH_VERSION`, the plugin CLI version, or the template.

## What happens, and which tool does it

| step | tool | task |
|---|---|---|
| scaffold | `emdash-plugin init` | `plugin:init` |
| fit to this site | this repo | `plugin:_fit` |
| install | `pnpm install` | `plugin:install` |
| validate the manifest | `emdash-plugin validate` | `plugin:validate` |
| typecheck | `tsc --noEmit` | `plugin:typecheck` |
| test, through EmDash's sandbox | `vitest` + `@emdash-cms/plugin-test` | `plugin:test` |
| build | `emdash-plugin build` | `plugin:build` |
| register with the site | this repo | `plugin:_register` (run by `config:apply`) |
| copy into the site | this repo | `plugin:link` |
| restart the site | mise daemons | `repo:apply` |
| prove the site runs it | this repo | `plugin:probe` |
| bundle for release | `emdash-plugin bundle` | `plugin:bundle` |

Everything the official CLI does, it does. The three steps marked "this repo" are the ones the CLI
leaves to you, and they are where the time used to go.

## What the scaffold needs fixing — `plugin:_fit`

`emdash-plugin init` writes a plugin for a site that is not this one:

- **It will not run without a terminal.** It exits with "Non-interactive setup requires:
  --publisher, --author-name, --security-email or --security-url". `plugin:init` passes them from
  `PLUGIN_PUBLISHER`, `PLUGIN_AUTHOR` and `PLUGIN_SECURITY_URL` in PROJECT SETTINGS.
- **It asks for EmDash 0.x.** `emdash: ">=0.12.0 <1.0.0"` installs 0.x while the site runs 1.x, so
  the scaffold's green test is evidence about a different CMS. Pinned to `EMDASH_VERSION`;
  `plugin:audit` fails on any drift afterwards.
- **Its `@emdash-cms/plugin-test` range predates EmDash 1.x.** Set to the current release.
- **It pins `packageManager`.** mise provides pnpm, so the pin is dropped.
- **It creates three symlinks** (`.agents/skills`, `.claude/skills`, `.claude/CLAUDE.md`). This
  repo allows none — `repo:check` fails on one — and the skills are vendored at the repo root.

## How the site finds a local plugin

`config:apply` generates `.src/site/local-plugins.mjs` from `plugins/`, and the site's
`astro.config.mjs` spreads it into `sandboxed: []`. A directory is registered when it has an
`emdash-plugin.jsonc`. Nothing is edited by hand, so adding or removing a plugin cannot leave the
config pointing at something that is not there.

Two details that cost a session each to learn:

- **The site imports the package root, not `/sandbox`.** `emdash-plugin build` generates a
  descriptor at the root that names `<pkg>/sandbox` as its entrypoint. Importing `/sandbox` hands
  EmDash the implementation and it refuses: *Plugin "undefined" uses the native format*.
- **Build before link.** The descriptor points at the built bundle, so copying an unbuilt plugin
  leaves the site importing a file that does not exist. `repo:apply` runs them in that order, and
  `plugin:audit` fails on an unbuilt one.

## Limits worth knowing before you design a plugin

- **Sandboxed plugins are D1-only.** The sandbox bridge talks to a D1 binding directly, so a
  Node.js or PostgreSQL deployment cannot run them. This harness is Cloudflare + D1.
- **The capability is `content:read`, not `read:content`.** The manifest's `capabilities`,
  `allowedHosts` and `storage` are a consent contract: changing them requires a version bump.
- **An editor panel sees saved values only.** Unsaved edits need `admin.editor-draft:read` and an
  explicit interaction.
- **A `secret` setting needs `EMDASH_ENCRYPTION_KEY`** and fails closed without it
  (`mise run emdash -- secrets generate`).
- **Native plugins** — trusted React code the host imports — are not scaffolded by the CLI and are
  not auto-registered here. Add one to `config/site.astro.config.mjs` by hand.
- **Publishing needs your own publisher identity.** Replace `PLUGIN_PUBLISHER` and run
  `mise run emdash-plugin -- login` before publishing.

The authoritative reference is the vendored skill: `.github/skills/creating-plugins/`.
