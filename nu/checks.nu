# The checks: the repo's own (does the harness hold together) and the live ones (does the running
# or deployed site match what the repo says).
use lib.nu *
use plugin.nu

# ── the harness checks itself ────────────────────────────────────────────────────────────────

# nushell's own checker over every module, plus the one trap it cannot see: inside `$"..."` a
# bracketed bare word is a subexpression, so `problem(s)` RUNS a command called `s` — accepted by
# the checker (it might be an external) and failing only when that line executes.
export def nu-problems [dir: string]: nothing -> list<string> {
  glob ($dir | path join "*.nu") | sort | par-each {|file|
    let name = ($file | path basename)
    let diagnostics = (
      (^nu --ide-check 200 $file | complete).stdout | lines | where {|l| $l | str starts-with "{" } | each {|l| $l | from json }
      | where {|d| ($d | get -o type) == "diagnostic" and ($d | get -o severity | default "Error") == "Error" }
      | each {|d| $"($name): ($d | get -o message)" }
    )
    let traps = (
      open --raw $file | parse --regex '(?s)\$"(?<text>[^"]*)"' | get text
      | each {|text| $text | parse --regex '\((?<word>[a-z]+)\)' | get word } | flatten | uniq
      | each {|word| $"($name): a bracketed bare word inside an interpolated string runs a command named ($word)" }
    )
    $diagnostics | append $traps
  } | flatten
}

# The subcommands main.nu defines.
def commands [main: string]: nothing -> list<string> {
  open --raw $main | parse --regex '(?m)^def "main (?<cmd>[^"]+)"' | get cmd
}

# mise.toml and the module must agree: every task runs a subcommand that exists, every subcommand
# has a task, and every daemon runs a task that exists. Neither mise nor nushell checks any of it.
export def task-problems [toml: string, main: string]: nothing -> list<string> {
  let cfg = (open $toml)
  let defined = (commands $main)
  let tasks = ($cfg.tasks | transpose name def)
  let called = ($tasks | each {|t|
    let hits = ($t.def | get -o run | default "" | parse --regex 'main\.nu (?<cmd>[a-z][a-z -]*[a-z])$')
    if ($hits | is-empty) { null } else { {task: $t.name, cmd: ($hits | first | get cmd)} }
  } | compact)
  let missing = ($called | where {|c| not ($c.cmd in $defined) } | each {|c| $"task ($c.task) runs `($c.cmd)`, which main.nu does not define" })
  let orphans = ($defined | where {|d| not ($d in ($called | get cmd)) } | each {|d| $"main.nu defines `($d)` but no task runs it" })
  let names = ($tasks | get name)
  let daemons = ($cfg | get -o daemons | default {} | transpose name def | each {|d|
    let ref = ($d.def.run | parse --regex 'mise run (?<task>\S+)' | get -o task.0 | default "")
    if ($ref in $names) { null } else { $"daemon ($d.name) runs `mise run ($ref)`, which is not a task" }
  } | compact)
  $missing | append $orphans | append $daemons
}

# A check that cannot fail is worse than none. Each fault below has really happened here; it is
# planted in a COPY, and the checker must report it.
export def selftest-problems []: nothing -> list<string> {
  let scratch = ($env.RUN_DIR | path join "selftest")
  let nu_dir = ($env.ROOT | path join "nu")
  let toml = (harness-file)
  let cases = [
    {what: "a POSIX operator nushell does not have", line: "def planted [] { print 'a' && print 'b' }"}
    {what: "a variable that was never defined", line: "def planted [] { print $never_defined }"}
    {what: "brackets inside an interpolated string", line: (['def planted [n: int] { print $' '"found ($n) problem' '(s)' '" }'] | str join)}
  ]
  let nu_missed = ($cases | each {|case|
    rm -rf $scratch
    mkdir $scratch
    cp ($nu_dir | path join "*.nu" | into glob) $scratch
    $"(char nl)($case.line)(char nl)" | save --append ($scratch | path join "lib.nu")
    if (nu-problems $scratch | is-empty) { $"the nushell check passed a module with ($case.what)" } else { null }
  } | compact)
  rm -rf $scratch
  mkdir $scratch
  let planted = ($scratch | path join "mise.toml")
  $"(open --raw $toml)(char nl)[tasks.planted](char nl)run = \"nu main.nu no such command\"(char nl)" | save $planted
  let task_missed = (if (task-problems $planted ($nu_dir | path join "main.nu") | is-empty) { ["the task check passed a task that runs a missing command"] } else { [] })
  rm -rf $scratch
  $nu_missed | append $task_missed
}

