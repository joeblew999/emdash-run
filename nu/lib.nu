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

# Where the local site answers. Built here, not in mise's [env]: a checkout that overrides
# SITE_PORT in mise.local.toml must get a URL that follows it.
export def site-url []: nothing -> string { $"http://localhost:($env.SITE_PORT)" }

# Where the optional local plugin registry answers. It follows REGISTRY_PORT the same way.
export def registry-url []: nothing -> string { $"http://localhost:($env.REGISTRY_PORT)" }

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

# Does the file hold exactly this text? How run/ remembers what something was last done on.
export def holds [file: string, text: string]: nothing -> bool {
  ($file | path exists) and (open --raw $file | str trim) == ($text | str trim)
}

# Run an npm command-line tool at a pinned version, through `pnpm dlx`. Not installed as a mise
# npm tool: those cannot find their own dependencies on Windows. `packages` are name@version; the
# first one's binary is what runs unless `--bin` names another.
export def --wrapped dlx [packages: list<string>, bin: string, ...args: string] {
  ^pnpm dlx ...($packages | each {|p| ["--package" $p] } | flatten) $bin ...$args
}

# The packages released together with an EmDash version, e.g. {"@emdash-cms/plugin-cli": "0.13.2"}.
# EmDash tags them all on one commit, so EMDASH_VERSION alone decides the set — nothing to keep in
# step by hand. Read from the tags once per version and remembered in run/.
export def version-set [version?: string]: nothing -> record {
  let want = ($version | default $env.EMDASH_VERSION)
  let cache = ($env.RUN_DIR | path join $"emdash-($want).json")
  if ($cache | path exists) { return (open $cache) }
  let tags = ((^git ls-remote --tags --refs $env.EMDASH_REPO | complete).stdout | lines | parse "{commit}\trefs/tags/{tag}")
  let commit = ($tags | where tag == $"emdash@($want)" | get -o commit.0 | default "")
  if ($commit | is-empty) { fail $"there is no EmDash release ($want)" $"check EMDASH_VERSION in mise.toml against ($env.EMDASH_REPO)/releases" }
  let set = ($tags | where commit == $commit | reduce --fold {} {|t, acc|
    let at = ($t.tag | str index-of --end "@")
    $acc | upsert ($t.tag | str substring 0..<$at) ($t.tag | str substring ($at + 1)..)
  })
  mkdir $env.RUN_DIR
  $set | save --force $cache
  $set
}

# The site the CLI talks to: the deployment a `--url` flow aimed at, otherwise the local site on
# ITS port. Never left to the CLI: it assumes port 4321, which is another checkout's site whenever
# this one overrides SITE_PORT. `check` fails on the CLI run anywhere but through these helpers.
export def cli-target []: nothing -> string { if (setting EMDASH_URL | is-empty) { site-url } else { $env.EMDASH_URL } }

# The emdash CLI, run where it must be run: in the site, which is its project root.
export def --wrapped emdash [...args: string] {
  cd $env.SITE_DIR
  with-env {EMDASH_URL: (cli-target)} { ^emdash ...$args }
}

# The same, captured instead of printed: {stdout, stderr, exit_code}.
export def --wrapped emdash-result [...args: string]: nothing -> record {
  cd $env.SITE_DIR
  with-env {EMDASH_URL: (cli-target)} { ^emdash ...$args | complete }
}

