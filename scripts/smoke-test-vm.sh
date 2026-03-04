#!/usr/bin/env bash
# =============================================================================
# scripts/smoke-test-vm.sh
#
# Quick smoke test for ODIN on an Oracle Linux VM after:
#   podman compose up -d   (or docker compose up -d)
#
# Run from the repo root or any directory on the VM:
#   bash scripts/smoke-test-vm.sh
#
# Optional environment overrides:
#   BACKEND_URL   default: http://localhost:8001
#   FRONTEND_URL  default: http://localhost:8080
#   INGEST_KEY    default: CHANGE_ME_DEV_KEY
# =============================================================================

set -euo pipefail

BACKEND="${BACKEND_URL:-http://localhost:8001}"
FRONTEND="${FRONTEND_URL:-http://localhost:8080}"
INGEST_KEY="${INGEST_KEY:-CHANGE_ME_DEV_KEY}"

PASS=0
FAIL=0

# ── helpers ──────────────────────────────────────────────────────────────────

ok()   { echo "  [PASS] $*"; ((PASS++)); }
fail() { echo "  [FAIL] $*"; ((FAIL++)); }

check_http() {
  local label="$1"
  local url="$2"
  local expected_status="${3:-200}"

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

  if [[ "$status" == "$expected_status" ]]; then
    ok "$label  →  HTTP $status"
  else
    fail "$label  →  HTTP $status (expected $expected_status)  URL: $url"
  fi
}

check_json_field() {
  local label="$1"
  local url="$2"
  local field="$3"   # jq path, e.g. '.status'
  local expected="$4"

  local body
  body=$(curl -s --max-time 10 "$url" 2>/dev/null || echo "{}")

  local actual
  actual=$(echo "$body" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    # simple single-key lookup
    key = '$field'.lstrip('.')
    print(data.get(key, ''))
except Exception as e:
    print('')
" 2>/dev/null)

  if [[ "$actual" == "$expected" ]]; then
    ok "$label  →  $field = \"$actual\""
  else
    fail "$label  →  $field = \"$actual\" (expected \"$expected\")"
  fi
}

# ── test suite ────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ODIN Smoke Test"
echo "  Backend  : $BACKEND"
echo "  Frontend : $FRONTEND"
echo "═══════════════════════════════════════════════════════"
echo ""

# 1. Backend health endpoint
echo "── Backend ──────────────────────────────────────────────"
check_http   "GET /api/health" "$BACKEND/api/health"
check_json_field \
  "health.status == ok" \
  "$BACKEND/api/health" \
  "status" \
  "ok"

# 2. Auth endpoint reachable (should return 400/401 without body, not 500)
HTTP_AUTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "$BACKEND/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"__smoke_test__","password":"__bad__"}' 2>/dev/null || echo "000")

if [[ "$HTTP_AUTH" == "400" || "$HTTP_AUTH" == "401" || "$HTTP_AUTH" == "403" ]]; then
  ok "POST /api/auth/login (bad creds)  →  HTTP $HTTP_AUTH  (auth layer alive)"
else
  fail "POST /api/auth/login  →  HTTP $HTTP_AUTH (expected 400/401/403)"
fi

# 3. Queue ingest endpoint (empty snapshot — should return 200)
echo ""
echo "── Queue ingest ─────────────────────────────────────────"
HTTP_INGEST=$(curl -s -o /tmp/odin_ingest_out.json -w "%{http_code}" --max-time 15 \
  -X POST "$BACKEND/api/queue/snapshot" \
  -H "Content-Type: application/json" \
  -H "X-OES-INGEST-KEY: $INGEST_KEY" \
  -d '{"queueType":"SmartHands","items":[]}' 2>/dev/null || echo "000")

if [[ "$HTTP_INGEST" == "200" || "$HTTP_INGEST" == "201" ]]; then
  ok "POST /api/queue/snapshot (empty)  →  HTTP $HTTP_INGEST"
elif [[ "$HTTP_INGEST" == "401" || "$HTTP_INGEST" == "403" ]]; then
  fail "POST /api/queue/snapshot  →  HTTP $HTTP_INGEST — check INGEST_KEY (used: $INGEST_KEY)"
else
  fail "POST /api/queue/snapshot  →  HTTP $HTTP_INGEST"
fi

# 4. Frontend reachable
echo ""
echo "── Frontend ─────────────────────────────────────────────"
check_http "GET /  (frontend)" "$FRONTEND/" "200"

# Vite-built index.html should contain the app root or a script reference
FRONTEND_BODY=$(curl -s --max-time 10 "$FRONTEND/" 2>/dev/null || echo "")
if echo "$FRONTEND_BODY" | grep -q "<div id=\"root\"\|<script"; then
  ok "Frontend HTML contains app root / script tags"
else
  fail "Frontend HTML looks empty or unexpected"
fi

# ── summary ──────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════════════════════"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo "  Some checks failed. Common causes:"
  echo "    - Containers not yet started: podman compose ps"
  echo "    - Wrong INGEST_KEY: set INGEST_KEY=<value from .env> before running"
  echo "    - Port conflict: check 'ss -tlnp | grep -E \"8001|8080\"'"
  echo ""
  exit 1
fi

exit 0
