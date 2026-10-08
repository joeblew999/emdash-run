---
title: Several sites at once
nav_order: 7
parent: Guides
---

# Several sites at once: two projects, or several agents, on one machine

Two projects would both want ports 4321 and 4322. In each one:

```sh
mise run site:ports    # two free ports of its own, written to mise.local.toml
```

Run it again and it keeps them. Git ignores `mise.local.toml`.

Everything else is already separate:

| Shared thing | Why two projects do not meet |
|---|---|
| What the sign-in tasks save (`~/.config/emdash-run/`) | Named by the site's folder; a deployed site by its address |
| Starting a site | One at a time, machine-wide: two Cloudflare sites starting in the same moment would take the same debugger port |
| The packages | pnpm's store is safe for installs at the same time |

One thing is not separate: a Node site's plugin sandbox takes fixed ports from 18788, so only one Node site on a machine can run sandboxed plugins at a time ([Upstream issues](../upstream.md)). Cloudflare sites are not affected.

## Agents working side by side on one repo

- A git worktree each, and `mise run site:ports` in each.
- Sign in with `signin:token`, not `emdash login` ([Upstream issues](../upstream.md)).
- The rest is in [Rules](../rules.md#working-beside-other-agents-here).


