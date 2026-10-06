# Shared helpers — everything here is used by more than one flow.
# Paths and names come from the project's mise.toml, as environment variables.

export def step [text: string] { print $"→ ($text)" }
export def ok [text: string] { print $"  ✓ ($text)" }

# Stop the whole flow with a message, and optionally what to do about it.
export def fail [text: string, hint?: string] {
  print --stderr $"✗ ($text)"
  if $hint != null { print --stderr $"  ($hint)" }
  exit 1
}

# Run a block and return its exit code instead of aborting. A failing external command ends a
# nushell script on the spot, so anything that must keep going — cleanup, "show every problem" —
# runs its commands through this.
export def code [block: closure]: nothing -> int {
  try { do $block; 0 } catch {|err| $err | get -o exit_code | default 1 }
}

# The harness-owned mise config: tools, tasks, daemons.
export def harness-file []: nothing -> string { $env.ROOT | path join ".config" "mise" "conf.d" "harness.toml" }

# Split a shell-quoted string into its arguments — what mise puts in `usage_args`. POSIX quoting:
# single quotes are literal, double quotes allow backslash escapes, a backslash escapes one character.
export def split-args [text: string]: nothing -> list<string> {
  mut out = []
  mut word = ""
  mut in_word = false
  mut mode = "plain"
  mut escaped = false
  for ch in ($text | split chars) {
    if $escaped {
      $word += $ch
      $escaped = false
      $in_word = true
    } else if $mode == "single" {
      if $ch == "'" { $mode = "plain" } else { $word += $ch }
    } else if $mode == "double" {
      if $ch == '"' { $mode = "plain" } else if $ch == '\' { $escaped = true } else { $word += $ch }
    } else if $ch == "'" {
      $mode = "single"
      $in_word = true
    } else if $ch == '"' {
      $mode = "double"
      $in_word = true
    } else if $ch == '\' {
      $escaped = true
    } else if $ch == " " {
      if $in_word { $out = ($out | append $word); $word = ""; $in_word = false }
    } else {
      $word += $ch
      $in_word = true
    }
  }
  if $in_word { $out | append $word } else { $out }
}

# A value from the environment, or "" when it is unset. Settings are optional by design.
export def setting [name: string]: nothing -> string {
  $env | get -o $name | default "" | into string
}

# Run an npm command-line tool at a pinned version, through `pnpm dlx`. Not installed as a mise
# npm tool: those cannot find their own dependencies on Windows. `packages` are name@version; the
# first one's binary is what runs unless `--bin` names another.
export def --wrapped dlx [packages: list<string>, bin: string, ...args: string] {
  ^pnpm dlx ...($packages | each {|p| ["--package" $p] } | flatten) $bin ...$args
}

# The emdash CLI, run where it must be run: in the site, which is its project root.
export def --wrapped emdash [...args: string] {
  cd $env.SITE_DIR
  ^emdash ...$args
}

# `--url <deployment>` when EMDASH_URL targets one. The CLI only accepts it as the LAST argument.
export def url-flag []: nothing -> list<string> {
  let url = (setting EMDASH_URL)
  if ($url | is-empty) { [] } else { ["--url" $url] }
}

# Run an emdash command and return its JSON, parsed. The CLI prints progress lines before the
# payload, and reports errors as text while still exiting 0 — so "no JSON came back" is the failure.
export def emdash-json [...args: string]: nothing -> any {
  let full = ($args | append "--json" | append (url-flag))
  let result = (do { cd $env.SITE_DIR; ^emdash ...$full | complete })
  let lines = ($result.stdout | lines)
  let starts = ($lines | enumerate | where {|l| ($l.item | str starts-with "{") or ($l.item | str starts-with "[") } | get index)
  if $result.exit_code != 0 or ($starts | is-empty) {
    error make {msg: $"emdash ($full | str join ' ') returned no JSON: ($result.stdout | str trim) ($result.stderr | str trim)"}
  }
  $lines | skip ($starts | first) | str join (char nl) | from json
}

# EmDash runs on Cloudflare (D1, R2, Workers) or on plain Node.js (a SQLite file, local uploads).
# The template decides: the Cloudflare ones ship a wrangler.jsonc.
export def on-cloudflare []: nothing -> bool { $env.SITE_DIR | path join "wrangler.jsonc" | path exists }

