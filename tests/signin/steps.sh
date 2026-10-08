# The signin group: the CLI, an agent and a browser window as an administrator of the built site.
#   mise run test:signin
# (Signing in to a deployed site, and Cloudflare Access, are in the live group.)

a_site

# a token
ok signin:token "builds and starts the site; the CLI is an administrator of it" \
   'mise run signin:token && says_i "admin" mise run emdash -- whoami --preview'
ok signin:token "run again: still an administrator" \
   'mise run signin:token && says_i "admin" mise run emdash -- whoami --preview'
ok emdash "--preview writes to the built site" \
   "mise run emdash -- content create pages --preview --slug built --data '{\"title\":\"On the built site\"}'"
ok signin:token "starts the built site when it is stopped" \
   'mise run site:stop && mise run signin:token && says slug mise run emdash -- schema list --preview'
# a window needs a screen: not on a CI runner
[ -n "${CI:-}" ] || ok signin:open "opens a signed-in window (token)" \
   'SIGNIN_OPEN_SECONDS=3 says "open: signed in" mise run signin:open'

# a passkey, on a fresh database
ok signin:passkey "completes the EmDash wizard on a fresh database" \
   'mise run site:stop; mise run step:forget; (cd site && pnpm exec emdash logout >/dev/null 2>&1); mise run signin:passkey && says slug mise run emdash -- schema list --preview'
[ -n "${CI:-}" ] || ok signin:open "opens a signed-in window (passkey)" \
   'SIGNIN_OPEN_SECONDS=3 says "open: signed in" mise run signin:open'
ok signin:token "the saved token goes when the local database does" \
   'mise run signin:token && ls "$XDG_CONFIG_HOME"/emdash-run/tokens/ | grep -q . && mise run site:stop && mise run step:forget && ! ls "$XDG_CONFIG_HOME"/emdash-run/tokens/ | grep -q .'

# all of it in one go
ok site:admin "a fresh built site, signed in, in one go" \
   'mise run --yes site:admin && says slug mise run emdash -- schema list --preview'