# Run an emdash command and return its JSON, parsed; an error when the command fails or prints
# none. To target a deployment, set $env.EMDASH_URL — the CLI reads it itself, and flows that take
# `--url` do exactly that.
export def emdash-json [...args: string]: nothing -> any {
  let full = ($args | append "--json")
  let result = (emdash-result ...$full)
  # With --json the CLI writes only JSON to stdout (progress goes to stderr) and exits non-zero on error.
  if $result.exit_code != 0 or ($result.stdout | str trim | is-empty) {
    error make {msg: $"emdash ($full | str join ' ') failed: ($result.stderr | str trim) ($result.stdout | str trim)"}
  }
  $result.stdout | from json
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

# Everything the local site stores: the database with its -wal and -shm, and the uploaded media. On
# Cloudflare that is miniflare's state — D1 and R2 together; on Node, the SQLite file and uploads/.
def local-data []: nothing -> list<string> {
  if (on-cloudflare) { [($env.SITE_DIR | path join ".wrangler" "state")] } else {
    ["data.db" "data.db-shm" "data.db-wal" "uploads"] | each {|name| $env.SITE_DIR | path join $name }
  }
}

# Is there any local data yet? False on a first start and after a wipe.
export def has-devdb []: nothing -> bool { local-data | any {|path| $path | path exists } }

# The EmDash installed in a package directory — the site's, or a plugin's — or "" before an install.
export def emdash-in [dir: string]: nothing -> string {
  let pkg = ($dir | path join "node_modules" "emdash" "package.json")
  if ($pkg | path exists) { open $pkg | get version } else { "" }
}

# Stop the site and delete its database and uploads. It recreates them, seeded, when it next starts.
export def wipe-local-data [] {
  daemon-stop $env.SITE_DAEMON $env.SITE_PORT
  rm -f ($env.RUN_DIR | path join "seed-applied.txt")
  for path in (local-data) { rm -rf $path }
}

# A new directory under run/backups/, named for what it holds and when.
export def backup-dir [label: string]: nothing -> string {
  let dir = ($env.RUN_DIR | path join "backups" $"($label)-(date now | format date '%Y%m%d-%H%M%S')")
  mkdir $dir
  $dir
}

# Stop the site and copy its data into a new backup directory, which is returned. Stopped, because
# a running site keeps committed changes in the -wal file and may be mid-write. The caller restarts.
export def backup-local-data [label: string]: nothing -> string {
  if not (has-devdb) { fail "no local database yet" "run: mise run dev" }
  daemon-stop $env.SITE_DAEMON $env.SITE_PORT
  let dest = (backup-dir $label)
  for path in (local-data | where {|p| $p | path exists }) { cp -r $path $dest }
  $dest
}

# Stop the site and put such a copy back in place of its data. The caller restarts.
export def restore-local-data [dir: string] {
  let saved = (local-data | each {|path| {from: ($dir | path join ($path | path basename)), to: $path} })
  if ($saved | where {|s| $s.from | path exists } | is-empty) {
    fail $"($dir) holds no copy of this site's data" "a backup is a directory made by: mise run snapshot -- --database"
  }
  daemon-stop $env.SITE_DAEMON $env.SITE_PORT
  for item in $saved {
    rm -rf $item.to
    if ($item.from | path exists) { cp -r $item.from $item.to }
  }
}

export def daemon-running [name: string]: nothing -> bool {
  let listed = (^mise daemons ls --json | complete)
  if $listed.exit_code != 0 { return false }
  $listed.stdout | from json | any {|d| $d.name == $name and $d.status == "running" }
}

# Is something listening on the port? Asked by trying to take it — true whoever holds it.
export def port-taken [number: int]: nothing -> bool { try { port $number $number; false } catch { true } }

# Stop a daemon, and return only once it is gone: not running, and its port free. "Stopped" alone
# is not enough — on Linux `mise run` puts the server in a process group of its own, so pitchfork
# reports the daemon stopped while the server is still shutting down, and a start that follows
# comes up beside the old one instead of replacing it. Stopping one that is not running is fine.
export def daemon-stop [name: string, port: string] {
  ^mise daemons stop $name | complete | ignore
  let number = ($port | into int)
  let deadline = ((date now) + 30sec)
  while (daemon-running $name) or (port-taken $number) {
    if (date now) > $deadline {
      fail $"the ($name) daemon was stopped, but port ($number) is still taken after 30s" "another program may hold it — give this checkout its own port in mise.local.toml, or see: mise daemons status"
    }
    sleep 250ms
  }
}

# One HTTP request, with nushell's own client (not curl: that is not on every OS). Returns
# {status, body}; status 0 means nothing answered. It never throws.
export def request [method: string, url: string, --headers: record = {}, --timeout: duration = 10sec]: nothing -> record {
  try {
    let response = (if $method == "POST" {
      http post --full --allow-errors --max-time $timeout --headers $headers --content-type application/json $url {}
    } else {
      http get --full --allow-errors --max-time $timeout --headers $headers $url
    })
    {status: $response.status, body: $response.body}
  } catch { {status: 0, body: null} }
}

# Files under a directory matching a pattern, e.g. `files-in $dir "**/*"`. Use this, never `glob`
# on a joined path: a glob pattern treats `\` as an escape, and `path join` produces `\` on Windows.
export def files-in [dir: string, pattern: string, --exclude: list<string> = []]: nothing -> list<string> {
  glob $"($dir | str replace --all '\' '/')/($pattern)" --exclude $exclude
}

# True when something answers at the URL without an error status.
export def answers [url: string, --timeout: duration = 2sec]: nothing -> bool {
  (request GET $url --timeout $timeout).status in 200..399
}

# Wait, bounded, until something answers. One PATIENT probe at a time: a cold dev server needs many
# seconds for its first answer, and short overlapping probes starve it. Nothing waits without a limit.
export def wait-for [url: string, seconds: int]: nothing -> bool {
  let deadline = ((date now) + ($seconds * 1sec))
  mut up = false
  while (not $up) and ((date now) <= $deadline) {
    $up = (answers $url --timeout 30sec)
    if not $up { sleep 1sec }
  }
  $up
}

# The last lines of a daemon's log — what to show when it would not come up.
export def daemon-log [name: string, lines: int = 30]: nothing -> string {
  (^mise daemons logs $name | complete).stdout | lines | last $lines | str join (char nl)
}

# Aim the emdash CLI at a deployment for the rest of the caller's flow: it reads EMDASH_URL itself,
# and EMDASH_TOKEN. The deployment's token is its own setting, DEPLOY_TOKEN, and becomes EMDASH_TOKEN
# only here — so it never reaches the local site, and no stale EMDASH_TOKEN reaches a deployment.
export def --env target [url?: string] {
  if $url == null { return }
  $env.EMDASH_URL = $url
  if (setting DEPLOY_TOKEN | is-not-empty) { $env.EMDASH_TOKEN = $env.DEPLOY_TOKEN }
}
