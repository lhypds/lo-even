#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Pull, install, rebuild, and restart the optional PM2 staging preview.

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found on PATH. Install it with: npm install -g pm2" >&2
  exit 1
fi

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing dependencies"
npm install

echo "==> Building"
npm run build

echo "==> Restarting lo-even"
pm2 restart ecosystem.config.cjs --update-env

