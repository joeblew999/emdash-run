## `check`

Before a commit: is the project sound? --fix repairs formatting; --site also type-checks the site


- **Usage:** `check [args]…`
- **Aliases:** `pre-commit`

### Arguments
- **`[args]…`**

## `deploy`

Go live: check, build, ship to Cloudflare, then verify what is live. --dry builds without shipping


- **Usage:** `deploy [args]…`

### Arguments
- **`[args]…`**

## `dev`

Start working. Brings the site up — the first time it also creates and installs it. Run it again after you change settings or a plugin; page edits reload by themselves


- **Usage:** `dev [args]…`

### Arguments
- **`[args]…`**

## `doctor`

Is the running site healthy, and what the repo says it is? --url <deployment> asks a live one


- **Usage:** `doctor [args]…`

### Arguments
- **`[args]…`**

## `emdash`

Anything else in EmDash, through its official CLI — e.g: mise run emdash -- content list posts


- **Usage:** `emdash [args]…`

### Arguments
- **`[args]…`**

## `emdash-plugin`

The plugin registry, through the official plugin CLI — e.g: mise run emdash-plugin -- search translate


- **Usage:** `emdash-plugin [args]…`

### Arguments
- **`[args]…`**

## `logs`

Follow the site's log. --deployed follows the live site


- **Usage:** `logs [args]…`

### Arguments
- **`[args]…`**

## `open`

Open the admin in your browser, signed in


- **Usage:** `open [args]…`

### Arguments
- **`[args]…`**

## `plugin:new`

Make a new plugin and load it into the running site — e.g: mise run plugin:new -- my-plugin


- **Usage:** `plugin:new [args]…`

### Arguments
- **`[args]…`**

## `plugin:release`

Get your plugins ready to publish: validate, test, build, bundle


- **Usage:** `plugin:release [args]…`

### Arguments
- **`[args]…`**

## `plugin:remove`

Remove a plugin and bring the site back up without it


- **Usage:** `plugin:remove [args]…`

### Arguments
- **`[args]…`**

## `prove`

Do the stages really work, from nothing, on this machine? Runs them in a throwaway project. --git <url> <ref> fetches them the way a real project does


- **Usage:** `prove [args]…`

### Arguments
- **`[args]…`**

## `reset`

Start the local site again from its seed. Wipes the local database; your site/ is untouched


- **Usage:** `reset [args]…`

### Arguments
- **`[args]…`**

## `restore`

Put a snapshot or a backup back. Shows the plan; --confirm does it; --wipe empties the local site first


- **Usage:** `restore [args]…`

### Arguments
- **`[args]…`**

## `rollback`

Undo the last deploy


- **Usage:** `rollback [args]…`

### Arguments
- **`[args]…`**

## `snapshot`

Save the site's content as a package. --database backs up everything, users included. --url takes it from a live site


- **Usage:** `snapshot [args]…`

### Arguments
- **`[args]…`**

## `start`

I want to work on this site: makes it if there is none, installs, starts it, signs you in


- **Usage:** `start [args]…`

### Arguments
- **`[args]…`**

## `status`

What is running, and on which versions


- **Usage:** `status [args]…`

### Arguments
- **`[args]…`**

## `stop`

- **Usage:** `stop`

Stop the site this project's start started

## `upgrade`

Take a newer version of these tasks. -- main takes the development branch


- **Usage:** `upgrade [args]…`

### Arguments
- **`[args]…`**

## `verify`

Prove everything works on this machine: site up, check, doctor. --full adds plugins, a snapshot and a build


- **Usage:** `verify [args]…`

### Arguments
- **`[args]…`**
