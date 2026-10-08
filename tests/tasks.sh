#!/usr/bin/env bash
# The test: the tasks, in the order a developer uses them, run on ONE site — the site in this repo,
# site/. Each run works on a copy of it in a temporary folder (an instant copy on macOS), so the
# site you are looking at, and its local database, are never touched. Every step is recorded
# against the TASK it tests, in tests/results.json, and docs/reference/status.md is written from that.
#
# THE LEVELS:
#   bash tests/tasks.sh quick     the everyday tasks — about a minute
#   bash tests/tasks.sh full      every task: the plugins, a site made from nothing and deleted,
#                                  then the tasks that act on a deployed site
#   bash tests/tasks.sh node      every local task on a Node site made from EmDash's template:
#                                  before a release, not every day
# ONE GROUP: the steps are in four groups, named as the tasks are — site, signin, plugin, live. Name one and only its
# steps run (with what they need: the site, its ports, the clean-up): `mise run test -- plugin`.
# ONE TEST AT A TIME on a machine: a second one waits for the first. Two at once were handed the
# same ports and spoiled each other.
# ONE TASK: add its name — `mise run test -- signin:token` — and the test runs the steps up to and
# including that task's, then stops the site and cleans up. For working on one task.
# TEST_FROM=github before either fetches the tasks from GitHub (main) instead of the local files:
# what another developer gets.
#
# It always runs as another developer would: a clean environment (none of your shell's variables)
# and an empty config folder, so it cannot pass because of something saved on this machine.
#
# The deployed part of `full` puts a fresh starter site on a Worker kept for testing. It needs two
# settings (in this repo's gitignored mise.local.toml): TEST_LIVE_URL, its address, and
# TEST_LIVE_NAME, the Worker's name — its database is <name>, its bucket <name>-media. Without
# them (on CI, on a machine with no Cloudflare login) that part is skipped, and docs/reference/status.md
# keeps what it last showed. It uses your real Cloudflare login and fnox: a clean config folder
# would hide them.
set -u
TIER=${1:-quick}
ONLY=${2:-}
# a group's name where a task's would be: only that group's steps, at the full level
WANT=""
case $ONLY in site|signin|plugin|live) WANT=$ONLY; ONLY=""; [ "$TIER" = node ] || TIER=full;; esac
G=always; SKIPG=""; DEPTH=quick
# A group that is already proven — every step of it passed, and nothing it depends on has changed
# since (tests/record.mjs: its fingerprint) — is not run again. TEST_AGAIN=1 runs it anyway.
proven() { [ -z "${TEST_AGAIN:-}" ] && (cd "$REPO" && node tests/record.mjs --proven "$1" "$( [ "$TIER" = quick ] && echo quick || echo full )"); }
group() {
  G=$1; SKIPG=""
  if [ "$G" != always ] && { [ -z "$WANT" ] || [ "$WANT" = "$G" ]; } && proven "$G"; then
    SKIPG=1; echo "---- $G: already proven, nothing it depends on has changed — not run again (TEST_AGAIN=1 to run it)"
  fi
}
FROM=${TEST_FROM:-local}
REPO=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d)
# On Windows this runs under Git Bash, whose /d/a/… paths mise (a Windows program) cannot read.
if command -v cygpath >/dev/null 2>&1; then REPO=$(cygpath -m "$REPO"); WORK=$(cygpath -m "$WORK"); fi

# Another developer's machine: start again with nothing but HOME, PATH and an empty config folder.
# (Not on Windows, where a program needs more of the environment than that to start at all.)
if [ -z "${REPLAY_CLEAN:-}" ] && ! command -v cygpath >/dev/null 2>&1; then
  rm -rf "$WORK"
  exec env -i HOME="$HOME" PATH="$PATH" TERM="${TERM:-xterm}" ${CI:+CI="$CI"} \
    ${TEST_LIVE_URL:+TEST_LIVE_URL="$TEST_LIVE_URL"} ${TEST_LIVE_NAME:+TEST_LIVE_NAME="$TEST_LIVE_NAME"} \
    ${TEST_FROM:+TEST_FROM="$TEST_FROM"} ${STEP_LIMIT:+STEP_LIMIT="$STEP_LIMIT"} ${TEST_ONLY:+TEST_ONLY="$TEST_ONLY"} ${TEST_AGAIN:+TEST_AGAIN="$TEST_AGAIN"} ${XDG_CONFIG_HOME:+REAL_CONFIG="$XDG_CONFIG_HOME"} \
    ${GITHUB_TOKEN:+GITHUB_TOKEN="$GITHUB_TOKEN"} ${GIGET_AUTH:+GIGET_AUTH="$GIGET_AUTH"} REPLAY_CLEAN=1 bash "$0" "$@"
