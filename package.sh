#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

APP_JSON="app.json"
DIST_DIR="dist"

echo "==> Checking evenhub CLI"
if ! command -v evenhub >/dev/null 2>&1; then
  echo "    evenhub not found on PATH."
  echo "    Install it: npm i -g @evenrealities/evenhub-cli"
  echo "    Docs: https://hub.evenrealities.com/docs/getting-started/overview"
  exit 1
fi

PACKAGE_ID="$(node -p "require('./$APP_JSON').package_id" 2>/dev/null || echo app)"
VERSION="$(node -p "require('./$APP_JSON').version" 2>/dev/null || echo 0.0.0)"
OUTPUT="${PACKAGE_ID}-${VERSION}.ehpk"

echo "==> Building web app"
npm run build

if [ ! -d "$DIST_DIR" ]; then
  echo "    Build did not produce '$DIST_DIR/'. Aborting." >&2
  exit 1
fi

echo "==> Packing into $OUTPUT"
evenhub pack "$APP_JSON" "$DIST_DIR" -o "$OUTPUT"

shopt -s nullglob
for OLD in "${PACKAGE_ID}"-*.ehpk; do
  [ "$OLD" = "$OUTPUT" ] && continue
  OLD_VERSION="${OLD#"${PACKAGE_ID}"-}"
  OLD_VERSION="${OLD_VERSION%.ehpk}"
  # only drop packages strictly older than the one just built
  if [ "$(printf '%s\n%s\n' "$OLD_VERSION" "$VERSION" | sort -V | head -n1)" = "$OLD_VERSION" ]; then
    rm -f "$OLD"
    echo "    Removed old package $OLD"
  fi
done
shopt -u nullglob

echo
echo "Done: $OUTPUT"
echo "Next: upload it at https://hub.evenrealities.com/hub/${PACKAGE_ID}"

