# emdash-run

Local runner for [emdash-cms/emdash](https://github.com/emdash-cms/emdash) with a CAD schema (projects → assemblies → parts).

Process manager: [pitchfork](https://pitchfork.jdx.dev/) — [mise](https://mise.jdx.dev/) for tasks.

---

## First time only

```bash
curl https://mise.run | sh    # install mise
mise install                  # install node, pnpm, pitchfork, wrangler, skills
mise run server:build         # clone → install → build + config:apply (slow, ~3 min)
mise run init                 # marketplace DB + plugin deps + skills (run once)
mise run apply                # start daemons + generate token
```

Then open the admin:

```bash
mise run server:open   # opens browser via dev-bypass — always use this, never the login page
```

---

## Every day / after every change

```bash
mise run apply        # config:apply + plugins:link + skills:sync + restart daemons + token
mise run server:open  # open admin in browser (dev-bypass — works in Chrome and Safari)
```

---

## URLs

| URL | What |
|-----|------|
| http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin | **Admin UI** — always use this, not the login page |
| http://localhost:4321/_emdash/admin/plugins/marketplace | Marketplace — browse + install plugins |
| http://localhost:4321/_emdash/api/mcp | MCP endpoint (Bearer token from `run/token-admin.txt`) |
| http://localhost:8787/health | Marketplace worker health check |
| http://localhost:8787/api/v1/plugins | Marketplace plugin listing (JSON) |

---

## When things break

| Symptom | Fix |
|---------|-----|
| Authentication failed / login redirects | `mise run server:open` — never use the login page in dev (http://localhost:4321/_emdash/admin) |
| MCP returns 401 | `mise run apply` |
| Want a clean database | `mise run server:reset` then `mise run apply` |
| Want a full fresh clone | `mise run server:clean` then `mise run server:build` → `mise run init` → `mise run apply` |

---

## All tasks

```bash
mise tasks ls    # always up to date
```

---

## Files

```
config/   astro.config.mjs, wrangler.jsonc  ← source config, copied into emdash clone by config:apply
logs/     server.log                        ← gitignored
run/      token-admin.txt, token-admin.env,
          token-user.txt                    ← gitignored
```
