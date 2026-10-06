# The host site: the official template in .src/site, our config on top, its seed, its dev server.
use lib.nu *

def site-file [...parts: string]: nothing -> string { $env.SITE_DIR | path join ...$parts }

# Shallow clone, or update, at one ref.
def checkout [repo: string, dir: string, ref: string] {
  mkdir ($dir | path dirname)
  if ($dir | path join ".git" | path exists) {
    ^git -C $dir fetch --quiet --depth 1 origin $ref
    ^git -C $dir checkout -q FETCH_HEAD
  } else {
    ^git clone --quiet --depth 1 --branch $ref $repo $dir
  }
}

# What the harness generates must not be committed. Adds any missing line to the project's .gitignore.
export def ensure-ignored [] {
  let file = ($env.ROOT | path join ".gitignore")
  let have = (if ($file | path exists) { open --raw $file | lines } else { [] })
  let missing = ([".src/" "/run/" "node_modules/" ".env" "/.claude/skills/" "/config/seed.live.json"] | where {|line| not ($line in $have) })
  if ($missing | is-not-empty) {
    $"($missing | str join (char nl))(char nl)" | save --append $file
    ok $".gitignore ← ($missing | str join ' ')"
  }
}

export def clone-templates [] {
  checkout $env.TEMPLATES_REPO $env.TEMPLATES_DIR "main"
  ok $"templates @ (^git -C $env.TEMPLATES_DIR rev-parse --short HEAD | str trim)"
}

# The EmDash monorepo at the version the site runs — for reading its source, and for the registry.
export def clone-emdash [] {
  let tag = $"emdash@($env.EMDASH_VERSION)"
  checkout $env.EMDASH_REPO $env.EMDASH_DIR $tag
  ok $"emdash source @ ($tag) → .src/emdash"
}

# A pristine copy of the template. Never edited by hand: config comes from config/, by `configure`.
export def copy-template [] {
  let src = ($env.TEMPLATES_DIR | path join $env.TEMPLATE)
  if not ($src | path exists) {
    fail $"template ($env.TEMPLATE) not found" $"available: (ls $env.TEMPLATES_DIR | where type == dir | get name | each {|p| $p | path basename } | str join ' ')"
  }
  rm -rf $env.SITE_DIR
  cp -r $src $env.SITE_DIR
  # mise provides pnpm, so the template's own packageManager pin goes.
  open (site-file "package.json") | reject -o packageManager | to json --indent 4 | save -f (site-file "package.json")
  ok $"site ← ($env.TEMPLATE)"
}

export def install [] {
  ^pnpm --dir $env.SITE_DIR install
  # Pin EmDash exactly: the template ships floating ranges that drift on every install.
  mut pkg = (open (site-file "package.json"))
  $pkg.dependencies.emdash = $env.EMDASH_VERSION
  if "@emdash-cms/cloudflare" in ($pkg.dependencies | columns) { $pkg.dependencies."@emdash-cms/cloudflare" = $env.EMDASH_VERSION }
  $pkg | to json --indent 4 | save -f (site-file "package.json")
  # On Node, sandboxed plugins run in workerd, which the Node templates do not ship: add the runner
  # and let its binary install. (On Cloudflare the platform is the runner.)
  let runner = (if (on-cloudflare) { [] } else {
    let workspace = (site-file "pnpm-workspace.yaml")
    open $workspace | upsert allowBuilds {|w| $w | get -o allowBuilds | default {} | upsert workerd true } | to yaml | save -f $workspace
    [$"@emdash-cms/sandbox-workerd@(version-set | get '@emdash-cms/sandbox-workerd')" "workerd"]
  })
  # Packages our site config imports, declared in settings rather than edited into the template.
  let extra = (setting SITE_PACKAGES | split row " " | where {|p| $p | is-not-empty } | append $runner)
  if ($extra | is-not-empty) { ^pnpm --dir $env.SITE_DIR add ...$extra }
  # The template's tsconfig asks for node types it never depends on.
  ^pnpm --dir $env.SITE_DIR add -D @types/node
  ok $"site installed — emdash@($env.EMDASH_VERSION)"
}