fi
export XDG_CONFIG_HOME=$WORK/config; mkdir -p "$XDG_CONFIG_HOME"
if [ "$FROM" = github ]; then
  INCLUDE="git::https://github.com/joeblew999/emdash-run.git//tasks.toml?ref=${REPLAY_REF:-main}"
  mise cache clear >/dev/null 2>&1   # mise keeps the first copy it fetched: take the current one
else
  INCLUDE=$REPO/tasks.toml
fi

# Provenance first: every task in tasks.toml has a step below, and every step names a real task.
(cd "$REPO" && node tests/record.mjs --coverage) || exit 1
# The scripts' own functions first: a third of a second, and a broken edit of a site's config fails
# here, not ten minutes in.
(cd "$REPO" && node --test tests/plugin-astro-config.test.mjs tests/plugin-permissions.test.mjs > "$WORK/unit.txt" 2>&1) || { tail -30 "$WORK/unit.txt"; echo "The unit tests fail (node --test tests/*.test.mjs). Nothing was run."; exit 1; }
echo "unit tests: $(grep -o 'pass [0-9]*' "$WORK/unit.txt" | grep -o '[0-9]*') pass"
# One test at a time on this machine. What must be undone when the test ends is added to CLEANUP.
CLEANUP=""; trap 'eval "$CLEANUP"' EXIT
TESTLOCK="$HOME/.config/emdash-run/locks/test"; mkdir -p "$(dirname "$TESTLOCK")"; waited=0
until mkdir "$TESTLOCK" 2>/dev/null; do
  if [ -n "$(find "$TESTLOCK" -maxdepth 0 -mmin +90 2>/dev/null)" ]; then rmdir "$TESTLOCK" 2>/dev/null; continue; fi
  [ "$waited" != 0 ] || echo "Another test is running on this machine: waiting for it to end (one at a time)…"
  sleep 10; waited=$((waited + 10))
  [ "$waited" -le 3600 ] || { echo "…it has not ended in an hour: not started. If none is running, remove $TESTLOCK"; exit 1; }
done
CLEANUP="$CLEANUP rmdir '$TESTLOCK' 2>/dev/null;"
# Running the test turns on the commit check in this clone (the generated pages, the docs lint).
[ -n "${CI:-}" ] || git -C "$REPO" config core.hooksPath .githooks 2>/dev/null || true

