---
title: "What the tests showed"
nav_order: 102
parent: "Reference"
---

# What the tests showed

Written by `charter docs` from what `node tests/run.mjs --report` prints (docs/_generated.toml): don't edit, change the code that command reads, then `mise run docs:setup`.

Each block is Node's own report of a group's last run of every step (`mise run dev:test --level all`) on a developer's machine: each step passed (✔) or failed (✖), with its time. The line above it says when it ran, at which commit and on what. A smoke or fast run is not recorded. On Linux, macOS and Windows the same tasks run in the [stages workflow](https://github.com/joeblew999/emdash-run/actions/workflows/stages.yml).

## site

```text
2026-10-09 03:24 UTC, commit 8c6521d, level all, macOS: passed in 197 s

✔ site:ports — gives the project two ports of its own (20812.496541ms)
✔ site:ports — run again: it keeps them (95.590083ms)
✔ site:new — run again: the site is left alone (94.331042ms)
✔ site:status — says where the site is, state by state, and for what is not so the task that gets it there (99.4575ms)
✔ plan — prints the states a task stands on, in order, and starts nothing (161.33925ms)
      site:start: 29.1 s — site:dev-running 27.9 s
✔ site:start — starts the dev site; EmDash's welcome dialog is closed (29132.831542ms)
✔ site:start — run again: it is already running (791.413708ms)
✔ site:start — the dev site answers; dev sign-in works (94.833833ms)
✔ site:logs — shows the dev site log (2013.6555ms)
✔ emdash — a quoted JSON argument arrives whole (1002.099375ms)
✔ emdash — whoami on the dev site (360.30075ms)
✔ emdash — --live with no LIVE_URL says so (must refuse) (139.572625ms)
✔ content:pull — with no LIVE_URL says so (must refuse) (141.831708ms)
      site:check: 15.6 s — site:built 6.6 s, site:check 15.2 s
✔ site:check — passes on a sound site (15598.822084ms)
      site:check: 6.8 s
✔ site:check — fails on a type error (6826.936ms)
✔ model:sync — records an added field in .emdash/ (1588.208417ms)
      site:preview: 3.3 s — site:built-running 3.1 s
✔ site:preview — serves the built site; dev sign-in is off there (3349.764708ms)
✔ site:seed — applies the site's own seed file, and run again makes nothing (1994.353084ms)
      site:demo: 2.4 s — site:demo 2.2 s
✔ site:demo — fills every core feature, and run again changes nothing (3457.97725ms)
      live:check: 10.6 s — site:check 8.8 s, live:check 10.2 s
✔ live:check — the deploy rehearses with no account (10607.234416ms)
      emdash:update: 45.4 s — site:built 6.6 s, emdash:update 18.6 s, site:dev-running 23.4 s, site:built-running 3.1 s
✔ emdash:update — updates, type-checks and builds (45364.787959ms)
      site:reset: 21.8 s — site:dev-running 13.4 s, site:reset 15.1 s, site:built-running 6.4 s
✔ site:reset — empties the local content (23200.143333ms)
✔ site:reset — refuses with nobody to ask (must refuse) (30.983083ms)
✔ site:delete — refuses with nobody to ask (must refuse) (30.038875ms)
✔ site:stop — stops both sites; twice is fine (1622.279291ms)
      site:delete: 7.6 s — site:delete 7.5 s
✔ site:delete — removes the site folder (8763.642416ms)
✔ site:delete — run again: nothing to delete (125.884042ms)
✔ site:start — with no site, says so and stops (must refuse) (85.9435ms)
      site:new: 12.3 s — site:new 12.2 s
✔ site:new — makes a site from nothing, from EmDash's template (12310.748334ms)
ℹ tests 29
ℹ pass 29
ℹ fail 0
ℹ skipped 0
ℹ duration_ms 197431.834209
```

## signin

