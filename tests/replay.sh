#!/usr/bin/env bash
# The test: the tasks, from an empty folder, in the order a developer uses them. Every step is
# recorded against the TASK it tests, in tests/results.json, and docs/status.md is rebuilt from
# that with one line for every task in tasks.toml — so the status and the tasks always match.
#
# TWO LEVELS, and no others:
#   bash tests/replay.sh quick     one template, the everyday tasks — about a minute
#   bash tests/replay.sh full      EVERYTHING: both templates, then the tasks that act on a
#                                  deployed site
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
# them (on CI, on a machine with no Cloudflare login) that part is skipped, and docs/status.md
# keeps what it last showed. It uses your real Cloudflare login and fnox: a clean config folder
# would hide them.
set -u
TIER=${1:-quick}
ONLY=${2:-}
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
    ${TEST_FROM:+TEST_FROM="$TEST_FROM"} ${TEST_ONLY:+TEST_ONLY="$TEST_ONLY"} ${XDG_CONFIG_HOME:+REAL_CONFIG="$XDG_CONFIG_HOME"} \
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
(cd "$REPO" && node tests/status.mjs --coverage) || exit 1
# Running the test turns on the commit check in this clone (the generated pages, the docs lint).
[ -n "${CI:-}" ] || git -C "$REPO" config core.hooksPath .githooks 2>/dev/null || true

# One step: the task it tests, what it shows, the command. `no` is a step that must refuse.
step() { # $1 = PASS-expected (ok|no)  $2 = task  $3 = what  $4 = command
  local verdict detail="" began=$SECONDS
  # one task asked for: once its steps are done, only the clean-up still runs
  if [ -n "$ONLY" ]; then
    if [ "$2" = "$ONLY" ]; then REACHED=1; elif [ "${REACHED:-}" = 1 ] && [ "$2" != site:stop ] && [ "$2" != site:delete ]; then return; fi
  fi
  if eval "$4" > "$D/step.log" 2>&1; then [ "$1" = ok ] && verdict=PASS || { verdict=FAIL; detail="it should have refused"; }
  else [ "$1" = no ] && verdict=PASS || { verdict=FAIL; detail=$(tail -3 "$D/step.log" | sed 's/\x1b\[[0-9;]*m//g' | tr '\n|' '  ' | cut -c1-160); }; fi
  printf '%s|%s|%s|%s|%s|%s\n' "$2" "$W" "$3" "$verdict" "$detail" "$1" >> "$ROWS"
  # with how long it took: on a CI runner that is how a slow step is told from a stuck one
  printf '%-4s %-11s %-15s %s (%ss)\n' "$verdict" "$W" "$2" "$3" "$((SECONDS - began))"
  # a failure shows its last output here too — on a CI runner this is the only place it can be read
  if [ "$verdict" = FAIL ]; then tail -12 "$D/step.log" | sed 's/\x1b\[[0-9;]*m//g' | cut -c1-220 | sed 's/^/       > /'; fi
}
# Run a command that never ends for a few seconds, then stop IT — its own process group, nothing
# else by that name on the machine: another run, or another agent, may be following a log too.
for_a_while() { # $1 = seconds  $2.. = the command
  perl -e 'setpgrp(0,0); exec @ARGV' "${@:2}" & local p=$!
  sleep "$1"; kill -TERM -- -"$p" 2>/dev/null || kill "$p" 2>/dev/null; wait "$p" 2>/dev/null; true
}
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