# One step: the task it tests, what it shows, the command. `no` is a step that must refuse.
step() { # $1 = PASS-expected (ok|no)  $2 = task  $3 = what  $4 = command
  local verdict detail="" began=$SECONDS
  # one group asked for: the others' steps are not run (group "always" is what every group needs)
  if [ -n "$WANT" ] && [ "$G" != always ] && [ "$G" != "$WANT" ]; then return; fi
  if [ -n "$SKIPG" ]; then return; fi
  # one task asked for: once its steps are done, only the clean-up still runs
  if [ -n "$ONLY" ]; then
    if [ "$2" = "$ONLY" ]; then REACHED=1; elif [ "${REACHED:-}" = 1 ] && [ "$2" != site:stop ] && [ "$2" != site:delete ]; then return; fi
  fi
  # A step that does not end is stopped at STEP_LIMIT seconds and fails with what it had printed: on
  # Windows a step once waited 40 minutes, to the job's limit, and the log said nothing of which.
  # The steps after it in that site are not run (but the clean-up): they would each wait as long.
  local pid stuck="" rc
  if [ -n "${STUCK:-}" ] && [ "$2" != site:stop ] && [ "$2" != site:delete ]; then
    echo "not run: [$STUCK] did not end" > "$D/step.log"; rc=1; stuck=skipped
  else
    ( eval "$4" ) > "$D/step.log" 2>&1 & pid=$!
    while kill -0 "$pid" 2>/dev/null; do
      if [ $((SECONDS - began)) -ge "${STEP_LIMIT:-900}" ]; then kill "$pid" 2>/dev/null; stuck=1; STUCK="$2: $3"; break; fi
      sleep 0.3
    done
    wait "$pid" 2>/dev/null; rc=$?
  fi
  if [ "$stuck" = 1 ]; then verdict=FAIL; detail="did not end in ${STEP_LIMIT:-900}s and was stopped"
  elif [ "$stuck" = skipped ]; then verdict=FAIL; detail="not run: an earlier step did not end"
  elif [ "$rc" = 0 ]; then [ "$1" = ok ] && verdict=PASS || { verdict=FAIL; detail="it should have refused"; }
  else [ "$1" = no ] && verdict=PASS || { verdict=FAIL; detail=$(tail -3 "$D/step.log" | sed 's/\x1b\[[0-9;]*m//g' | tr '\n|' '  ' | cut -c1-160); }; fi
  printf '%s|%s|%s|%s|%s|%s|%s|%s|%s\n' "$2" "$W" "$3" "$verdict" "$detail" "$1" "$((SECONDS - began))" "$G" "$DEPTH" >> "$ROWS"
  # with how long it took: on a CI runner that is how a slow step is told from a stuck one
  printf '%-4s %-11s %-15s %s (%ss)\n' "$verdict" "$W" "$2" "$3" "$((SECONDS - began))"
  # a failure shows its last output here too — on a CI runner this is the only place it can be read
  if [ "$verdict" = FAIL ]; then tail -30 "$D/step.log" | sed 's/\x1b\[[0-9;]*m//g' | cut -c1-220 | sed 's/^/       > /'; fi
  if [ "$stuck" = 1 ]; then echo "       > $detail"; fi
}
# Run a command that never ends for a few seconds, then stop IT — its own process group, nothing
# else by that name on the machine: another run, or another agent, may be following a log too.
for_a_while() { # $1 = seconds  $2.. = the command
  perl -e 'setpgrp(0,0); exec @ARGV' "${@:2}" & local p=$!
  sleep "$1"; kill -TERM -- -"$p" 2>/dev/null || kill "$p" 2>/dev/null; wait "$p" 2>/dev/null; true
}
# A command whose output must say something: `says "<words>" mise run …` (says_i: in any case).
# Never `mise run … | grep -q`: the output would be lost to the step's log, so a failure on a CI
# runner showed nothing; and on Windows a site the task leaves running keeps the pipe open, so a
# grep that has not found its words waits for ever.
says() { local want=$1; shift; "$@" > "$D/said.txt" 2>&1; cat "$D/said.txt"; grep -q -- "$want" "$D/said.txt"; }
says_i() { local want=$1; shift; "$@" > "$D/said.txt" 2>&1; cat "$D/said.txt"; grep -qi -- "$want" "$D/said.txt"; }
ok() { step ok "$@"; }
no() { step no "$@"; }
project() { # $1 = folder  $2 = template  $3.. = extra [env] lines
  # No ports here: the project gets its own from site:ports, as an agent's copy of a repo would —
  # so any number of these can run at once, and beside whatever else is running on this machine.
  D=$1; mkdir -p "$D" && cd "$D" && git init -q
  { printf '[settings]\nexperimental = true\n[tools]\nnode = "26"\npnpm = "12"\nfnox = "1.36.0"\n[env]\nTEMPLATE = "%s"\n' "$2"
    printf 'PLUGIN_PUBLISHER = "did:web:example.com"\nPLUGIN_AUTHOR = "Example Author"\nPLUGIN_SECURITY_EMAIL = "security@example.com"\n'
    shift 2; for line in "$@"; do printf '%s\n' "$line"; done
    printf '[task_config]\nincludes = ["%s"]\n' "$INCLUDE"; } > mise.toml
  mise trust -q .
}
port() { sed -n "s/^$1 = \"\([0-9]*\)\"/\1/p" mise.local.toml; }

