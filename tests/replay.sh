#!/usr/bin/env bash
# What `mise run test` and `mise run test:full` run: the tasks, from an empty folder, in the order a
# developer uses them — and a record of what passed, written to docs/status.md so that "what works
# right now" is a file anyone can read, not a claim.
#
#   bash tests/replay.sh quick            one template, the everyday path — about 2 minutes
#   bash tests/replay.sh full             both templates, every task that needs no deployment
#
# It runs in a temporary folder with one mise.toml that includes this repo's tasks.toml, as a
# project would. The live: tasks and --live need a deployed site and are not run here.
set -u
TIER=${1:-quick}
REPO=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d)
# On Windows this runs under Git Bash, whose /d/a/… paths mise (a Windows program) cannot read:
# give it C:/… ones.
if command -v cygpath >/dev/null 2>&1; then REPO=$(cygpath -m "$REPO"); WORK=$(cygpath -m "$WORK"); fi
OUT=$REPO/docs/status.md
ROWS=$WORK/rows.txt; : > "$ROWS"

replay() {
  # Each template gets its own folder, ports and result file, so two can run side by side.
  local T=$1 DEV=$2 PRE=$3 D=$WORK/${1/:/-} SITE=http://localhost:$2 BUILT=http://localhost:$3
  local ROWS=$WORK/rows-${1/:/-}.txt; : > "$ROWS"
  mkdir -p "$D" && cd "$D" && git init -q
  printf '[settings]\nexperimental = true\n[tools]\nnode = "26"\npnpm = "12"\n[env]\nTEMPLATE = "%s"\nSITE_PORT = "%s"\nPREVIEW_PORT = "%s"\nPLUGIN_PUBLISHER = "did:web:example.com"\nPLUGIN_AUTHOR = "Example Author"\nPLUGIN_SECURITY_EMAIL = "security@example.com"\n[task_config]\nincludes = ["%s/tasks.toml"]\n' "$T" "$DEV" "$PRE" "$REPO" > mise.toml
  mise trust -q .
  row() { printf '| %s | %s | %s | %s |\n' "$T" "$1" "$2" "$3" >> "$ROWS"; printf '%-4s %-18s %s\n' "$1" "$T" "$2"; }
  ok() { if eval "$2" > "$D/step.log" 2>&1; then row PASS "$1" ""; else row FAIL "$1" "$(tail -3 "$D/step.log" | sed 's/\x1b\[[0-9;]*m//g' | tr '\n|' '  ' | cut -c1-160)"; fi; }
  no() { if eval "$2" > "$D/step.log" 2>&1; then row FAIL "$1" "it should have refused"; else row PASS "$1" ""; fi; }

  no "site:start with no site refuses"       'mise run site:start'
  ok "site:new"                              'mise run site:new'
  ok "site:start"                            'mise run site:start'
  ok "dev site answers; dev sign-in"         'test "$(curl -s -o /dev/null -w "%{http_code}" --max-time 120 $SITE/)" = 200 && curl -fsS -X POST $SITE/_emdash/api/setup/dev-bypass -o /dev/null'
  ok "emdash: a quoted JSON argument"        "mise run emdash -- content create pages --draft --slug audit --data '{\"title\":\"Two words, one argument\"}' && mise run emdash -- content get pages audit --json | grep -q 'Two words, one argument'"
  ok "emdash whoami on the dev site"         'mise run emdash -- whoami 2>&1 | grep -qi "dev-bypass"'
  ok "site:check passes"                     'mise run site:check'
  ok "site:check fails on a type error"      'printf -- "---\nconst n: number = \"text\";\n---\n<p>{n}</p>\n" > site/src/pages/zz.astro; mise run site:check; r=$?; rm site/src/pages/zz.astro; test $r != 0'
  ok "model:sync records an added field"     'mise run emdash -- schema add-field pages subtitle --type string --label Subtitle && mise run model:sync && grep -q subtitle site/.emdash/schema.json'
  no "emdash --live refuses with no LIVE_URL" 'mise run emdash -- schema list --live'
  ok "signin:token (starts the built site)"  'mise run signin:token && mise run emdash -- whoami --preview 2>&1 | grep -qi "admin"'
  ok "emdash --preview writes"               "mise run emdash -- content create pages --preview --slug built --data '{\"title\":\"On the built site\"}'"
  if [ "$TIER" = full ]; then
    case $T in cloudflare:*) ok "live:check (hidden, by name)" 'mise run live:check';; esac
    no "content:pull refuses with no LIVE_URL" 'mise run content:pull'
    ok "content:pull (the built site as LIVE_URL)" 'LIVE_URL=$BUILT mise run content:pull && ls site/backups/*.emdash'
    # a window needs a screen: not on a CI runner
    [ -n "${CI:-}" ] || ok "signin:open says what it shows"      'SIGNIN_OPEN_SECONDS=3 mise run signin:open 2>&1 | grep -q "open: signed in"'
    ok "plugin:new"                          'mise run plugin:new -- save-log && test -f site/plugins/save-log/dist/plugin.mjs'
    ok "plugin:check"                        'mise run plugin:check -- save-log'
    ok "plugin:add"                          'mise run plugin:add -- @emdash-cms/plugin-forms && grep -q plugin-forms site/package.json'
    ok "plugin -- search"                    'env -u EMDASH_REGISTRY_URL mise run plugin -- search forms'
    ok "emdash:update"                       'mise run emdash:update'
    ok "site:reset empties the content"      'mise run site:start && mise run --yes site:reset && ! mise run emdash -- content get pages audit --json'
    no "site:reset refuses with nobody to ask" 'env -u MISE_YES -u CI mise run site:reset </dev/null'
    ok "signin:passkey on a fresh database"  'mise run site:stop; mise run step:forget; (cd site && pnpm exec emdash logout >/dev/null 2>&1); rm -f ~/.config/emdash-run/tokens/localhost_${PRE}_*.json; mise run signin:passkey && mise run emdash -- schema list --preview | grep -q slug'
    no "site:delete refuses with nobody to ask" 'env -u MISE_YES -u CI mise run site:delete </dev/null'
  fi
  ok "site:stop, twice"                      'mise run site:stop && mise run site:stop && test "$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 $BUILT/ || true)" != 200'
  ok "site:delete"                           '(cd site && pnpm exec emdash logout >/dev/null 2>&1); mise run --yes site:delete && test ! -e site'
  cd "$REPO"
}

