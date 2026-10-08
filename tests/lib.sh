# What a group's steps are written with. tests/run.sh reads this, then the group's steps.sh.
#
#   ok <task> "<what it shows>" '<command>'     a step that must succeed
#   no <task> "<what it shows>" '<command>'     a step that must refuse
#   need <task> '<command>'                     what the steps stand on: not a step, but when it
#                                               fails the group fails there, and says so
#   says "<words>" <command…>                   the command's output must hold the words (says_i: any case)
#   a_site                                      a project with a site in it and its two ports
#
# Set by the runner: REPO, WORK, G (the group), WHERE (cloudflare, node or deployed), ROWS.

# One step: the task it tests, what it shows, the command.
step() { # $1 = ok|no  $2 = task  $3 = what  $4 = command
  local verdict detail="" began=$SECONDS pid stuck="" rc
  # A step that does not end is stopped at STEP_LIMIT seconds and fails with what it had printed: on
  # Windows a step once waited 40 minutes, to the job's limit, and the log said nothing of which.
  # The steps after it in the group are not run (but the clean-up): they would each wait as long.
  if [ -n "${STUCK:-}" ] && [ "$2" != site:stop ] && [ "$2" != site:delete ]; then
    echo "not run: [$STUCK]" > "$D/step.log"; rc=1; stuck=skipped
  else
    ( eval "$4" ) > "$D/step.log" 2>&1 & pid=$!
    while kill -0 "$pid" 2>/dev/null; do
      if [ $((SECONDS - began)) -ge "${STEP_LIMIT:-900}" ]; then kill "$pid" 2>/dev/null; stuck=1; STUCK="$2: $3 did not end"; break; fi
      sleep 0.3
    done
    wait "$pid" 2>/dev/null; rc=$?
  fi
  if [ "$stuck" = 1 ]; then verdict=FAIL; detail="did not end in ${STEP_LIMIT:-900}s and was stopped"
  elif [ "$stuck" = skipped ]; then verdict=FAIL; detail="not run: $STUCK"
  elif [ "$rc" = 0 ]; then [ "$1" = ok ] && verdict=PASS || { verdict=FAIL; detail="it should have refused"; }
  else [ "$1" = no ] && verdict=PASS || { verdict=FAIL; detail=$(tail -3 "$D/step.log" | sed 's/\x1b\[[0-9;]*m//g' | tr '\n|' '  ' | cut -c1-160); }; fi
  printf '%s|%s|%s|%s|%s|%s\n' "$2" "$3" "$verdict" "$detail" "$1" "$((SECONDS - began))" >> "$ROWS"
  # with how long it took: on a CI runner that is how a slow step is told from a stuck one
  printf '%-4s %-18s %s (%ss)\n' "$verdict" "$2" "$3" "$((SECONDS - began))"
  # a failure shows its last output here too — on a CI runner this is the only place it can be read
  if [ "$verdict" = FAIL ]; then tail -30 "$D/step.log" | sed 's/\x1b\[[0-9;]*m//g' | cut -c1-220 | sed 's/^/       > /'; fi
  if [ "$stuck" = 1 ]; then echo "       > $detail"; fi
}
ok() { step ok "$@"; }
no() { step no "$@"; }

# What the group's steps stand on. It passing is not news; it failing is the group's failure.
need() { # $1 = task  $2 = command
  [ -z "${STUCK:-}" ] || return 0
  ( eval "$2" ) > "$D/need.log" 2>&1 && return 0
  printf '%s|%s|FAIL|%s|ok|0\n' "$1" "needed before the $G steps" "$(tail -3 "$D/need.log" | sed 's/\x1b\[[0-9;]*m//g' | tr '\n|' '  ' | cut -c1-160)" >> "$ROWS"
  printf 'FAIL %-18s needed before the %s steps\n' "$1" "$G"
  tail -30 "$D/need.log" | sed 's/\x1b\[[0-9;]*m//g' | cut -c1-220 | sed 's/^/       > /'
  STUCK="$1, needed first, failed"
}

# A command whose output must say something. Never `mise run … | grep -q`: the output would be lost
# to the step's log, so a failure on a CI runner showed nothing; and on Windows a site the task
# leaves running keeps the pipe open, so a grep that has not found its words waits for ever.
says() { local want=$1; shift; "$@" > "$D/said.txt" 2>&1; cat "$D/said.txt"; grep -q -- "$want" "$D/said.txt"; }
says_i() { local want=$1; shift; "$@" > "$D/said.txt" 2>&1; cat "$D/said.txt"; grep -qi -- "$want" "$D/said.txt"; }

# Run a command that never ends for a few seconds, then stop IT — its own process group, nothing
# else by that name on the machine: another run, or another agent, may be following a log too.
for_a_while() { # $1 = seconds  $2.. = the command
  perl -e 'setpgrp(0,0); exec @ARGV' "${@:2}" & local p=$!
  sleep "$1"; kill -TERM -- -"$p" 2>/dev/null || kill "$p" 2>/dev/null; wait "$p" 2>/dev/null; true
}

# A project as another repo has one: a folder, a mise.toml that includes the tasks, no ports yet.
project() { # $1 = template  $2.. = extra [env] lines
  D=$WORK/$G; mkdir -p "$D" && cd "$D" && git init -q
  { printf '[settings]\nexperimental = true\n[tools]\nnode = "26"\npnpm = "12"\nfnox = "1.36.0"\n[env]\nTEMPLATE = "%s"\n' "$1"
    printf 'PLUGIN_PUBLISHER = "did:web:example.com"\nPLUGIN_AUTHOR = "Example Author"\nPLUGIN_SECURITY_EMAIL = "security@example.com"\n'
    shift; for line in "$@"; do printf '%s\n' "$line"; done
    printf '[task_config]\nincludes = ["%s"]\n' "$INCLUDE"; } > mise.toml
  mise trust -q .
}
# This repo's site, as committed and with its packages if they are installed: copied (cp -c is an
# instant copy on macOS), without what is the machine's — its database, its build, its key.
copy_site() {
  cp -Rc "$REPO/site" site 2>/dev/null || { rm -rf site; cp -R "$REPO/site" site; }
  rm -rf site/.wrangler site/dist site/.astro site/.env site/backups
}
port() { sed -n "s/^$1 = \"\([0-9]*\)\"/\1/p" mise.local.toml; }
# The two addresses, once the project has its ports.
addresses() { SITE=http://localhost:$(port SITE_PORT); BUILT=http://localhost:$(port PREVIEW_PORT); }
# A project with a site in it and its ports: a copy of this repo's site/, or (test:node) a site
# made from EmDash's Node template.
a_site() {
  if [ "$WHERE" = node ]; then project node:starter; else project cloudflare:blog; fi
  need site:ports 'mise run site:ports'
  if [ "$WHERE" = node ]; then need site:new 'mise run site:new'; else copy_site; fi
  addresses
}
# After a group, whatever it left running is stopped. Its folder goes with the run's.
tidy() {
  [ -n "${D:-}" ] && [ -d "$D" ] || return 0
  (cd "$D" && { [ ! -d site ] || (cd site && pnpm exec emdash logout); mise run site:stop; }) > /dev/null 2>&1
  cd "$REPO"
}
