# emdash-run

Local runner for [emdash-cms/emdash](https://github.com/emdash-cms/emdash) with a CAD schema (projects → assemblies → parts).

The host site is an official EmDash template — **`starter-cloudflare`** — copied into
`.src/site` and run against the published `emdash` npm package. There is no emdash
monorepo clone. See [ADR-0007](docs/adr/0007-emdash-1.1-templates-src-rework.md).

Process manager: [pitchfork](https://pitchfork.jdx.dev/) — [mise](https://mise.jdx.dev/) for tasks.

---

## First time only

```bash
curl https://mise.run | sh    # install mise
mise install                  # install node, pnpm 11.9, pitchfork, wrangler, skills
mise run server:build         # clone templates → copy site → install → apply config
mise run init                 # plugin deps + skills (run once)
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
| http://localhost:4321/_emdash/admin/plugins | Plugins — discovery via the hosted registry |
| http://localhost:4321/_emdash/api/mcp | MCP endpoint (Bearer token from `run/token-admin.txt`) |

---

## When things break

| Symptom | Fix |
|---------|-----|
| Authentication failed / login redirects | `mise run server:open` — never use the login page in dev |
| MCP returns 401 | `mise run apply` |
| Want a clean database | `mise run server:reset` then `mise run apply` |
| Want the site re-copied from the template | `mise run server:clean` then `mise run server:build` → `mise run init` → `mise run apply` |
| Want everything re-cloned | `mise run server:regen` then `mise run server:build` → `mise run init` → `mise run apply` |

---

## All tasks

```bash
mise tasks ls    # always up to date
```

---

## Files

```
config/   site.astro.config.mjs, site.wrangler.jsonc, cad.seed.json
          ← source config, written into .src/site by config:apply
logs/     server.log                        ← gitignored
run/      token-admin.txt, token-admin.env,
          token-user.txt                    ← gitignored
.src/     templates/, site/                 ← gitignored working checkouts
plugins/  plat-trunk/                       ← local plugin, symlinked into .src/site
```

---

## Updating

- **Template changes** (new starter content): `mise run server:clean` → `mise run server:build`
  → `mise run init` → `mise run apply`. `apply` alone does **not** re-copy `.src/site`.
- **EmDash version:** bump `EMDASH_VERSION` in `mise.toml`. `site:install` pins the
  site's `emdash` and `@emdash-cms/cloudflare` to exactly that version.
- **Local plugin change:** `mise run apply` (config + relink + restart).

---

## Plugins

`emdash@1.1.0` uses the hosted **registry** (`registry.emdashcms.com`) for plugin
discovery and installs. Local plugins are loaded straight from
`config/site.astro.config.mjs` (`plugins: []` / `sandboxed: []`) and symlinked into
the site by `mise run apply`:

```bash
mise run plugin:cli -- content list projects   # the site's emdash CLI
mise run plugin:publish -- plat-trunk          # publish to the public registry
```