START=$(date +%s)
if [ "$TIER" = full ]; then
  # side by side: two sites at once is what this machine is comfortable with
  replay cloudflare:blog 4400 4410 & replay node:starter 4420 4430 & wait
else
  replay cloudflare:starter 4400 4410
fi
cat "$WORK"/rows-*.txt > "$ROWS"
FAILED=$(grep -c '| FAIL |' "$ROWS")
TOOK=$(( $(date +%s) - START ))
{
  echo "# What works — the last run of \`mise run test${TIER/quick/}\`"
  echo
  echo "Written by \`tests/replay.sh\`. Do not edit: run it again."
  echo
  echo "| | |"; echo "|---|---|"
  echo "| when | $(date -u '+%Y-%m-%d %H:%M UTC') |"
  echo "| tier | $TIER ($( [ "$TIER" = full ] && echo 'both templates, every task that needs no deployment' || echo 'one template, the everyday path' )) |"
  echo "| commit | \`$(git -C "$REPO" rev-parse --short HEAD)\`$( [ -n "$(git -C "$REPO" status --porcelain -- tasks.toml admin tests)" ] && echo ' **plus uncommitted changes**' ) |"
  echo "| machine | $(uname -s) $(uname -m), $(mise --version | head -1 | cut -d' ' -f1) |"
  echo "| took | ${TOOK}s |"
  echo "| result | $(grep -c '| PASS |' "$ROWS") passed, **$FAILED failed** |"
  echo
  echo "Not covered by this run: the \`live:\` tasks and anything with \`--live\` (they need a deployed site), \`plugin:publish\`, Windows and Linux$( [ "$TIER" = quick ] && echo ', and everything only in the full tier' )."
  echo
  echo "| template | | step | on failure, the last output |"; echo "|---|---|---|---|"
  cat "$ROWS"
} > "$OUT"
rm -rf "$WORK"
echo; echo "$(grep -c PASS "$OUT") passed, $FAILED failed, ${TOOK}s — written to docs/status.md"
[ "$FAILED" = 0 ]
