#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  ODIN Smoke Test  –  comprehensive deployment health check
#
#  Usage:
#    bash scripts/smoke-test.sh                        # defaults: 8001 / 8080
#    BACKEND=http://10.0.0.5:8001 bash scripts/smoke-test.sh
#    FRONTEND=http://10.0.0.5:8080 bash scripts/smoke-test.sh
#
#  Prerequisites: curl, jq (optional), running containers.
#  Exit code 0 = all checks passed; non-zero = at least one check failed.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

BACKEND="${BACKEND:-http://localhost:8001}"
FRONTEND="${FRONTEND:-http://localhost:8000}"
PASS=0; FAIL=0; WARN=0

if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  CYAN='\033[0;36m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; CYAN=''; RESET=''
fi

pass()    { echo -e "  ${GREEN}PASS${RESET}  $*"; PASS=$((PASS+1)); }
fail()    { echo -e "  ${RED}FAIL${RESET}  $*"; FAIL=$((FAIL+1)); }
warn()    { echo -e "  ${YELLOW}WARN${RESET}  $*"; WARN=$((WARN+1)); }
section() { echo -e "\n${CYAN}── $* ──${RESET}"; }

check_json() {
  local label="$1" url="$2" expected="${3:-200}"
  local http_code ct body tmpfile
  tmpfile=$(mktemp 2>/dev/null || echo "/tmp/smoke_$$")
  # Separate status-code call (body → tmpfile) from -o /dev/null path
  http_code=$(curl -s -o "$tmpfile" -w "%{http_code}" --max-time 10 "$url" 2>/dev/null)
  http_code="${http_code:-000}"
  ct=$(curl -sI --max-time 5 "$url" 2>/dev/null | grep -i "^content-type" | head -1 || true)
  body=$(cat "$tmpfile" 2>/dev/null | head -c 300 || true)
  rm -f "$tmpfile"
  [ "$http_code" = "000" ] && { fail "$label -> connection refused ($url)"; return; }
  [ "$http_code" != "$expected" ] && { fail "$label -> HTTP $http_code (expected $expected)"; return; }
  if echo "$ct" | grep -qi "application/json"; then
    pass "$label -> HTTP $http_code JSON"
  else
    fail "$label -> HTTP $http_code wrong Content-Type: ${ct:-unknown}"
    echo "      Body: ${body:0:120}"
  fi
}

check_html() {
  local label="$1" url="$2"
  local http_code ct
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  ct=$(curl -sI --max-time 5 "$url" 2>/dev/null | grep -i "^content-type" | head -1 || echo "")
  [ "$http_code" = "000" ] && { fail "$label -> connection refused ($url)"; return; }
  if echo "$ct" | grep -qi "text/html"; then
    pass "$label -> HTTP $http_code HTML"
  else
    fail "$label -> HTTP $http_code, Content-Type: ${ct:-unknown}"
  fi
}

check_field() {
  local label="$1" url="$2" field="$3" expected="$4"
  local body val
  body=$(curl -s --max-time 10 "$url" 2>/dev/null || echo "{}")
  if command -v jq &>/dev/null; then
    val=$(echo "$body" | jq -r ".$field" 2>/dev/null || echo "__error__")
  elif command -v python3 &>/dev/null; then
    val=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d.get('$field','__missing__'); print(str(v).lower() if isinstance(v, bool) else str(v))" 2>/dev/null || echo "__error__")
  else
    val=$(echo "$body" | grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | cut -d'"' -f4 || echo "__fallback__")
  fi
  [ "$val" = "$expected" ] && pass "$label -> $field=$val" || fail "$label -> $field='$val' (expected '$expected')"
}

echo ""
echo "==========================================================="
echo "  ODIN SMOKE TEST  --  $(date '+%Y-%m-%d %H:%M:%S')"
echo "==========================================================="
echo "  Backend  : $BACKEND"
echo "  Frontend : $FRONTEND"

section "1. Backend Health / Readiness"
check_json  "Health endpoint"        "$BACKEND/api/health"
check_field "Health.backend=ok"      "$BACKEND/api/health"        "backend"  "ok"
check_json  "Ready endpoint"         "$BACKEND/api/health/ready"
check_field "Ready.ready=true"       "$BACKEND/api/health/ready"  "ready"    "true"

section "2. Database Connectivity"
check_field "DB status via ready"    "$BACKEND/api/health/ready"  "database" "ok"

section "3. Auth-gated endpoints return 401 (not 500/crash)"
check_json "dashboard/info"          "$BACKEND/api/dashboard/info"            401
check_json "schedules"               "$BACKEND/api/schedules"                 401
check_json "projects"                "$BACKEND/api/projects"                  401
check_json "competencies"            "$BACKEND/api/competencies"              401
check_json "app-settings"            "$BACKEND/api/app-settings"              401
check_json "handover"                "$BACKEND/api/handover"                  401
check_json "schedules/last-upload"   "$BACKEND/api/schedules/last-upload"     401
check_json "commit/latest"           "$BACKEND/api/commit/latest"             401

section "4. Frontend SPA"
check_html "Frontend root"           "$FRONTEND/"
check_html "Frontend /login"         "$FRONTEND/login"
check_html "Frontend /dashboard"     "$FRONTEND/dashboard"
check_html "Frontend /dbs"           "$FRONTEND/dbs"

section "5. Frontend -> Backend proxy"
check_json  "Frontend /api/health"   "$FRONTEND/api/health"
check_field "Frontend proxy working" "$FRONTEND/api/health"        "backend"  "ok"

section "6. SSE endpoint"
http_sse=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$BACKEND/api/sse" 2>/dev/null || echo "000")
[ "$http_sse" = "401" ] && pass "SSE no-auth -> 401 (correct)" || { [ "$http_sse" = "000" ] && fail "SSE -> connection refused" || warn "SSE -> HTTP $http_sse (expected 401)"; }

http_sse_bad=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$BACKEND/api/sse?token=bogus" 2>/dev/null || echo "000")
[ "$http_sse_bad" = "401" ] && pass "SSE invalid-token -> 401 (correct)" || warn "SSE invalid-token -> HTTP $http_sse_bad (expected 401)"

section "7. Teams endpoint (optional)"
http_teams=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$BACKEND/api/teams/log" 2>/dev/null || echo "000")
if [ "$http_teams" = "401" ] || [ "$http_teams" = "200" ]; then
  pass "Teams log -> HTTP $http_teams (no crash)"
else
  [ "$http_teams" = "000" ] && fail "Teams log -> connection refused" || warn "Teams log -> HTTP $http_teams"
fi

echo ""
echo "==========================================================="
echo -e "  PASS: $PASS   FAIL: $FAIL   WARN: $WARN"
echo "==========================================================="
if [ "$FAIL" -gt 0 ]; then
  echo "FAIL: ${FAIL} check(s) failed."
  exit 1
else
  echo "OK: All critical checks passed."
  exit 0
fi