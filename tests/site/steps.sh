# The site group: making, running, checking and deleting a site.   mise run test:site
# On a copy of this repo's site/ (test:node: on a site made from EmDash's Node template).

if [ "$WHERE" = node ]; then project node:starter; else project cloudflare:blog; fi

ok site:ports "gives the project two ports of its own" \
   'mise run site:ports && test -n "$(port SITE_PORT)" && test -n "$(port PREVIEW_PORT)"'
ok site:ports "run again: it keeps them" \
   'before=$(cat mise.local.toml); says "already has its ports" mise run site:ports && test "$before" = "$(cat mise.local.toml)"'
addresses

if [ "$WHERE" = node ]; then
  no site:start "with no site, says so and stops" \
     'mise run site:start'
  ok site:new "makes the site" \
     'mise run site:new'
else
  copy_site
fi
ok site:new "run again: the site is left alone" \
   'says "already a site" mise run site:new'

# the dev site
ok site:start "starts the dev site; EmDash's welcome dialog is closed" \
   'says "welcome dialog is closed" mise run site:start'
ok site:start "run again: it is already running" \
   'mise run site:start'
ok site:start "the dev site answers; dev sign-in works" \
   'test "$(curl -s -o /dev/null -w "%{http_code}" --max-time 120 $SITE/)" = 200 && curl -fsS -X POST $SITE/_emdash/api/setup/dev-bypass -o /dev/null'
ok site:logs "shows the dev site log" \
   'for_a_while 5 mise run site:logs > logs.txt 2>&1; grep -q . logs.txt'

# EmDash's CLI, on it
ok emdash "a quoted JSON argument arrives whole" \
   "mise run emdash -- content create pages --draft --slug audit --data '{\"title\":\"Two words, one argument, from $WHERE\"}' && says 'Two words, one argument, from $WHERE' mise run emdash -- content get pages audit --json"
ok emdash "whoami on the dev site" \
   'says_i "dev-bypass" mise run emdash -- whoami'
no emdash "--live with no LIVE_URL says so" \
   'mise run emdash -- schema list --live'
no content:pull "with no LIVE_URL says so" \
   'mise run content:pull'

# checking it
ok site:check "passes on a sound site" \
   'mise run site:check'
ok site:check "fails on a type error" \
   'printf -- "---\nconst n: number = \"text\";\n---\n<p>{n}</p>\n" > site/src/pages/zz.astro; mise run site:check; r=$?; rm site/src/pages/zz.astro; test $r != 0'
ok model:sync "records an added field in .emdash/" \
   'mise run emdash -- schema add-field pages subtitle --type string --label Subtitle && mise run model:sync && grep -q subtitle site/.emdash/schema.json'

# the built site
ok site:preview "serves the built site; dev sign-in is off there" \
   'mise run site:preview && test "$(curl -s -o /dev/null -w "%{http_code}" $BUILT/_emdash/api/setup/dev-bypass)" = 403'
[ "$WHERE" = node ] || ok live:check "the deploy rehearses with no account" \
   'mise run live:check'
ok emdash:update "updates, type-checks and builds" \
   'mise run emdash:update'

# emptying, stopping, deleting
ok site:reset "empties the local content" \
   'mise run site:start && mise run --yes site:reset && ! mise run emdash -- content get pages audit --json'
no site:reset "refuses with nobody to ask" \
   'env -u MISE_YES -u CI mise run site:reset </dev/null'
no site:delete "refuses with nobody to ask" \
   'env -u MISE_YES -u CI mise run site:delete </dev/null'
ok site:stop "stops both sites; twice is fine" \
   'mise run site:stop && mise run site:stop && test "$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 $BUILT/ || true)" != 200'
ok site:delete "removes the site folder" \
   '(cd site && pnpm exec emdash logout >/dev/null 2>&1); mise run --yes site:delete && test ! -e site'
ok site:delete "run again: nothing to delete" \
   'says "nothing to delete" mise run --yes site:delete'

# from nothing: the one thing a copy of a site that exists cannot show
if [ "$WHERE" != node ]; then
  no site:start "with no site, says so and stops" \
     'mise run site:start'
  ok site:new "makes a site from nothing, from EmDash's template" \
     'mise run site:new -- cloudflare:starter && test -f site/package.json'
fi
