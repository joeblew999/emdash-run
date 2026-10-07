---
title: "Signing in"
nav_order: 7
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# Signing in

On the dev site (`site:start`) you never need to. A built site — `site:preview` locally, or a
deployed one — has real sign-in. Pick a way:

| task | signs in | browser? | use it for |
|---|---|---|---|
| `signin:token` | a machine | no | the CLI, agents, CI — the everyday one |
| `signin:access` | people | no | a deployed site: Cloudflare Access, sign in by emailed code |
| `signin:passkey` | a machine | Playwright + Chrome | testing EmDash's own setup wizard |
| `signin:open` | you | Playwright + Chrome | a browser window already signed in |

```
mise run signin:token                 this machine's built site
mise run signin:token -- --live       the deployed site
```

These are for development sites. What they save is in `~/.config/emdash-run/` on your machine,
never in the repo.
