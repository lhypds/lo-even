#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Usage:
#   ./stop.sh
#   ./stop.sh --delete

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found on PATH — nothing to stop." >&2
  exit 0
fi

PM2_NAME="$(grep -m1 '^PM2_NAME=' .env 2>/dev/null | cut -d= -f2- || true)"
PM2_NAME="${PM2_NAME:-lo-even}"

if [ "${1:-}" = "--delete" ]; then
  pm2 delete ecosystem.config.cjs && echo "==> $PM2_NAME stopped and removed from PM2."
else
  pm2 stop ecosystem.config.cjs && echo "==> $PM2_NAME stopped (still in PM2; ./start.sh to resume)."
fi

