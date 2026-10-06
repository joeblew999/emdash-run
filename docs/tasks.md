## `check`

Everything that must hold before a commit. --fix repairs formatting and generated docs; --site also type-checks the site


- **Usage:** `check [args]…`
- **Aliases:** `pre-commit`

### Arguments
- **`[args]…`**

## `deploy`

Check, build, deploy to Cloudflare, then verify what is live. --dry builds without deploying


- **Usage:** `deploy [args]…`

### Arguments
- **`[args]…`**

## `dev`

Bring the site up on the current config, seed and plugins — run it after any change


- **Usage:** `dev [args]…`

### Arguments
- **`[args]…`**

## `doctor`

Is the running site what the repo says it is? --url <deployment> checks a deployed one


- **Usage:** `doctor [args]…`

### Arguments
- **`[args]…`**

## `emdash`

The official emdash CLI — e.g: mise run emdash -- schema list


- **Usage:** `emdash [args]…`

### Arguments
- **`[args]…`**

## `emdash-plugin`

The official plugin CLI — e.g: mise run emdash-plugin -- login


- **Usage:** `emdash-plugin [args]…`

### Arguments
- **`[args]…`**

## `logs`

Follow the site's logs. --deployed follows the live Worker


- **Usage:** `logs [args]…`

### Arguments
- **`[args]…`**

## `open`

Open the admin in a browser, signed in


- **Usage:** `open [args]…`

### Arguments
- **`[args]…`**

## `plugin:new`

Scaffold a plugin with the official CLI, fit it to this site, load it, and have the running site call it


- **Usage:** `plugin:new [args]…`

### Arguments
- **`[args]…`**

## `plugin:release`

Validate, typecheck, test, build and bundle plugins — everything short of publishing


- **Usage:** `plugin:release [args]…`

### Arguments
- **`[args]…`**

## `plugin:remove`

Remove a plugin and bring the site back up without it


- **Usage:** `plugin:remove [args]…`

### Arguments
- **`[args]…`**

## `report`

Something broke? Prints your versions, status and recent site log, ready to paste into an issue


- **Usage:** `report [args]…`

### Arguments
- **`[args]…`**

## `reset`

Wipe the local database and uploads, then bring the site back up on its seed. Your site/ is untouched


- **Usage:** `reset [args]…`

### Arguments
- **`[args]…`**

## `restore`

Restore a snapshot into an EMPTY site: shows the plan, --confirm executes it (or finishes an interrupted one), --wipe empties the local site first. Given a backup directory, puts that database back


- **Usage:** `restore [args]…`

### Arguments
- **`[args]…`**

## `rollback`

Put the previous deployment back, then verify what is live


- **Usage:** `rollback [args]…`

### Arguments
- **`[args]…`**

## `seed:export`

Export the running site's model and content as a seed, to review against the project's


- **Usage:** `seed:export [args]…`

### Arguments
- **`[args]…`**

## `setup`

First time here: create site/ from the template (once), install, then bring the site up


- **Usage:** `setup [args]…`

### Arguments
- **`[args]…`**

## `snapshot`

Save the site — schema, content and media — as a .emdash package (not users, tokens or plugin data). --database backs up the database itself instead. --url does either for a deployment


- **Usage:** `snapshot [args]…`

### Arguments
- **`[args]…`**

## `source`

Clone or update a reference checkout under .src/ for reading: emdash (the default — EmDash's source at the version the site runs), templates, or emdashcms.com (EmDash's own production site)


- **Usage:** `source [args]…`

### Arguments
- **`[args]…`**

## `status`

What is running, and on what: harness, template, EmDash, site, plugins, deployment


- **Usage:** `status [args]…`

### Arguments
- **`[args]…`**

## `upgrade`

Take a newer harness: replaces nu/ and .config/mise/conf.d/harness.toml with the latest release, then runs check. -- <tag> or -- main picks another


- **Usage:** `upgrade [args]…`

### Arguments
- **`[args]…`**

## `verify`

Does this project work on THIS machine? Site up, check, doctor. --full adds a plugin round trip, a snapshot and a build; --restore also wipes the local database and restores it


- **Usage:** `verify [args]…`

### Arguments
- **`[args]…`**
