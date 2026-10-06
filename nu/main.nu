# The harness — every `mise run <task>` lands on one command here. Run through mise, which supplies
# the settings as environment variables:  mise run <task> [-- args]
use lib.nu *
use site.nu
use plugin.nu
use checks.nu
use registry.nu

# Everything between "something changed" and "the site is up on it": config, seed, plugins, skills,
# a restart, the seed applied to the running database, a fresh admin token.
def refresh [] {
  step "config, seed and plugin registration"
  site configure (plugin current-registration)
  plugin sweep build
  plugin link
  let faults = (plugin audit)
  if ($faults | is-not-empty) { fail $"plugins are inconsistent: ($faults | str join '; ')" }
  checks sync-skills
  step "restart the site"
  site restart
  site apply-seed
  site mint-token
}

# First time on a machine: template, install, config, hooks — then bring the site up.
def "main setup" [] {
  step "template"
  site clone-templates
  site copy-template
  step "install"
  site install
  ^git -C $env.ROOT config core.hooksPath .githooks
  refresh
  site urls
}

# Bring the site up on the current config, seed and plugins. Run it after any change.
def "main dev" [] {
  refresh
  site urls
}

# Everything that must hold before a commit. --fix repairs what can be repaired; --site also
# type-checks the site, which restarts it.
def "main check" [--fix, --site] {
  let nu_dir = ($env.ROOT | path join "nu")
  let paths = (plugin code-paths)
  cd $env.ROOT
  if $fix {
    ^mise fmt
    if ($paths | is-not-empty) { ^oxfmt ...$paths }
    ^mise generate task-docs --output docs/tasks.md
  }
  def passes [block: closure]: nothing -> list<string> { if (code $block) == 0 { [] } else { ["failed — see the output above"] } }
  let results = [
    {check: "nushell modules parse and type-check", problems: (checks nu-problems $nu_dir)}
    {check: "tasks, commands and daemons agree", problems: (checks task-problems (harness-file) ($nu_dir | path join "main.nu"))}
    {check: "the checkers catch planted faults", problems: (checks selftest-problems)}
    {check: "unit tests", problems: (passes { ^nu --no-config-file ($nu_dir | path join "tests.nu") })}
    {check: "mise accepts the task definitions", problems: (passes { ^mise tasks validate | ignore })}
    {check: "mise.toml is formatted", problems: (passes { ^mise fmt --check })}
    {check: "docs/tasks.md matches the tasks", problems: (if (checks docs-current) { [] } else { ["out of date — run: mise run check -- --fix"] })}
    {check: "vendored EmDash skills match the site's", problems: (if (checks skills-current) { [] } else { ["drifted — run: mise run dev"] })}
    {check: "no symlinks", problems: (checks symlinks)}
    {check: "plugins are consistent", problems: (plugin audit)}
    {check: "plugin code lints", problems: (if ($paths | is-empty) { [] } else { passes { ^oxlint --type-aware --deny-warnings ...$paths } })}
    {check: "plugin code is formatted", problems: (if ($paths | is-empty) { [] } else { passes { ^oxfmt --check ...$paths } })}
    {check: "plugins type-check", problems: (passes { plugin sweep typecheck })}
    {check: "plugin tests", problems: (passes { plugin sweep test })}
  ] | append (if $site { [{check: "the site type-checks", problems: (if (site typecheck) == 0 { [] } else { ["failed — see the output above"] })}] } else { [] })
  for result in $results {
    if ($result.problems | is-empty) { ok $result.check } else {
      print $"  ✗ ($result.check)"
      for problem in $result.problems { print $"      ($problem)" }
    }
  }
  let failed = ($results | where {|r| $r.problems | is-not-empty } | length)
  if $failed > 0 { fail $"($failed) of ($results | length) checks failed" }
  print $"✓ ($results | length) checks passed"
}

# Is the running site what the repo says it is? With --url, a deployment instead.
def "main doctor" [--url: string] {
  if $url != null { $env.EMDASH_URL = $url }
  if (setting EMDASH_URL | is-empty) {
    step "local database"
    emdash doctor -d (devdb)
    let faults = (plugin audit)
    if ($faults | is-not-empty) { fail $"plugins are inconsistent: ($faults | str join '; ')" }
  } else {
    step "core migrations on the deployed database"
    do { cd $env.SITE_DIR; ^fnox exec -- emdash migrate --status --d1 (site d1-name) }
    step "content model"
    if not (checks schema-diff (open ($env.SITE_DIR | path join "seed" "seed.json"))) { exit 1 }
  }
  step "live state"
  if not (checks verify) { fail "the site does not match the repo" }
  print "✓ healthy"
}

