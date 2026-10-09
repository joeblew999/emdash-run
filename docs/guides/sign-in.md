---
title: Sign in
nav_order: 3
parent: Guides
---

# Sign in: a machine, an agent or a person, with or without a browser

On the dev site (`site:start`) you never need to. A built site, local (`site:preview`) or deployed, has real sign-in. Pick a way:

| Task | Signs in | Needs a browser | Use it for |
|---|---|---|---|
| `signin:token` | A machine | No | The CLI, agents, CI: the everyday one |
| `signin:access` | People | No | A deployed site: Cloudflare Access, a code by email |
| `signin:open` | You, with what `signin:token` or `signin:passkey` saved | Playwright and Chrome | A browser window already signed in |
| `signin:passkey` | A machine | Playwright and Chrome | Testing EmDash's own setup wizard |

```sh
mise run signin:token                 # this machine's built site
mise run signin:token -- --live       # the deployed site (Cloudflare sites only)
mise run emdash -- whoami --live      # who the CLI is, there
```

`signin:token` writes an administrator and an API token into the site's database. EmDash accepts an API token before any other sign-in, also behind Cloudflare Access. The administrator is `ADMIN_EMAIL` if you set it.

Being signed in is a state the other tasks stand on: a task that needs it checks the token this machine saved, and signs in only when the site no longer accepts it. Asked for by name, `signin:token` makes a new token.

These are for development sites: whoever can write to the database can sign in. What they save is in `~/.config/emdash-run/` on your machine, never in the repo. `signin:token -- --live` and `signin:passkey` also write EmDash's own sign-in store, `~/.config/emdash/auth.json`.

Putting Cloudflare Access in front of a deployed site: [Deploy](deploy.md).

## An agent: the site's own MCP server

EmDash has an MCP server, at `/_emdash/api/mcp` of the site, and it takes the token `signin:token` saves.

```sh
mise run signin:mcp                # this machine's built site
mise run signin:mcp -- --live      # the deployed site
```

It signs this machine in if needed, then prints three things: the server's address, the block to put in the agent's `.mcp.json`, and the line for the shell that starts the agent. The block names the token as `EMDASH_MCP_TOKEN`, which that line reads from the saved file. The token itself is never printed.

Limits:

- The task prints how to connect, and that is what its test step checks. No test step connects an agent to the server, and none runs it with `--live`.
- The line it prints for the shell is for a POSIX shell.
- The token is an administrator's: an agent given it can do whatever the admin can.