local_site() { # $1 = "site" (a copy of this repo's site/) or a template to make a site from
  local T=$1 SITE BUILT OWN=""
  if [ "$T" = site ]; then OWN=1; T=cloudflare:blog; fi
  W=${T%%:*}; ROWS=$WORK/rows-$W.txt; : > "$ROWS"
  # A config folder of its own. EmDash's CLI keeps every sign-in in ONE file, auth.json, which it
  # reads, changes and writes back with no lock: two `emdash login`s at once and one is lost
  # (seen 2026-10-07 — "Invalid or expired token" when three sites ran at once; docs/upstream.md).
  # Upstream: emdash-cms/emdash#3996 (when fixed: no config folder of its own is needed)
  export XDG_CONFIG_HOME=$WORK/config-$W; mkdir -p "$XDG_CONFIG_HOME"
  project "$WORK/$W" "$T"
  if [ -n "$OWN" ]; then
    # This repo's site, as committed and with its packages if they are installed: copied (cp -c is
    # an instant copy on macOS), without what is the machine's — its database, its build, its key.
    cp -Rc "$REPO/site" site 2>/dev/null || cp -R "$REPO/site" site
    rm -rf site/.wrangler site/dist site/.astro site/.env site/backups
  fi
  group always
  ok site:ports     "gives the project two ports of its own"  'mise run site:ports && test -n "$(port SITE_PORT)" && test -n "$(port PREVIEW_PORT)"'
  ok site:ports     "run again: it keeps them"                'before=$(cat mise.local.toml); says "already has its ports" mise run site:ports && test "$before" = "$(cat mise.local.toml)"'
  SITE=http://localhost:$(port SITE_PORT); BUILT=http://localhost:$(port PREVIEW_PORT)
  group site
  if [ -z "$OWN" ]; then
    no site:start   "with no site, says so and stops"        'mise run site:start'
    ok site:new     "makes the site"                          'mise run site:new'
  fi
  ok site:new       "run again: the site is left alone"       'says "already a site" mise run site:new'
  ok site:start     "starts the dev site; EmDash's welcome dialog is closed" 'says "welcome dialog is closed" mise run site:start'
  ok site:start     "run again: it is already running"        'mise run site:start'
  ok site:start     "the dev site answers; dev sign-in works" 'test "$(curl -s -o /dev/null -w "%{http_code}" --max-time 120 $SITE/)" = 200 && curl -fsS -X POST $SITE/_emdash/api/setup/dev-bypass -o /dev/null'
  ok site:logs      "shows the dev site log"                  'for_a_while 5 mise run site:logs > logs.txt 2>&1; grep -q . logs.txt'
  ok emdash         "a quoted JSON argument arrives whole"    "mise run emdash -- content create pages --draft --slug audit --data '{\"title\":\"Two words, one argument, from $W\"}' && says 'Two words, one argument, from $W' mise run emdash -- content get pages audit --json"
  ok emdash         "whoami on the dev site"                  'says_i "dev-bypass" mise run emdash -- whoami'
  no emdash         "--live with no LIVE_URL says so"         'mise run emdash -- schema list --live'
  ok site:check     "passes on a sound site"                  'mise run site:check'
  ok site:check     "fails on a type error"                   'printf -- "---\nconst n: number = \"text\";\n---\n<p>{n}</p>\n" > site/src/pages/zz.astro; mise run site:check; r=$?; rm site/src/pages/zz.astro; test $r != 0'
  ok model:sync     "records an added field in .emdash/"      'mise run emdash -- schema add-field pages subtitle --type string --label Subtitle && mise run model:sync && grep -q subtitle site/.emdash/schema.json'
  ok site:preview   "serves the built site; dev sign-in is off there" 'mise run site:preview && test "$(curl -s -o /dev/null -w "%{http_code}" $BUILT/_emdash/api/setup/dev-bypass)" = 403'
  group signin
  ok signin:token   "the CLI is an administrator of the built site" 'mise run signin:token && says_i "admin" mise run emdash -- whoami --preview'
  ok signin:token   "run again: still an administrator"       'mise run signin:token && says_i "admin" mise run emdash -- whoami --preview'
  ok emdash         "--preview writes to the built site"      "mise run emdash -- content create pages --preview --slug built --data '{\"title\":\"On the built site\"}'"
  if [ "$TIER" != quick ]; then
    DEPTH=full
    group signin
    ok signin:token "starts the built site when it is stopped" 'mise run site:stop && mise run signin:token && says slug mise run emdash -- schema list --preview'
    group site
    case $T in cloudflare:*) ok live:check "the deploy rehearses with no account" 'mise run live:check';; esac
    no content:pull "with no LIVE_URL says so"                'mise run content:pull'
    # a window needs a screen: not on a CI runner
    group signin
    [ -n "${CI:-}" ] || ok signin:open "opens a signed-in window (token)" 'SIGNIN_OPEN_SECONDS=3 says "open: signed in" mise run signin:open'
    group plugin
    ok plugin:sandbox "the site can run sandboxed plugins: the runner is in its config" 'mise run plugin:sandbox && grep -q "sandboxRunner" site/astro.config.mjs'
    ok plugin:sandbox "run again: nothing changes"            'before=$(cat site/astro.config.mjs site/package.json); says "nothing changed" mise run plugin:sandbox && test "$before" = "$(cat site/astro.config.mjs site/package.json)"'
    ok plugin:new   "scaffolds, tests, builds and adds a plugin — to the site's config too, by itself" 'mise run plugin:new -- save-log && test -f site/plugins/save-log/dist/plugin.mjs && grep -q save-log site/package.json && grep -q "sandboxed: \[saveLog\]" site/astro.config.mjs'
    ok plugin:new   "run again: not scaffolded twice, still builds, the config is not touched" 'before=$(cat site/astro.config.mjs); says "already there" mise run plugin:new -- save-log && test -f site/plugins/save-log/dist/plugin.mjs && test "$before" = "$(cat site/astro.config.mjs)"'
    ok plugin:check "the plugin passes its checks"            'mise run plugin:check -- save-log'
    ok plugin:add   "a native plugin from npm: the package is added, its two lines are printed, the config is not touched" 'before=$(cat site/astro.config.mjs); mise run plugin:add -- @emdash-cms/plugin-forms > add.txt 2>&1; r=$?; test $r != 0 && grep -q plugin-forms site/package.json && grep -q "import { formsPlugin } from \"@emdash-cms/plugin-forms\";" add.txt && grep -q "plugins: \[formsPlugin()\]," add.txt && test "$before" = "$(cat site/astro.config.mjs)"'
    ok plugin:search "finds plugins in the registry"          'says_i "forms" mise run plugin:search -- forms'
    ok plugin:install "installs a registry plugin with no clicking, from a stopped site" 'says "contact-forms: installed" mise run plugin:install -- @masonjames.com/contact-forms --yes'
    ok plugin:install "run again: it is already installed"    'says "contact-forms: already installed" mise run plugin:install -- @masonjames.com/contact-forms --yes'
    no plugin:install "a plugin that can change things or reach outside is not installed without a yes" 'env -u MISE_YES -u CI mise run plugin:install -- @meekmedia.bsky.social/link-guardian'
    no plugin:install "a release other than the one asked for is not installed" 'mise run plugin:install -- @netdollar.dev/forms@0.0.1'
    no plugin:install "a plugin the registry does not have: says so and fails" 'mise run plugin:install -- @nobody.example/nothing'
    ok plugin:works "the registry plugin: every check passes" 'mise run plugin:works -- @masonjames.com/contact-forms --fresh > works.txt 2>&1; grep -q "contact-forms: loads and answers" works.txt && ! grep -q "FAIL" works.txt'
    ok plugin:works "the plugin plugin:new made: its route answers from the sandbox" 'says "save-log routes: 1 declared, each asked with a GET: hello 200" mise run plugin:works -- save-log'
    no plugin:works "a plugin the site does not have fails"   'mise run plugin:works -- no-such-plugin'
    ok plugin:remove "removes a registry plugin"              'says "contact-forms: removed" mise run plugin:remove -- @masonjames.com/contact-forms'
    ok plugin:remove "run again: nothing to remove"           'says "nothing to remove" mise run plugin:remove -- @masonjames.com/contact-forms'
    ok plugin:favourites "installs the favourites in one go"  'mise run plugin:favourites -- --yes > fav.txt 2>&1; ! grep -q "^FAIL\|^STOP" fav.txt && test "$(grep -c ": installed" fav.txt)" -ge 4'
    ok plugin:favourites "run again: all already installed"   'mise run plugin:favourites -- --yes > fav.txt 2>&1; ! grep -q "^FAIL\|^STOP" fav.txt && ! grep -q ": installed" fav.txt && grep -q "already installed" fav.txt'
    ok plugin:favourites "PLUGINS in the project chooses the list" 'PLUGINS="@lasymphonieagency.com/comment-notify" says "comment-notify: installed" mise run plugin:favourites -- --yes'
    no plugin:update "a plugin that is not installed: says so and fails" 'mise run plugin:update -- @meekmedia.bsky.social/bulletin@0.1.1'
    ok plugin:install "an older release, asked for by version, is the one installed" 'says "bulletin: installed — 0.1.0" mise run plugin:install -- --yes @meekmedia.bsky.social/bulletin@0.1.0'
    no plugin:update "no release named: says which the site has and the registry's newest, and fails" 'mise run plugin:update -- @meekmedia.bsky.social/bulletin'
    ok plugin:update "to the release named: prints what was granted and what each release declares; it asks for nothing more, so no yes is needed" 'env -u MISE_YES -u CI mise run plugin:update -- @meekmedia.bsky.social/bulletin@0.1.1 > update.txt 2>&1; grep -q "0.1.0, installed, was granted: .*email:send" update.txt && grep -q "0.1.1 declares, by the registry: .*email.send" update.txt && grep -q "asks for nothing more" update.txt && grep -q "bulletin: updated — 0.1.0 -> 0.1.1" update.txt'
    ok plugin:update "run again: nothing to update"           'says "already at 0.1.1" mise run plugin:update -- @meekmedia.bsky.social/bulletin@0.1.1'
    no plugin:update "an older release is refused"            'mise run plugin:update -- @meekmedia.bsky.social/bulletin@0.1.0'
    ok plugin:works "no name: every plugin in the site loads and answers — the favourites among them" 'mise run plugin:works > works.txt 2>&1; ! grep -q "FAIL\|DOES NOT WORK" works.txt && test "$(grep -c ": loads and answers" works.txt)" -ge 6'
    no plugin:publish "asks first, and stops with nobody to answer (a real publish is never run)" 'env -u MISE_YES -u CI mise run plugin:publish -- save-log </dev/null'
    ok plugin       "passes any command to the plugin CLI"    'says_i "search" mise run plugin -- --help'
    group site
    ok emdash:update "updates, type-checks and builds"        'mise run emdash:update'
    ok site:reset   "empties the local content"               'mise run site:start && mise run --yes site:reset && ! mise run emdash -- content get pages audit --json'
    no site:reset   "refuses with nobody to ask"              'env -u MISE_YES -u CI mise run site:reset </dev/null'
    group signin
    ok signin:passkey "completes the EmDash wizard on a fresh database" 'mise run site:stop; mise run step:forget; (cd site && pnpm exec emdash logout >/dev/null 2>&1); mise run signin:passkey && says slug mise run emdash -- schema list --preview'
    [ -n "${CI:-}" ] || ok signin:open "opens a signed-in window (passkey)" 'SIGNIN_OPEN_SECONDS=3 says "open: signed in" mise run signin:open'
    ok signin:token "the saved token goes when the local database does" 'mise run signin:token && ls "$XDG_CONFIG_HOME"/emdash-run/tokens/ | grep -q . && mise run site:stop && mise run step:forget && ! ls "$XDG_CONFIG_HOME"/emdash-run/tokens/ | grep -q .'
    ok site:admin   "a fresh built site, signed in, in one go" 'mise run --yes site:admin && says slug mise run emdash -- schema list --preview'
    group site
    no site:delete  "refuses with nobody to ask"              'env -u MISE_YES -u CI mise run site:delete </dev/null'
  fi
  DEPTH=quick
  group always
  ok site:stop      "stops both sites; twice is fine"         'mise run site:stop && mise run site:stop && test "$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 $BUILT/ || true)" != 200'
  ok site:delete    "removes the site folder"                 '(cd site && pnpm exec emdash logout >/dev/null 2>&1); mise run --yes site:delete && test ! -e site'
  ok site:delete    "run again: nothing to delete"            'says "nothing to delete" mise run --yes site:delete'
  if [ -n "$OWN" ] && [ "$TIER" = full ]; then
    # from nothing: the one thing a copy of a site that exists cannot show
    group site
    no site:start   "with no site, says so and stops"        'mise run site:start'
    ok site:new     "makes a site from nothing, from EmDash's template" 'mise run site:new -- cloudflare:starter && test -f site/package.json'
    mise run --yes site:delete > /dev/null 2>&1
  fi
  cd "$REPO"
}

