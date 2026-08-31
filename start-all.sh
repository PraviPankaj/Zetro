#!/usr/bin/env bash
# Run API on :8000 (internal) and Next.js on $PORT (public) — same host paths as localhost.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
export PYTHONPATH="${ROOT}/backend"
export API_INTERNAL_URL="${API_INTERNAL_URL:-http://127.0.0.1:8000}"
export MEDIA_ROOT="${MEDIA_ROOT:-${ROOT}/backend/uploads}"
mkdir -p "$MEDIA_ROOT"

cd "${ROOT}/backend"
uvicorn app.main:app --host 127.0.0.1 --port 8000 &
API_PID=$!

cleanup() {
  kill "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "Waiting for API on 127.0.0.1:8000..."
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:8000/health" >/dev/null; then
    echo "API is up."
    break
  fi
  sleep 1
done

cd "${ROOT}/apps/web"
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
