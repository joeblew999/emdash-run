#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMDASH_DIR="$ROOT/emdash"

# ── Clone or update ──────────────────────────────────────────────────────────
if [ ! -d "$EMDASH_DIR" ]; then
  echo "→ Cloning emdash..."
  git clone https://github.com/emdash-cms/emdash.git "$EMDASH_DIR"
else
  echo "→ Updating emdash..."
  git -C "$EMDASH_DIR" pull --ff-only
fi

# ── Install ──────────────────────────────────────────────────────────────────
echo "→ Installing dependencies..."
cd "$EMDASH_DIR"
pnpm install --frozen-lockfile

# ── Build packages ───────────────────────────────────────────────────────────
echo "→ Building packages..."
pnpm build

# ── Copy CAD demo config ─────────────────────────────────────────────────────
echo "→ Applying CAD demo config..."
cp "$ROOT/config/astro.config.mjs" "$EMDASH_DIR/demos/plugins-demo/astro.config.mjs"

# ── Seed ─────────────────────────────────────────────────────────────────────
echo "→ Seeding database..."
pnpm --filter emdash-demo seed

# ── Dev ──────────────────────────────────────────────────────────────────────
echo ""
echo "✓ Ready. Opening http://localhost:4321/_emdash/admin"
echo ""
pnpm --filter emdash-demo dev
