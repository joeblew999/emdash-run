---
title: "Deploying"
nav_order: 8
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# Deploying

For a site on Cloudflare. You need to be signed in to Cloudflare (`mise x -- pnpm dlx wrangler login`).
Every task here is safe to run again:

```
mise run signin:access                Cloudflare Access in front of the admin
mise run live:ship                    check, deploy, wait for it to answer
mise run signin:token -- --live       the CLI is signed in to the deployed site
mise run live:logs
mise run live:undo                    back to the previous version
mise run live:backup
```

Everything uses that wrangler login except `signin:access`: wrangler's login can read Cloudflare
Access but not change it. For that one task, make an API token in the Cloudflare dashboard
(My Profile → API Tokens) with **Access: Apps and Policies — Edit** and **Access: Service Tokens —
Edit**, and store it with [fnox](https://fnox.jdx.dev), which the task reads by itself:

```
fnox init                             if this machine has no fnox config yet
fnox set CLOUDFLARE_API_TOKEN         it asks for the value
```

Or set `CLOUDFLARE_API_TOKEN` in your environment any other way.
