## `emdash`

- **Usage:** `emdash`

Anything else in EmDash, through its official CLI — e.g: mise run emdash -- content list posts

## `site:delete`

- **Usage:** `site:delete`

Delete this project's site/ — the opposite of site:new. Stops the site first. Everything in site/ goes, including its local database. Asks first — except in CI, where mise answers yes

## `site:logs`

- **Usage:** `site:logs`

Follow the running site's log

## `site:new`

A site, once: EmDash's scaffolder makes site/ and installs it. Say which — mise run site:new -- node:blog — or leave it out for TEMPLATE in mise.toml, else cloudflare:blog


- **Usage:** `site:new [template]`

### Arguments
- **`[template]`** — &lt;platform>:&lt;template>

  **Choices:** `cloudflare:blog`, `cloudflare:starter`, `cloudflare:marketing`, `cloudflare:portfolio`, `node:blog`, `node:starter`, `node:marketing`, `node:portfolio`

## `site:start`

- **Usage:** `site:start`

I want to work on this site: install, make its key if it has none, run it in the background. Then open the admin: /_emdash/api/setup/dev-bypass?redirect=/_emdash/admin

## `site:stop`

- **Usage:** `site:stop`

Stop the site that site:start started
