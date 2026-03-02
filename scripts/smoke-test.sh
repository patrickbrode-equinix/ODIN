#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  ODIN Smoke Test – verifies backend serves JSON and frontend serves HTML
#
#  Usage:  bash scripts/smoke-test.sh
#  Requirements: curl, containers running (podman-compose up)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BACKEND="http://localhost:8001"
FRONTEND="http://localhost:8000"
PASS=0
FAIL=0

check() {
  local label="$1" url="$2" expect_type="$3"
  local ct body http_code

  http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  ct=$(curl -sI "$url" 2>/dev/null | grep -i "content-type" | head -1 || echo "")
  body=$(curl -s "$url" 2>/dev/null | head -c 200 || echo "")

  if [ "$http_code" = "000" ]; then
    echo "  FAIL  $label  →  connection refused ($url)"
    FAIL=$((FAIL+1))
    return
  fi

  case "$expect_type" in
    json)
      if echo "$ct" | grep -qi "application/json"; then
        echo "  PASS  $label  →  HTTP $http_code  Content-Type: JSON"
        PASS=$((PASS+1))
      else
        echo "  FAIL  $label  →  HTTP $http_code  Expected JSON, got: $ct"
        echo "        Body preview: ${body:0:120}"
        FAIL=$((FAIL+1))
      fi
      ;;
    html)
      if echo "$ct" | grep -qi "text/html"; then
        echo "  PASS  $label  →  HTTP $http_code  Content-Type: HTML (expected)"
        PASS=$((PASS+1))
      else
        echo "  FAIL  $label  →  HTTP $http_code  Expected HTML, got: $ct"
        FAIL=$((FAIL+1))
      fi
      ;;
  esac
}

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ODIN SMOKE TEST"
echo "═══════════════════════════════════════════════════"
echo ""

echo "── Backend (should return JSON) ──"
check "Health Endpoint" "$BACKEND/api/health" json
check "Schedules List"  "$BACKEND/api/schedules" json

echo ""
echo "── Frontend (should return HTML) ──"
check "Frontend Root"   "$FRONTEND/" html
check "Frontend SPA Route" "$FRONTEND/shiftplan" html

echo ""
echo "── Cross-check: Backend non-API path (should 404, NOT HTML) ──"
http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND/shiftplan" 2>/dev/null || echo "000")
if [ "$http_code" = "404" ] || [ "$http_code" = "000" ]; then
  echo "  PASS  Backend /shiftplan  →  HTTP $http_code (correct: no SPA fallback)"
  PASS=$((PASS+1))
else
  echo "  WARN  Backend /shiftplan  →  HTTP $http_code (unexpected)"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Results:  $PASS passed,  $FAIL failed"
echo "═══════════════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
