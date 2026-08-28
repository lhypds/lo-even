#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Serve the production build in the foreground. This is useful for a device on
# the LAN; published Even Hub packages carry the same dist files themselves.

if [ ! -d dist ]; then
  echo "==> dist not found — building first"
  npm run build
fi

if [ -z "${PORT:-}" ] && [ -f .env ]; then
  PORT="$(grep -m1 '^PORT=' .env | cut -d= -f2- || true)"
fi
PORT="${PORT:-4173}"

echo "==> lo-even preview on http://localhost:$PORT"
exec npm run preview -- --port "$PORT" --strictPort --clearScreen false

