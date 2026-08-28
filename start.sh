#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Run the built preview under PM2. The Even Hub release itself does not require
# this process; it is for a stable LAN/staging preview.

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found on PATH. Install it with: npm install -g pm2" >&2
  exit 1
fi

if [ ! -x node_modules/.bin/vite ]; then
  echo "==> Dependencies not installed — installing"
  npm ci || npm install
fi

if [ ! -d dist ]; then
  echo "==> dist not found — building"
  npm run build
fi

pm2 startOrReload ecosystem.config.cjs

PM2_NAME="$(grep -m1 '^PM2_NAME=' .env 2>/dev/null | cut -d= -f2- || true)"
PORT="$(grep -m1 '^PORT=' .env 2>/dev/null | cut -d= -f2- || true)"
pm2 list
echo
echo "==> ${PM2_NAME:-lo-even} is running under PM2 on port ${PORT:-4173}."
echo "    Logs: pm2 logs ${PM2_NAME:-lo-even}"

