#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Non-interactive shells can miss the system directories containing ipconfig
# and route, so include them while detecting a reachable LAN address.
export PATH="$PATH:/usr/sbin:/sbin"

PORT="${DEV_PORT:-5173}"

lan_ip() {
  local ip iface
  if command -v ipconfig >/dev/null 2>&1; then
    for iface in en0 en1 en2; do
      ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
      [ -n "$ip" ] && { echo "$ip"; return; }
    done
  fi
  if command -v ip >/dev/null 2>&1; then
    ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')"
    [ -n "$ip" ] && { echo "$ip"; return; }
  fi
  if command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}'
  fi
}

IP="$(lan_ip)"
if [ -z "$IP" ]; then
  echo "!! Could not detect a LAN IP — other devices may not reach the dev server." >&2
  IP="localhost"
fi
URL="http://$IP:$PORT"

if command -v evenhub >/dev/null 2>&1; then
  evenhub qr --url "$URL" || echo "!! evenhub qr failed — continuing without a QR code." >&2
else
  echo "==> evenhub not found on PATH; skipping QR code."
  echo "    App URL: $URL"
  echo "    Install per https://hub.evenrealities.com/docs/getting-started/overview"
fi

npm run dev -- --host 0.0.0.0 --port "$PORT" --strictPort --clearScreen false

