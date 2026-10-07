# What works — the last run of `mise run test`

Written by `tests/replay.sh`. Do not edit: run it again.

| | |
|---|---|
| when | 2026-10-07 09:07 UTC |
| tier | quick (one template, the everyday path) |
| commit | `13dbb00` |
| machine | Darwin arm64, 2026.10.3 |
| took | 76s |
| result | 14 passed, **0 failed** |

Not covered by this run: the `live:` tasks and anything with `--live` (they need a deployed site), `plugin:publish`, Windows and Linux, and everything only in the full tier.

| template | | step | on failure, the last output |
|---|---|---|---|
| cloudflare:starter | PASS | site:start with no site refuses |  |
| cloudflare:starter | PASS | site:new |  |
| cloudflare:starter | PASS | site:start |  |
| cloudflare:starter | PASS | dev site answers; dev sign-in |  |
| cloudflare:starter | PASS | emdash: a quoted JSON argument |  |
| cloudflare:starter | PASS | emdash whoami on the dev site |  |
| cloudflare:starter | PASS | site:check passes |  |
| cloudflare:starter | PASS | site:check fails on a type error |  |
| cloudflare:starter | PASS | model:sync records an added field |  |
| cloudflare:starter | PASS | emdash --live refuses with no LIVE_URL |  |
| cloudflare:starter | PASS | signin:token (starts the built site) |  |
| cloudflare:starter | PASS | emdash --preview writes |  |
| cloudflare:starter | PASS | site:stop, twice |  |
| cloudflare:starter | PASS | site:delete |  |
