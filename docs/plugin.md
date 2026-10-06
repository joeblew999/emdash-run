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

| step | tool |
|---|---|
| scaffold | `emdash-plugin init` |
| fit to this site | the harness (`fit` in `nu/plugin.nu`) |
| install | `pnpm install` |
| validate the manifest | `emdash-plugin validate` |
| typecheck | `tsc --noEmit` |
| test, through EmDash's sandbox | `vitest` + `@emdash-cms/plugin-test` |
| build | `emdash-plugin build` |
| register with the site, copy it in, restart | the harness (`mise run dev`) |
| prove the site runs it | the harness (`mise run plugin:probe`) |
| bundle for release | `emdash-plugin bundle` (`mise run plugin:release`) |

Everything the official CLI does, it does. The steps marked "the harness" are the ones the CLI
leaves to you, and they are where the time used to go.

## What the scaffold needs fixing

`emdash-plugin init` writes a plugin for a site that is not this one:

- **It will not run without a terminal.** It exits with "Non-interactive setup requires:
  --publisher, --author-name, --security-email or --security-url". The harness passes them from
  `PLUGIN_PUBLISHER`, `PLUGIN_AUTHOR` and `PLUGIN_SECURITY_URL` in PROJECT SETTINGS.
- **It asks for EmDash 0.x.** `emdash: ">=0.12.0 <1.0.0"` installs 0.x while the site runs 1.x, so
  the scaffold's green test is evidence about a different CMS. Pinned to `EMDASH_VERSION`;
  `check` fails on any drift afterwards.
- **Its `@emdash-cms/plugin-test` range predates EmDash 1.x.** Set to the current release.
- **It pins `packageManager`.** mise provides pnpm, so the pin is dropped.
- **It creates three symlinks** (`.agents/skills`, `.claude/skills`, `.claude/CLAUDE.md`). This
  repo allows none — `check` fails on one — and the skills are vendored at the repo root.

## Enabling plugins in your site config

**You normally do nothing.** When the harness creates `config/` from a template it makes these
edits for you, and `plugin:new` makes them if they are missing and your config still looks like a
template's. They are shown here for a config you have reshaped by hand:

```js
// config/site.astro.config.mjs
import { d1, r2, sandbox } from "@emdash-cms/cloudflare";            // add `sandbox`
import { sandboxed as localSandboxed } from "./local-plugins.mjs";   // add this line

emdash({
	// …your database and storage…
	sandboxed: [...localSandboxed],                                   // add
	sandboxRunner: sandbox(),                                         // add
})
```

```jsonc
// config/site.wrangler.jsonc — uncomment, or add:
"worker_loaders": [{ "binding": "LOADER" }],
```

Then `mise run dev`.

## How the site finds a local plugin

`mise run dev` generates `.src/site/local-plugins.mjs` from `plugins/`, and the site's
`astro.config.mjs` spreads it into `sandboxed: []`. A directory is registered when it has an
`emdash-plugin.jsonc`. Nothing is edited by hand, so adding or removing a plugin cannot leave the
config pointing at something that is not there.

Two details that cost a session each to learn:

- **The site imports the package root, not `/sandbox`.** `emdash-plugin build` generates a
  descriptor at the root that names `<pkg>/sandbox` as its entrypoint. Importing `/sandbox` hands
  EmDash the implementation and it refuses: *Plugin "undefined" uses the native format*.
- **Build before link.** The descriptor points at the built bundle, so copying an unbuilt plugin
  leaves the site importing a file that does not exist. `dev` runs them in that order, and `check`
  fails on an unbuilt one.

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
