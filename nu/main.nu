# The harness — every `mise run <task>` lands on one command here. Run through mise, which supplies
# the settings as environment variables:  mise run <task> [-- args]
use lib.nu *
use site.nu
use plugin.nu
use checks.nu
use registry.nu

# The linter and formatter for plugin code, at the versions pinned in harness.toml. oxlint's
# type-aware mode needs its companion package beside it, and the two must move together.
def --wrapped lint [...args: string] { dlx [$"oxlint@($env.OXLINT_VERSION)" $"oxlint-tsgolint@($env.TSGOLINT_VERSION)"] oxlint ...$args }
def --wrapped format [...args: string] { dlx [$"oxfmt@($env.OXFMT_VERSION)"] oxfmt ...$args }

# Everything between "something changed" and "the site is up on it": config, seed, plugins, skills,
# the seed applied to the running database — and a restart, with a fresh admin token, only when
# something changed that a running server cannot pick up by itself.
def refresh [] {
  site sync-version
  # Plugins move with EmDash: re-pin each that is not on its version — a re-run finishes an upgrade.
  for name in (plugin behind) { plugin fit $name; plugin install $name }
  step "key, plugin registration, seed"
  site prepare (plugin current-registration)
  plugin sweep build
  plugin require-consistent
  checks sync-skills
  let mark = ($env.RUN_DIR | path join "site-started.txt")
  let inputs = (site restart-inputs)
  if (holds $mark $inputs) and (daemon-running $env.SITE_DAEMON) and (answers (site-url) --timeout 30sec) {
    ok "the site is running on these settings, dependencies and plugins already — left alone"
  } else {
    step "restart the site"
    plugin link
    site restart
    $inputs | save --force $mark
  }
  site apply-seed
  ok "admin token → run/token-admin.txt"
}

# First time on a machine: template, install, config, hooks — then bring the site up.
def "main setup" [] {
  site ensure-ignored
  # The templates are fetched only to make site/ — a checkout that already has one does not clone them.
  if not ($env.SITE_DIR | path join "package.json" | path exists) {
    step "template"
    site clone-source templates
    site create
  }
  step "install"
  site install
  if ($env.ROOT | path join ".githooks" | path exists) { ^git -C $env.ROOT config core.hooksPath .githooks }
  refresh
  step "check the running site"
  if not (checks verify) { fail "the site came up but does not match the repo" "see: mise run doctor" }
  print ""
  print $"✓ EmDash ($env.EMDASH_VERSION) is running — the ($env.TEMPLATE) template, on your settings"
  site urls
  site next-steps
}

# Bring the site up on the current config, seed and plugins. Run it after any change.
def "main dev" [] {
  refresh
  site urls
}

# What is running, and on what — read-only, safe to run any time.
def "main status" [] {
  let site_up = (daemon-running $env.SITE_DAEMON)
  let plugins = (plugin dirs | each {|p| $p | path basename })
  let live = (setting DEPLOY_URL)
  print $"  harness   ($env.HARNESS_VERSION)"
  let lag = (site template-lag)
  print $"  template  ($env.TEMPLATE)(if ($lag | is-empty) { '' } else { $' — ($lag)' })"
  print $"  emdash    (site installed-version | default --empty 'not installed — run: mise run setup')"
  print $"  site      (if $site_up { $'running at (site-url)' } else { 'stopped — run: mise run dev' })"
  print $"  plugins   (if ($plugins | is-empty) { 'none — make one: mise run plugin:new -- <name>' } else { $plugins | str join ', ' })"
  print $"  sources   (site source-heads | str join ', ')"
  print $"  registry  (if (answers $'(registry-url)/health') { $'local, at (registry-url)' } else { 'hosted' })"
  print $"  deployed  (if ($live | is-empty) { 'no DEPLOY_URL set' } else if (answers $live) { $'($live) answers' } else { $'($live) does not answer' })"
}

