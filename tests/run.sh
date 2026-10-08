#!/usr/bin/env bash
# The test. A GROUP is the unit: site, signin, plugin, live — named as the tasks are. Each has a
# folder here with its steps (steps.sh) and what its last run showed (results.json), and a page in
# docs/reference/ written from that. Each runs alone, on a site of its own.
#
#   mise run test             every group that is not proven
#   mise run test:plugin      one group (test:site, test:signin, test:plugin, test:live)
#   mise run test:node        site, signin and plugin on a Node site made from EmDash's template
#   … -- --again              run it even though it is proven
#
# PROVEN: every step of the group passed, and nothing it depends on has changed since (its tasks,
# its scripts, its steps, the site: tests/record.mjs). A proven group is not run again. On a CI
# runner nothing is skipped.
# A RUN IS THE WHOLE TRUTH FOR ITS GROUP: it replaces everything recorded for that group.
# ONE TEST AT A TIME on a machine: a second one waits for the first.
# TEST_FROM=github fetches the tasks from GitHub (main) instead of the local files.
#
# It runs as another developer would: a clean environment (none of your shell's variables), an
# empty config folder, and a copy of this repo's site/ in a temporary folder — the site you are
# looking at, and its database, are never touched.
#
# The live group puts a fresh starter site on a Worker kept for testing. It needs TEST_LIVE_URL and
# TEST_LIVE_NAME (tests/live/steps.sh); without them it is not run and its record is kept.
set -u
AGAIN=""; WHERE=cloudflare; WANT=""
for a in "$@"; do
  case $a in
    --again) AGAIN=1 ;;
    --node) WHERE=node ;;
    site|signin|plugin|live) WANT="$WANT $a" ;;
    *) echo "usage: bash tests/run.sh [site|signin|plugin|live]… [--again] [--node]"; exit 2 ;;
  esac
done
[ -n "$WANT" ] || { [ "$WHERE" = node ] && WANT="site signin plugin" || WANT="site signin plugin live"; }
[ -z "${CI:-}" ] || AGAIN=1
FROM=${TEST_FROM:-local}
REPO=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d)
# On Windows this runs under Git Bash, whose /d/a/… paths mise (a Windows program) cannot read.
if command -v cygpath >/dev/null 2>&1; then REPO=$(cygpath -m "$REPO"); WORK=$(cygpath -m "$WORK"); fi

# Another developer's machine: start again with nothing but HOME, PATH and an empty config folder.
# (Not on Windows, where a program needs more of the environment than that to start at all.)
if [ -z "${TEST_CLEAN:-}" ] && ! command -v cygpath >/dev/null 2>&1; then
  rm -rf "$WORK"
  exec env -i HOME="$HOME" PATH="$PATH" TERM="${TERM:-xterm}" ${CI:+CI="$CI"} \
    ${TEST_LIVE_URL:+TEST_LIVE_URL="$TEST_LIVE_URL"} ${TEST_LIVE_NAME:+TEST_LIVE_NAME="$TEST_LIVE_NAME"} \
    ${TEST_FROM:+TEST_FROM="$TEST_FROM"} ${STEP_LIMIT:+STEP_LIMIT="$STEP_LIMIT"} ${XDG_CONFIG_HOME:+REAL_CONFIG="$XDG_CONFIG_HOME"} \
    ${GITHUB_TOKEN:+GITHUB_TOKEN="$GITHUB_TOKEN"} ${GIGET_AUTH:+GIGET_AUTH="$GIGET_AUTH"} TEST_CLEAN=1 bash "$0" "$@"
fi
export XDG_CONFIG_HOME=$WORK/config; mkdir -p "$XDG_CONFIG_HOME"
if [ "$FROM" = github ]; then
  INCLUDE="git::https://github.com/joeblew999/emdash-run.git//tasks.toml?ref=${TEST_REF:-main}"
  mise cache clear >/dev/null 2>&1   # mise keeps the first copy it fetched: take the current one
else
  INCLUDE=$REPO/tasks.toml
fi
cd "$REPO"

# Every task in tasks.toml has a step, and every step names a real task.
node tests/record.mjs --coverage || exit 1
# The scripts' own functions: a third of a second, and a broken edit of a site's config fails here,
# not minutes in.
node --test "tests/**/*.test.mjs" > "$WORK/unit.txt" 2>&1 || { tail -30 "$WORK/unit.txt"; echo "The unit tests fail (node --test \"tests/**/*.test.mjs\"). Nothing was run."; exit 1; }
echo "unit tests: $(grep -o 'pass [0-9]*' "$WORK/unit.txt" | grep -o '[0-9]*') pass"

# What is left to run?
TODO=""
for G in $WANT; do
  if [ -z "$AGAIN" ] && node tests/record.mjs --proven "$G" "$( [ "$G" = live ] && echo deployed || echo "$WHERE" )"; then
    echo "$G: proven — every step passed and nothing it depends on has changed. Not run again (-- --again runs it)."
  else TODO="$TODO $G"; fi
done
[ -n "$TODO" ] || { rm -rf "$WORK"; exit 0; }

# One test at a time on this machine. What must be undone when the test ends is added to CLEANUP.
CLEANUP="tidy;"; trap 'eval "$CLEANUP"' EXIT
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

. "$REPO/tests/lib.sh"
code=0; RUN_WHERE=$WHERE
for G in $TODO; do
  WHERE=$RUN_WHERE; [ "$G" != live ] || WHERE=deployed
  ROWS=$WORK/$G.rows; : > "$ROWS"; STUCK=""; D=""; began=$SECONDS
  # A config folder of its own. EmDash's CLI keeps every sign-in in ONE file, auth.json, which it
  # reads, changes and writes back with no lock: two `emdash login`s at once and one is lost.
  # Upstream: emdash-cms/emdash#3996 (when fixed: no config folder of its own is needed)
  export XDG_CONFIG_HOME=$WORK/config-$G; mkdir -p "$XDG_CONFIG_HOME"
  echo "==== $G ($WHERE)"
  . "$REPO/tests/$G/steps.sh"
  tidy
  cd "$REPO"
  [ -s "$ROWS" ] || continue
  # plain `node`: it is on the PATH inside a mise task, and `mise x --` would install every tool in
  # mise.toml first — on a CI runner that meant charter, and GitHub refused the download
  node tests/record.mjs --record "$G" "$ROWS" "$WHERE" "$( [ "$FROM" = github ] && echo GitHub || echo 'the local files' )" \
    "$(git rev-parse --short HEAD)$( [ -n "$(git status --porcelain -- tasks.toml scripts tests/lib.sh tests/run.sh "tests/$G/steps.sh")" ] && echo '+uncommitted' )" "$((SECONDS - began))" || code=1
done
D=""
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
