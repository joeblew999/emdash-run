#!/usr/bin/env bash
# The test: the tasks, from an empty folder, in the order a developer uses them. Every step is
# recorded against the TASK it tests, in tests/results.json, and docs/status.md is rebuilt from
# that with one line for every task in tasks.toml — so the status and the tasks always match.
#
# TWO LEVELS, and no others:
#   bash tests/replay.sh quick     one template, the everyday tasks — about a minute
#   bash tests/replay.sh full      EVERYTHING: both templates, then the tasks that act on a
#                                  deployed site
# TEST_FROM=github before either fetches the tasks from GitHub (main) instead of the local files:
# what another developer gets.
#
# It always runs as another developer would: a clean environment (none of your shell's variables)
# and an empty config folder, so it cannot pass because of something saved on this machine.
#
# The deployed part of `full` puts a fresh starter site on a Worker kept for testing. It needs two
# settings (in this repo's gitignored mise.local.toml): TEST_LIVE_URL, its address, and
# TEST_LIVE_NAME, the Worker's name — its database is <name>, its bucket <name>-media. Without
# them (on CI, on a machine with no Cloudflare login) that part is skipped, and docs/status.md
# keeps what it last showed. It uses your real Cloudflare login and fnox: a clean config folder
# would hide them.
set -u
TIER=${1:-quick}
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
    ${TEST_FROM:+TEST_FROM="$TEST_FROM"} ${TEST_ONLY:+TEST_ONLY="$TEST_ONLY"} ${XDG_CONFIG_HOME:+REAL_CONFIG="$XDG_CONFIG_HOME"} REPLAY_CLEAN=1 bash "$0" "$@"
fi
export XDG_CONFIG_HOME=$WORK/config; mkdir -p "$XDG_CONFIG_HOME"
if [ "$FROM" = github ]; then
  INCLUDE="git::https://github.com/joeblew999/emdash-run.git//tasks.toml?ref=${REPLAY_REF:-main}"
  mise cache clear >/dev/null 2>&1   # mise keeps the first copy it fetched: take the current one
else
  INCLUDE=$REPO/tasks.toml
fi

# Provenance first: every task in tasks.toml has a step below, and every step names a real task.
(cd "$REPO" && node tests/status.mjs --coverage) || exit 1

# One step: the task it tests, what it shows, the command. `no` is a step that must refuse.
step() { # $1 = PASS-expected (ok|no)  $2 = task  $3 = what  $4 = command
  local verdict detail=""
  if eval "$4" > "$D/step.log" 2>&1; then [ "$1" = ok ] && verdict=PASS || { verdict=FAIL; detail="it should have refused"; }
  else [ "$1" = no ] && verdict=PASS || { verdict=FAIL; detail=$(tail -3 "$D/step.log" | sed 's/\x1b\[[0-9;]*m//g' | tr '\n|' '  ' | cut -c1-160); }; fi
  printf '%s|%s|%s|%s|%s|%s\n' "$2" "$W" "$3" "$verdict" "$detail" "$1" >> "$ROWS"
  printf '%-4s %-11s %-15s %s\n' "$verdict" "$W" "$2" "$3"
}
ok() { step ok "$@"; }
no() { step no "$@"; }
project() { # $1 = folder  $2 = template  $3 = dev port  $4 = built port  $5.. = extra [env] lines
  D=$1; mkdir -p "$D" && cd "$D" && git init -q
  { printf '[settings]\nexperimental = true\n[tools]\nnode = "26"\npnpm = "12"\nfnox = "1.36.0"\n[env]\nTEMPLATE = "%s"\nSITE_PORT = "%s"\nPREVIEW_PORT = "%s"\n' "$2" "$3" "$4"
    printf 'PLUGIN_PUBLISHER = "did:web:example.com"\nPLUGIN_AUTHOR = "Example Author"\nPLUGIN_SECURITY_EMAIL = "security@example.com"\n'
    shift 4; for line in "$@"; do printf '%s\n' "$line"; done
    printf '[task_config]\nincludes = ["%s"]\n' "$INCLUDE"; } > mise.toml
  mise trust -q .
}