# Something broke? This prints everything we need to help — paste it into an issue.
def "main report" [] {
  let logs = (daemon-log $env.SITE_DAEMON 25)
  let nu_version = (version | get version)
  let tick = (char -u "0060" | fill --character (char -u "0060") --width 3)
  print "Copy everything between the lines into a new issue:"
  print $"  ($env.HARNESS_REPO)/issues/new"
  print "────────────────────────────────────────"
  print "**What I ran, and what happened:**"
  print ""
  print ""
  print $tick
  print $"os        ($nu.os-info.name) ($nu.os-info.arch) ($nu.os-info.kernel_version)"
  print $"mise      (^mise --version | str trim)"
  print $"nushell   ($nu_version)"
  main status
  print ""
  print "last lines of the site log:"
  print $logs
  print $tick
  print "────────────────────────────────────────"
}

# Everything that must hold before a commit. --fix repairs what can be repaired; --site also
# type-checks the site, without touching a running one.
def "main check" [--fix, --site] {
  let nu_dir = ($env.ROOT | path join "nu")
  let paths = (plugin code-paths)
  cd $env.ROOT
  if $fix {
    ^mise fmt
    if ($paths | is-not-empty) { format ...$paths }
    ^mise generate task-docs --output docs/tasks.md
  }
  def passes [block: closure]: nothing -> list<string> { if (code $block) == 0 { [] } else { ["failed — see the output above"] } }
  let results = [
    {check: "nushell modules parse and type-check", problems: (checks nu-problems $nu_dir)}
    {check: "tasks, commands and daemons agree", problems: (checks task-problems (harness-file) ($nu_dir | path join "main.nu"))}
    {check: "the checkers catch planted faults", problems: (checks selftest-problems)}
    {check: "task arguments reach commands", problems: (checks argument-problems)}
    {check: "unit tests", problems: (passes { ^nu --no-config-file ($nu_dir | path join "tests.nu") })}
    {check: "mise accepts the task definitions", problems: ((if (^mise tasks validate | complete).exit_code == 0 { [] } else { ["mise rejects a task definition — run: mise tasks validate"] }))}
    {check: "mise.toml is formatted", problems: (passes { ^mise fmt --check })}
    {check: "docs/tasks.md matches the tasks", problems: (if (checks docs-current) { [] } else { ["out of date — run: mise run check -- --fix"] })}
    {check: "no symlinks", problems: (checks symlinks)}
    {check: "plugins are consistent", problems: (plugin audit)}
    {check: "plugin code lints", problems: (if ($paths | is-empty) { [] } else { passes { lint --type-aware --deny-warnings ...$paths } })}
    {check: "plugin code is formatted", problems: (if ($paths | is-empty) { [] } else { passes { format --check ...$paths } })}
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
  target $url
  if (setting EMDASH_URL | is-empty) {
    step "local database"
    emdash doctor -d (devdb)
    plugin require-consistent
  } else {
    if (on-cloudflare) {
      # `--check` exits non-zero on a pending or unknown migration; `--status` always exits 0.
      step "core migrations on the deployed database"
      let migrations = (do { cd $env.SITE_DIR; ^fnox exec -- emdash migrate --check --d1 (site d1-name) | complete })
      print ($migrations.stdout | lines | where {|l| $l =~ '^(Pending|Unknown applied)' } | each {|l| $"  ($l)" } | str join (char nl))
      if $migrations.exit_code != 0 { fail "the deployed database's migrations do not match this build" ($migrations.stderr | str trim) }
    }
    step "content model"
    main schema diff
  }
  step "live state"
  if not (checks verify) { fail "the site does not match the repo" }
  print "✓ healthy"
}

# Ship it: check, build, deploy to Cloudflare, then verify what is live. --dry builds and bundles
# without deploying; --build-only stops after the build; --no-check skips the gate.
def "main deploy" [--dry, --build-only, --no-check] {
  let cloudflare = (on-cloudflare)
  let mode = (if $build_only or ((not $cloudflare) and $dry) { "build" } else if $dry { "dry" } else { "deploy" })
  if $cloudflare and $mode == "deploy" and (setting DEPLOY_URL | is-empty) { fail "DEPLOY_URL is not set in mise.toml" }
  if $cloudflare and $mode == "deploy" and (not (site deployed-has-key)) {
    fail "the deployment has no EMDASH_ENCRYPTION_KEY — secret plugin settings would fail" "make one (mise run emdash -- secrets generate), store it safely, then: cd site; fnox exec -- pnpm exec wrangler secret put EMDASH_ENCRYPTION_KEY"
  }
  if $mode == "deploy" and (not $no_check) {
    step "check — nothing ships that fails it"
    main check
  }
  step "prepare"
  site prepare (plugin current-registration)
  if $cloudflare and $mode == "deploy" {
    # Where the database stands before this build's migrations run. None on a first deploy.
    let bookmark = (site d1-bookmark)
    if ($bookmark | is-not-empty) {
      print $"  the database before this deploy is Time Travel bookmark ($bookmark)"
      print $"  to go back to it: cd site; fnox exec -- pnpm exec wrangler d1 time-travel restore (site d1-name) --bookmark=($bookmark)"
    }
  }
  step $mode
  let rc = (site ship $mode)
  if $rc != 0 { fail $"($mode) failed" }
  if $mode == "deploy" and $cloudflare {
    step "verify what is live"
    main doctor --url $env.DEPLOY_URL
    print $"✓ live at ($env.DEPLOY_URL)"
  } else if $mode == "deploy" {
    # A Node build runs anywhere Node does; the harness does not choose your host.
    print "✓ built → site/dist — start it with: node ./dist/server/entry.mjs"
    print "  once it is running somewhere: mise run doctor -- --url <where>"
  }
}

# Put the previous deployment back, then verify what is live.
def "main rollback" [] {
  if not (on-cloudflare) { fail "rollback is for Cloudflare deployments" "on Node, redeploy the previous build the way your host does it" }
  if (setting DEPLOY_URL | is-empty) { fail "DEPLOY_URL is not set in mise.toml" }
  step "rollback to the previous version"
  site wrangler rollback --yes --message "rollback via mise run rollback"
  print "  the previous Worker is live. A rollback does NOT undo database migrations: if the build you"
  print "  just left ran one, the database is ahead of this code — restore the database with it."
  main doctor --url $env.DEPLOY_URL
}

# The backup a site package is not: the database itself — users, tokens and plugin data included —
# and, locally, the media beside it. A deployment's is its D1: a Time Travel bookmark and a dump.
def backup [] {
  let wrangler = "cd site; fnox exec -- pnpm exec wrangler"
  if (setting EMDASH_URL | is-empty) {
    let was_running = (daemon-running $env.SITE_DAEMON)
    let dir = (backup-local-data "site" | path relative-to $env.ROOT)
    if $was_running { site restart }
    ok $"database and media → ($dir)"
    print "    everything the local site stores. NOT the key in site/.env that reads secret plugin"
    print "    settings — keep a copy of that somewhere else."
    print $"    to put it back: mise run restore -- ($dir) --confirm"
    return
  }
  if not (on-cloudflare) {
    fail "a Node deployment's database is a file on its host, which the harness cannot reach" "there: stop the server, then copy data.db with data.db-wal and data.db-shm, and uploads/, together"
  }
  let name = (site d1-name)
  let bookmark = (site d1-bookmark)
  if ($bookmark | is-empty) { fail $"Cloudflare gave no Time Travel bookmark for ($name)" $"see why: ($wrangler) d1 time-travel info ($name)" }
  let dir = (backup-dir $name)
  let dump = ($dir | path join "database.sql")
  site wrangler d1 export $name --remote --output $dump
  let notes = [
    $"($name), as it was at (date now | format date '%Y-%m-%dT%H:%M:%S%:z') — ($env.EMDASH_URL), EmDash ($env.EMDASH_VERSION)"
    ""
    "Back to that moment, in place — the whole database. Stop writes first, and deploy the build that matches:"
    $"  ($wrangler) d1 time-travel restore ($name) --bookmark=($bookmark)"
    ""
    "Or from the dump — into a NEW, EMPTY database, never the existing one; then point the binding at it:"
    $"  ($wrangler) d1 execute <new-database> --remote --file=($dump)"
    ""
    "NOT in either: the media bucket, and EMDASH_ENCRYPTION_KEY. Copy the bucket with any S3 client:"
    "  aws s3 sync s3://<bucket> ./media --endpoint-url https://<account-id>.r2.cloudflarestorage.com"
  ]
  $notes | str join (char nl) | save ($dir | path join "restore.txt")
  ok $"bookmark and dump → ($dir | path relative-to $env.ROOT)"
  for line in $notes { print $"    ($line)" }
}

# Save the site — schema, content and media — as a .emdash package. --database takes a real backup
# instead: the database itself. --url does either for a deployment.
def "main snapshot" [--url: string, --database] {
  target $url
  if $database { backup; return }
  let dest = ($env.RUN_DIR | path join "snapshots" $"(date now | format date '%Y%m%d-%H%M%S').emdash")
  mkdir ($dest | path dirname)
  emdash site export --output $dest
  ok $"saved → ($dest)"
  print "    a site package: schema, content and media. NOT users, tokens, plugin data or secrets —"
  print "    for those: mise run snapshot -- --database. It does carry authors' emails: keep it private."
}

# Restore a snapshot into an EMPTY site. Shows the plan; --confirm executes exactly that plan.
# --wipe empties the LOCAL database first, so a local restore is one command. Given a backup
# directory instead of a package, it puts that database and media back in place of the local ones.
def "main restore" [package: string, --confirm, --wipe, --url: string] {
  target $url
  let pkg = ($package | path expand)
  if not ($pkg | path exists) { fail $"no such package: ($pkg)" }
  if ($pkg | path type) == "dir" {
    if (setting EMDASH_URL | is-not-empty) { fail "a backup directory goes back into the local site" "for a deployment, follow the restore.txt beside its dump" }
    if not $confirm { print "  this REPLACES the local database and media with that copy — add --confirm"; return }
    # Going back to another EmDash: its install comes first, because that step keeps a copy of the
    # data about to be replaced, labelled with the version it is on.
    site sync-version
    step "replace the local database and media"
    restore-local-data $pkg
    main dev
    ok "restored — users, tokens and plugin data are as they were then"
    return
  }
  if $wipe {
    if (setting EMDASH_URL | is-not-empty) { fail "--wipe only empties the local site" }
    if not $confirm { fail "--wipe destroys the local database — pass --confirm as well" }
    step "wipe the local database"
    wipe-local-data
    # Empty: a site that already has entries cannot receive a package.
    site restart --empty
  }
  let analysis = (emdash-result site import $pkg --analyze --json)
  if $analysis.exit_code != 0 {
    let hint = (if (setting EMDASH_URL | is-empty) { "the target must be empty — add: --wipe --confirm" } else { "a deployment must be set up and hold no entries, and DEPLOY_TOKEN be a token it accepts — or sign in: mise run emdash -- login --url <deployment>" })
    fail $"the package cannot be imported here: ($analysis.stdout | str trim) ($analysis.stderr | str trim)" $hint
  }
  let planned = ($analysis.stdout | from json)
  if ($planned | get -o plan | is-empty) {
    let state = ($planned | get -o state | default "")
    if $state == "complete" { ok "this package is already imported here"; return }
    # No plan and no error: an import of this package was cut off while it was writing. (One cut
    # off earlier — uploading, analysing — is picked up by the analysis above.)
    if ($planned | get -o operationId | is-empty) { fail $"no import plan came back: ($planned | to json --raw)" }
    if not $confirm { print "  an import of this package was started here and never finished — add --confirm to finish it"; return }
    step "finish the interrupted import"
    emdash site import resume $planned.operationId
    ok "restored — check it: mise run doctor"
    return
  }
  print ($planned.plan.counts | transpose what count | where count > 0 | table --index false)
  let blockers = ($planned.plan | get -o blockers | default [])
  if ($blockers | is-not-empty) { fail $"the plan has blockers: ($blockers | to json --raw)" }
  if not $confirm { print "  nothing imported — add --confirm to execute this plan"; return }
  emdash site import $pkg --plan $planned.planDigest --confirm
  ok "restored — check it: mise run doctor"
}

# Wipe the local database and uploads, and bring the site back up on its seed. Your site/ stays.
def "main reset" [] {
  wipe-local-data
  main dev
}

# Follow logs: the site by default, another daemon by name, or --deployed for the live Worker.
def "main logs" [daemon?: string, --deployed] {
  if $deployed and (not (on-cloudflare)) { fail "--deployed follows a Cloudflare Worker" "on Node, read the logs where your host keeps them" }
  if $deployed { site wrangler tail --format pretty } else { ^mise daemons logs ($daemon | default $env.SITE_DAEMON) --follow }
}

# Open the admin in a browser, signed in.
def "main open" [] { start (site admin-url) }

# Scaffold a plugin with the official CLI, fit it to this site, load it, and have the RUNNING site
# call it. When this prints ✓ the plugin is live.
def "main plugin new" [name: string] {
  if not (site enable-local-plugins) {
    fail "site/astro.config.mjs does not load local plugins, and is not shaped like a template's" "three edits, shown in docs/plugin.md § Enabling plugins"
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
  plugin require-consistent
  if (plugin dirs | is-empty) { print "  no plugins to release — make one: mise run plugin:new -- <name>"; return }
  for script in [validate typecheck test build bundle] { plugin sweep $script $name }
  print "✓ bundled — publish with: mise run emdash-plugin -- publish --manifest plugins/<name>"
}

# Set fields on a live entry: reads its revision, updates, publishes. --url targets a deployment.
def "main content set" [collection: string, entry: string, json: string, --url: string] {
  target $url
  let rev = (emdash-json content get $collection $entry | get -o _rev | default "")
  if ($rev | is-empty) { fail $"no revision for ($collection)/($entry)" }
  emdash content update $collection $entry $"--rev=($rev)" --data $json
}

# Compare the repo's content model with the running site's, or with a deployment's (--url).
def "main schema diff" [--url: string] {
  target $url
  if not (checks schema-diff) { exit 1 }
}

# Export the running site's model and content as a seed, to compare with the project's.
def "main seed export" [] {
  let dest = ($env.RUN_DIR | path join "seed.live.json")
  emdash export-seed --database (devdb) --with-content=all | save -f $dest
  ok "exported → run/seed.live.json — compare it with site/seed/seed.json"
}

# Start the local plugin registry and point the site at it. Builds the EmDash monorepo the first time.
def "main registry up" [] {
  let line = "registry: process.env.EMDASH_REGISTRY_URL,"
  if not (site enable-local-registry) {
    fail "site/astro.config.mjs passes no registry to EmDash, and is not shaped like a template's" $"add to its emdash\({ … }) options, beside a sandboxRunner:  ($line)"
  }
  step "prepare the registry"
  registry prepare
  ^mise daemons start registry
  if not (wait-for $"(registry-url)/health" 120) {
    print --stderr (daemon-log registry)
    fail "the registry did not answer within 120s" "its last log lines are above"
  }
  step "fill the registry from the published plugins — the label replay takes a few minutes"
  registry admin "/_admin/backfill"
  registry admin "/_admin/labels/replay"
  site restart
  # EmDash tells its admin which registry to ask; that is the one the site uses.
  let token = (open --raw ($env.RUN_DIR | path join "token-admin.txt") | str trim)
  let used = (request GET $"(site-url)/_emdash/api/manifest" --headers {Authorization: $"Bearer ($token)"} | get -o body.data.registry.aggregatorUrl | default "none")
  if $used != (registry-url) { fail $"the registry is up at (registry-url), but the site uses ($used)" $"site/astro.config.mjs must hold:  ($line)" }
  ok $"registry at (registry-url) — the site now discovers plugins from it"
}

# Stop the local registry and point the site back at the hosted one.
def "main registry down" [] {
  daemon-stop "registry" $env.REGISTRY_PORT
  site restart
  ok "registry stopped — the site uses the hosted registry"
}

# Take a newer harness from emdash-run: nu/ and the harness mise config are replaced wholesale —
# they hold nothing of the project's — and then check says whether the project still holds together.
# With no version it takes the latest release; `-- main` takes the development branch.
def "main upgrade" [ref?: string, --from: string] {
  let repo = ($from | default $env.HARNESS_REPO)
  let latest = ((^git ls-remote --tags --refs --sort=-v:refname $repo "v*" | complete).stdout | lines | get -o 0 | default "" | split row "/" | last)
  let target = ($ref | default (if ($latest | is-empty) { "main" } else { $latest }))
  let scratch = ($env.RUN_DIR | path join "upgrade")
  rm -rf $scratch
  mkdir $env.RUN_DIR
  step $"fetch ($repo) @ ($target)"
  ^git clone --quiet --depth 1 --branch $target $repo $scratch
  let incoming = (open ($scratch | path join ".config" "mise" "conf.d" "harness.toml") | get env.HARNESS_VERSION)
  rm -rf ($env.ROOT | path join "nu")
  cp -r ($scratch | path join "nu") ($env.ROOT | path join "nu")
  cp ($scratch | path join ".config" "mise" "conf.d" "harness.toml") (harness-file)
  try { rm -rf $scratch }
  ok $"harness ($env.HARNESS_VERSION) → ($incoming)"
  # Through mise, not `main check`: this process is still the OLD harness.
  step "check, on the new harness"
  ^mise run check
  print "✓ upgraded — review with git diff, then: mise run dev"
}

# Does this project work on THIS machine? The minimum that answers it: bring the site up, run the
# checks, ask doctor. It is what CI runs on every OS. --full adds the slower flows: a plugin round
# trip, a snapshot, and a production build.
def "main verify" [--full, --restore] {
  step "bring the site up"
  # A fresh clone has site/ but nothing installed, so "is there a site" is the wrong question.
  if (site installed-version | is-empty) { main setup } else { main dev }
  step "check"
  main check
  step "doctor"
  main doctor
  if $full {
    step "plugin round trip"
    main plugin roundtrip
    step "snapshot"
    main snapshot
    step "deploy --dry"
    main deploy --dry
  }
  # Wipes the local database and restores it from the snapshot just taken. Local users, tokens and
  # plugin data are not in a package, so this is opt-in: CI and throwaway projects use it.
  if $restore {
    step "snapshot, wipe, restore"
    main snapshot
    main restore (ls ($env.RUN_DIR | path join "snapshots") | sort-by modified | last | get name) --wipe --confirm
    main doctor
    # An entry is edited first, and the database wiped after the backup: a restore that put
    # nothing back would leave a freshly seeded site, without the edit.
    step "back up the database, wipe, put it back"
    main upgrade-probe mark
    main snapshot --database
    wipe-local-data
    main restore (ls ($env.RUN_DIR | path join "backups") | sort-by modified | last | get name) --confirm
    main upgrade-probe find
    main doctor
  }
  print $"✓ verified on ($nu.os-info.name) ($nu.os-info.arch)(if $full { ' — site, checks, doctor, plugins, snapshot, build' } else { ' — site, checks, doctor' })"
}

# Does the harness work for a project on ANOTHER template? Builds a throwaway project from this
# checkout's harness with that template and runs `verify` in it. This is how the Node.js path is
# proven from a repo whose own project is on Cloudflare — CI runs it with `starter`. --from <version>
# proves an EmDash upgrade instead: data and a plugin made on the older version survive the move.
def "main verify template" [template: string, --full, --from: string] {
  # A fresh directory every time: on Windows a just-stopped site can still hold its files open,
  # so neither reusing nor deleting a previous run's directory is safe.
  let scratch = ($nu.temp-dir | path join "emdash-run-verify")
  # Earlier runs' directories, best effort: Windows may still hold one open. Only old ones — a
  # recent one may be another checkout's run, still going.
  if ($scratch | path exists) { for old in (ls $scratch | where modified < ((date now) - 6hr) | get name) { try { rm -rf $old } } }
  let dir = ($scratch | path join $"($template)-(random chars --length 6)")
  mkdir ($dir | path join ".config" "mise" "conf.d")
  cp -r ($env.ROOT | path join "nu") ($dir | path join "nu")
  cp (harness-file) ($dir | path join ".config" "mise" "conf.d" "harness.toml")
  (open --raw ($env.ROOT | path join "nu" "project.example.toml")
    | str replace --regex 'TEMPLATE = "[^"]*"' $"TEMPLATE = \"($template)\""
    | save ($dir | path join "mise.toml"))
  ^git init --quiet $dir
  let rc = (code {
    cd $dir
    ^mise trust --all --quiet
    # A port of its own, free right now, so it runs beside this site and anyone else's.
    let free = (port)
    ^mise set $"SITE_PORT=($free)"
    ^mise fmt
    if $from != null {
      # An upgrade: come up on the older EmDash with a plugin, mark an entry, move to this version,
      # then find the mark and have the site call the plugin.
      ^mise set $"EMDASH_VERSION=($from)"
      ^mise run setup
      ^mise run plugin:new -- upgraded
      ^mise run upgrade-probe -- mark
      ^mise set $"EMDASH_VERSION=($env.EMDASH_VERSION)"
      ^mise run dev
      ^mise run upgrade-probe -- find
      ^mise run plugin:probe -- upgraded
      ^mise run doctor
    } else if $full { ^mise run verify -- --full --restore } else { ^mise run verify }
  })
  do { cd $dir; ^mise daemons stop --all | complete | ignore }
  if $rc != 0 { fail $"the harness does not verify on the ($template) template" $"the project is left in ($dir)" }
  try { rm -rf $dir }
  print $"✓ the harness works on the ($template) template"
}

# The two halves of a "the data survived" proof: `mark` writes a recognisable title into the first
# page, `find` fails unless it is still there. Run by verify:template --from around an upgrade, and
# by verify --restore around a backup, a wipe and a restore.
def "main upgrade-probe" [step: string] {
  let page = (emdash-json content list pages | get items.0.slug)
  if $step == "mark" {
    main content set pages $page '{"title":"survived"}'
  } else if (emdash-json content get pages $page | get data.title) != "survived" {
    fail "the entry edited beforehand is not there afterwards"
  } else { ok "the entry edited beforehand is still there" }
}

# The same verification on a clean Linux machine: a container with only git and mise, and a fresh
# clone of this checkout. Needs docker; the host can be any OS.
def "main verify linux" [] {
  let script = ([
    "export DEBIAN_FRONTEND=noninteractive"
    "apt-get update -qq >/tmp/apt.log && apt-get install -y -qq curl git ca-certificates xz-utils unzip procps libatomic1 >>/tmp/apt.log"
    "curl -fsSL https://mise.run -o /tmp/install-mise.sh && sh /tmp/install-mise.sh >/tmp/mise.log 2>&1"
    "export PATH=$HOME/.local/bin:$PATH"
    "git config --global --add safe.directory '*'"
    "git clone -q /src /work && cd /work && mise trust --all -q && mise run verify -- --full"
  ] | str join (char nl))
  step "a clean Debian container — this takes about five minutes"
  ^docker run --rm -v $"($env.ROOT):/src:ro" debian:stable-slim bash -c $script
}

# Clone the EmDash source at the version the site runs, into .src/emdash, for reading.
def "main source" [name: string = "emdash"] { site clone-source $name }

# The official CLIs, any arguments. Wrapped, so flags go to the CLI rather than being parsed here.
def --wrapped "main emdash" [...args: string] { emdash ...$args }
def --wrapped "main emdash-plugin" [...args: string] { plugin cli ...$args }
def --wrapped "main skills" [...args: string] { dlx [$"skills@($env.SKILLS_VERSION)"] skills ...$args }

# Prints its arguments as JSON. `check` calls it through mise to prove arguments reach commands.
def --wrapped "main args" [...args: string] { print ($args | to json --raw) }

# What the daemons run. Not for typing: `mise run dev` and `mise run registry:up` start them.
def "main daemon site" [] { site serve }
def "main daemon registry" [] { registry serve }

def main [] { print "run a task: mise tasks ls" }
