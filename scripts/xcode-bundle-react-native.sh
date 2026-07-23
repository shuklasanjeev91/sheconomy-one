#!/usr/bin/env bash
# Wrapper around react-native-xcode.sh with progress logs and a hard timeout so
# Archive never sits on "Building" forever. Exit non-zero on timeout so Xcode
# shows Build Failed instead of hanging.
set -euo pipefail

BUNDLE_TIMEOUT_SEC="${BUNDLE_TIMEOUT_SEC:-1200}" # 20 minutes

if [[ -z "${NODE_BINARY:-}" ]]; then
  echo "error: NODE_BINARY is not set" >&2
  exit 1
fi

RN_XCODE_SH="$("$NODE_BINARY" --print "require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'")"

echo "[SHEconomy] Bundle React Native — starting (timeout ${BUNDLE_TIMEOUT_SEC}s)"
echo "[SHEconomy] NODE_BINARY=$NODE_BINARY"
echo "[SHEconomy] HERMES_CLI_PATH=${HERMES_CLI_PATH:-"(unset)"}"
echo "[SHEconomy] CONFIGURATION=${CONFIGURATION:-"(unset)"} ENTRY_FILE=${ENTRY_FILE:-"(unset)"}"

# macOS has no GNU timeout by default; use perl alarm.
set +e
perl -e 'alarm shift; exec @ARGV' "$BUNDLE_TIMEOUT_SEC" /bin/bash "$RN_XCODE_SH"
STATUS=$?
set -e

if [[ $STATUS -eq 142 ]] || [[ $STATUS -eq 14 ]]; then
  # 142 = 128+SIGALRM on some systems; 14 = SIGALRM
  echo "error: JS bundle phase timed out after ${BUNDLE_TIMEOUT_SEC}s. Check Report navigator for the last log line." >&2
  exit 1
fi

if [[ $STATUS -ne 0 ]]; then
  echo "error: react-native-xcode.sh failed with exit code $STATUS" >&2
  exit "$STATUS"
fi

echo "[SHEconomy] Bundle React Native — finished successfully"
exit 0