# Ship it: check, build, deploy to Cloudflare, then verify what is live. --dry builds and bundles
# without deploying; --build-only stops after the build; --no-check skips the gate.
def "main deploy" [--dry, --build-only, --no-check] {
  let mode = (if $build_only { "build" } else if $dry { "dry" } else { "deploy" })
  if $mode == "deploy" and (setting DEPLOY_URL | is-empty) { fail "DEPLOY_URL is not set in mise.toml" }
  if $mode == "deploy" and (not $no_check) {
    step "check — nothing ships that fails it"
    main check
  }
  step "config and seed"
  site configure (plugin current-registration)
  step $mode
  let rc = (site ship $mode)
  if $rc != 0 { fail $"($mode) failed" }
  if $mode == "deploy" {
    step "verify what is live"
    main doctor --url $env.DEPLOY_URL
    print $"✓ live at ($env.DEPLOY_URL)"
  }
}

# Put the previous deployment back, then verify what is live.
def "main rollback" [] {
  step "rollback to the previous version"
  site wrangler rollback --yes --message "rollback via mise run rollback"
  main doctor --url $env.DEPLOY_URL
}

# Save the whole site — schema and content — as a .emdash package. --url snapshots a deployment.
def "main snapshot" [--url: string] {
  if $url != null { $env.EMDASH_URL = $url }
  let dest = ($env.RUN_DIR | path join "snapshots" $"(date now | format date '%Y%m%d-%H%M%S').emdash")
  mkdir ($dest | path dirname)
  emdash site export --output $dest ...(url-flag)
  ok $"saved → ($dest) — it holds every entry and authors' emails; treat it like a database backup"
}

# Restore a snapshot into an EMPTY site. Shows the plan; --confirm executes exactly that plan.
# --wipe empties the LOCAL database first, so a local restore is one command.
def "main restore" [package: string, --confirm, --wipe, --url: string] {
  if $url != null { $env.EMDASH_URL = $url }
  let pkg = ($package | path expand)
  if not ($pkg | path exists) { fail $"no such package: ($pkg)" }
  if $wipe {
    if (setting EMDASH_URL | is-not-empty) { fail "--wipe only empties the local site" }
    if not $confirm { fail "--wipe destroys the local database — pass --confirm as well" }
    step "wipe the local database"
    daemon-stop $env.SITE_DAEMON
    rm -rf ($env.SITE_DIR | path join ".wrangler" "state")
    ^mise daemons start $env.SITE_DAEMON
  }
  let analysis = (do { cd $env.SITE_DIR; ^emdash site import $pkg --analyze --json ...(url-flag) | complete })
  let start = ($analysis.stdout | str index-of "{")
  if $analysis.exit_code != 0 or $start < 0 {
    fail $"the package cannot be imported here: ($analysis.stdout | str trim) ($analysis.stderr | str trim)" "the target must be empty — locally, add: --wipe --confirm"
  }
  let planned = ($analysis.stdout | str substring $start.. | from json)
  if ($planned | get -o plan | is-empty) {
    if ($planned | get -o state) == "complete" { ok "this package is already imported here"; return }
    fail $"no import plan came back: ($planned | to json --raw)"
  }
  print ($planned.plan.counts | transpose what count | where count > 0 | table --index false)
  let blockers = ($planned.plan | get -o blockers | default [])
  if ($blockers | is-not-empty) { fail $"the plan has blockers: ($blockers | to json --raw)" }
  if not $confirm { print "  nothing imported — add --confirm to execute this plan"; return }
  emdash site import $pkg --plan $planned.planDigest --confirm ...(url-flag)
  if $wipe { site mint-token }
  ok "restored — check it: mise run doctor"
}

# Wipe the local database and bring the site back up on the seed. --site wipes the site copy too;
# --all wipes every checkout under .src. Both of those need `mise run setup` afterwards.
def "main reset" [--site, --all] {
  ^mise daemons stop --all | complete | ignore
  if $all {
    rm -rf $env.SRC_DIR
    print "✓ wiped .src — next: mise run setup"
  } else if $site {
    rm -rf $env.SITE_DIR
    print "✓ wiped .src/site — next: mise run setup"
  } else {
    rm -rf ($env.SITE_DIR | path join ".wrangler" "state")
    main dev
  }
}

# Follow logs: the site by default, another daemon by name, or --deployed for the live Worker.
def "main logs" [daemon?: string, --deployed] {
  if $deployed { site wrangler tail --format pretty } else { ^mise daemons logs ($daemon | default $env.SITE_DAEMON) --follow }
}

# Open the admin in a browser, signed in.
def "main open" [] { site open-admin }

# Scaffold a plugin with the official CLI, fit it to this site, load it, and have the RUNNING site
# call it. When this prints ✓ the plugin is live.
def "main plugin new" [name: string] {
  if not (site loads-local-plugins) {
    fail "config/site.astro.config.mjs does not load local plugins" 'add:  import { sandboxed as localSandboxed } from "./local-plugins.mjs";  and  sandboxed: [...localSandboxed], sandboxRunner: sandbox()  — see docs/plugin.md'
  }
  step "scaffold"
  plugin scaffold $name
  plugin fit $name
  step "install"
  plugin install $name
  for script in [validate typecheck test build] { plugin sweep $script $name }
  refresh
  plugin probe $name "hello"
  print $"✓ ($name) is live — edit plugins/($name)/src/plugin.ts, then: mise run dev"
}

