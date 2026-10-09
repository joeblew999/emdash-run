---
title: "What the tests showed"
nav_order: 102
parent: "Reference"
---

# What the tests showed

Written by `charter docs` from what `node tests/run.mjs --report` prints (docs/_generated.toml): don't edit, change the code that command reads, then `mise run docs:setup`.

Each block is Node's own report of a group's last run on a developer's machine: every step, passed (✔) or failed (✖), with its time. The line above it says when it ran, at which commit, at which level and on what. On Linux, macOS and Windows the same tasks run in the [stages workflow](https://github.com/joeblew999/emdash-run/actions/workflows/stages.yml).

## site

```text
2026-10-09 02:38 UTC, commit d1c980c, level fast, macOS: passed in 99 s

✔ site:ports — gives the project two ports of its own (189.198041ms)
✔ site:ports — run again: it keeps them (180.435833ms)
✔ site:new — run again: the site is left alone (179.834208ms)
✔ site:status — says where the site is, state by state, and for what is not so the task that gets it there (204.749708ms)
✔ plan — prints the states a task stands on, in order, and starts nothing (280.488208ms)
      site:start: 50.5 s — site:dev-running 47.1 s, site:start 2.9 s
✔ site:start — starts the dev site; EmDash's welcome dialog is closed (50534.859583ms)
      site:start: 3.4 s
✔ site:start — run again: it is already running (3392.357792ms)
✔ site:start — the dev site answers; dev sign-in works (327.390041ms)
✔ site:logs — shows the dev site log (2031.642417ms)
      emdash: 2.4 s — emdash 1.6 s
✔ emdash — a quoted JSON argument arrives whole (3766.420792ms)
✔ emdash — whoami on the dev site (1152.207375ms)
✔ emdash — --live with no LIVE_URL says so (must refuse) (525.094125ms)
✔ content:pull — with no LIVE_URL says so (must refuse) (691.542708ms)
﹣ site:check — passes on a sound site (0.213083ms) # SKIP
﹣ site:check — fails on a type error (0.040333ms) # SKIP
      model:sync: 2.5 s — model:sync 1.6 s
✔ model:sync — records an added field in .emdash/ (3988.724791ms)
✔ site:preview — serves the built site; dev sign-in is off there (872.373042ms)
﹣ site:seed — applies the site's own seed file, and run again makes nothing (0.4555ms) # SKIP
﹣ site:demo — fills every core feature, and run again changes nothing (0.095541ms) # SKIP
﹣ live:check — the deploy rehearses with no account (0.05875ms) # SKIP
﹣ emdash:update — updates, type-checks and builds (0.065333ms) # SKIP
﹣ site:reset — empties the local content (0.069917ms) # SKIP
﹣ site:reset — refuses with nobody to ask (must refuse) (0.071167ms) # SKIP
﹣ site:delete — refuses with nobody to ask (must refuse) (0.059708ms) # SKIP
﹣ site:stop — stops both sites; twice is fine (0.047833ms) # SKIP
﹣ site:delete — removes the site folder (0.047167ms) # SKIP
﹣ site:delete — run again: nothing to delete (0.06725ms) # SKIP
﹣ site:start — with no site, says so and stops (must refuse) (0.051333ms) # SKIP
﹣ site:new — makes a site from nothing, from EmDash's template (0.0475ms) # SKIP
ℹ tests 29
ℹ pass 15
ℹ fail 0
ℹ skipped 14
ℹ duration_ms 98461.10225
```

## signin

```text
2026-10-09 02:38 UTC, commit d1c980c, level fast, macOS: passed in 108 s

✔ signin:token — this machine's built site: the CLI is an administrator of it (2710.858458ms)
✔ signin:token — this machine's built site, run again: still an administrator (2079.121625ms)
✔ emdash — this machine's built site: --preview reads and writes it (2408.560042ms)
✔ signin:mcp — prints how an agent connects to the site's MCP server, and never the token (782.543125ms)
﹣ signin:token — starts the built site when it is stopped (2.058125ms) # SKIP
﹣ signin:open — opens a signed-in window (token) (0.143708ms) # SKIP
﹣ signin:passkey — completes the EmDash wizard on a fresh database (0.381ms) # SKIP
﹣ signin:open — opens a signed-in window (passkey) (0.249375ms) # SKIP
﹣ signin:token — the saved token goes when the local database does (0.237ms) # SKIP
﹣ site:admin — a fresh built site, signed in, in one go (0.555708ms) # SKIP
ℹ tests 10
ℹ pass 4
ℹ fail 0
ℹ skipped 6
ℹ duration_ms 108256.801417
```