live_site() {
  group live
  if [ -n "$SKIPG" ]; then return; fi
  W=deployed; ROWS=$WORK/rows-$W.txt; : > "$ROWS"
  if [ -z "${TEST_LIVE_URL:-}" ] || [ -z "${TEST_LIVE_NAME:-}" ]; then
    echo "SKIP deployed: no TEST_LIVE_URL / TEST_LIVE_NAME here. docs/reference/status.md keeps what the deployed tasks last showed."; return
  fi
  # The developer's real Cloudflare login and fnox, not the empty config folder.
  if [ -n "${REAL_CONFIG:-}" ]; then export XDG_CONFIG_HOME=$REAL_CONFIG; else unset XDG_CONFIG_HOME; fi
  local U=$TEST_LIVE_URL
  # One at a time: two runs deploying to the same Worker would overwrite each other.
  local LOCK="${HOME}/.config/emdash-run/locks/deployed-$TEST_LIVE_NAME"
  mkdir -p "$(dirname "$LOCK")"
  if ! mkdir "$LOCK" 2>/dev/null; then
    if [ -n "$(find "$LOCK" -maxdepth 0 -mmin -30 2>/dev/null)" ]; then
      echo "SKIP deployed: another run is using the test Worker ($LOCK). docs/reference/status.md keeps what the deployed tasks last showed."; return
    fi
    echo "(a lock older than 30 minutes was left behind: taking it)"
  fi
  # the path itself in the trap: LOCK is this function's, and gone by the time the script exits
  # (2026-10-07: the lock was left behind, and the next run skipped the deployed part)
  CLEANUP="$CLEANUP rmdir '$LOCK' 2>/dev/null;"
  project "$WORK/live" cloudflare:starter "LIVE_URL = \"$U\"" 'ADMIN_EMAIL = "agent@emdash.local"'
  mise run site:ports >/dev/null 2>&1
  ok site:new       "makes the site that will be deployed"    'mise run site:new && sed -i.bak "s/\"my-emdash-site\"/\"$TEST_LIVE_NAME\"/g; s/\"my-emdash-media\"/\"$TEST_LIVE_NAME-media\"/" site/wrangler.jsonc && mise run site:start && mise run site:stop'
  ok signin:access  "Cloudflare Access is in front of the admin" 'mise run signin:access > access.txt 2>&1; grep -q "access: application" access.txt'
  ok signin:access  "uploaded media stays public; the team's domain is printed before any deploy" 'grep -q "uploaded media" access.txt && grep -q "teamDomain: \"[a-z0-9-]*.cloudflareaccess.com\"" access.txt && node "$REPO/tests/signin-access-lines.mjs" access.txt site'
  ok emdash         "a site set to Cloudflare Access: the dev site starts and the CLI works on it" 'grep -q "auth: access(" site/astro.config.mjs && grep -q CF_ACCESS_AUDIENCE site/wrangler.jsonc && mise run site:start && says slug mise run emdash -- schema list && mise run site:stop'
  STAMP=shipped-$(date +%s)
  ok live:ship      "deploys; the site answers with the change" "printf '<p>%s</p>\n' $STAMP > site/src/pages/zz-shipped.astro && mise run live:ship && (for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS \$LIVE_URL_/zz-shipped 2>/dev/null | grep -q $STAMP && exit 0; sleep 3; done; exit 1)"
  ok signin:access  "run again: changes nothing"              'says "already" mise run signin:access'
  ok signin:token   "--live: the CLI is an administrator of the deployed site" 'mise run signin:token -- --live && says_i "admin" mise run emdash -- whoami --live'
  ok signin:token   "--live, run again: still an administrator" 'mise run signin:token -- --live && says_i "admin" mise run emdash -- whoami --live'
  ok emdash         "--live reads and writes the deployed site" "says slug mise run emdash -- schema list --live && mise run emdash -- content create pages --live --slug test-\$(date +%s) --data '{\"title\":\"Made by the test\"}'"
  ok plugin:works   "--live: the deployed site is checked from outside; it says what it skips, and builds and restarts nothing" 'mise run plugin:works -- --live > works-live.txt 2>&1; grep -q "skip builds" works-live.txt && grep -q "skip starts" works-live.txt && grep -q "ok   answers" works-live.txt && ! grep -q "^FAIL\|\] FAIL" works-live.txt'
  ok model:sync     "--live records the deployed model"       'mise run model:sync -- --live && test -f site/.emdash/schema.json'
  ok content:pull   "downloads the deployed site as a package" 'mise run content:pull && ls site/backups/*.emdash'
  ok live:backup    "the database bookmark and a package"     'says "bookmark is" mise run live:backup'
  ok live:preview   "a preview: an address of its own, the live site still answers" 'mise run live:preview -- test > preview.txt 2>&1; grep -q "PREVIEW \"test\"" preview.txt && grep -q "\"previews\"" site/wrangler.jsonc && curl -fsS -o /dev/null "$LIVE_URL_/" && (for i in 1 2 3 4 5 6 7 8 9 10; do test "$(curl -s -o /dev/null -w "%{http_code}" --max-time 120 "${LIVE_URL_/:\/\//://test-}/_emdash/admin")" = 302 && exit 0; sleep 3; done; cat preview.txt | tail -15; exit 1)'
  ok live:preview   "run again: the same preview, nothing new made" 'mise run live:preview -- test > preview2.txt 2>&1; grep -q "PREVIEW \"test\"" preview2.txt && ! grep -q "preview: made\|wrote the" preview2.txt'
  ok signin:token   "LIVE_PREVIEW: the CLI is an administrator of the preview, in the preview's own database" 'LIVE_PREVIEW=test mise run signin:token -- --live > preview3.txt 2>&1; grep -q "its own database" preview3.txt && LIVE_PREVIEW=test says_i "admin" mise run emdash -- whoami --live'
  ok live:preview   "--delete removes it; again: nothing to delete" 'says "is deleted" mise run live:preview -- test --delete && says "nothing to delete" mise run live:preview -- test --delete'
  ok live:logs      "shows a request to the deployed site"    '(for_a_while 20 mise run live:logs > tail.txt 2>&1 &); sleep 12; curl -s -o /dev/null "$LIVE_URL_/?from=test"; sleep 10; grep -q GET tail.txt'
  [ -n "${CI:-}" ] || ok signin:open "--live opens a signed-in window" 'SIGNIN_OPEN_SECONDS=3 says "open: signed in" mise run signin:open -- --live'
  ok signin:access  "a visitor reaches uploaded media and plugins' public routes without signing in" 'test "$(curl -s -o /dev/null -w "%{http_code}" "$LIVE_URL_/_emdash/api/media/file/none.png")" != 302 && test "$(curl -s -o /dev/null -w "%{http_code}" "$LIVE_URL_/_emdash/api/plugins/none/info")" != 302 && test "$(curl -s -o /dev/null -w "%{http_code}" "$LIVE_URL_/_emdash/admin")" = 302'
  ok live:undo      "puts the previous version back: the change is gone" "mise run live:undo && (for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS \$LIVE_URL_/zz-shipped?t=\$i 2>/dev/null | grep -q $STAMP || exit 0; sleep 3; done; exit 1)"
  ok site:delete    "removes the local site folder"           'mise run --yes site:delete && test ! -e site'
  cd "$REPO"
}

