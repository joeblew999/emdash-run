# Shared helpers — everything here is used by more than one flow.
# Paths and names come from PROJECT SETTINGS in mise.toml, as environment variables.

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

# A value from the environment, or "" when it is unset. Settings are optional by design.
export def setting [name: string]: nothing -> string {
  $env | get -o $name | default "" | into string
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

# The dev server's real database. EmDash's file commands default to ./data.db, which a Cloudflare
# site never uses — the dev server reads miniflare's D1 — so they must be pointed here.
export def devdb []: nothing -> string {
  let d1 = ($env.SITE_DIR | path join ".wrangler" "state" "v3" "d1" "miniflare-D1DatabaseObject")
  let found = (
    if ($d1 | path exists) {
      ls $d1 | get name | where {|n| ($n | str ends-with ".sqlite") and (not ($n | str ends-with "metadata.sqlite")) }
    } else { [] }
  )
  if ($found | is-empty) { fail "no local database yet" "run: mise run dev" }
  $found | first
}

# A credential: the environment first, then fnox. "" when there is none — a finding, not a crash.
export def secret [name: string]: nothing -> string {
  let ambient = (setting $name)
  if ($ambient | is-not-empty) { return $ambient }
  let result = (^fnox exec -- printenv $name | complete)
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

# True when something answers at the URL.
export def answers [url: string]: nothing -> bool {
  (^curl -fsS -o /dev/null --max-time 2 $url | complete).exit_code == 0
}