# The key EmDash encrypts secret plugin settings with. Made once into the project's own .env
# (gitignored — back it up: a database backup does not contain it) and copied to the site, where the
# dev server reads it. Without one, secret settings fail closed.
export def ensure-key [] {
  let ours = ($env.ROOT | path join ".env")
  if not (($ours | path exists) and (open --raw $ours | str contains "EMDASH_ENCRYPTION_KEY=")) {
    emdash secrets generate --write $ours
    ok ".env ← a new EMDASH_ENCRYPTION_KEY — keep a copy somewhere safe"
  }
  cp $ours (site-file ".env")
}

# Does the deployed Worker have an encryption key? Its value cannot be read back, only its presence.
export def deployed-has-key []: nothing -> bool {
  let listed = (do { cd $env.SITE_DIR; ^fnox exec -- pnpm exec wrangler secret list | complete })
  $listed.exit_code == 0 and ($listed.stdout | str contains "EMDASH_ENCRYPTION_KEY")
}

# The EmDash the site has installed, or "" before the first install.
export def installed-version []: nothing -> string {
  let pkg = (site-file "node_modules" "emdash" "package.json")
  if ($pkg | path exists) { open $pkg | get version } else { "" }
}

# Upgrading EmDash is changing EMDASH_VERSION and running `dev`. When the installed version differs,
# keep a copy of the local database first — EmDash's migrations only go forward — then re-pin and
# install in place. The site, and its data, stay.
export def sync-version []: nothing -> bool {
  let have = (installed-version)
  if ($have | is-empty) or $have == $env.EMDASH_VERSION { return false }
  step $"EmDash ($have) → ($env.EMDASH_VERSION)"
  version-set | ignore
  if (has-devdb) {
    let backup = ($env.RUN_DIR | path join "backups" $"emdash-($have)-(date now | format date '%Y%m%d-%H%M%S')")
    mkdir $backup
    cp (devdb) $backup
    ok $"database as it was on ($have) → ($backup | path relative-to $env.ROOT)"
    print $"    to go back: set EMDASH_VERSION to ($have), put that file back, run mise run dev — both, together"
  }
  install
  true
}

# Merge the template's seed with the project's. Pure — see tests.nu. Keyed lists are unioned and a
# collision goes to the TEMPLATE. Content is the exception: the PROJECT wins, and it is ordered
# dependency-first, because entries carry `$ref:` values that must already exist.
export def merge-seeds [base: record, project: record, order: list<string>, label: string]: nothing -> record {
  def items [seed: record, key: string] { $seed | get -o $key | default [] }
  def pick [key: string, fallback: any] { $base | get -o $key | default ($project | get -o $key | default $fallback) }
  # The later item wins, so the template goes last. An item without the id cannot collide.
  def union [key: string, id: string] {
    items $project $key | append (items $base $key)
    | reduce --fold {} {|item, acc| $acc | upsert ($item | get -o $id | default ($item | to json --raw) | into string) $item }
    | values
  }
  let ours = ($project | get -o content | default {})
  let theirs = ($base | get -o content | default {})
  # The first entry with an id wins, across all collections; the project's are read first.
  let content = ($order | append ($ours | columns) | append ($theirs | columns) | uniq | reduce --fold {seen: [], out: {}} {|key, acc|
    let kept = (items $ours $key | append (items $theirs $key) | reduce --fold {seen: $acc.seen, rows: []} {|entry, got|
      let id = ($entry | get -o id)
      if ($id | is-not-empty) and ($id in $got.seen) { $got } else {
        {seen: (if ($id | is-empty) { $got.seen } else { $got.seen | append $id }), rows: ($got.rows | append $entry)}
      }
    })
    {seen: $kept.seen, out: ($acc.out | upsert $key $kept.rows)}
  } | get out)

  let meta = ($base | get -o meta | default {})
  let name = ($meta | get -o name | default "Site")
  let description = (
    [($meta | get -o description | default "") ($project | get -o meta | default {} | get -o description | default "")]
    | where {|part| $part | is-not-empty } | str join " — "
  )
  let always = {collections: "slug", taxonomies: "name", menus: "name", widgetAreas: "name"}
  let if_present = {redirects: "source", sections: "slug", blockTypes: "slug", relations: "slug", bylines: "id"}
  let head = (
    {} | insert '$schema' (pick '$schema' "") | insert version (pick version "1")
    | insert meta ($meta | upsert name (if ($label | is-empty) { $name } else { $"($name) + ($label)" }) | upsert description $description)
    | insert settings (pick settings {})
  )
  let merged = (
    $always | transpose key id | reduce --fold $head {|l, acc| $acc | insert $l.key (union $l.key $l.id) }
    | insert content $content
  )
  let merged = (
    $if_present | transpose key id | where {|l| (items $base $l.key | append (items $project $l.key)) | is-not-empty }
    | reduce --fold $merged {|l, acc| $acc | insert $l.key (union $l.key $l.id) }
  )
  # Anything else a seed carries passes through: the template's, falling back to the project's.
  let known = ($merged | columns)
  ($base | columns) | append ($project | columns) | uniq | where {|key| not ($key in $known) }
  | reduce --fold $merged {|key, acc| $acc | insert $key (pick $key null) }
}

