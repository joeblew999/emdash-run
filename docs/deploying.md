---
title: "Deploying"
nav_order: 8
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# Deploying

For a site on Cloudflare. You need to be signed in to Cloudflare (`mise x -- pnpm dlx wrangler login`).
Every task is safe to run again. In this order the first time: `signin:access`, put the lines it
prints into the site, `live:ship`, `signin:token -- --live`.

<!-- tasks:live: -->
| task | what it does |
|---|---|
| `live:ship` | Deploy to Cloudflare: check, deploy, wait for the new version to answer. A newly deployed site has no content: it prints how to bring this machine's |
| `live:backup` | Back up the deployed site: a database bookmark to restore to, and a content package in backups/. No SQL dump — Cloudflare's export refuses an EmDash database |
| `live:logs` | Follow the deployed site's log |
| `live:undo` | Roll the deployed site back to the previous version (code only) |
<!-- /tasks -->

**A newly deployed site has no content.** `live:ship` says so, with the commands: export this
machine's content (`mise run emdash -- site export --output site.emdash`), then import it with
`--live` — `--analyze` first, which prints a plan, then `--plan <digest> --confirm`.

Everything uses that wrangler login except `signin:access`: wrangler's login can read Cloudflare
Access but not change it. For that one task, make an API token in the Cloudflare dashboard
(My Profile → API Tokens) with **Access: Apps and Policies — Edit** and **Access: Service Tokens —
Edit**, and store it with [fnox](https://fnox.jdx.dev), which the task reads by itself:

```
fnox init                             if this machine has no fnox config yet
fnox set CLOUDFLARE_API_TOKEN         it asks for the value
```

Or set `CLOUDFLARE_API_TOKEN` in your environment any other way.
