# The plugin group: a plugin of your own, and plugins from EmDash's registry.   mise run test:plugin
# The unit tests of the scripts' own functions are here too (*.test.mjs, fixtures/): they run first
# in every test, and in mise run check.

a_site

# the sandbox
ok plugin:sandbox "the site can run sandboxed plugins: the runner is in its config" \
   'mise run plugin:sandbox && grep -q "sandboxRunner" site/astro.config.mjs'
ok plugin:sandbox "run again: nothing changes" \
   'before=$(cat site/astro.config.mjs site/package.json); says "nothing changed" mise run plugin:sandbox && test "$before" = "$(cat site/astro.config.mjs site/package.json)"'

# a plugin of your own
ok plugin:new "scaffolds, tests, builds and adds a plugin — to the site's config too, by itself" \
   'mise run plugin:new -- save-log && test -f site/plugins/save-log/dist/plugin.mjs && grep -q save-log site/package.json && grep -q "sandboxed: \[saveLog\]" site/astro.config.mjs'
ok plugin:new "run again: not scaffolded twice, still builds, the config is not touched" \
   'before=$(cat site/astro.config.mjs); says "already there" mise run plugin:new -- save-log && test -f site/plugins/save-log/dist/plugin.mjs && test "$before" = "$(cat site/astro.config.mjs)"'
ok plugin:check "the plugin passes its checks" \
   'mise run plugin:check -- save-log'
ok plugin:add "a native plugin from npm: the package is added, its two lines are printed, the config is not touched" \
   'before=$(cat site/astro.config.mjs); mise run plugin:add -- @emdash-cms/plugin-forms > add.txt 2>&1; r=$?; test $r != 0 && grep -q plugin-forms site/package.json && grep -q "import { formsPlugin } from \"@emdash-cms/plugin-forms\";" add.txt && grep -q "plugins: \[formsPlugin()\]," add.txt && test "$before" = "$(cat site/astro.config.mjs)"'
no plugin:publish "asks first, and stops with nobody to answer (a real publish is never run)" \
   'env -u MISE_YES -u CI mise run plugin:publish -- save-log </dev/null'
ok plugin "passes any command to the plugin CLI" \
   'says_i "search" mise run plugin -- --help'

# from the registry: install, check, remove
ok plugin:search "finds plugins in the registry" \
   'says_i "forms" mise run plugin:search -- forms'
ok plugin:install "installs a registry plugin with no clicking, from a stopped site" \
   'says "contact-forms: installed" mise run plugin:install -- @masonjames.com/contact-forms --yes'
ok plugin:install "run again: it is already installed" \
   'says "contact-forms: already installed" mise run plugin:install -- @masonjames.com/contact-forms --yes'
no plugin:install "a plugin that can change things or reach outside is not installed without a yes" \
   'env -u MISE_YES -u CI mise run plugin:install -- @meekmedia.bsky.social/link-guardian'
no plugin:install "a release other than the one asked for is not installed" \
   'mise run plugin:install -- @netdollar.dev/forms@0.0.1'
no plugin:install "a plugin the registry does not have: says so and fails" \
   'mise run plugin:install -- @nobody.example/nothing'
ok plugin:works "the registry plugin: every check passes" \
   'mise run plugin:works -- @masonjames.com/contact-forms --fresh > works.txt 2>&1; grep -q "contact-forms: loads and answers" works.txt && ! grep -q "FAIL" works.txt'
ok plugin:works "the plugin plugin:new made: its route answers from the sandbox" \
   'says "save-log routes: 1 declared, each asked with a GET: hello 200" mise run plugin:works -- save-log'
no plugin:works "a plugin the site does not have fails" \
   'mise run plugin:works -- no-such-plugin'
ok plugin:remove "removes a registry plugin" \
   'says "contact-forms: removed" mise run plugin:remove -- @masonjames.com/contact-forms'
ok plugin:remove "run again: nothing to remove" \
   'says "nothing to remove" mise run plugin:remove -- @masonjames.com/contact-forms'

# the favourites
ok plugin:favourites "installs the favourites in one go" \
   'mise run plugin:favourites -- --yes > fav.txt 2>&1; ! grep -q "^FAIL\|^STOP" fav.txt && test "$(grep -c ": installed" fav.txt)" -ge 4'
ok plugin:favourites "run again: all already installed" \
   'mise run plugin:favourites -- --yes > fav.txt 2>&1; ! grep -q "^FAIL\|^STOP" fav.txt && ! grep -q ": installed" fav.txt && grep -q "already installed" fav.txt'
ok plugin:favourites "PLUGINS in the project chooses the list" \
   'PLUGINS="@lasymphonieagency.com/comment-notify" says "comment-notify: installed" mise run plugin:favourites -- --yes'

# a release by version, and updating it
no plugin:update "a plugin that is not installed: says so and fails" \
   'mise run plugin:update -- @meekmedia.bsky.social/bulletin@0.1.1'
ok plugin:install "an older release, asked for by version, is the one installed" \
   'says "bulletin: installed — 0.1.0" mise run plugin:install -- --yes @meekmedia.bsky.social/bulletin@0.1.0'
no plugin:update "no release named: says which the site has and the registry's newest, and fails" \
   'mise run plugin:update -- @meekmedia.bsky.social/bulletin'
ok plugin:update "to the release named: prints what was granted and what each release declares; it asks for nothing more, so no yes is needed" \
   'env -u MISE_YES -u CI mise run plugin:update -- @meekmedia.bsky.social/bulletin@0.1.1 > update.txt 2>&1; grep -q "0.1.0, installed, was granted: .*email:send" update.txt && grep -q "0.1.1 declares, by the registry: .*email.send" update.txt && grep -q "asks for nothing more" update.txt && grep -q "bulletin: updated — 0.1.0 -> 0.1.1" update.txt'
ok plugin:update "run again: nothing to update" \
   'says "already at 0.1.1" mise run plugin:update -- @meekmedia.bsky.social/bulletin@0.1.1'
no plugin:update "an older release is refused" \
   'mise run plugin:update -- @meekmedia.bsky.social/bulletin@0.1.0'

# everything the site now has
ok plugin:works "no name: every plugin in the site loads and answers — the favourites among them" \
   'mise run plugin:works > works.txt 2>&1; ! grep -q "FAIL\|DOES NOT WORK" works.txt && test "$(grep -c ": loads and answers" works.txt)" -ge 6'
