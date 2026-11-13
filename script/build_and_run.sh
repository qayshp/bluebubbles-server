#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/usr/local/opt/node@20/bin:$PATH"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
MODE="${1:---verify}"
OUT="$ROOT/packages/server/releases/custom-local/mac/BlueBubbles.app"
case "$MODE" in run|--verify|--logs|--telemetry|--debug|--build-only|--install-only) ;; *) echo 'Usage: build_and_run.sh [--verify|--logs|--telemetry|--debug|--build-only|--install-only]' >&2; exit 2;; esac
if [ "$MODE" != '--install-only' ]; then
    python3 script/test_operations.py
    npm run test:custom --workspace=@bluebubbles/server
    npm run build-ui
    npm run build --workspace=@bluebubbles/server
    (cd packages/server && CSC_IDENTITY_AUTO_DISCOVERY=false ../../node_modules/.bin/electron-builder --mac --x64 --dir --publish never --config scripts/electron-builder-config.js --config.npmRebuild=false --config.mac.notarize=false --config.directories.output=releases/custom-local)
    python3 script/deploy_custom.py record "$ROOT" "$OUT"
    python3 script/deploy_custom.py validate "$ROOT" "$OUT"
fi
if [ "$MODE" = '--build-only' ]; then exit 0; fi
# Deployment validates a private staged bundle before stopping the exact custom app.
if [ "$MODE" = '--debug' ]; then
    python3 script/deploy_custom.py deploy "$ROOT" "$OUT" --debug
else
    python3 script/deploy_custom.py deploy "$ROOT" "$OUT"
fi
"$ROOT/script/ensure_running.sh"
case "$MODE" in
 --logs) exec tail -f "$HOME/Library/Logs/bluebubbles-server/main.log";;
 --telemetry) exec /usr/bin/log stream --info --predicate 'process == "BlueBubbles"';;
esac
"$ROOT/script/health.py"