# The dev server's real database, as a file the CLI's file commands can be pointed at. On
# Cloudflare that is miniflare's D1 — NOT the ./data.db those commands default to. On Node it is
# the SQLite file the template configures.
export def devdb []: nothing -> string {
  let found = (
    if (on-cloudflare) {
      let d1 = ($env.SITE_DIR | path join ".wrangler" "state" "v3" "d1" "miniflare-D1DatabaseObject")
      if ($d1 | path exists) {
        ls $d1 | get name | where {|n| ($n | str ends-with ".sqlite") and (not ($n | str ends-with "metadata.sqlite")) }
      } else { [] }
    } else {
      [($env.SITE_DIR | path join "data.db")] | where {|f| $f | path exists }
    }
  )
  if ($found | is-empty) { fail "no local database yet" "run: mise run dev" }
  $found | first
}

# Delete the local database and uploads. The site recreates them, seeded, when it next starts.
export def wipe-local-data [] {
  if (on-cloudflare) {
    rm -rf ($env.SITE_DIR | path join ".wrangler" "state")
  } else {
    for name in ["data.db" "data.db-shm" "data.db-wal" "uploads"] { rm -rf ($env.SITE_DIR | path join $name) }
  }
}

# A credential: the environment first, then fnox. "" when there is none — a finding, not a crash.
export def secret [name: string]: nothing -> string {
  let ambient = (setting $name)
  if ($ambient | is-not-empty) { return $ambient }
  let result = (^fnox get $name | complete)
  if $result.exit_code == 0 { $result.stdout | str trim } else { "" }
}

export def daemon-running [name: string]: nothing -> bool {
  let listed = (^mise daemons ls --json | complete)
  if $listed.exit_code != 0 { return false }
  $listed.stdout | from json | any {|d| $d.name == $name and $d.status == "running" }
}

export def daemon-stop [name: string] { ^mise daemons stop $name | complete | ignore }

# Run a block with the dev server stopped, then put it back — whatever the block did. Anything that
# re-runs the Vite optimizer in the site (a production build, astro check) breaks a running server.
export def with-site-paused [block: closure]: nothing -> int {
  let was_running = (daemon-running $env.SITE_DAEMON)
  if $was_running { daemon-stop $env.SITE_DAEMON }
  let rc = (code $block)
  rm -rf ($env.SITE_DIR | path join "node_modules" ".vite") ($env.SITE_DIR | path join ".astro")
  if $was_running { ^mise daemons start $env.SITE_DAEMON }
  $rc
}

# One HTTP request, with nushell's own client rather than curl — so it is the same on every OS.
# Returns {status, body, cookies}. status 0 means nothing answered; it never throws.
export def request [
  method: string         # GET, POST or DELETE
  url: string
  --headers: record = {}
  --body: any            # sent as JSON
  --timeout: duration = 10sec
]: nothing -> record {
  try {
    let response = (match $method {
      "POST" => { http post --full --allow-errors --max-time $timeout --headers $headers --content-type application/json $url ($body | default {}) }
      "DELETE" => { http delete --full --allow-errors --max-time $timeout --headers $headers $url }
      _ => { http get --full --allow-errors --max-time $timeout --headers $headers $url }
    })
    let cookies = (
      $response.headers.response | where {|h| ($h.name | str lowercase) == "set-cookie" }
      | get value | each {|v| $v | split row ";" | first } | str join "; "
    )
    {status: $response.status, body: $response.body, cookies: $cookies}
  } catch { {status: 0, body: null, cookies: ""} }
}

# Files under a directory matching a pattern, e.g. `files-in $dir "**/*"`. Use this, never `glob`
# on a joined path: a glob pattern treats `\` as an escape, and `path join` produces `\` on Windows.
export def files-in [dir: string, pattern: string, --exclude: list<string> = []]: nothing -> list<string> {
  glob $"($dir | str replace --all '\' '/')/($pattern)" --exclude $exclude
}

# True when something answers at the URL without an error status.
export def answers [url: string]: nothing -> bool {
  let status = (request GET $url --timeout 2sec).status
  $status >= 200 and $status < 400
}
