---
title: Sign in
nav_order: 3
parent: Guides
---

# Sign in: a machine or a person, with or without a browser

On the dev site (`site:start`) you never need to. A built site, local (`site:preview`) or deployed, has real sign-in. Pick a way:

| Task | Signs in | Needs a browser | Use it for |
|---|---|---|---|
| `signin:token` | A machine | No | The CLI, agents, CI: the everyday one |
| `signin:access` | People | No | A deployed site: Cloudflare Access, a code by email |
| `signin:open` | You | Playwright and Chrome | A browser window already signed in |
| `signin:passkey` | A machine | Playwright and Chrome | Testing EmDash's own setup wizard |

```sh
mise run signin:token                 # this machine's built site
mise run signin:token -- --live       # the deployed site (Cloudflare sites only)
mise run emdash -- whoami --live      # who the CLI is, there
```

`signin:token` writes an administrator and an API token into the site's database. EmDash accepts an API token before any other sign-in, also behind Cloudflare Access. The administrator is `ADMIN_EMAIL` if you set it.

These are for development sites: whoever can write to the database can sign in. What they save is in `~/.config/emdash-run/` on your machine, never in the repo.

Putting Cloudflare Access in front of a deployed site: [Deploy](deploy.md).
