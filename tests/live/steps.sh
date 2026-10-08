# The live group: the tasks that act on a deployed site.   mise run test:live
#
# It puts a fresh starter site on a Worker kept for testing. Two settings, in this repo's gitignored
# mise.local.toml: TEST_LIVE_URL, its address, and TEST_LIVE_NAME, the Worker's name — its database
# is <name>, its bucket <name>-media. Without them (on CI, on a machine with no Cloudflare login)
# the group is not run, and its record keeps what it last showed.

if [ -z "${TEST_LIVE_URL:-}" ] || [ -z "${TEST_LIVE_NAME:-}" ]; then
  echo "live: not run — no TEST_LIVE_URL / TEST_LIVE_NAME here. Its record keeps what it last showed."; return
fi
# The developer's real Cloudflare login and fnox, not the empty config folder.
if [ -n "${REAL_CONFIG:-}" ]; then export XDG_CONFIG_HOME=$REAL_CONFIG; else unset XDG_CONFIG_HOME; fi
# One at a time: two runs deploying to the same Worker would overwrite each other.
LIVELOCK="$HOME/.config/emdash-run/locks/deployed-$TEST_LIVE_NAME"
mkdir -p "$(dirname "$LIVELOCK")"
if ! mkdir "$LIVELOCK" 2>/dev/null; then
  if [ -n "$(find "$LIVELOCK" -maxdepth 0 -mmin -30 2>/dev/null)" ]; then
    echo "live: not run — another run is using the test Worker ($LIVELOCK). Its record keeps what it last showed."; return
  fi
  echo "(a lock older than 30 minutes was left behind: taking it)"
fi
CLEANUP="$CLEANUP rmdir '$LIVELOCK' 2>/dev/null;"
LIVE_URL_=$TEST_LIVE_URL
STAMP=shipped-$(date +%s)

project cloudflare:starter "LIVE_URL = \"$TEST_LIVE_URL\"" 'ADMIN_EMAIL = "agent@emdash.local"'
need site:ports 'mise run site:ports'

# a site, with Cloudflare Access in front of its admin
ok site:new "makes the site that will be deployed" \
   'mise run site:new && sed -i.bak "s/\"my-emdash-site\"/\"$TEST_LIVE_NAME\"/g; s/\"my-emdash-media\"/\"$TEST_LIVE_NAME-media\"/" site/wrangler.jsonc && mise run site:start && mise run site:stop'
ok signin:access "Cloudflare Access is in front of the admin" \
   'mise run signin:access > access.txt 2>&1; grep -q "access: application" access.txt'
ok signin:access "uploaded media stays public; the team's domain is printed before any deploy" \
   'grep -q "uploaded media" access.txt && grep -q "teamDomain: \"[a-z0-9-]*.cloudflareaccess.com\"" access.txt && node "$REPO/tests/live/signin-access-lines.mjs" access.txt site'
ok emdash "a site set to Cloudflare Access: the dev site starts and the CLI works on it" \
   'grep -q "auth: access(" site/astro.config.mjs && grep -q CF_ACCESS_AUDIENCE site/wrangler.jsonc && mise run site:start && says slug mise run emdash -- schema list && mise run site:stop'

# deploying
ok live:ship "deploys; the site answers with the change" \
   "printf '<p>%s</p>\n' $STAMP > site/src/pages/zz-shipped.astro && mise run live:ship && (for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS \$LIVE_URL_/zz-shipped 2>/dev/null | grep -q $STAMP && exit 0; sleep 3; done; exit 1)"
ok signin:access "run again: changes nothing" \
   'says "already" mise run signin:access'

# the CLI on the deployed site
ok signin:token "--live: the CLI is an administrator of the deployed site" \
   'mise run signin:token -- --live && says_i "admin" mise run emdash -- whoami --live'
ok signin:token "--live, run again: still an administrator" \
   'mise run signin:token -- --live && says_i "admin" mise run emdash -- whoami --live'
ok emdash "--live reads and writes the deployed site" \
   "says slug mise run emdash -- schema list --live && mise run emdash -- content create pages --live --slug test-\$(date +%s) --data '{\"title\":\"Made by the test\"}'"
ok plugin:works "--live: the deployed site is checked from outside; it says what it skips, and builds and restarts nothing" \
   'mise run plugin:works -- --live > works-live.txt 2>&1; grep -q "skip builds" works-live.txt && grep -q "skip starts" works-live.txt && grep -q "ok   answers" works-live.txt && ! grep -q "^FAIL\|\] FAIL" works-live.txt'
ok model:sync "--live records the deployed model" \
   'mise run model:sync -- --live && test -f site/.emdash/schema.json'
ok content:pull "downloads the deployed site as a package" \
   'mise run content:pull && ls site/backups/*.emdash'
ok live:backup "the database bookmark and a package" \
   'says "bookmark is" mise run live:backup'

# a preview
ok live:preview "a preview: an address of its own, the live site still answers" \
   'mise run live:preview -- test > preview.txt 2>&1; grep -q "PREVIEW \"test\"" preview.txt && grep -q "\"previews\"" site/wrangler.jsonc && curl -fsS -o /dev/null "$LIVE_URL_/" && (for i in 1 2 3 4 5 6 7 8 9 10; do test "$(curl -s -o /dev/null -w "%{http_code}" --max-time 120 "${LIVE_URL_/:\/\//://test-}/_emdash/admin")" = 302 && exit 0; sleep 3; done; cat preview.txt | tail -15; exit 1)'
ok live:preview "run again: the same preview, nothing new made" \
   'mise run live:preview -- test > preview2.txt 2>&1; grep -q "PREVIEW \"test\"" preview2.txt && ! grep -q "preview: made\|wrote the" preview2.txt'
ok signin:token "LIVE_PREVIEW: the CLI is an administrator of the preview, in the preview's own database" \
   'LIVE_PREVIEW=test mise run signin:token -- --live > preview3.txt 2>&1; grep -q "its own database" preview3.txt && LIVE_PREVIEW=test says_i "admin" mise run emdash -- whoami --live'
ok live:preview "--delete removes it; again: nothing to delete" \
   'says "is deleted" mise run live:preview -- test --delete && says "nothing to delete" mise run live:preview -- test --delete'

# watching it, and who gets in
ok live:logs "shows a request to the deployed site" \
   '(for_a_while 20 mise run live:logs > tail.txt 2>&1 &); sleep 12; curl -s -o /dev/null "$LIVE_URL_/?from=test"; sleep 10; grep -q GET tail.txt'
[ -n "${CI:-}" ] || ok signin:open "--live opens a signed-in window" \
   'SIGNIN_OPEN_SECONDS=3 says "open: signed in" mise run signin:open -- --live'
ok signin:access "a visitor reaches uploaded media and plugins' public routes without signing in" \
   'test "$(curl -s -o /dev/null -w "%{http_code}" "$LIVE_URL_/_emdash/api/media/file/none.png")" != 302 && test "$(curl -s -o /dev/null -w "%{http_code}" "$LIVE_URL_/_emdash/api/plugins/none/info")" != 302 && test "$(curl -s -o /dev/null -w "%{http_code}" "$LIVE_URL_/_emdash/admin")" = 302'

# undoing
ok live:undo "puts the previous version back: the change is gone" \
   "mise run live:undo && (for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS \$LIVE_URL_/zz-shipped?t=\$i 2>/dev/null | grep -q $STAMP || exit 0; sleep 3; done; exit 1)"
ok site:delete "removes the local site folder" \
   'mise run --yes site:delete && test ! -e site'
