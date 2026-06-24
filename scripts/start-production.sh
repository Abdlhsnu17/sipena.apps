#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
FRONTEND_PORT="${PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-4000}"

export PORT="$BACKEND_PORT"
export API_PROXY_TARGET="${API_PROXY_TARGET:-http://127.0.0.1:$BACKEND_PORT}"

cd "$APP_ROOT"
npm run start:backend &
BACKEND_PID="$!"

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

cd "$APP_ROOT/packages/frontend"
exec npm run start -- --hostname 0.0.0.0 --port "$FRONTEND_PORT"