# docs/tasks.md is generated from the tasks; fail if what is committed is not what would be generated.
export def docs-current []: nothing -> bool {
  # Only a repo that keeps the generated list is held to it.
  if not ($env.ROOT | path join "docs" "tasks.md" | path exists) { return true }
  let generated = (^mise generate task-docs | complete).stdout
  ($generated | str trim) == (open --raw ($env.ROOT | path join "docs" "tasks.md") | str trim)
}

# Where the site ships its EmDash skills, or "" before setup.
def shipped-skills []: nothing -> string {
  [".claude" ".agents"] | each {|d| $env.SITE_DIR | path join $d "skills" } | where {|p| $p | path exists } | get -o 0 | default ""
}

def tree-hashes [dir: string]: nothing -> record {
  glob ($dir | path join "**" "*") | where {|f| ($f | path type) == "file" }
  | reduce --fold {} {|file, acc| $acc | upsert ($file | path relative-to $dir) (open --raw $file | hash sha256) }
}

# Vendor the site's EmDash skills: committed under .github/skills (skills are discovered when an
# agent session STARTS, so a fresh clone needs them in git), copied to .claude/skills for Claude.
export def sync-skills [] {
  let shipped = (shipped-skills)
  if ($shipped | is-empty) { return }
  let names = (ls $shipped | where type == dir | get name | each {|p| $p | path basename })
  for target in [($env.ROOT | path join ".github" "skills") ($env.ROOT | path join ".claude" "skills" "emdash")] {
    rm -rf $target
    mkdir $target
    for name in $names { cp -r ($shipped | path join $name) ($target | path join $name) }
  }
}

export def skills-current []: nothing -> bool {
  let shipped = (shipped-skills)
  ($shipped | is-empty) or ((tree-hashes $shipped) == (tree-hashes ($env.ROOT | path join ".github" "skills")))
}

# git cannot make a symlink on Windows — it writes the target path into a file instead. None allowed.
export def symlinks []: nothing -> list<string> {
  let committed = ((^git -C $env.ROOT ls-files -s | complete).stdout | lines | where {|l| $l | str starts-with "120000" })
  let on_disk = (
    (^find $env.ROOT -type l -not -path "*/node_modules/*" -not -path "*/.src/*" -not -path "*/.git/*" | complete).stdout
    | lines | where {|l| $l | is-not-empty }
  )
  $committed | append $on_disk
}

# ── the live site ────────────────────────────────────────────────────────────────────────────

def report [passed: bool, label: string, detail: string]: nothing -> bool {
  print $"  (if $passed { '✓' } else { '✗' }) ($label)(if ($detail | is-empty) { '' } else { $' — ($detail)' })"
  $passed
}

