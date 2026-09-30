#!/usr/bin/env bash
# Run on the mediasoup host from a directory holding this folder's files:
#   MEDIASOUP_JWT_SECRET=... sudo -E ./apply.sh
# The secret must match the `MEDIASOUP_JWT_SECRET` Supabase function secret.
set -euo pipefail

SERVER_DIR="${SERVER_DIR:-/home/ubuntu/mediasoup-demo/server}"
SERVICE="${SERVICE:-mediasoup-server.service}"
HERE="$(cd "$(dirname "$0")" && pwd)"

: "${MEDIASOUP_JWT_SECRET:?set MEDIASOUP_JWT_SECRET}"

cp "$SERVER_DIR/lib/WsServer.js" "$SERVER_DIR/lib/WsServer.js.bak.$(date +%s)"
cp "$HERE/sheconomy-auth.cjs" "$SERVER_DIR/lib/sheconomy-auth.cjs"
if ! grep -q 'sheconomy-auth' "$SERVER_DIR/lib/WsServer.js"; then
  (cd "$SERVER_DIR" && patch -p1 < "$HERE/WsServer.patch")
fi
chown ubuntu:ubuntu "$SERVER_DIR/lib/sheconomy-auth.cjs" "$SERVER_DIR/lib/WsServer.js"

mkdir -p "/etc/systemd/system/$SERVICE.d"
umask 077
printf '[Service]\nEnvironment=MEDIASOUP_JWT_SECRET=%s\n' "$MEDIASOUP_JWT_SECRET" \
  > "/etc/systemd/system/$SERVICE.d/sheconomy-auth.conf"

systemctl daemon-reload
systemctl restart "$SERVICE"
systemctl --no-pager --lines=20 status "$SERVICE"
