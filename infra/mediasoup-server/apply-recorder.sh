#!/usr/bin/env bash
# Adds cloud recording to the mediasoup host. Run after `apply.sh` (which sets
# MEDIASOUP_JWT_SECRET) from a directory holding this folder's files:
#   sudo ./apply-recorder.sh
set -euo pipefail

SERVER_DIR="${SERVER_DIR:-/home/ubuntu/mediasoup-demo/server}"
SERVICE="${SERVICE:-mediasoup-server.service}"
CALLBACK_URL="${SHECONOMY_RECORDING_CALLBACK_URL:-https://zsaqrrzwygzwrlzgymxk.supabase.co/functions/v1/mediasoup-recording}"
RECORDINGS_DIR="${SHECONOMY_RECORDINGS_DIR:-/home/ubuntu/sheconomy-recordings}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if ! command -v ffmpeg >/dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends ffmpeg
fi

SERVER_JS="$SERVER_DIR/lib/Server.js"
cp "$SERVER_JS" "$SERVER_JS.bak.$(date +%s)"
cp "$HERE/sheconomy-recorder.cjs" "$SERVER_DIR/lib/sheconomy-recorder.cjs"

if ! grep -q 'sheconomy-recorder' "$SERVER_JS"; then
  node - "$SERVER_JS" <<'NODE'
const fs = require('node:fs')
const file = process.argv[2]
let src = fs.readFileSync(file, 'utf8')
const replace = (from, to) => {
  if (!src.includes(from)) throw new Error(`Server.js anchor not found: ${from}`)
  src = src.replace(from, to)
}
replace(
  "const logger = new Logger_1.Logger('Server');",
  "const logger = new Logger_1.Logger('Server');\nconst sheconomyRecorder = require(\"./sheconomy-recorder.cjs\");",
)
replace(
  "this.#httpServer.on('request', this.#apiServer.getApp());",
  "const apiApp = this.#apiServer.getApp();\n        this.#httpServer.on('request', (req, res) => {\n            if (!sheconomyRecorder.handleAdminRequest(req, res))\n                apiApp(req, res);\n        });",
)
replace(
  "            roomData.room = room;\n            this.handleRoom(room);",
  "            roomData.room = room;\n            this.handleRoom(room);\n            sheconomyRecorder.registerRoom(room, producerRouter);",
)
fs.writeFileSync(file, src)
NODE
fi

install -d -o ubuntu -g ubuntu "$RECORDINGS_DIR"
chown ubuntu:ubuntu "$SERVER_DIR/lib/sheconomy-recorder.cjs" "$SERVER_JS"

mkdir -p "/etc/systemd/system/$SERVICE.d"
printf '[Service]\nEnvironment=SHECONOMY_RECORDING_CALLBACK_URL=%s\nEnvironment=SHECONOMY_RECORDINGS_DIR=%s\n' \
  "$CALLBACK_URL" "$RECORDINGS_DIR" > "/etc/systemd/system/$SERVICE.d/sheconomy-recording.conf"

(cd "$SERVER_DIR" && node -e "require('./lib/sheconomy-recorder.cjs'); require('./lib/Server.js')" )

systemctl daemon-reload
systemctl restart "$SERVICE"
sleep 3
systemctl --no-pager --lines=15 status "$SERVICE"