local_site() { # $1 = template  $2 = dev port  $3 = built port
  local T=$1 SITE=http://localhost:$2 BUILT=http://localhost:$3
  W=${T%%:*}; ROWS=$WORK/rows-$W.txt; : > "$ROWS"
  project "$WORK/$W" "$T" "$2" "$3"
  no site:start     "with no site, says so and stops"        'mise run site:start'
  ok site:new       "makes the site"                          'mise run site:new'
  ok site:start     "starts the dev site"                     'mise run site:start'
  ok site:start     "the dev site answers; dev sign-in works" 'test "$(curl -s -o /dev/null -w "%{http_code}" --max-time 120 $SITE/)" = 200 && curl -fsS -X POST $SITE/_emdash/api/setup/dev-bypass -o /dev/null'
  ok site:logs      "shows the dev site log"            '(mise run site:logs > logs.txt 2>&1 & p=$!; sleep 5; kill $p 2>/dev/null; pkill -f "astro dev logs" 2>/dev/null; true); grep -q . logs.txt'
  ok emdash         "a quoted JSON argument arrives whole"    "mise run emdash -- content create pages --draft --slug audit --data '{\"title\":\"Two words, one argument\"}' && mise run emdash -- content get pages audit --json | grep -q 'Two words, one argument'"
  ok emdash         "whoami on the dev site"                  'mise run emdash -- whoami 2>&1 | grep -qi "dev-bypass"'
  no emdash         "--live with no LIVE_URL says so"         'mise run emdash -- schema list --live'
  ok site:check     "passes on a sound site"                  'mise run site:check'
  ok site:check     "fails on a type error"                   'printf -- "---\nconst n: number = \"text\";\n---\n<p>{n}</p>\n" > site/src/pages/zz.astro; mise run site:check; r=$?; rm site/src/pages/zz.astro; test $r != 0'
  ok model:sync     "records an added field in .emdash/"      'mise run emdash -- schema add-field pages subtitle --type string --label Subtitle && mise run model:sync && grep -q subtitle site/.emdash/schema.json'
  ok site:preview   "serves the built site; dev sign-in is off there" 'mise run site:preview && test "$(curl -s -o /dev/null -w "%{http_code}" $BUILT/_emdash/api/setup/dev-bypass)" = 403'
  ok signin:token   "the CLI is an administrator of the built site" 'mise run signin:token && mise run emdash -- whoami --preview 2>&1 | grep -qi "admin"'
  ok emdash         "--preview writes to the built site"      "mise run emdash -- content create pages --preview --slug built --data '{\"title\":\"On the built site\"}'"
  if [ "$TIER" = full ]; then
    ok signin:token "starts the built site when it is stopped" 'mise run site:stop && mise run signin:token && mise run emdash -- schema list --preview | grep -q slug'
    case $T in cloudflare:*) ok live:check "the deploy rehearses with no account" 'mise run live:check';; esac
    no content:pull "with no LIVE_URL says so"                'mise run content:pull'
    # a window needs a screen: not on a CI runner
    [ -n "${CI:-}" ] || ok signin:open "opens a signed-in window (token)" 'SIGNIN_OPEN_SECONDS=3 mise run signin:open 2>&1 | grep -q "open: signed in"'
    ok plugin:new   "scaffolds, tests, builds and adds a plugin" 'mise run plugin:new -- save-log && test -f site/plugins/save-log/dist/plugin.mjs && grep -q save-log site/package.json'
    ok plugin:check "the plugin passes its checks"            'mise run plugin:check -- save-log'
    ok plugin:add   "adds a package from npm"                 'mise run plugin:add -- @emdash-cms/plugin-forms && grep -q plugin-forms site/package.json'
    ok plugin:search "finds plugins in the registry"          'mise run plugin:search -- forms | grep -qi "forms"'
    no plugin:publish "asks first, and stops with nobody to answer (a real publish is never run)" 'env -u MISE_YES -u CI mise run plugin:publish -- save-log </dev/null'
    ok plugin       "passes any command to the plugin CLI"    'mise run plugin -- --help | grep -qi "search"'
    ok emdash:update "updates, type-checks and builds"        'mise run emdash:update'
    ok site:reset   "empties the local content"               'mise run site:start && mise run --yes site:reset && ! mise run emdash -- content get pages audit --json'
    no site:reset   "refuses with nobody to ask"              'env -u MISE_YES -u CI mise run site:reset </dev/null'
    ok signin:passkey "completes the EmDash wizard on a fresh database" 'mise run site:stop; mise run step:forget; (cd site && pnpm exec emdash logout >/dev/null 2>&1); rm -f $XDG_CONFIG_HOME/emdash-run/tokens/localhost_*.json; mise run signin:passkey && mise run emdash -- schema list --preview | grep -q slug'
    [ -n "${CI:-}" ] || ok signin:open "opens a signed-in window (passkey)" 'SIGNIN_OPEN_SECONDS=3 mise run signin:open 2>&1 | grep -q "open: signed in"'
    ok site:admin   "a fresh built site, signed in, in one go" 'mise run --yes site:admin && mise run emdash -- schema list --preview | grep -q slug'
    no site:delete  "refuses with nobody to ask"              'env -u MISE_YES -u CI mise run site:delete </dev/null'
  fi
  ok site:stop      "stops both sites; twice is fine"         'mise run site:stop && mise run site:stop && test "$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 $BUILT/ || true)" != 200'
  ok site:delete    "removes the site folder"                 '(cd site && pnpm exec emdash logout >/dev/null 2>&1); mise run --yes site:delete && test ! -e site'
  cd "$REPO"
}