# Rebuild a plugin on change (official: emdash-plugin dev).
def "main plugin dev" [name: string] { ^pnpm --dir (plugin dir-of $name) exec emdash-plugin dev }

# Ask the RUNNING site to call a plugin's route — proof it is loaded, not just built.
def "main plugin probe" [name: string, route: string = "hello"] { plugin probe $name $route }

# Remove a plugin and bring the site back up without it.
def "main plugin remove" [name: string] {
  plugin delete $name
  refresh
  ok $"removed ($name)"
}

# Prove the whole plugin toolchain against this EmDash: scaffold, load, call, remove. Leaves nothing.
def "main plugin roundtrip" [] {
  let name = "harness-probe"
  if ($env.PLUGINS_DIR | path join $name | path exists) { main plugin remove $name }
  main plugin new $name
  main plugin remove $name
  if (plugin current-registration | str contains $name) { fail "the probe is still registered after removal" }
  print "✓ plugin round trip — scaffolded, loaded, called by the running site, removed"
}

# Everything a plugin release needs short of publishing: validate, typecheck, test, build, bundle.
def "main plugin release" [name?: string] {
  let faults = (plugin audit)
  if ($faults | is-not-empty) { fail $"plugins are inconsistent: ($faults | str join '; ')" }
  if (plugin dirs | is-empty) { print "  no plugins to release — make one: mise run plugin:new -- <name>"; return }
  for script in [validate typecheck test build bundle] { plugin sweep $script $name }
  print "✓ bundled — publish with: mise run emdash-plugin -- publish"
}

# Set fields on a live entry: reads its revision, updates, publishes. --url targets a deployment.
def "main content set" [collection: string, entry: string, json: string, --url: string] {
  if $url != null { $env.EMDASH_URL = $url }
  let rev = (emdash-json content get $collection $entry | get -o _rev | default "")
  if ($rev | is-empty) { fail $"no revision for ($collection)/($entry)" }
  emdash content update $collection $entry $"--rev=($rev)" --data $json ...(url-flag)
}

# Compare the repo's content model with the running site's, or with a deployment's (--url).
def "main schema diff" [--url: string] {
  if $url != null { $env.EMDASH_URL = $url }
  if not (checks schema-diff (open ($env.SITE_DIR | path join "seed" "seed.json"))) { exit 1 }
}

# Export the running site's model and content as a seed, to compare with the project's.
def "main seed export" [] {
  let dest = ($env.ROOT | path join "config" "seed.live.json")
  emdash export-seed --database (devdb) --with-content=all | save -f $dest
  ok $"exported → config/seed.live.json — a review copy, never written over the project's seed"
}

# Start the local plugin registry and point the site at it. Builds the EmDash monorepo the first time.
def "main registry up" [] {
  step "prepare the registry"
  registry prepare
  ^mise daemons start registry
  # A fresh registry is empty: ingest published plugins, then build the projection reads go through.
  registry admin "/_admin/backfill"
  registry admin "/_admin/labels/replay"
  site restart
  ok $"registry at ($env.REGISTRY_URL) — the site now discovers plugins from it"
}

# Stop the local registry and point the site back at the hosted one.
def "main registry down" [] {
  daemon-stop "registry"
  site restart
  ok "registry stopped — the site uses the hosted registry"
}

# Take a newer harness from emdash-run: nu/ and the harness mise config are replaced wholesale —
# they hold nothing of the project's — and check says whether the project still holds together.
def "main upgrade" [ref?: string, --from: string] {
  let scratch = ($env.RUN_DIR | path join "upgrade")
  rm -rf $scratch
  mkdir $env.RUN_DIR
  let target = ($ref | default "main")
  let repo = ($from | default $env.HARNESS_REPO)
  step $"fetch ($repo) @ ($target)"
  ^git clone --quiet --depth 1 --branch $target $repo $scratch
  let incoming = (open ($scratch | path join ".config" "mise" "conf.d" "harness.toml") | get env.HARNESS_VERSION)
  rm -rf ($env.ROOT | path join "nu")
  cp -r ($scratch | path join "nu") ($env.ROOT | path join "nu")
  cp ($scratch | path join ".config" "mise" "conf.d" "harness.toml") (harness-file)
  rm -rf $scratch
  ok $"harness ($env.HARNESS_VERSION) → ($incoming) — review with git diff, then: mise run dev"
}

# Clone the EmDash source at the version the site runs, into .src/emdash, for reading.
def "main source" [] { site clone-emdash }

# What the daemons run. Not for typing: `mise run dev` and `mise run registry:up` start them.
def "main daemon site" [] { site serve }
def "main daemon registry" [] { registry serve }

def main [] { print "run a task: mise tasks ls" }
