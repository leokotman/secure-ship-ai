#!/usr/bin/env bash
# Compose / local smoke checks — no Ollama required.
# Usage:
#   make smoke
#   BACKEND_URL=http://localhost:8000 FRONTEND_URL=http://localhost:3000 ./scripts/smoke.sh
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

echo "==> Health ($BACKEND_URL/health)"
health="$(curl -sf "$BACKEND_URL/health")"
echo "$health" | grep -q '"status"' || {
  echo "FAIL: unexpected health payload: $health" >&2
  exit 1
}
echo "OK"

echo "==> Chat validation rejects empty message (expect 422)"
chat_code="$(
  curl -s -o /tmp/secureship-smoke-chat.json -w '%{http_code}' \
    -X POST "$BACKEND_URL/chat" \
    -H 'Content-Type: application/json' \
    -d '{"message":""}'
)"
if [[ "$chat_code" != "422" ]]; then
  echo "FAIL: expected 422, got $chat_code" >&2
  cat /tmp/secureship-smoke-chat.json >&2 || true
  exit 1
fi
echo "OK"

echo "==> Admin shipments without token (expect 401)"
admin_code="$(
  curl -s -o /tmp/secureship-smoke-admin.json -w '%{http_code}' \
    "$BACKEND_URL/admin/shipments"
)"
if [[ "$admin_code" != "401" ]]; then
  echo "FAIL: expected 401, got $admin_code" >&2
  cat /tmp/secureship-smoke-admin.json >&2 || true
  exit 1
fi
echo "OK"

if curl -sf --max-time 5 "$FRONTEND_URL" >/dev/null 2>&1; then
  echo "==> Frontend reachable ($FRONTEND_URL) — OK"
else
  echo "==> Frontend ($FRONTEND_URL) not reachable — skipped (backend smoke passed)"
fi

echo "Smoke checks passed."