```text
2026-10-09 03:25 UTC, commit 8c6521d, level all, macOS: passed in 240 s

signin:token: 35.7 s — site:built 14.3 s, site:built-running 19.7 s, signin:token 1.2 s
✔ signin:token — this machine's built site: the CLI is an administrator of it (56677.447625ms)
✔ signin:token — this machine's built site, run again: still an administrator (1451.909375ms)
✔ emdash — this machine's built site: --preview reads and writes it (1007.56175ms)
✔ signin:mcp — prints how an agent connects to the site's MCP server, and never the token (181.298042ms)
      signin:token: 7.2 s — site:built-running 6.2 s
✔ signin:token — starts the built site when it is stopped (8945.863125ms)
      signin:open: 12.6 s — signin:open 12.4 s
✔ signin:open — opens a signed-in window (token) (12585.030917ms)
      signin:passkey: 67.5 s — site:built-running 5.3 s, signin:passkey 15.4 s
✔ signin:passkey — completes the EmDash wizard on a fresh database (73233.86375ms)
      signin:open: 8.2 s — signin:open 8.0 s
✔ signin:open — opens a signed-in window (passkey) (8169.728584ms)
✔ signin:token — the saved token goes when the local database does (2148.119459ms)
      site:admin: 67.3 s — site:built-running 4.6 s, site:admin 14.3 s
✔ site:admin — a fresh built site, signed in, in one go (67848.18075ms)
ℹ tests 10
ℹ pass 10
ℹ fail 0
ℹ skipped 0
ℹ duration_ms 240260.526
```

## plugin

```text
2026-10-09 03:32 UTC, commit 8c6521d, level all, macOS: passed in 282 s

plugin:remove: 16.9 s — site:built 7.8 s, site:built-running 4.3 s, plugin:remove 3.8 s
✔ plugin:sandbox — the site can run sandboxed plugins: the runner is in its config (30418.368916ms)
✔ plugin:sandbox — run again: nothing changes (116.306708ms)
      plugin:new: 27.9 s — plugin:new 18.9 s, site:built 6.2 s, site:built-running 2.6 s
✔ plugin:new — scaffolds, tests, builds and adds a plugin — to the site's config too, by itself (27855.445625ms)
      plugin:check: 9.6 s — plugin:check 9.4 s
✔ plugin:check — the plugin passes its checks (9566.977875ms)
      plugin:new: 16.9 s — plugin:new 9.2 s, site:built 5.0 s, site:built-running 2.5 s
✔ plugin:new — run again: not scaffolded twice, still builds, the config is not touched (16857.203625ms)
      plugin:add: 12.0 s — site:built 6.0 s, site:built-running 2.5 s
✔ plugin:add — a native plugin from npm: the package is added, its two lines are printed, the config is not touched (12006.047ms)
✔ plugin:publish — asks first, and stops with nobody to answer (a real publish is never run) (must refuse) (28.299333ms)
✔ plugin — passes any command to the plugin CLI (474.595792ms)
✔ plugin:search — finds plugins in the registry (830.413416ms)
      plugin:install: 5.4 s — plugin:install 5.3 s
✔ plugin:install — this machine's built site: installs a registry plugin with no clicking (5400.067834ms)
✔ plugin:install — this machine's built site, run again: it is already installed (687.637583ms)
      plugin:install: 3.0 s
✔ plugin:install — this machine's built site: a plugin that can change things or reach outside is not installed without a yes (must refuse) (3030.388875ms)
      plugin:works: 5.8 s — plugin:works 5.7 s
✔ plugin:works — this machine's built site: the registry plugin loads and answers (5827.716625ms)
✔ plugin:install — this machine's built site: a release other than the one asked for is not installed (must refuse) (1589.413292ms)
✔ plugin:install — this machine's built site: a plugin the registry does not have: says so and fails (must refuse) (1818.423625ms)
✔ plugin:works — this machine's built site: a plugin the site does not have fails (must refuse) (163.038959ms)
✔ plugin:remove — this machine's built site: removes a registry plugin (834.114125ms)
✔ plugin:remove — this machine's built site, run again: nothing to remove (977.04725ms)
      plugin:favourites: 32.9 s — plugin:favourites 32.8 s
✔ plugin:favourites — this machine's built site: installs the favourites in one go (32923.534208ms)
      plugin:favourites: 2.4 s — plugin:favourites 2.3 s
✔ plugin:favourites — this machine's built site, run again: all already installed (2441.113958ms)
      plugin:favourites: 4.5 s — plugin:favourites 4.4 s
✔ plugin:favourites — this machine's built site: PLUGINS in the project chooses the list (4520.319125ms)
      plugin:update: 2.6 s
✔ plugin:update — this machine's built site: a plugin that is not installed: says so and fails (must refuse) (2639.763208ms)
      plugin:install: 4.6 s — plugin:install 4.5 s
✔ plugin:install — this machine's built site: an older release, asked for by version, is the one installed (4617.424416ms)
✔ plugin:update — this machine's built site: no release named: says which the site has and the registry's newest, and fails (must refuse) (690.234125ms)
      plugin:update: 3.3 s — plugin:update 3.1 s
✔ plugin:update — this machine's built site: to the release named: prints what was granted and what each release declares (3290.652792ms)
✔ plugin:update — this machine's built site, run again: nothing to update (786.7105ms)
      plugin:update: 2.6 s
✔ plugin:update — this machine's built site: an older release is refused (must refuse) (2569.930791ms)
      plugin:works: 24.7 s — plugin:works 24.5 s
✔ plugin:works — this machine's built site, no name: every plugin in the site loads and answers — the favourites among them (24677.174542ms)
      plugin:remove: 10.5 s — plugin:remove 10.4 s
✔ plugin:remove — this machine's built site: removes several at once (10541.827875ms)
      plugin:install: 7.1 s — plugin:install 7.0 s
      plugin:works: 10.7 s — plugin:works 10.5 s
✔ plugin:works — --fresh: checks, builds and restarts the site first, then every check passes (18493.965458ms)
✔ plugin:works — the plugin plugin:new made: its route answers from the sandbox (463.7845ms)
      plugin:demo: 44.7 s — plugin:demo 44.5 s
✔ plugin:demo — each plugin does its real thing, and run again changes nothing (45067.808209ms)
ℹ tests 32
ℹ pass 32
ℹ fail 0
ℹ skipped 0
ℹ duration_ms 282431.6505
```

