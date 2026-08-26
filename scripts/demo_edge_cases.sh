#!/usr/bin/env bash
# Phase 5 edge-case dry-run — fast HTTP checks against a running stack.
# Does not require Ollama for most scenarios (rate limit is covered by pytest).
#
# Prerequisites:
#   make start && make seed
#
# Usage:
#   make demo
#   BACKEND_URL=http://localhost:8000 ./scripts/demo_edge_cases.sh
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> SecureShip Phase 5 edge-case dry-run"
echo "    Backend: $BACKEND_URL"
echo ""

# ── 1. Base smoke (health, chat 422, admin 401) ─────────────────────────────
echo "── Step 1: smoke checks"
BACKEND_URL="$BACKEND_URL" bash "$SCRIPT_DIR/smoke.sh"
echo ""

# ── 2. Input validation ─────────────────────────────────────────────────────
echo "── Step 2: input validation"

expect_code() {
  local label="$1"
  local expected="$2"
  shift 2
  local code
  code="$(curl -s -o /tmp/secureship-demo.json -w '%{http_code}' "$@")"
  if [[ "$code" != "$expected" ]]; then
    echo "FAIL: $label — expected $expected, got $code" >&2
    cat /tmp/secureship-demo.json >&2 || true
    exit 1
  fi
  echo "OK: $label → $code"
}

# Empty message
expect_code "empty chat message" 422 \
  -X POST "$BACKEND_URL/chat" \
  -H 'Content-Type: application/json' \
  -d '{"message":""}'

# Oversized message (>5000 chars)
long_msg="$(python3 -c 'print("x"*5001)')"
expect_code "message over 5000 chars" 422 \
  -X POST "$BACKEND_URL/chat" \
  -H 'Content-Type: application/json' \
  -d "{\"message\":\"$long_msg\"}"

# Bad session UUID
expect_code "non-UUID session_id" 422 \
  -X POST "$BACKEND_URL/chat" \
  -H 'Content-Type: application/json' \
  -d '{"message":"hello","session_id":"not-a-uuid"}'

# Bad verify-sms session UUID
expect_code "verify-sms bad session_id" 422 \
  -X POST "$BACKEND_URL/verify-sms" \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"bad","code":"123456"}'

echo ""

# ── 3. Verify-sms edge cases ────────────────────────────────────────────────
echo "── Step 3: SMS verification edge cases"

SESSION_ID="$(python3 -c 'import uuid; print(uuid.uuid4())')"

# No active OTP for fresh session → 409
expect_code "verify-sms no active code" 409 \
  -X POST "$BACKEND_URL/verify-sms" \
  -H 'Content-Type: application/json' \
  -d "{\"session_id\":\"$SESSION_ID\",\"code\":\"123456\"}"

echo ""

# ── 4. Admin auth ───────────────────────────────────────────────────────────
echo "── Step 4: admin auth"

expect_code "admin missing token" 401 \
  "$BACKEND_URL/admin/shipments"

expect_code "admin malformed token" 401 \
  -H 'Authorization: Bearer not-a-jwt' \
  "$BACKEND_URL/admin/shipments"

echo ""

# ── 5. Rate limit (optional — hits Ollama on each request; skip by default) ─
if [[ "${DEMO_RATE_LIMIT:-0}" == "1" ]]; then
  echo "── Step 5: rate limit (31 requests — slow; DEMO_RATE_LIMIT=1)"
  RL_SESSION="$(python3 -c 'import uuid; print(uuid.uuid4())')"
  got_429=0
  for i in $(seq 1 31); do
    code="$(curl -s -o /dev/null -w '%{http_code}' \
      -X POST "$BACKEND_URL/chat" \
      -H 'Content-Type: application/json' \
      -d "{\"message\":\"ping $i\",\"session_id\":\"$RL_SESSION\"}")"
    if [[ "$code" == "429" ]]; then
      got_429=1
      retry_after="$(curl -s -D - -o /dev/null \
        -X POST "$BACKEND_URL/chat" \
        -H 'Content-Type: application/json' \
        -d "{\"message\":\"ping\",\"session_id\":\"$RL_SESSION\"}" \
        | awk 'BEGIN{IGNORECASE=1} /^Retry-After:/{print $2}' | tr -d '\r')"
      echo "OK: rate limit triggered on request $i (Retry-After: ${retry_after:-present})"
      break
    fi
  done
  if [[ "$got_429" != "1" ]]; then
    echo "WARN: expected 429 within 31 requests — check rate limit config" >&2
  fi
  echo ""
else
  echo "── Step 5: rate limit — skipped (covered by pytest; set DEMO_RATE_LIMIT=1 to live-test)"
  echo ""
fi

# ── 6. Manual browser demo checklist ────────────────────────────────────────
echo "── Step 6: manual demo checklist (browser + Ollama required)"
cat <<'EOF'
  [ ] Anonymous → ask about shipment → bot declines (Epic A3)
  [ ] Identity collection → SMS modal → verify → all shipments (lookup_shipments)
  [ ] Specific tracking → one card + "Showing 1 of N" + Show all
  [ ] "I want to talk to a human" → escalation theater; no data leak if unverified
  [ ] Verified + escalation → Melany can still discuss shipments (Epic G)
  [ ] Admin Auth0 → create shipment → customer sees it; soft-delete hides it
  [ ] 375px width: no horizontal scroll; keyboard/Escape on verification modal
EOF

echo ""
echo "Automated edge-case dry-run passed."
echo "Run the manual checklist above for the final demo (see docs/week5_tasks.md)."