# Does the project's site config load local plugins? plugin:new needs it to.
export def loads-local-plugins []: nothing -> bool {
  open --raw ($env.ROOT | path join "config" "site.astro.config.mjs") | str contains "local-plugins.mjs"
}

# Make the project's site config load local plugins — sandboxed, on either platform: Cloudflare's
# Worker Loader, or workerd under Node. Edits the official templates' config; returns false,
# changing nothing, when the config is not shaped like a template's (then docs/plugin.md says how).
export def enable-local-plugins []: nothing -> bool {
  if (loads-local-plugins) { return true }
  let astro = ($env.ROOT | path join "config" "site.astro.config.mjs")
  let config = (open --raw $astro)
  let load = 'import { sandboxed as localSandboxed } from "./local-plugins.mjs";'
  let tabs = (char tab | fill --character (char tab) --width 3)
  let registered = $"($tabs)// Local plugins from plugins/ — generated by the harness.(char nl)($tabs)sandboxed: [...localSandboxed],"
  if (on-cloudflare) {
    let wrangler = ($env.ROOT | path join "config" "site.wrangler.jsonc")
    let import_line = 'import { d1, r2 } from "@emdash-cms/cloudflare";'
    let anchor = 'storage: r2({ binding: "MEDIA" }),'
    let loader_line = '// "worker_loaders": [{ "binding": "LOADER" }],'
    let bindings = (open --raw $wrangler)
    let has_loader = ($bindings | str contains $loader_line) or ($bindings | str contains '"worker_loaders"')
    if not (($config | str contains $import_line) and ($config | str contains $anchor) and $has_loader) { return false }
    $config
    | str replace $import_line $"import { d1, r2, sandbox } from \"@emdash-cms/cloudflare\";(char nl)($load)"
    | str replace $anchor $"($anchor)(char nl)($registered)(char nl)($tabs)sandboxRunner: sandbox\(\),"
    | save --force $astro
    $bindings | str replace $loader_line '"worker_loaders": [{ "binding": "LOADER" }],' | save --force $wrangler
  } else {
    let import_line = 'import { sqlite } from "emdash/db";'
    let anchor = 'database: sqlite({ url: "file:./data.db" }),'
    if not (($config | str contains $import_line) and ($config | str contains $anchor)) { return false }
    $config
    | str replace $import_line $"($import_line)(char nl)($load)"
    | str replace $anchor $"($anchor)(char nl)($registered)(char nl)($tabs)sandboxRunner: \"@emdash-cms/sandbox-workerd/sandbox\","
    | save --force $astro
  }
  ok "config/ now loads local plugins"
  if (on-cloudflare) { print "    this switches on the Worker Loader binding — deploying with it needs the Workers Paid plan" }
  true
}

# The project's own seed, or {} when the project has none and runs on the template's alone.
export def project-seed []: nothing -> record {
  let file = (setting SEED_FILE)
  if ($file | is-not-empty) and ($file | path exists) { open $file } else { {} }
}

def seed-order []: nothing -> list<string> { setting SEED_ORDER | split row ":" | where {|k| $k | is-not-empty } }

export def build-seed [] {
  let base = (open ($env.TEMPLATES_DIR | path join $env.TEMPLATE "seed" "seed.json"))
  let merged = (merge-seeds $base (project-seed) (seed-order) (setting SEED_LABEL))
  mkdir (site-file "seed")
  $merged | to json --indent 4 | save --force (site-file "seed" "seed.json")
  let total = ($merged.content | values | each {|list| $list | length } | append 0 | math sum)
  ok $"seed — ($merged.content | columns | length) collections, ($total) entries"
  # EmDash silently skips an invalid seed, so validate it here.
  emdash seed --validate seed/seed.json
}

