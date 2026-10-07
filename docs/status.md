# What works — the last run of `mise run testfull`

Written by `tests/replay.sh`. Do not edit: run it again.

| | |
|---|---|
| when | 2026-10-07 08:58 UTC |
| tier | full (both templates, every task that needs no deployment) |
| commit | `b7c8251` **plus uncommitted changes** |
| machine | Darwin arm64, 2026.10.3 |
| took | 290s |
| result | 53 passed, **0 failed** |

Not covered by this run: the `live:` tasks and anything with `--live` (they need a deployed site), `plugin:publish`, Windows and Linux.

| template | | step | on failure, the last output |
|---|---|---|---|
| cloudflare:blog | PASS | site:start with no site refuses |  |
| cloudflare:blog | PASS | site:new |  |
| cloudflare:blog | PASS | site:start |  |
| cloudflare:blog | PASS | dev site answers; dev sign-in |  |
| cloudflare:blog | PASS | emdash: a quoted JSON argument |  |
| cloudflare:blog | PASS | emdash whoami on the dev site |  |
| cloudflare:blog | PASS | site:check passes |  |
| cloudflare:blog | PASS | site:check fails on a type error |  |
| cloudflare:blog | PASS | model:sync records an added field |  |
| cloudflare:blog | PASS | emdash --live refuses with no LIVE_URL |  |
| cloudflare:blog | PASS | signin:token (starts the built site) |  |
| cloudflare:blog | PASS | emdash --preview writes |  |
| cloudflare:blog | PASS | live:check (hidden, by name) |  |
| cloudflare:blog | PASS | content:pull refuses with no LIVE_URL |  |
| cloudflare:blog | PASS | content:pull (the built site as LIVE_URL) |  |
| cloudflare:blog | PASS | signin:open says what it shows |  |
| cloudflare:blog | PASS | plugin:new |  |
| cloudflare:blog | PASS | plugin:check |  |
| cloudflare:blog | PASS | plugin:add |  |
| cloudflare:blog | PASS | plugin -- search |  |
| cloudflare:blog | PASS | emdash:update |  |
| cloudflare:blog | PASS | site:reset empties the content |  |
| cloudflare:blog | PASS | site:reset refuses with nobody to ask |  |
| cloudflare:blog | PASS | signin:passkey on a fresh database |  |
| cloudflare:blog | PASS | site:delete refuses with nobody to ask |  |
| cloudflare:blog | PASS | site:stop, twice |  |
| cloudflare:blog | PASS | site:delete |  |
| node:starter | PASS | site:start with no site refuses |  |
| node:starter | PASS | site:new |  |
| node:starter | PASS | site:start |  |
| node:starter | PASS | dev site answers; dev sign-in |  |
| node:starter | PASS | emdash: a quoted JSON argument |  |
| node:starter | PASS | emdash whoami on the dev site |  |
| node:starter | PASS | site:check passes |  |
| node:starter | PASS | site:check fails on a type error |  |
| node:starter | PASS | model:sync records an added field |  |
| node:starter | PASS | emdash --live refuses with no LIVE_URL |  |
| node:starter | PASS | signin:token (starts the built site) |  |
| node:starter | PASS | emdash --preview writes |  |
| node:starter | PASS | content:pull refuses with no LIVE_URL |  |
| node:starter | PASS | content:pull (the built site as LIVE_URL) |  |
| node:starter | PASS | signin:open says what it shows |  |
| node:starter | PASS | plugin:new |  |
| node:starter | PASS | plugin:check |  |
| node:starter | PASS | plugin:add |  |
| node:starter | PASS | plugin -- search |  |
| node:starter | PASS | emdash:update |  |
| node:starter | PASS | site:reset empties the content |  |
| node:starter | PASS | site:reset refuses with nobody to ask |  |
| node:starter | PASS | signin:passkey on a fresh database |  |
| node:starter | PASS | site:delete refuses with nobody to ask |  |
| node:starter | PASS | site:stop, twice |  |
| node:starter | PASS | site:delete |  |
