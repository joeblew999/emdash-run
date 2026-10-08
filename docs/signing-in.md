---
title: "Signing in"
nav_order: 7
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# Signing in

On the dev site (`site:start`) you never need to. A built site — `site:preview` locally, or a
deployed one — has real sign-in. Pick a way:

<!-- tasks:signin: -->
| task | what it does |
|---|---|
| `signin:token` | Sign a machine in with no browser — the everyday way, for the CLI, agents and CI: an admin and an API token written to the site's database. This machine's built site; add \-\- \-\-live for the deployed one (Cloudflare sites only) |
| `signin:open` | Open a browser window already signed in to the admin, for you to look around. Add \-\- \-\-live for the deployed site. Needs Playwright + Chrome |
| `signin:passkey` | Sign a machine in through EmDash's real setup wizard, with a passkey — for testing the wizard itself. Add \-\- \-\-live for the deployed site. Needs Playwright + Chrome |
| `signin:access` | Sign people in to the deployed site: Cloudflare Access in front of its admin, by a code emailed to ADMIN_EMAIL. Uploaded media stays public. Prints three lines for astro.config.mjs and wrangler.jsonc. Needs a Cloudflare API token with Access edit rights, in CLOUDFLARE_API_TOKEN or in fnox |
<!-- /tasks -->

These are for development sites. What they save is in `~/.config/emdash-run/` on your machine,
never in the repo.