# Our config over the template's, then the seed. `registration` is the generated plugin module.
export def configure [registration: string] {
  if not (site-file "package.json" | path exists) { fail ".src/site is missing" "run: mise run setup" }
  # config/ is the project's. A project that has none yet starts from the template's own files.
  # Only the Cloudflare templates have a wrangler.jsonc.
  let pairs = ([["site.astro.config.mjs" "astro.config.mjs"] ["site.wrangler.jsonc" "wrangler.jsonc"]]
    | where {|pair| $env.TEMPLATES_DIR | path join $env.TEMPLATE ($pair | last) | path exists })
  for pair in $pairs {
    let ours = ($env.ROOT | path join "config" ($pair | first))
    if not ($ours | path exists) {
      mkdir ($ours | path dirname)
      cp ($env.TEMPLATES_DIR | path join $env.TEMPLATE ($pair | last)) $ours
      ok $"config/($pair | first) ← the template's — it is yours to edit now"
    }
    cp $ours (site-file ($pair | last))
  }
  ensure-key
  $registration | save --force (site-file "local-plugins.mjs")
  build-seed
}

# Get the seed into the RUNNING site's database, updating entries that already exist. The site's
# own first-request seeding skips anything that exists, so edits to the seed never land without this.
# Carry seed EDITS into an existing database, and only when the seed has changed since it was last
# applied: re-applying overwrites admin edits and (until emdash#3919) duplicates every image. A
# fresh database needs nothing — the site has just seeded itself.
export def apply-seed [--fresh] {
  let seed = (site-file "seed" "seed.json")
  let mark = ($env.RUN_DIR | path join "seed-applied.txt")
  let db = (devdb)
  let now = $"(open --raw $seed | hash sha256) ($db)"
  mkdir $env.RUN_DIR
  if $fresh {
    $now | save --force $mark
    return
  }
  if ($mark | path exists) and (open --raw $mark | str trim) == $now {
    ok "seed unchanged since it was last applied"
    return
  }
  emdash seed seed/seed.json --database $db --on-conflict=update
  if (on-cloudflare) { uploads-to-r2 }
  $now | save --force $mark
}