## plugin

```text
2026-10-09 02:37 UTC, commit d1c980c, level fast, macOS: passed in 28 s

plugin:remove: 8.1 s — plugin:remove 7.5 s
✔ plugin:sandbox — the site can run sandboxed plugins: the runner is in its config (8356.301625ms)
✔ plugin:sandbox — run again: nothing changes (178.637708ms)
﹣ plugin:new — scaffolds, tests, builds and adds a plugin — to the site's config too, by itself (0.130625ms) # SKIP
﹣ plugin:check — the plugin passes its checks (0.064541ms) # SKIP
﹣ plugin:new — run again: not scaffolded twice, still builds, the config is not touched (0.075042ms) # SKIP
﹣ plugin:add — a native plugin from npm: the package is added, its two lines are printed, the config is not touched (0.057708ms) # SKIP
﹣ plugin:publish — asks first, and stops with nobody to answer (a real publish is never run) (must refuse) (0.058792ms) # SKIP
﹣ plugin — passes any command to the plugin CLI (0.050041ms) # SKIP
✔ plugin:search — finds plugins in the registry (1020.006ms)
      plugin:install: 6.3 s — plugin:install 6.0 s
✔ plugin:install — this machine's built site: installs a registry plugin with no clicking (6254.278542ms)
✔ plugin:install — this machine's built site, run again: it is already installed (732.371458ms)
      plugin:install: 3.4 s
✔ plugin:install — this machine's built site: a plugin that can change things or reach outside is not installed without a yes (must refuse) (3428.65075ms)
      plugin:works: 6.4 s — plugin:works 6.2 s
✔ plugin:works — this machine's built site: the registry plugin loads and answers (6438.363166ms)
﹣ plugin:install — this machine's built site: a release other than the one asked for is not installed (must refuse) (0.1635ms) # SKIP
﹣ plugin:install — this machine's built site: a plugin the registry does not have: says so and fails (must refuse) (0.044708ms) # SKIP
﹣ plugin:works — this machine's built site: a plugin the site does not have fails (must refuse) (0.024083ms) # SKIP
✔ plugin:remove — this machine's built site: removes a registry plugin (762.580083ms)
✔ plugin:remove — this machine's built site, run again: nothing to remove (819.14175ms)
﹣ plugin:favourites — this machine's built site: installs the favourites in one go (0.101583ms) # SKIP
﹣ plugin:favourites — this machine's built site, run again: all already installed (0.025791ms) # SKIP
﹣ plugin:favourites — this machine's built site: PLUGINS in the project chooses the list (0.021292ms) # SKIP
﹣ plugin:update — this machine's built site: a plugin that is not installed: says so and fails (must refuse) (0.018542ms) # SKIP
﹣ plugin:install — this machine's built site: an older release, asked for by version, is the one installed (0.016666ms) # SKIP
﹣ plugin:update — this machine's built site: no release named: says which the site has and the registry's newest, and fails (must refuse) (0.015458ms) # SKIP
﹣ plugin:update — this machine's built site: to the release named: prints what was granted and what each release declares (0.015042ms) # SKIP
﹣ plugin:update — this machine's built site, run again: nothing to update (0.014292ms) # SKIP
﹣ plugin:update — this machine's built site: an older release is refused (must refuse) (0.014875ms) # SKIP
﹣ plugin:remove — this machine's built site: removes the plugin that was updated (0.0145ms) # SKIP
﹣ plugin:works — this machine's built site, no name: every plugin in the site loads and answers — the favourites among them (0.015125ms) # SKIP
﹣ plugin:remove — this machine's built site: removes several at once (0.014625ms) # SKIP
﹣ plugin:works — --fresh: checks, builds and restarts the site first, then every check passes (0.013666ms) # SKIP
﹣ plugin:works — the plugin plugin:new made: its route answers from the sandbox (0.014166ms) # SKIP
﹣ plugin:demo — each plugin does its real thing, and run again changes nothing (0.013708ms) # SKIP
ℹ tests 33
ℹ pass 9
ℹ fail 0
ℹ skipped 24
ℹ duration_ms 28134.168041
```