# Does the running site (or the deployment in EMDASH_URL) match what the repo says? Every check is
# driven by PROJECT SETTINGS and is skipped, not failed, when its setting is empty.
export def verify []: nothing -> bool {
  let target = (if (setting EMDASH_URL | is-empty) { $env.SITE_URL } else { $env.EMDASH_URL })
  # Retried: a config change restarts the dev server, and one attempt reports a false alarm.
  mut status = ""
  for _ in 0..40 {
    let probe = (^curl -sS -o /dev/null -w "%{http_code}" --max-time 2 $target | complete)
    if $probe.exit_code == 0 { $status = ($probe.stdout | str trim); break }
    sleep 500ms
  }
  if ($status | is-empty) or (($status | into int) >= 500) {
    return (report false $"($target) responds" (if ($status | is-empty) { "no response after 20s" } else { $status }))
  }
  mut results = [(report true $"($target) responds" $status)]

  let collection = (setting VERIFY_COLLECTION)
  if ($collection | is-empty) { return true }
  # `content list` is slim — no `data` — so each entry is fetched. A check that passes because it
  # read nothing is worse than one that fails, hence the count.
  let entries = (try {
    emdash-json content list $collection | get -o items | default [] | each {|item| emdash-json content get $collection $item.slug }
  } catch {|err| print --stderr $"    ($err.msg)"; [] })
  let with_data = ($entries | where {|e| $e | get -o data | is-not-empty } | length)
  $results = ($results | append (report ($with_data > 0 and $with_data == ($entries | length)) $"($collection) entries carry data" $"($with_data) of ($entries | length)"))

  let join = (setting VERIFY_JOIN_FIELD)
  if ($join | is-empty) or ($entries | is-empty) { return ($results | all {|r| $r }) }
  let unjoined = ($entries | where {|e| $e | get -o data | default {} | get -o $join | is-empty } | each {|e| $e.slug })
  $results = ($results | append (report ($unjoined | is-empty) $"every ($collection) entry has a ($join)" ($unjoined | str join ", ")))

  # The join field names an object in a bucket; a stored snapshot must match that object's fields.
  let bucket = (setting VERIFY_BUCKET)
  if ($bucket | is-empty) { return ($results | all {|r| $r }) }
  let account = (secret "CLOUDFLARE_ACCOUNT_ID")
  let token = (secret "CLOUDFLARE_API_TOKEN")
  if ($account | is-empty) or ($token | is-empty) {
    print $"  – ($bucket) cross-check skipped: no Cloudflare credentials"
    return ($results | all {|r| $r })
  }
  let pairs = (setting VERIFY_SNAPSHOT_MAP | split row "," | where {|p| $p | str contains "=" } | each {|p| $p | split row "=" })
  let snapshot_field = (setting VERIFY_SNAPSHOT_FIELD)
  let checked = ($entries | where {|e| $e | get -o data | default {} | get -o $join | is-not-empty } | first 5 | each {|entry|
    let id = ($entry.data | get $join)
    let key = (setting VERIFY_OBJECT_KEY | str replace "{id}" $id)
    let fetched = (
      ^curl -sS -w '\n%{http_code}' -H $"Authorization: Bearer ($token)"
        $"https://api.cloudflare.com/client/v4/accounts/($account)/r2/buckets/($bucket)/objects/($key)"
      | complete
    )
    let out = ($fetched.stdout | lines)
    if $fetched.exit_code != 0 or ($out | is-empty) { return {missing: $"($id) unreachable", drift: []} }
    if (($out | last | str trim | into int) >= 400) { return {missing: $"($id) ($out | last | str trim)", drift: []} }
    let object = ($out | drop 1 | str join (char nl) | from json)
    let stored = ($entry.data | get -o $snapshot_field | default {})
    let drift = ($pairs | where {|p| ($stored | get -o ($p | first)) != ($object | get -o ($p | last)) } | each {|p|
      $"($entry.slug): ($p | first) is ($stored | get -o ($p | first)), live is ($object | get -o ($p | last))"
    })
    {missing: null, drift: $drift}
  })
  let missing = ($checked | get missing | compact)
  let drift = ($checked | get drift | flatten)
  $results = ($results | append (report ($missing | is-empty) $"($join) resolves in ($bucket)" (if ($missing | is-empty) { $"($checked | length) objects" } else { $missing | str join ", " })))
  if ($pairs | is-not-empty) {
    $results = ($results | append (report ($drift | is-empty) "stored snapshot matches the live object" ($drift | first 6 | str join "; ")))
  }
  $results | all {|r| $r }
}

# The content model: the repo's seed against a live instance. Returns true when they agree.
export def schema-diff [seed: record]: nothing -> bool {
  let listed = (emdash-json schema list)
  let remote_collections = (if ($listed | describe | str starts-with "record") { $listed | get -o items | default ($listed | get -o collections | default []) } else { $listed })
  let remote = ($remote_collections | each {|c|
    let detail = (emdash-json schema get $c.slug)
    (if ($detail | describe | str starts-with "record") { $detail | get -o fields | default [] } else { [] })
    | each {|f| {key: $"($c.slug).($f.slug)", type: $f.type} }
  } | flatten)
  let local = ($seed | get -o collections | default [] | each {|c|
    $c | get -o fields | default [] | each {|f| {key: $"($c.slug).($f.slug)", type: $f.type} }
  } | flatten)
  let remote_keys = ($remote | get -o key | default [])
  let local_keys = ($local | get -o key | default [])
  let problems = (
    ($local | where {|l| not ($l.key in $remote_keys) } | each {|l| $"missing from the live site: ($l.key)" })
    | append ($remote | where {|r| not ($r.key in $local_keys) } | each {|r| $"only on the live site:      ($r.key)" })
    | append ($local | each {|l|
      let other = ($remote | where key == $l.key)
      if ($other | is-not-empty) and ($other | first | get type) != $l.type { $"type differs:               ($l.key) repo=($l.type) live=($other | first | get type)" }
    } | compact)
  )
  print $"  live: ($remote_collections | length) collections, ($remote_keys | length) fields — repo: ($seed | get -o collections | default [] | length) collections, ($local_keys | length) fields"
  for problem in $problems { print $"    ($problem)" }
  if ($problems | is-empty) { ok "the live content model matches the repo's seed" } else { print "  evolve the live model with `emdash schema` — a seed only applies at first boot" }
  $problems | is-empty
}