local_site() { # $1 = template  $2 = (optional) a label, when this is an extra copy run beside the others
  local T=$1 SITE BUILT
  W=${2:-${T%%:*}}; ROWS=$WORK/rows-$W.txt; : > "$ROWS"
  # A config folder of its own. EmDash's CLI keeps every sign-in in ONE file, auth.json, which it
  # reads, changes and writes back with no lock: two `emdash login`s at once and one is lost
  # (seen 2026-10-07 — "Invalid or expired token" on one of three sites; docs/upstream.md).
  # Upstream: emdash-cms/emdash#3996 (when fixed: the three sites can share one config folder again)
  export XDG_CONFIG_HOME=$WORK/config-$W; mkdir -p "$XDG_CONFIG_HOME"
  project "$WORK/$W" "$T"
  ok site:ports     "gives the project two ports of its own"  'mise run site:ports && test -n "$(port SITE_PORT)" && test -n "$(port PREVIEW_PORT)"'
  ok site:ports     "run again: it keeps them"                'before=$(cat mise.local.toml); mise run site:ports | grep -q "already has its ports" && test "$before" = "$(cat mise.local.toml)"'
  SITE=http://localhost:$(port SITE_PORT); BUILT=http://localhost:$(port PREVIEW_PORT)
  no site:start     "with no site, says so and stops"        'mise run site:start'
  ok site:new       "makes the site"                          'mise run site:new'
  ok site:new       "run again: the site is left alone"       'mise run site:new 2>&1 | grep -q "already a site"'
  ok site:start     "starts the dev site; EmDash's welcome dialog is closed" 'mise run site:start | grep -q "welcome dialog is closed"'
  ok site:start     "run again: it is already running"        'mise run site:start'
  ok site:start     "the dev site answers; dev sign-in works" 'test "$(curl -s -o /dev/null -w "%{http_code}" --max-time 120 $SITE/)" = 200 && curl -fsS -X POST $SITE/_emdash/api/setup/dev-bypass -o /dev/null'
  ok site:logs      "shows the dev site log"                  'for_a_while 5 mise run site:logs > logs.txt 2>&1; grep -q . logs.txt'
  ok emdash         "a quoted JSON argument arrives whole"    "mise run emdash -- content create pages --draft --slug audit --data '{\"title\":\"Two words, one argument, from $W\"}' && mise run emdash -- content get pages audit --json | grep -q 'Two words, one argument, from $W'"
  ok emdash         "whoami on the dev site"                  'mise run emdash -- whoami 2>&1 | grep -qi "dev-bypass"'
  no emdash         "--live with no LIVE_URL says so"         'mise run emdash -- schema list --live'
  ok site:check     "passes on a sound site"                  'mise run site:check'
  ok site:check     "fails on a type error"                   'printf -- "---\nconst n: number = \"text\";\n---\n<p>{n}</p>\n" > site/src/pages/zz.astro; mise run site:check; r=$?; rm site/src/pages/zz.astro; test $r != 0'
  ok model:sync     "records an added field in .emdash/"      'mise run emdash -- schema add-field pages subtitle --type string --label Subtitle && mise run model:sync && grep -q subtitle site/.emdash/schema.json'
  ok site:preview   "serves the built site; dev sign-in is off there" 'mise run site:preview && test "$(curl -s -o /dev/null -w "%{http_code}" $BUILT/_emdash/api/setup/dev-bypass)" = 403'
  ok signin:token   "the CLI is an administrator of the built site" 'mise run signin:token && mise run emdash -- whoami --preview 2>&1 | grep -qi "admin"'
  ok signin:token   "run again: still an administrator"       'mise run signin:token && mise run emdash -- whoami --preview 2>&1 | grep -qi "admin"'
  ok emdash         "--preview writes to the built site"      "mise run emdash -- content create pages --preview --slug built --data '{\"title\":\"On the built site\"}'"
  if [ "$TIER" = full ]; then
    ok signin:token "starts the built site when it is stopped" 'mise run site:stop && mise run signin:token && mise run emdash -- schema list --preview | grep -q slug'
    case $T in cloudflare:*) ok live:check "the deploy rehearses with no account" 'mise run live:check';; esac
    no content:pull "with no LIVE_URL says so"                'mise run content:pull'
    # a window needs a screen: not on a CI runner
    [ -n "${CI:-}" ] || ok signin:open "opens a signed-in window (token)" 'SIGNIN_OPEN_SECONDS=3 mise run signin:open 2>&1 | grep -q "open: signed in"'
    ok plugin:sandbox "the site can run sandboxed plugins: the runner is in its config" 'mise run plugin:sandbox && grep -q "sandboxRunner" site/astro.config.mjs'
    ok plugin:sandbox "run again: nothing changes"            'before=$(cat site/astro.config.mjs site/package.json); mise run plugin:sandbox | grep -q "nothing changed" && test "$before" = "$(cat site/astro.config.mjs site/package.json)"'
    ok plugin:new   "scaffolds, tests, builds and adds a plugin — to the site's config too, by itself" 'mise run plugin:new -- save-log && test -f site/plugins/save-log/dist/plugin.mjs && grep -q save-log site/package.json && grep -q "sandboxed: \[saveLog\]" site/astro.config.mjs'
    ok plugin:new   "run again: not scaffolded twice, still builds, the config is not touched" 'before=$(cat site/astro.config.mjs); mise run plugin:new -- save-log 2>&1 | grep -q "already there" && test -f site/plugins/save-log/dist/plugin.mjs && test "$before" = "$(cat site/astro.config.mjs)"'
    ok plugin:check "the plugin passes its checks"            'mise run plugin:check -- save-log'
    ok plugin:add   "adds a package from npm, and its lines in the site's config" 'mise run plugin:add -- @emdash-cms/plugin-forms && grep -q plugin-forms site/package.json && grep -q "plugins: \[formsPlugin()\]" site/astro.config.mjs'
    ok plugin:add   "run again: the config is not touched"    'before=$(cat site/astro.config.mjs); mise run plugin:add -- @emdash-cms/plugin-forms && test "$before" = "$(cat site/astro.config.mjs)"'
    ok plugin:search "finds plugins in the registry"          'mise run plugin:search -- forms | grep -qi "forms"'
    ok plugin:install "installs a registry plugin with no clicking, from a stopped site" 'mise run plugin:install -- @masonjames.com/contact-forms | grep -q "contact-forms: installed"'
    ok plugin:install "run again: it is already installed"    'mise run plugin:install -- @masonjames.com/contact-forms | grep -q "contact-forms: already installed"'
    no plugin:install "a plugin that can change things or reach outside is not installed without a yes" 'env -u MISE_YES -u CI mise run plugin:install -- @meekmedia.bsky.social/link-guardian'
    no plugin:install "a release other than the one asked for is not installed" 'mise run plugin:install -- @netdollar.dev/forms@0.0.1'
    no plugin:install "a plugin the registry does not have: says so and fails" 'mise run plugin:install -- @nobody.example/nothing'
    ok plugin:works "the registry plugin: every check passes" 'mise run plugin:works -- @masonjames.com/contact-forms > works.txt 2>&1; grep -q "contact-forms: works" works.txt && ! grep -q "FAIL" works.txt'
    ok plugin:works "the plugin plugin:new made: its route answers from the sandbox" 'mise run plugin:works -- save-log 2>&1 | grep -q "save-log routes: 1 declared, each asked with a GET: hello 200"'
    no plugin:works "a plugin the site does not have fails"   'mise run plugin:works -- no-such-plugin'
    ok plugin:remove "removes a registry plugin"              'mise run plugin:remove -- @masonjames.com/contact-forms | grep -q "contact-forms: removed"'
    ok plugin:remove "run again: nothing to remove"           'mise run plugin:remove -- @masonjames.com/contact-forms | grep -q "nothing to remove"'
    ok plugin:favourites "installs the favourites in one go"  'mise run plugin:favourites > fav.txt 2>&1; ! grep -q "^FAIL" fav.txt && test "$(grep -c ": installed" fav.txt)" -ge 4'
    ok plugin:favourites "run again: all already installed"   'mise run plugin:favourites > fav.txt 2>&1; ! grep -q "^FAIL" fav.txt && ! grep -q ": installed" fav.txt && grep -q "already installed" fav.txt'
    ok plugin:favourites "PLUGINS in the project chooses the list" 'PLUGINS="@lasymphonieagency.com/comment-notify" mise run plugin:favourites | grep -q "comment-notify: installed"'
    ok plugin:works "no name: every plugin in the site works — the favourites among them" 'mise run plugin:works > works.txt 2>&1; ! grep -q "FAIL\|DOES NOT WORK" works.txt && test "$(grep -c ": works" works.txt)" -ge 6'
    no plugin:publish "asks first, and stops with nobody to answer (a real publish is never run)" 'env -u MISE_YES -u CI mise run plugin:publish -- save-log </dev/null'
    ok plugin       "passes any command to the plugin CLI"    'mise run plugin -- --help | grep -qi "search"'
    ok emdash:update "updates, type-checks and builds"        'mise run emdash:update'
    ok site:reset   "empties the local content"               'mise run site:start && mise run --yes site:reset && ! mise run emdash -- content get pages audit --json'
    no site:reset   "refuses with nobody to ask"              'env -u MISE_YES -u CI mise run site:reset </dev/null'
    ok signin:passkey "completes the EmDash wizard on a fresh database" 'mise run site:stop; mise run step:forget; (cd site && pnpm exec emdash logout >/dev/null 2>&1); mise run signin:passkey && mise run emdash -- schema list --preview | grep -q slug'
    [ -n "${CI:-}" ] || ok signin:open "opens a signed-in window (passkey)" 'SIGNIN_OPEN_SECONDS=3 mise run signin:open 2>&1 | grep -q "open: signed in"'
    ok signin:token "the saved token goes when the local database does" 'mise run signin:token && ls "$XDG_CONFIG_HOME"/emdash-run/tokens/ | grep -q . && mise run site:stop && mise run step:forget && ! ls "$XDG_CONFIG_HOME"/emdash-run/tokens/ | grep -q .'
    ok site:admin   "a fresh built site, signed in, in one go" 'mise run --yes site:admin && mise run emdash -- schema list --preview | grep -q slug'
    no site:delete  "refuses with nobody to ask"              'env -u MISE_YES -u CI mise run site:delete </dev/null'
  fi
  ok site:stop      "stops both sites; twice is fine"         'mise run site:stop && mise run site:stop && test "$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 $BUILT/ || true)" != 200'
  ok site:delete    "removes the site folder"                 '(cd site && pnpm exec emdash logout >/dev/null 2>&1); mise run --yes site:delete && test ! -e site'
  ok site:delete    "run again: nothing to delete"            'mise run --yes site:delete 2>&1 | grep -q "nothing to delete"'
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
  # One at a time: two runs deploying to the same Worker would overwrite each other.
  local LOCK="${HOME}/.config/emdash-run/locks/deployed-$TEST_LIVE_NAME"
  mkdir -p "$(dirname "$LOCK")"
  if ! mkdir "$LOCK" 2>/dev/null; then
    if [ -n "$(find "$LOCK" -maxdepth 0 -mmin -30 2>/dev/null)" ]; then
      echo "SKIP deployed: another run is using the test Worker ($LOCK). docs/status.md keeps what the deployed tasks last showed."; return
    fi
    echo "(a lock older than 30 minutes was left behind: taking it)"
  fi
  # the path itself in the trap: LOCK is this function's, and gone by the time the script exits
  # (2026-10-07: the lock was left behind, and the next run skipped the deployed part)
  trap "rmdir '$LOCK' 2>/dev/null" EXIT
  project "$WORK/live" cloudflare:starter "LIVE_URL = \"$U\"" 'ADMIN_EMAIL = "agent@emdash.local"'
  mise run site:ports >/dev/null 2>&1
  ok site:new       "makes the site that will be deployed"    'mise run site:new && sed -i.bak "s/\"my-emdash-site\"/\"$TEST_LIVE_NAME\"/g; s/\"my-emdash-media\"/\"$TEST_LIVE_NAME-media\"/" site/wrangler.jsonc && mise run site:start && mise run site:stop'
  ok signin:access  "Cloudflare Access is in front of the admin" 'mise run signin:access > access.txt 2>&1; grep -q "access: application" access.txt'
  ok signin:access  "uploaded media stays public; the team's domain is printed before any deploy" 'grep -q "uploaded media" access.txt && grep -q "teamDomain: \"[a-z0-9-]*.cloudflareaccess.com\"" access.txt && node "$REPO/tests/access-config.mjs" access.txt site'
  ok emdash         "a site set to Cloudflare Access: the dev site starts and the CLI works on it" 'grep -q "auth: access(" site/astro.config.mjs && grep -q CF_ACCESS_AUDIENCE site/wrangler.jsonc && mise run site:start && mise run emdash -- schema list | grep -q slug && mise run site:stop'
  STAMP=shipped-$(date +%s)
  ok live:ship      "deploys; the site answers with the change" "printf '<p>%s</p>\n' $STAMP > site/src/pages/zz-shipped.astro && mise run live:ship && (for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS \$LIVE_URL_/zz-shipped 2>/dev/null | grep -q $STAMP && exit 0; sleep 3; done; exit 1)"
  ok signin:access  "run again: changes nothing"              'mise run signin:access 2>&1 | grep -q "already"'
  ok signin:token   "--live: the CLI is an administrator of the deployed site" 'mise run signin:token -- --live && mise run emdash -- whoami --live 2>&1 | grep -qi "admin"'
  ok signin:token   "--live, run again: still an administrator" 'mise run signin:token -- --live && mise run emdash -- whoami --live 2>&1 | grep -qi "admin"'
  ok emdash         "--live reads and writes the deployed site" "mise run emdash -- schema list --live | grep -q slug && mise run emdash -- content create pages --live --slug test-\$(date +%s) --data '{\"title\":\"Made by the test\"}'"
  ok model:sync     "--live records the deployed model"       'mise run model:sync -- --live && test -f site/.emdash/schema.json'
  ok content:pull   "downloads the deployed site as a package" 'mise run content:pull && ls site/backups/*.emdash'
  ok live:backup    "the database bookmark and a package"     'mise run live:backup 2>&1 | tee backup.txt | grep -q "bookmark is"'
  ok live:preview   "a preview: an address of its own, the live site still answers" 'mise run live:preview -- test > preview.txt 2>&1; grep -q "PREVIEW \"test\"" preview.txt && grep -q "\"previews\"" site/wrangler.jsonc && curl -fsS -o /dev/null "$LIVE_URL_/" && (for i in 1 2 3 4 5 6 7 8 9 10; do test "$(curl -s -o /dev/null -w "%{http_code}" --max-time 120 "${LIVE_URL_/:\/\//://test-}/_emdash/admin")" = 302 && exit 0; sleep 3; done; cat preview.txt | tail -15; exit 1)'
  ok live:preview   "run again: the same preview, nothing new made" 'mise run live:preview -- test > preview2.txt 2>&1; grep -q "PREVIEW \"test\"" preview2.txt && ! grep -q "preview: made\|wrote the" preview2.txt'
  ok signin:token   "LIVE_PREVIEW: the CLI is an administrator of the preview, in the preview's own database" 'LIVE_PREVIEW=test mise run signin:token -- --live > preview3.txt 2>&1; grep -q "its own database" preview3.txt && LIVE_PREVIEW=test mise run emdash -- whoami --live 2>&1 | grep -qi "admin"'
  ok live:preview   "--delete removes it; again: nothing to delete" 'mise run live:preview -- test --delete | grep -q "is deleted" && mise run live:preview -- test --delete | grep -q "nothing to delete"'
  ok live:logs      "shows a request to the deployed site"    '(for_a_while 20 mise run live:logs > tail.txt 2>&1 &); sleep 12; curl -s -o /dev/null "$LIVE_URL_/?from=test"; sleep 10; grep -q GET tail.txt'
  [ -n "${CI:-}" ] || ok signin:open "--live opens a signed-in window" 'SIGNIN_OPEN_SECONDS=3 mise run signin:open -- --live 2>&1 | grep -q "open: signed in"'
  ok signin:access  "a visitor reaches uploaded media and plugins' public routes without signing in" 'test "$(curl -s -o /dev/null -w "%{http_code}" "$LIVE_URL_/_emdash/api/media/file/none.png")" != 302 && test "$(curl -s -o /dev/null -w "%{http_code}" "$LIVE_URL_/_emdash/api/plugins/none/info")" != 302 && test "$(curl -s -o /dev/null -w "%{http_code}" "$LIVE_URL_/_emdash/admin")" = 302'
  ok live:undo      "puts the previous version back: the change is gone" "mise run live:undo && (for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS \$LIVE_URL_/zz-shipped?t=\$i 2>/dev/null | grep -q $STAMP || exit 0; sleep 3; done; exit 1)"
  ok site:delete    "removes the local site folder"           'mise run --yes site:delete && test ! -e site'
  cd "$REPO"
}