# `emdash seed` always writes a seed's media files to ./uploads — right for Node, where the site
# reads them from there. A Cloudflare site reads local R2, so its seeded images would be rows with
# no file behind them: broken in the admin, and `snapshot` refuses to export them. Move them across.
def uploads-to-r2 [] {
  let uploads = (site-file "uploads")
  if not ($uploads | path exists) { return }
  let bucket = (open --raw (site-file "wrangler.jsonc") | parse --regex '"bucket_name"\s*:\s*"(?<name>[^"]+)"' | get -o name.0 | default "")
  if ($bucket | is-empty) { return }
  let types = {jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", avif: "image/avif", svg: "image/svg+xml", pdf: "application/pdf", mp4: "video/mp4"}
  cd $env.SITE_DIR
  for file in (ls $uploads | where type == file | get name) {
    let kind = ($types | get -o ($file | path parse | get extension | str lowercase) | default "application/octet-stream")
    let put = (^pnpm exec wrangler r2 object put $"($bucket)/($file | path basename)" --file $file --content-type $kind --local | complete)
    if $put.exit_code != 0 { fail $"could not copy ($file | path basename) into local R2: ($put.stderr | str trim)" }
    rm $file
  }
}

# (Re)start the dev server and make ONE call to EmDash's dev-bypass: it migrates, completes setup,
# seeds through the site's own storage, and with `?token=1` returns an admin token. `--empty` leaves
# the seed's content out, which a site must be to receive a restore. Bounded: two starts, then fail.
export def restart [--empty] {
  let query = (if $empty { "?token=1&content=0" } else { "?token=1" })
  for attempt in 1..2 {
    daemon-stop $env.SITE_DAEMON
    rm -rf (site-file "node_modules" ".vite")
    ^mise daemons start $env.SITE_DAEMON
    # Refused at once until the server listens (retried for 90s); once accepted, the call gets five
    # minutes — the first request compiles the site. Never many short calls: they starve it.
    let deadline = ((date now) + 90sec)
    mut setup: any = {status: 0, body: null}
    loop {
      $setup = (request POST $"($env.SITE_URL)/_emdash/api/setup/dev-bypass($query)" --timeout 5min)
      if $setup.status != 0 or (date now) > $deadline { break }
      sleep 1sec
    }
    let token = ($setup.body | get -o data.token | default "")
    if $setup.status in 200..299 and ($token | is-not-empty) {
      mkdir $env.RUN_DIR
      $"($token)(char nl)" | save -f ($env.RUN_DIR | path join "token-admin.txt")
      # mise loads this file into the environment; .mcp.json reads EMDASH_MCP_TOKEN from there.
      $"EMDASH_MCP_TOKEN=($token)(char nl)" | save -f ($env.RUN_DIR | path join "token-admin.env")
      return
    }
    print --stderr $"  setup answered ($setup.status): ($setup.body | to json --raw)"
    if $attempt == 1 { print "  the site is not ready — restarting it once more" }
  }
  print --stderr (daemon-log $env.SITE_DAEMON)
  fail "the site did not come up after two starts" "the last lines of its log are above; more: mise run logs"
}

export def admin-url []: nothing -> string { $"($env.SITE_URL)/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin" }

# What a dev can do next — printed when the site comes up.
export def next-steps [] {
  print ""
  print "  mise run open                     the admin, signed in"
  print "  mise run dev                      after you change config/, the seed, or a plugin"
  print "  mise run plugin:new -- <name>     scaffold a plugin and load it"
  print "  mise run emdash -- schema list    the official CLI, any command"
  print "  mise run status                   what is running, at a glance"
  print "  mise tasks ls                     everything else"
  print "  mise run report                   something broke? this prints what to paste into an issue"
}

export def urls [] {
  print $"  site    ($env.SITE_URL)"
  print $"  admin   (admin-url)"
  print $"  mcp     ($env.SITE_URL)/_emdash/api/mcp — bearer token in run/token-admin.txt"
  if (setting DEPLOY_URL | is-not-empty) { print $"  live    ($env.DEPLOY_URL)" }
}

# nushell's own `start` opens a URL with the default browser on every OS.
export def open-admin [] { start (admin-url) }

# The dev server itself — what the site daemon runs. Astro detaches into the background when it
# detects an AI-agent environment, which orphans it from the daemon manager; ASTRO_DEV_BACKGROUND
# keeps it in the foreground.
export def serve [] {
  $env.ASTRO_DEV_BACKGROUND = "1"
  # Plugin discovery uses the hosted registry unless the optional local one is really answering.
  if (answers $"($env.REGISTRY_URL)/health") { $env.EMDASH_REGISTRY_URL = $env.REGISTRY_URL }
  # Bound to IPv4 on purpose. Astro's default listens on [::1] only, and on Linux `localhost`
  # resolves to 127.0.0.1 first — so the emdash CLI was refused there while curl worked.
  ^pnpm --dir $env.SITE_DIR dev --host 127.0.0.1
}

# Type-check the site: astro check loads the config, tsc checks the config's types. Both re-run
# the Vite optimizer, so the dev server is paused around them.
export def typecheck []: nothing -> int {
  with-site-paused {
    ^pnpm --dir $env.SITE_DIR exec astro check
    (^pnpm --dir $env.SITE_DIR exec tsc --noEmit --ignoreConfig --allowJs --checkJs --moduleResolution bundler
      --module esnext --target es2022 --skipLibCheck (site-file "astro.config.mjs"))
  }
}

# Production build; on Cloudflare optionally a dry-run bundle or the real deploy. Returns the exit
# code. On Node the build IS the artefact — where it runs is the project's business.
export def ship [mode: string]: nothing -> int {
  let cloudflare = (on-cloudflare)
  with-site-paused {
    if (not $cloudflare) or $mode == "build" {
      ^pnpm --dir $env.SITE_DIR build
    } else if $mode == "dry" {
      ^pnpm --dir $env.SITE_DIR build
      do { cd $env.SITE_DIR; ^pnpm exec wrangler deploy --dry-run --outdir dist }
    } else {
      ^fnox exec -- pnpm --dir $env.SITE_DIR run deploy
    }
  }
}

# wrangler, with Cloudflare credentials, in the site.
export def --wrapped wrangler [...args: string] {
  cd $env.SITE_DIR
  ^fnox exec -- pnpm exec wrangler ...$args
}

# The deployed D1's name, from our wrangler config.
export def d1-name []: nothing -> string {
  let hits = (open --raw ($env.ROOT | path join "config" "site.wrangler.jsonc") | parse --regex '"database_name"\s*:\s*"(?<name>[^"]+)"')
  if ($hits | is-empty) { fail "no d1_databases[].database_name in config/site.wrangler.jsonc" }
  $hits | first | get name
}
