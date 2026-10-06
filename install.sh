#!/bin/sh
# Put the emdash-run harness in the current directory and bring EmDash up.
#   curl -fsSL https://raw.githubusercontent.com/joeblew999/emdash-run/main/install.sh | sh
# Pick a template (default starter-cloudflare; `starter` is plain Node.js, no Cloudflare):
#   curl -fsSL …/install.sh | sh -s -- starter
set -e
TEMPLATE_CHOICE="${1:-}"
command -v mise >/dev/null 2>&1 || { echo "✗ mise is not installed — get it first: https://mise.jdx.dev/getting-started.html"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "✗ git is not installed"; exit 1; }
[ -d .git ] || git init -q
echo "→ fetching the harness into $(pwd)"
curl -fsSL https://github.com/joeblew999/emdash-run/releases/latest/download/emdash-harness.tar.gz | tar xz
if [ -f mise.toml ]; then
  if ! grep -q '^TEMPLATE' mise.toml; then
    echo "✗ you already have a mise.toml, and it has no EmDash settings."
    echo "  copy the [env] block from nu/project.example.toml into it, then run: mise trust --all && mise run setup"
    exit 1
  fi
else
  cp nu/project.example.toml mise.toml
  if [ -n "$TEMPLATE_CHOICE" ]; then mise set "TEMPLATE=$TEMPLATE_CHOICE"; mise fmt; fi
  echo "  ✓ mise.toml — your settings; edit it any time, then: mise run dev"
fi
mise trust --all -q
echo "→ mise run setup (a few minutes the first time)"
exec mise run setup
