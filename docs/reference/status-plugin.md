---
title: "The plugin tests: a plugin of your own, and plugins from EmDash's registry"
nav_order: 104
parent: "Reference"
---

# The plugin tests: a plugin of your own, and plugins from EmDash's registry

Written by `charter docs` from what `node tests/record.mjs --page status-plugin` prints (docs/_generated.toml): don't edit, change the code that command reads, then `mise run docs:setup`.

Run them: `mise run test:plugin`. The steps: `tests/plugin/steps.sh`. Every group: [What works](status.md).

## On a Cloudflare site

**29 of 29 steps pass, in 4 min 26 s.** State: proven. Run 2026-10-08 04:44 UTC at commit `ada7563+uncommitted`, on macOS.

| | Task | Step | Seconds |
|---|---|---|---|
| pass | `plugin:sandbox` | the site can run sandboxed plugins: the runner is in its config | 0 |
| pass | `plugin:sandbox` | run again: nothing changes | 0 |
| pass | `plugin:new` | scaffolds, tests, builds and adds a plugin — to the site's config too, by itself | 22 |
| pass | `plugin:new` | run again: not scaffolded twice, still builds, the config is not touched | 14 |
| pass | `plugin:check` | the plugin passes its checks | 9 |
| pass | `plugin:add` | a native plugin from npm: the package is added, its two lines are printed, the config is not touched | 8 |
| pass | `plugin:publish` | asks first, and stops with nobody to answer (a real publish is never run) (it must refuse) | 0 |
| pass | `plugin` | passes any command to the plugin CLI | 0 |
| pass | `plugin:search` | finds plugins in the registry | 2 |
| pass | `plugin:install` | installs a registry plugin with no clicking, from a stopped site | 41 |
| pass | `plugin:install` | run again: it is already installed | 0 |
| pass | `plugin:install` | a plugin that can change things or reach outside is not installed without a yes (it must refuse) | 7 |
| pass | `plugin:install` | a release other than the one asked for is not installed (it must refuse) | 1 |
| pass | `plugin:install` | a plugin the registry does not have: says so and fails (it must refuse) | 2 |
| pass | `plugin:works` | the registry plugin: every check passes | 59 |
| pass | `plugin:works` | the plugin plugin:new made: its route answers from the sandbox | 1 |
| pass | `plugin:works` | a plugin the site does not have fails (it must refuse) | 0 |
| pass | `plugin:remove` | removes a registry plugin | 1 |
| pass | `plugin:remove` | run again: nothing to remove | 1 |
| pass | `plugin:favourites` | installs the favourites in one go | 27 |
| pass | `plugin:favourites` | run again: all already installed | 3 |
| pass | `plugin:favourites` | PLUGINS in the project chooses the list | 9 |
| pass | `plugin:update` | a plugin that is not installed: says so and fails (it must refuse) | 1 |
| pass | `plugin:install` | an older release, asked for by version, is the one installed | 5 |
| pass | `plugin:update` | no release named: says which the site has and the registry's newest, and fails (it must refuse) | 1 |
| pass | `plugin:update` | to the release named: prints what was granted and what each release declares; it asks for nothing more, so no yes is needed | 4 |
| pass | `plugin:update` | run again: nothing to update | 1 |
| pass | `plugin:update` | an older release is refused (it must refuse) | 3 |
| pass | `plugin:works` | no name: every plugin in the site loads and answers — the favourites among them | 23 |

## On a Node site

**22 of 22 steps pass.** Run 2026-10-08 01:44 UTC at commit `201a653`, on undefined.

| | Task | Step | Seconds |
|---|---|---|---|
| pass | `plugin:sandbox` | the site can run sandboxed plugins: the runner is in its config | undefined |
| pass | `plugin:sandbox` | run again: nothing changes | undefined |
| pass | `plugin:new` | scaffolds, tests, builds and adds a plugin — to the site's config too, by itself | undefined |
| pass | `plugin:new` | run again: not scaffolded twice, still builds, the config is not touched | undefined |
| pass | `plugin:check` | the plugin passes its checks | undefined |
| pass | `plugin:add` | adds a package from npm, and its lines in the site's config | undefined |
| pass | `plugin:add` | run again: the config is not touched | undefined |
| pass | `plugin:search` | finds plugins in the registry | undefined |
| pass | `plugin:install` | installs a registry plugin with no clicking, from a stopped site | undefined |
| pass | `plugin:install` | run again: it is already installed | undefined |
| pass | `plugin:install` | a plugin the registry does not have: says so and fails (it must refuse) | undefined |
| pass | `plugin:works` | the registry plugin: every check passes | undefined |
| pass | `plugin:works` | the plugin plugin:new made: its route answers from the sandbox | undefined |
| pass | `plugin:works` | a plugin the site does not have fails (it must refuse) | undefined |
| pass | `plugin:remove` | removes a registry plugin | undefined |
| pass | `plugin:remove` | run again: nothing to remove | undefined |
| pass | `plugin:favourites` | installs the favourites in one go | undefined |
| pass | `plugin:favourites` | run again: all already installed | undefined |
| pass | `plugin:favourites` | PLUGINS in the project chooses the list | undefined |
| pass | `plugin:works` | no name: every plugin in the site works — the favourites among them | undefined |
| pass | `plugin:publish` | asks first, and stops with nobody to answer (a real publish is never run) (it must refuse) | undefined |
| pass | `plugin` | passes any command to the plugin CLI | undefined |