START=$(date +%s)
case $TIER in
  full)  # (TEST_ONLY=deployed runs just the last part — for working on that part, not a third level)
         # THREE AT ONCE, as three agents would be: each in its own folder, on its own ports. The
         # third is the proof of that and is recorded as one step, not as a third column.
         [ "${TEST_ONLY:-}" = deployed ] || {
           local_site cloudflare:blog & local_site node:starter & local_site cloudflare:starter third & wait
           W=cloudflare; ROWS=$WORK/rows-cloudflare.txt; D=$WORK/cloudflare
           ok site:ports "three sites at once, each on its own ports with only its own content" \
             'test "$(grep -c "|FAIL|" "$WORK/rows-third.txt")" = 0 && test "$(grep -c "|PASS|" "$WORK/rows-third.txt")" -gt 20 && test "$(cat "$WORK"/*/mise.local.toml | grep -c PORT)" = "$(cat "$WORK"/*/mise.local.toml | grep PORT | sort -u | wc -l | tr -d " ")"'
           mv "$WORK/rows-third.txt" "$WORK/third.txt"
         }
         LIVE_URL_=${TEST_LIVE_URL:-} live_site ;;
  *)     local_site cloudflare:starter ;;
esac
cat "$WORK"/rows-*.txt > "$WORK/rows.txt"
cd "$REPO"
# plain `node`: it is on the PATH inside a mise task, and `mise x --` would install every tool in
# mise.toml first — on a CI runner that meant charter, and GitHub refused the download
node tests/status.mjs "$WORK/rows.txt" "$TIER" "$( [ "$FROM" = github ] && echo GitHub || echo 'the local files' )" \
  "$(git rev-parse --short HEAD)$( [ -n "$(git status --porcelain -- tasks.toml admin tests/replay.sh)" ] && echo '+uncommitted' )" "$(( $(date +%s) - START ))"
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
