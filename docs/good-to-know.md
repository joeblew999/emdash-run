---
title: "Good to know"
nav_order: 12
---

<!-- Written by tests/status.mjs from a section of the repo's README.md: edit that, not this. -->

# Good to know

- **Every task is safe to run again.** `site:new` leaves a site that is there alone, `site:start`
  leaves a running one running, `signin:token` replaces its own token, `plugin:new` does not
  scaffold twice, `site:delete` with no site has nothing to delete. The test runs each of them
  twice.
- `site:reset`, `site:delete` and `plugin:publish` ask first. In CI nothing asks.
- `plugin:new` and `plugin:add` stop the site; start it again afterwards.
- `content:pull` and `live:backup` write to `backups/` in the site. Keep it out of git.
- There is no SQL dump in `live:backup`: Cloudflare's export refuses an EmDash database.
- `signin:token -- --live` works for Cloudflare sites only.
