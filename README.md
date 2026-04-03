# emdash-run

Local runner for [emdash-cms/emdash](https://github.com/emdash-cms/emdash) with a CAD schema (projects → assemblies → parts).

Process manager: [pitchfork](https://pitchfork.jdx.dev/) — [mise](https://mise.jdx.dev/) for tasks.

---

## First time only

```bash
curl https://mise.run | sh       # install mise
mise install                     # install node, pnpm, pitchfork
mise run server:build            # clone → install → build (slow, ~3 min)
mise run pitchfork:start         # start server (fast, server already built)
mise run mcp:token-admin         # generate admin API token (saved to run/token-admin.env)
mise run server:seed             # apply CAD schema + sample content from config/seed.json
mise run claude:gen-permissions  # write .claude/settings.local.json from live MCP tool list
mise run playwright:auth         # get browser session cookie
mise run playwright:validate     # confirm everything is working
```

Then open http://localhost:4321/_emdash/admin/

---

## Every day

```bash
mise run pitchfork:start    # start the server
```

If your token or cookie has expired:

```bash
mise run mcp:token-admin    # refresh admin token
mise run playwright:auth    # refresh browser session
```

---

## When things break

| Symptom | Fix |
|---------|-----|
| 504 errors in browser | `mise run server:clean-cache` |
| MCP returns 401 | `mise run mcp:token-admin` |
| Admin UI redirects to login | `mise run playwright:auth` |
| Want a clean database | `mise run server:reset` then `mise run pitchfork:start` |
| Want a full fresh clone | `mise run server:clean` then `mise run pitchfork:start` |
| Start from absolutely nothing | `mise run server:teardown` then `server:build` → `pitchfork:start` → `mcp:token-admin` → `server:seed` |
| MCP tools return 404 on `/register` after teardown | Restart Claude Code to reload the new `EMDASH_TOKEN` (see ADR-0004) |

---

## All tasks (reference)

```bash
# Daemon
mise run pitchfork:start     # start server daemon (waits until ready)
mise run pitchfork:stop      # stop server daemon
mise run pitchfork:status    # is it running?
mise run pitchfork:logs      # follow live logs
mise run pitchfork:tui       # interactive TUI

# Server
mise run server:build        # clone → install → build (once, or after teardown)
mise run server:start        # start pnpm dev — called by pitchfork, not directly
mise run server:seed         # apply config/seed.json — schema + content on fresh DB
mise run server:logs         # follow live server logs (via pitchfork)
mise run server:clean-cache  # clear Vite cache, restart daemon
mise run server:teardown     # ⚠ stop daemon + wipe DB + wipe clone (full reset)
mise run server:reset        # ⚠ wipe database only
mise run server:clean        # ⚠ wipe emdash clone only

# MCP tokens — idempotent, safe to re-run
mise run mcp:token-admin             # admin token → run/token-admin.txt + run/token-admin.env
mise run mcp:token-user              # user token  → run/token-user.txt
mise run mcp:clean-tokens            # revoke all tokens
mise run mcp:clean-tokens -- <name>  # revoke tokens matching name

# EmDash CLI (remote — talks to server over HTTP)
mise run emdash:cli -- schema list                              # list collections
mise run emdash:cli -- content list <collection>               # list content
mise run emdash:cli -- content create <collection> --data '{...}' # create content

# EmDash CLI (local — reads data.db directly, no server needed)
mise run emdash:local -- export-seed --with-content            # export schema+content → stdout
mise run emdash:local -- doctor                                # check database health
mise run emdash:export-seed                                    # export → logs/seed-export.json

# Browser / Playwright
mise run playwright:auth     # session cookie → run/cookies-playwright.txt
mise run playwright:validate # verify admin UI is reachable and authenticated

# Claude Code
mise run claude:gen-permissions  # regenerate .claude/settings.local.json from live MCP tools
```

---

## Files

```
logs/   server.log, setup.log                    ← gitignored
run/    token-admin.txt, token-admin.env,
        token-user.txt, cookies-playwright.txt   ← gitignored
```