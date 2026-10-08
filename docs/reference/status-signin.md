---
title: "The signin tests: the CLI and a browser window as an administrator of the built site"
nav_order: 103
parent: "Reference"
---

# The signin tests: the CLI and a browser window as an administrator of the built site

Written by `charter docs` from what `node tests/record.mjs --page status-signin` prints (docs/_generated.toml): don't edit, change the code that command reads, then `mise run docs:setup`.

Run them: `mise run test:signin`. The steps: `tests/signin/steps.sh`. Every group: [What works](status.md).

## On a Cloudflare site

**9 of 9 steps pass, in 1 min 43 s.** State: proven. Run 2026-10-08 04:39 UTC at commit `ada7563+uncommitted`, on macOS.

| | Task | Step | Seconds |
|---|---|---|---|
| pass | `signin:token` | builds and starts the site; the CLI is an administrator of it | 25 |
| pass | `signin:token` | run again: still an administrator | 1 |
| pass | `emdash` | \-\-preview writes to the built site | 1 |
| pass | `signin:token` | starts the built site when it is stopped | 10 |
| pass | `signin:open` | opens a signed-in window (token) | 6 |
| pass | `signin:passkey` | completes the EmDash wizard on a fresh database | 19 |
| pass | `signin:open` | opens a signed-in window (passkey) | 5 |
| pass | `signin:token` | the saved token goes when the local database does | 4 |
| pass | `site:admin` | a fresh built site, signed in, in one go | 17 |

## On a Node site

**9 of 9 steps pass.** Run 2026-10-08 01:44 UTC at commit `201a653`, on undefined.

| | Task | Step | Seconds |
|---|---|---|---|
| pass | `signin:token` | the CLI is an administrator of the built site | undefined |
| pass | `signin:token` | run again: still an administrator | undefined |
| pass | `emdash` | \-\-preview writes to the built site | undefined |
| pass | `signin:token` | starts the built site when it is stopped | undefined |
| pass | `signin:open` | opens a signed-in window (token) | undefined |
| pass | `signin:passkey` | completes the EmDash wizard on a fresh database | undefined |
| pass | `signin:open` | opens a signed-in window (passkey) | undefined |
| pass | `signin:token` | the saved token goes when the local database does | undefined |
| pass | `site:admin` | a fresh built site, signed in, in one go | undefined |
