## `content:pull`

- **Usage:** `content:pull`

The deployed site's content, on this machine: downloads it as an EmDash package into backups/ and prints how to load it into an empty local site. Needs LIVE_URL, and once: mise run emdash -- login --url &lt;LIVE_URL>

## `emdash`

- Depends: step:there

- **Usage:** `emdash`

Anything else in EmDash, through its official CLI — e.g: mise run emdash -- content list posts

## `emdash:update`

- **Usage:** `emdash:update`

A newer EmDash: updates the site to the latest release, then type-checks and builds it. The local database migrates on the next start. A deployed site: take a backup first, deploy after

## `live:backup`

- **Usage:** `live:backup`

A way back, and a copy: the deployed database's Time Travel bookmark, and the deployed site as an EmDash package in backups/. Says what neither holds. Needs LIVE_URL, and once: mise run emdash -- login --url &lt;LIVE_URL>

## `live:check`

- **Usage:** `live:check`

Would this deploy: site:check, then wrangler's dry run of the deploy — nothing is uploaded and no account is needed. For a site on Cloudflare

## `live:key`

- Depends: step:there

- **Usage:** `live:key`

Once, after the first live:ship: the site's encryption key goes to the Worker as a secret. It uploads every line of the site's .env — on a site this made, that is the key and nothing else. The values are never shown. Asks first

## `live:logs`

- Depends: step:there

- **Usage:** `live:logs`

Follow the deployed site's log — requests, errors, and each run of the scheduler

## `live:ship`

- **Usage:** `live:ship`

Put it live on Cloudflare: checks who is signed in, runs live:check, deploys, shows what is now live and waits for the site to answer. Needs LIVE_URL. EmDash migrates the database on the first request. First time: follow it with live:key, then make the first administrator in a browser

## `live:undo`

Put the previous version back — or the one you name: mise run live:undo -- <version-id> (wrangler versions list shows them). Code only: a rollback does not undo a database migration or any content


- Depends: step:live, step:there

- **Usage:** `live:undo [version]`

### Arguments
- **`[version]`** — A version id; left out, the one before the current

## `model:sync`

The admin and the repo must agree: after anyone changes the model — in the admin or with emdash schema — this records it in .emdash/ and shows what changed. Commit that with the code that uses it. From the running local site; with --live, from the deployed one at LIVE_URL (once: mise run emdash -- login --url <LIVE_URL>)


- Depends: step:there

- **Usage:** `model:sync [--live]`

### Flags
- **`--live`** — Read the model of the deployed site at LIVE_URL instead of the local one

## `plugin`

- Depends: step:there

- **Usage:** `plugin`

Anything else in EmDash's plugin CLI — e.g: mise run plugin -- search forms

## `plugin:add`

I need someone else's plugin, from npm: stops the site and adds the package to it, so the repo declares it and a fresh clone has it. Ends with the two lines to add to astro.config.mjs. (A registry plugin is installed in the admin instead — EmDash has no command for it)


- Depends: step:there

- **Usage:** `plugin:add <package>`

### Arguments
- **`<package>`** — The npm package, e.g. @emdash-cms/plugin-forms

## `plugin:check`

Is this plugin sound: its manifest is valid, its types check, its tests pass, it builds, and the bundle the registry would get is valid


- Depends: step:there

- **Usage:** `plugin:check <name>`

### Arguments
- **`<name>`** — The folder name of the plugin under plugins/

## `plugin:new`

I need a plugin of my own: stops the site, then EmDash's plugin scaffolder makes plugins/<name> inside it, and the plugin is installed, tested, built and added to the site. Ends with the two lines to add to astro.config.mjs. Needs PLUGIN_PUBLISHER, PLUGIN_AUTHOR and PLUGIN_SECURITY_EMAIL


- Depends: step:there, step:plugin-details

- **Usage:** `plugin:new <name>`

### Arguments
- **`<name>`** — The slug of the plugin, e.g. save-log

## `plugin:publish`

Release this plugin to EmDash's registry, under the account you are logged in to: mise run plugin -- login <handle>. Checks it first. Asks first — except in CI, where mise answers yes


- Depends: step:there

- **Usage:** `plugin:publish <name>`

### Arguments
- **`<name>`** — The folder name of the plugin under plugins/

## `site:check`

- **Usage:** `site:check`

Is my work sound, before a commit or a deploy: the seed is valid, the types check, the production build passes. Safe beside a running site

## `site:delete`

- **Usage:** `site:delete`

Delete this project's site folder — the opposite of site:new. Stops the site first. Everything in it goes, including its local database. Asks first — except in CI, where mise answers yes. Refuses when the site is the project itself

## `site:logs`

- Depends: step:there

- **Usage:** `site:logs`

Follow the running site's log

## `site:new`

A site, once: EmDash's scaffolder makes the site folder and installs it. Say which — mise run site:new -- node:blog — or leave it out for TEMPLATE in mise.toml, else cloudflare:blog


- **Usage:** `site:new [template]`

### Arguments
- **`[template]`** — &lt;platform>:&lt;template>

  **Choices:** `cloudflare:blog`, `cloudflare:starter`, `cloudflare:marketing`, `cloudflare:portfolio`, `node:blog`, `node:starter`, `node:marketing`, `node:portfolio`

## `site:reset`

- **Usage:** `site:reset`

The local site back to its seed: stops it, removes the local database and uploads, starts it again. Local only — nothing deployed is touched. Asks first — except in CI, where mise answers yes

## `site:start`

- **Usage:** `site:start`

I want to work on this site: install, make its key if it has none, run it in the background. Then open the admin: /_emdash/api/setup/dev-bypass?redirect=/_emdash/admin

## `site:stop`

- Depends: step:there

- **Usage:** `site:stop`

Stop the site that site:start started