live_site() {
  W=deployed; ROWS=$WORK/rows-$W.txt; : > "$ROWS"
  if [ -z "${TEST_LIVE_URL:-}" ] || [ -z "${TEST_LIVE_NAME:-}" ]; then
    echo "SKIP deployed: no TEST_LIVE_URL / TEST_LIVE_NAME here. docs/status.md keeps what the deployed tasks last showed."; return
  fi
  # The developer's real Cloudflare login and fnox, not the empty config folder.
  if [ -n "${REAL_CONFIG:-}" ]; then export XDG_CONFIG_HOME=$REAL_CONFIG; else unset XDG_CONFIG_HOME; fi
  local U=$TEST_LIVE_URL
  project "$WORK/live" cloudflare:starter 4440 4450 "LIVE_URL = \"$U\"" 'ADMIN_EMAIL = "agent@emdash.local"'
  ok site:new       "makes the site that will be deployed"    'mise run site:new && sed -i.bak "s/\"my-emdash-site\"/\"$TEST_LIVE_NAME\"/g; s/\"my-emdash-media\"/\"$TEST_LIVE_NAME-media\"/" site/wrangler.jsonc && mise run site:start && mise run site:stop'
  ok signin:access  "Cloudflare Access is in front of the admin" 'mise run signin:access 2>&1 | tee access.txt | grep -q "access: application"'
  STAMP=shipped-$(date +%s)
  ok live:ship      "deploys; the site answers with the change" "printf '<p>%s</p>\n' $STAMP > site/src/pages/zz-shipped.astro && mise run live:ship && curl -fsS \$LIVE_URL_/zz-shipped | grep -q $STAMP"
  ok signin:token   "--live: the CLI is an administrator of the deployed site" 'mise run signin:token -- --live && mise run emdash -- whoami --live 2>&1 | grep -qi "admin"'
  ok emdash         "--live reads and writes the deployed site" "mise run emdash -- schema list --live | grep -q slug && mise run emdash -- content create pages --live --slug test-\$(date +%s) --data '{\"title\":\"Made by the test\"}'"
  ok model:sync     "--live records the deployed model"       'mise run model:sync -- --live && test -f site/.emdash/schema.json'
  ok content:pull   "downloads the deployed site as a package" 'mise run content:pull && ls site/backups/*.emdash'
  ok live:backup    "the database bookmark and a package"     'mise run live:backup 2>&1 | tee backup.txt | grep -q "bookmark is"'
  ok live:logs      "shows a request to the deployed site"    '(mise run live:logs > tail.txt 2>&1 & p=$!; sleep 12; curl -s -o /dev/null "$LIVE_URL_/?from=test"; sleep 6; kill $p 2>/dev/null; pkill -f "wrangler tail" 2>/dev/null; true); grep -q GET tail.txt'
  [ -n "${CI:-}" ] || ok signin:open "--live opens a signed-in window" 'SIGNIN_OPEN_SECONDS=3 mise run signin:open -- --live 2>&1 | grep -q "open: signed in"'
  ok live:undo      "puts the previous version back: the change is gone" "mise run live:undo && sleep 5 && ! curl -fsS \$LIVE_URL_/zz-shipped 2>/dev/null | grep -q $STAMP"
  ok site:delete    "removes the local site folder"           'mise run --yes site:delete && test ! -e site'
  cd "$REPO"
}

START=$(date +%s)
case $TIER in
  full)  # (TEST_ONLY=deployed runs just the last part — for working on that part, not a third level)
         [ "${TEST_ONLY:-}" = deployed ] || { local_site cloudflare:blog 4400 4410 & local_site node:starter 4420 4430 & wait; }   # side by side
         LIVE_URL_=${TEST_LIVE_URL:-} live_site ;;
  *)     local_site cloudflare:starter 4400 4410 ;;
esac
cat "$WORK"/rows-*.txt > "$WORK/rows.txt"
cd "$REPO"
# plain `node`: it is on the PATH inside a mise task, and `mise x --` would install every tool in
# mise.toml first — on a CI runner that meant charter, and GitHub refused the download
node tests/status.mjs "$WORK/rows.txt" "$TIER" "$( [ "$FROM" = github ] && echo GitHub || echo 'the local files' )" \
  "$(git rev-parse --short HEAD)$( [ -n "$(git status --porcelain -- tasks.toml admin tests/replay.sh)" ] && echo '+uncommitted' )" "$(( $(date +%s) - START ))"
code=$?
rm -rf "$WORK"
exit $code