## live

```text
2026-10-09 03:17 UTC, commit 8c6521d, level all, macOS: passed in 494 s

site:new: 21.8 s — site:new 21.5 s
      site:start: 37.5 s — site:dev-running 36.6 s
      site:stop: 2.1 s — site:stop 1.9 s
✔ site:new — makes the site that will be deployed (61547.042ms)
✔ signin:access — Cloudflare Access is in front of the admin (1731.923875ms)
✔ signin:access — uploaded media stays public; the team's domain is printed before any deploy (68.09825ms)
      site:start: 14.1 s — site:dev-running 13.5 s
✔ emdash — a site set to Cloudflare Access: the dev site starts and the CLI works on it (16194.895958ms)
✔ plugin:sandbox — the site that will be deployed can run sandboxed plugins (205.757875ms)
      live:ship: 35.8 s — site:typescript 2.5 s, site:built 6.7 s, site:check 13.6 s, live:check 17.1 s, live:ship 35.6 s
✔ live:ship — deploys; the site answers with the change (35879.905167ms)
✔ signin:access — run again: changes nothing (1476.945375ms)
      signin:token: 2.2 s — signin:token 1.8 s
✔ signin:token — the deployed site: the CLI is an administrator of it (2781.144375ms)
✔ signin:token — the deployed site, run again: still an administrator (2520.952916ms)
      emdash: 6.3 s — emdash 6.2 s
✔ emdash — the deployed site: --live reads and writes it (6994.457167ms)
      plugin:remove: 7.1 s — plugin:remove 6.8 s
✔ plugin:install — the deployed site: what a run stopped half way left installed is taken out first (7084.827042ms)
      plugin:install: 11.0 s — plugin:install 10.7 s
✔ plugin:install — the deployed site: installs a registry plugin with no clicking (11009.589542ms)
✔ plugin:install — the deployed site, run again: it is already installed (1882.064ms)
      plugin:install: 3.9 s
✔ plugin:install — the deployed site: a plugin that can change things or reach outside is not installed without a yes (must refuse) (3892.362583ms)
      plugin:works: 14.2 s — plugin:works 14.0 s
✔ plugin:works — the deployed site: the registry plugin loads and answers (14240.578375ms)
      plugin:install: 2.6 s
✔ plugin:install — the deployed site: a release other than the one asked for is not installed (must refuse) (2615.352916ms)
      plugin:install: 2.3 s
✔ plugin:install — the deployed site: a plugin the registry does not have: says so and fails (must refuse) (2337.29125ms)
✔ plugin:works — the deployed site: a plugin the site does not have fails (must refuse) (1459.0315ms)
      plugin:remove: 3.8 s — plugin:remove 3.5 s
✔ plugin:remove — the deployed site: removes a registry plugin (3842.6435ms)
✔ plugin:remove — the deployed site, run again: nothing to remove (1613.052833ms)
      plugin:favourites: 41.8 s — plugin:favourites 41.5 s
✔ plugin:favourites — the deployed site: installs the favourites in one go (41787.435166ms)
      plugin:favourites: 6.0 s — live:answers 1.1 s, plugin:favourites 4.7 s
✔ plugin:favourites — the deployed site, run again: all already installed (6042.278625ms)
      plugin:favourites: 9.7 s — live:answers 3.1 s, plugin:favourites 6.4 s
✔ plugin:favourites — the deployed site: PLUGINS in the project chooses the list (9715.054ms)
✔ plugin:update — the deployed site: a plugin that is not installed: says so and fails (must refuse) (1736.985583ms)
      plugin:install: 11.1 s — plugin:install 10.6 s
✔ plugin:install — the deployed site: an older release, asked for by version, is the one installed (11103.285833ms)
✔ plugin:update — the deployed site: no release named: says which the site has and the registry's newest, and fails (must refuse) (1755.413792ms)
      plugin:update: 8.8 s — plugin:update 8.3 s
✔ plugin:update — the deployed site: to the release named: prints what was granted and what each release declares (8843.793209ms)
✔ plugin:update — the deployed site, run again: nothing to update (1881.572291ms)
      plugin:update: 3.9 s
✔ plugin:update — the deployed site: an older release is refused (must refuse) (3903.668625ms)
      plugin:remove: 19.3 s — plugin:remove 18.8 s
✔ plugin:remove — the deployed site: removes several at once (19309.035709ms)
✔ plugin:works — --live: the deployed site is checked from outside; it says what it skips, and builds and restarts nothing (1506.632416ms)
✔ model:sync — --live records the deployed model (1233.647209ms)
      content:pull: 43.9 s — content:pull 43.7 s
✔ content:pull — downloads the deployed site as a package (43874.611584ms)
      live:backup: 48.5 s — live:backup 48.4 s
✔ live:backup — the database bookmark and a package (48521.125208ms)
      live:preview: 33.9 s — site:check 4.9 s, live:check 5.9 s, live:preview 33.7 s
✔ live:preview — a preview: an address of its own, the live site still answers (35531.307959ms)
      live:preview: 16.1 s — site:check 4.2 s, live:check 5.1 s, live:preview 16.0 s
✔ live:preview — run again: the same preview, nothing new made (16131.209709ms)
      signin:token: 5.4 s — live:answers 1.9 s, signin:token 3.2 s
✔ signin:token — LIVE_PREVIEW: the CLI is an administrator of the preview, in the preview's own database (7338.627083ms)
      live:preview: 2.3 s — live:preview 2.1 s
      live:preview: 2.3 s — live:preview 2.1 s
✔ live:preview — --delete removes it; again: nothing to delete (4575.409791ms)
✔ live:logs — shows a request to the deployed site (22016.94625ms)
      signin:open: 9.0 s — signin:open 8.8 s
✔ signin:open — --live opens a signed-in window (9007.270209ms)
✔ signin:access — a visitor reaches uploaded media and plugins' public routes without signing in (290.458541ms)
      live:undo: 9.1 s — live:undo 8.7 s
✔ live:undo — puts the previous version back: the change is gone (9219.2275ms)
      site:delete: 9.3 s — site:stop 1.3 s, site:delete 9.1 s
✔ site:delete — removes the local site folder (9289.963958ms)
ℹ tests 43
ℹ pass 43
ℹ fail 0
ℹ skipped 0
ℹ duration_ms 494294.845416
```
