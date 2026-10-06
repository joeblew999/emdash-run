## `check`

- **Usage:** `check`

Everything that must hold before a commit. --fix repairs formatting and generated docs; --site also type-checks the site

## `content:set`

- **Usage:** `content:set`

Set fields on a live entry — e.g: mise run content:set -- parts top-plate '{"material":"Steel"}'

## `deploy`

- **Usage:** `deploy`

Check, build, deploy to Cloudflare, then verify what is live. --dry builds without deploying

## `dev`

- **Usage:** `dev`

Bring the site up on the current config, seed and plugins — run it after any change

## `doctor`

- **Usage:** `doctor`

Is the running site what the repo says it is? --url &lt;deployment> checks a deployed one

## `emdash`

- **Usage:** `emdash`

The official emdash CLI — e.g: mise run emdash -- schema list

## `emdash-plugin`

- **Usage:** `emdash-plugin`

The official plugin CLI — e.g: mise run emdash-plugin -- login

## `logs`

- **Usage:** `logs`

Follow the site's logs. --deployed follows the live Worker

## `open`

- **Usage:** `open`

Open the admin in a browser, signed in

## `plugin:dev`

- **Usage:** `plugin:dev`

Rebuild a plugin on change

## `plugin:new`

- **Usage:** `plugin:new`

Scaffold a plugin with the official CLI, fit it to this site, load it, and have the running site call it

## `plugin:probe`

- **Usage:** `plugin:probe`

Ask the running site to call a plugin's route — proof it is loaded, not just built

## `plugin:release`

- **Usage:** `plugin:release`

Validate, typecheck, test, build and bundle plugins — everything short of publishing

## `plugin:remove`

- **Usage:** `plugin:remove`

Remove a plugin and bring the site back up without it

## `plugin:roundtrip`

- **Usage:** `plugin:roundtrip`

Prove the plugin toolchain end to end with a throwaway plugin: scaffold, load, call, remove

## `registry:down`

- **Usage:** `registry:down`

Stop the local registry — the site goes back to the hosted one

## `registry:up`

- **Usage:** `registry:up`

Start the optional local plugin registry and point the site at it (builds the EmDash monorepo the first time)

## `report`

- **Usage:** `report`

Something broke? Prints your versions, status and recent site log, ready to paste into an issue

## `reset`

- **Usage:** `reset`

Wipe the local database and bring the site back up on the seed. --site / --all wipe more

## `restore`

- **Usage:** `restore`

Restore a snapshot into an EMPTY site: shows the plan, --confirm executes it, --wipe empties the local site first

## `rollback`

- **Usage:** `rollback`

Put the previous deployment back, then verify what is live

## `schema:diff`

- **Usage:** `schema:diff`

Compare the repo's content model with the running site's, or a deployment's with --url

## `seed:export`

- **Usage:** `seed:export`

Export the running site's model and content as a seed, to review against the project's

## `setup`

- **Usage:** `setup`

First time here: clone the template, install, apply config, then bring the site up

## `skills`

- **Usage:** `skills`

The skills CLI — e.g: mise run skills -- list. Add with --copy: this repo allows no symlinks

## `snapshot`

- **Usage:** `snapshot`

Save the whole site — schema and content — as a .emdash package. --url snapshots a deployment

## `source`

- **Usage:** `source`

Clone the EmDash source at the version the site runs into .src/emdash, for reading

## `status`

- **Usage:** `status`

What is running, and on what: harness, template, EmDash, site, plugins, deployment

## `upgrade`

- **Usage:** `upgrade`

Take a newer harness: replaces nu/ and .config/mise/conf.d/harness.toml from emdash-run, then runs check. -- &lt;tag> picks a version

## `verify`

- **Usage:** `verify`

Does this project work on THIS machine? Site up, check, doctor — what CI runs on every OS. --full adds a plugin round trip, a snapshot and a build

## `verify:linux`

- **Usage:** `verify:linux`

The same verification in a clean Linux container with only git and mise. Needs docker
