## `content:pull`

- **Usage:** `content:pull`

Download the deployed site's content as a package into backups/

## `emdash`

- Depends: step:there

- **Usage:** `emdash`

EmDash's CLI. This machine by default; add --live for the deployed site, --preview for the built site

## `emdash:update`

- **Usage:** `emdash:update`

Update the site to the newest EmDash, then type-check and build

## `live:backup`

- **Usage:** `live:backup`

Back up the deployed site: database bookmark + content package

## `live:logs`

- Depends: step:there

- **Usage:** `live:logs`

Follow the deployed site's log

## `live:ship`

- **Usage:** `live:ship`

Deploy to Cloudflare: check, deploy, wait for the site to answer

## `live:undo`

Roll the deployed site back to the previous version (code only)


- Depends: step:live, step:there

- **Usage:** `live:undo [version]`

### Arguments
- **`[version]`** — A version id; left out, the one before the current

## `model:sync`

Record the site's content model in the repo (.emdash/). Add -- --live for the deployed site


- Depends: step:there

- **Usage:** `model:sync [--live]`

### Flags
- **`--live`** — Read the model of the deployed site at LIVE_URL instead of the local one

## `plugin`

- Depends: step:there

- **Usage:** `plugin`

EmDash's plugin CLI. mise run plugin -- search forms

## `plugin:add`

Add a plugin from npm. mise run plugin:add -- <package>


- Depends: step:there

- **Usage:** `plugin:add <package>`

### Arguments
- **`<package>`** — The npm package, e.g. @emdash-cms/plugin-forms

## `plugin:check`

Check a plugin: manifest, types, tests, build, bundle. mise run plugin:check -- <name>


- Depends: step:there

- **Usage:** `plugin:check <name>`

### Arguments
- **`<name>`** — The folder name of the plugin under plugins/

## `plugin:new`

Make a plugin inside the site: scaffold, test, build, add. mise run plugin:new -- <name>


- Depends: step:there, step:plugin-details

- **Usage:** `plugin:new <name>`

### Arguments
- **`<name>`** — The slug of the plugin, e.g. save-log

## `plugin:publish`

Publish a plugin to EmDash's registry. Asks first


- Depends: step:there

- **Usage:** `plugin:publish <name>`

### Arguments
- **`<name>`** — The folder name of the plugin under plugins/

## `signin:access`

- Depends: step:live, step:there

- **Usage:** `signin:access`

Put Cloudflare Access in front of the deployed site's admin (sign in by emailed code)

## `signin:open`

Open a browser window already signed in to the admin. Needs Playwright + Chrome


- Depends: step:there, step:admin-tools

- **Usage:** `signin:open [--live]`

### Flags
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

## `signin:passkey`

Sign a machine in through EmDash's real setup wizard. Needs Playwright + Chrome


- Depends: step:there, step:admin-tools

- **Usage:** `signin:passkey [--live]`

### Flags
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

## `signin:token`

Sign a machine in, no browser: admin + API token written to the site's database. Add -- --live for deployed


- Depends: step:there

- **Usage:** `signin:token [--live]`

### Flags
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

## `site:check`

- **Usage:** `site:check`

Before a commit: seed valid, types check, site builds

## `site:delete`

- **Usage:** `site:delete`

Delete the site folder. Asks first

## `site:logs`

- Depends: step:there

- **Usage:** `site:logs`

Follow the dev site's log

## `site:new`

Make a new site. Template: mise run site:new -- node:blog (default cloudflare:blog)


- **Usage:** `site:new [template]`

### Arguments
- **`[template]`** — &lt;platform>:&lt;template>

  **Choices:** `cloudflare:blog`, `cloudflare:starter`, `cloudflare:marketing`, `cloudflare:portfolio`, `node:blog`, `node:starter`, `node:marketing`, `node:portfolio`

## `site:preview`

- **Usage:** `site:preview`

Build the site and serve it locally (port 4322) — behaves like a deployed site

## `site:reset`

- **Usage:** `site:reset`

Empty the local database and start again from the seed. Asks first

## `site:start`

- **Usage:** `site:start`

Start the dev site in the background (port 4321). EmDash signs you in by itself

## `site:stop`

- Depends: step:there

- **Usage:** `site:stop`

Stop the dev site and the built site

## `test`

- **Usage:** `test`

Test the everyday tasks from an empty folder (about a minute). Writes docs/status.md

## `test:full`

- **Usage:** `test:full`

Test every task that needs no deployment, on both templates (about 5 minutes). Writes docs/status.md
