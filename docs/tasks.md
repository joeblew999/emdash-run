## `content:pull`

- **Usage:** `content:pull`

The deployed site's content, on this machine: downloads it as an EmDash package into backups/ and prints how to load it into an empty local site. Needs LIVE_URL, and once: mise run emdash -- login --url &lt;LIVE_URL>

## `emdash`

- Depends: step:there

- **Usage:** `emdash`

Anything in EmDash, through its official CLI — e.g: mise run emdash -- content list posts. The local dev site unless you say --url; for any site it adds the token and the Access pass this machine has saved for it (signin:token, signin:access)

## `emdash:update`

- **Usage:** `emdash:update`

A newer EmDash: updates the site to the latest release, then type-checks and builds it. The local database migrates on the next start. A deployed site: take a backup first, deploy after

## `live:backup`

- **Usage:** `live:backup`

A way back, and a copy: the deployed database's Time Travel bookmark, and the deployed site as an EmDash package in backups/. Says what neither holds. Needs LIVE_URL, and once: mise run emdash -- login --url &lt;LIVE_URL>

## `live:logs`

- Depends: step:there

- **Usage:** `live:logs`

Follow the deployed site's log — requests, errors, and each run of the scheduler

## `live:ship`

- **Usage:** `live:ship`

Put it live on Cloudflare: checks who is signed in, runs live:check, deploys, shows what is now live and waits for the site to answer. Needs LIVE_URL. EmDash migrates the database on the first request. The site's .env goes up with it as secrets. First time: see the signin: tasks, and have one in place BEFORE this — a deployed site with no sign-in in front of it belongs to whoever opens its admin first

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

## `signin:access`

- Depends: step:live, step:there

- **Usage:** `signin:access`

SIGN-IN for PEOPLE on the deployed site, by Cloudflare Access. NO BROWSER, NO PLAYWRIGHT. Puts Access in front of the admin and API at LIVE_URL: ADMIN_EMAIL may sign in with a code sent to that address, and a pass for machines is saved in ~/.config/emdash-run/access/ so the CLI gets through. Changes nothing already there. Ends by printing the lines to add to astro.config.mjs and wrangler.jsonc. Run as: fnox exec -- mise run signin:access (it needs a Cloudflare token with Access edit rights; wrangler's own login can only read Access)

## `signin:open`

SIGN-IN for a PERSON. NEEDS PLAYWRIGHT and Chrome or Edge. Opens a browser window you can see, already signed in to the admin, using whatever this machine saved for the site: the token from signin:token (and the Cloudflare Access pass, if any), or else the passkey from signin:passkey. Local production build by default, started if it is not running; -- --live for the deployed site. Close the window when done. (Dev site: no task needed, open /_emdash/api/setup/dev-bypass?redirect=/_emdash/admin)


- Depends: step:there, step:admin-tools

- **Usage:** `signin:open [--live]`

### Flags
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

## `signin:passkey`

SIGN-IN for a MACHINE — the long way, through EmDash's real pages. NEEDS PLAYWRIGHT and Chrome or Edge (installed for you on first run). A hidden browser completes EmDash's setup wizard with a simulated passkey and approves the CLI's own login. Only needed to test the wizard and emdash login themselves — signin:token does the same job without a browser. Local production build by default (run site:preview first); -- --live for the deployed site at LIVE_URL as ADMIN_EMAIL (not for a site behind Cloudflare Access: Access turns passkeys off). Saves the passkey in ~/.config/emdash-run/passkeys/


- Depends: step:there, step:admin-tools

- **Usage:** `signin:passkey [--live]`

### Flags
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

## `signin:token`

SIGN-IN for a MACHINE — the fast way. NO BROWSER, NO PLAYWRIGHT. Writes an administrator and an EmDash API token straight into the site's database, and saves the token on this machine, so the CLI, agents and CI are a full user at once. Local production build by default (run site:preview first); add -- --live for the deployed site at LIVE_URL, run as: fnox exec -- mise run signin:token -- --live (it needs your Cloudflare token to write to D1). With --live it also puts the token and the Cloudflare Access pass into EmDash's own sign-in store, so plain emdash --url works too. Then: mise run emdash -- <command> --url <site>


- Depends: step:there

- **Usage:** `signin:token [--live]`

### Flags
- **`--live`** — The deployed site at LIVE_URL instead of the local production build

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

## `site:preview`

- **Usage:** `site:preview`

The site as a deploy would ship it, on this machine: stops the dev server, builds, and serves the production build in the background on PREVIEW_PORT (4322). It shares the local database with site:start. site:stop stops it

## `site:reset`

- **Usage:** `site:reset`

The local site back to its seed: stops it, removes the local database and uploads, starts it again. Local only — nothing deployed is touched. Asks first — except in CI, where mise answers yes

## `site:start`

- **Usage:** `site:start`

I want to work on this site: install, make its key if it has none, run it in the background. Then open the admin: /_emdash/api/setup/dev-bypass?redirect=/_emdash/admin

## `site:stop`

- Depends: step:there

- **Usage:** `site:stop`

Stop the site that site:start started, and the production build that site:preview started