START=$(date +%s)
# Is there anything to run on a local site? Not if every group this run would run is proven.
local_needed() {
  local g
  for g in ${WANT:-$1}; do [ "$g" = live ] || proven "$g" || return 0; done
  echo "Nothing to run on this machine: ${WANT:-$1} — already proven, nothing changed since (TEST_AGAIN=1 to run anyway)."
  return 1
}
case $TIER in
  full)  # (TEST_ONLY=deployed runs just the last part, as `-- live` does)
         if [ "$WANT" != live ] && [ "${TEST_ONLY:-}" != deployed ] && local_needed "site signin plugin"; then local_site site; fi
         if [ -z "$WANT" ] || [ "$WANT" = live ]; then LIVE_URL_=${TEST_LIVE_URL:-} live_site; fi ;;
  node)  local_site node:starter ;;
  *)     if local_needed "site signin"; then local_site site; fi ;;
esac
cat "$WORK"/rows-*.txt > "$WORK/rows.txt" 2>/dev/null
[ -s "$WORK/rows.txt" ] || { rm -rf "$WORK"; exit 0; }
cd "$REPO"
# plain `node`: it is on the PATH inside a mise task, and `mise x --` would install every tool in
# mise.toml first — on a CI runner that meant charter, and GitHub refused the download
node tests/record.mjs "$WORK/rows.txt" "$( if [ -n "$WANT" ]; then echo "$WANT"; elif [ "$TIER" = node ]; then echo full; else echo "$TIER"; fi )" "$( [ "$FROM" = github ] && echo GitHub || echo 'the local files' )" \
  "$(git rev-parse --short HEAD)$( [ -n "$(git status --porcelain -- tasks.toml scripts tests/tasks.sh)" ] && echo '+uncommitted' )" "$(( $(date +%s) - START ))"
code=$?
# The pages written from what was just recorded (docs/_generated.toml): charter writes them. It is
# one of this repo's tools on a developer's machine (the test's clean environment has no PATH to
# it: mise says where it is); a CI runner installs no charter and commits nothing.
CHARTER=$(command -v charter 2>/dev/null || mise which charter 2>/dev/null) || true
if [ -n "$CHARTER" ]; then
  # with the developer's own config folder, not the test's empty one: charter asks gh about the repo
  if [ -n "${REAL_CONFIG:-}" ]; then export XDG_CONFIG_HOME=$REAL_CONFIG; else unset XDG_CONFIG_HOME; fi
  if "$CHARTER" docs > "$WORK/charter-docs.txt" 2>&1; then grep -m1 "steps pass" docs/reference/status.md
  else echo "The pages were not rewritten (mise run docs:setup):"; tail -3 "$WORK/charter-docs.txt"; fi
fi
rm -rf "$WORK"
exit $code
