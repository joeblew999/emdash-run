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
  let missing = ([".src/" "/run/" "node_modules/" "/.claude/skills/" "/config/seed.live.json"] | where {|line| not ($line in $have) })
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
    ["@emdash-cms/sandbox-workerd" "workerd"]
  })
  # Packages our site config imports, declared in settings rather than edited into the template.
  let extra = (setting SITE_PACKAGES | split row " " | where {|p| $p | is-not-empty } | append $runner)
  if ($extra | is-not-empty) { ^pnpm --dir $env.SITE_DIR add ...$extra }
  # The template's tsconfig asks for node types it never depends on.
  ^pnpm --dir $env.SITE_DIR add -D @types/node
  ok $"site installed — emdash@($env.EMDASH_VERSION)"
}

# Merge the template's seed with the project's. Pure: records in, record out — see tests.nu.
#
# The rules are deliberately not uniform:
#   collections, taxonomies       a collision goes to the TEMPLATE
#   content                       a collision goes to the PROJECT (its ids are namespaced)
#   menus, widgetAreas, settings  the template's, falling back to the project's
# Content is ordered dependency-first, because entries carry `$ref:` values that must already exist.
export def merge-seeds [base: record, project: record, order: list<string>, label: string]: nothing -> record {
  def union [project_items: list, base_items: list, key: string] {
    mut acc = {}
    for item in $project_items { $acc = ($acc | upsert ($item | get $key) $item) }
    for item in $base_items { $acc = ($acc | upsert ($item | get $key) $item) }
    $acc | values
  }
  def pick [key: string, fallback: any] {
    $base | get -o $key | default ($project | get -o $key | default $fallback)
  }

  let project_content = ($project | get -o content | default {})
  let base_content = ($base | get -o content | default {})
  let keys = (
    $order
    | append ($project_content | columns | where {|k| not ($k in $order) })
    | append ($base_content | columns)
    | uniq
  )
  mut content = {}
  mut seen = []
  for key in $keys {
    let entries = (($project_content | get -o $key | default []) | append ($base_content | get -o $key | default []))
    mut kept = []
    for entry in $entries {
      let id = ($entry | get -o id)
      if ($id | is-empty) {
        $kept = ($kept | append $entry)
      } else if not ($id in $seen) {
        $seen = ($seen | append $id)
        $kept = ($kept | append $entry)
      }
    }
    $content = ($content | upsert $key $kept)
  }

  let base_meta = ($base | get -o meta | default {})
  let site_name = ($base_meta | get -o name | default "Site")
  let description = (
    [($base_meta | get -o description | default "") ($project | get -o meta | default {} | get -o description | default "")]
    | where {|part| $part | is-not-empty }
    | str join " — "
  )
  let name = (if ($label | is-empty) { $site_name } else { $"($site_name) + ($label)" })

  let merged = (
    {}
    | insert '$schema' (pick '$schema' "")
    | insert version (pick version "1")
    | insert meta ($base_meta | upsert name $name | upsert description $description)
    | insert settings (pick settings {})
    | insert collections (union ($project | get -o collections | default []) ($base | get -o collections | default []) "slug")
    | insert taxonomies (union ($project | get -o taxonomies | default []) ($base | get -o taxonomies | default []) "name")
    | insert menus (pick menus [])
    | insert widgetAreas (pick widgetAreas [])
    | insert content $content
  )
  # Every other top-level key a seed carries — bylines, redirects, whatever a template adds next —
  # passes through: the template's, falling back to the project's. Dropping an unknown key silently
  # broke the blog template, whose posts reference bylines.
  ($base | columns) | append ($project | columns) | uniq | where {|key| not ($key in ($merged | columns)) }
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
  let fresh = (not ($env.ROOT | path join "config" "site.astro.config.mjs" | path exists))
  for pair in $pairs {
    let ours = ($env.ROOT | path join "config" ($pair | first))
    if not ($ours | path exists) {
      mkdir ($ours | path dirname)
      cp ($env.TEMPLATES_DIR | path join $env.TEMPLATE ($pair | last)) $ours
      ok $"config/($pair | first) ← the template's — it is yours to edit now"
    }
  }
  # A project starting from the template gets plugin loading switched on, so plugin:new just works.
  # Only then: once config/ exists it is the project's, and plugin:new asks before it needs it.
  if $fresh { enable-local-plugins | ignore }
  for pair in $pairs { cp ($env.ROOT | path join "config" ($pair | first)) (site-file ($pair | last)) }
  $registration | save --force (site-file "local-plugins.mjs")
  build-seed
}

# Get the seed into the RUNNING site's database, updating entries that already exist. The site's
# own first-request seeding skips anything that exists, so edits to the seed never land without this.
export def apply-seed [] {
  emdash seed seed/seed.json --database (devdb) --on-conflict=update
  if (on-cloudflare) { uploads-to-r2 }
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

# (Re)start the dev server and wait until it has migrated and answers.
export def restart [] {
  daemon-stop $env.SITE_DAEMON
  rm -rf (site-file "node_modules" ".vite")
  ^mise daemons start $env.SITE_DAEMON
  for _ in 1..60 {
    if (request POST $"($env.SITE_URL)/_emdash/api/setup/dev-bypass").status in 200..399 { return }
    sleep 1sec
  }
  fail "the site did not answer within 60s" "see: mise run logs"
}

# Mint the admin API token the MCP server and `plugin:probe` use. Idempotent: the previous one is
# revoked, because EmDash shows a token's secret only once.
export def mint-token [] {
  mkdir $env.RUN_DIR
  let base = $"($env.SITE_URL)/_emdash/api"
  # dev-bypass signs us in on localhost; its session cookie authenticates the admin API.
  let session = (request POST $"($base)/setup/dev-bypass")
  if $session.status == 0 or ($session.cookies | is-empty) { fail "could not sign in to the site" "run: mise run dev" }
  let headers = {Cookie: $session.cookies, "X-EmDash-Request": "1"}
  let listed = (request GET $"($base)/admin/api-tokens" --headers $headers).body
  for old in ($listed | get -o data.items | default [] | where name == "token-admin") {
    request DELETE $"($base)/admin/api-tokens/($old.id)" --headers $headers | ignore
  }
  let created = (request POST $"($base)/admin/api-tokens" --headers $headers --body {name: "token-admin", scopes: ["admin"]}).body
  let token = ($created | get -o data.token | default "")
  if ($token | is-empty) { fail $"token creation failed: ($created | to json --raw)" }
  $"($token)(char nl)" | save -f ($env.RUN_DIR | path join "token-admin.txt")
  # mise loads this file into the environment; .mcp.json reads EMDASH_MCP_TOKEN from there.
  $"EMDASH_MCP_TOKEN=($token)(char nl)" | save -f ($env.RUN_DIR | path join "token-admin.env")
  ok "admin token → run/token-admin.txt"
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
