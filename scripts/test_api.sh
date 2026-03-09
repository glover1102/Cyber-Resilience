#!/usr/bin/env bash
# test_api.sh — Test all Railway API endpoints
# Usage: bash scripts/test_api.sh [BASE_URL]
# Default BASE_URL: $RAILWAY_URL or http://localhost:3000

set -euo pipefail

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass()  { echo -e "${GREEN}  ✓ $*${NC}"; PASSED=$((PASSED + 1)); }
fail()  { echo -e "${RED}  ✗ $*${NC}"; FAILED=$((FAILED + 1)); }
info()  { echo -e "${CYAN}  → $*${NC}"; }
warn()  { echo -e "${YELLOW}  ⚠ $*${NC}"; }

PASSED=0
FAILED=0

# ---------------------------------------------------------------------------
# Resolve base URL
# ---------------------------------------------------------------------------
BASE_URL="${1:-${RAILWAY_URL:-http://localhost:3000}}"
# Strip trailing slash
BASE_URL="${BASE_URL%/}"

echo ""
echo -e "${CYAN}=================================================="
echo -e "  🛡️  Cyber Resilience — API Test Suite"
echo -e "==================================================${NC}"
echo ""
echo -e "  Target: ${CYAN}${BASE_URL}${NC}"
echo ""

# ---------------------------------------------------------------------------
# Helper: send a request and check status code
# ---------------------------------------------------------------------------
# check_endpoint METHOD PATH EXPECTED_STATUS [BODY]
check_endpoint() {
    local method="$1"
    local path="$2"
    local expected="$3"
    local body="${4:-}"
    local url="${BASE_URL}${path}"

    local http_status
    if [ -n "$body" ]; then
        http_status=$(curl -s -o /dev/null -w "%{http_code}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            -d "$body" \
            --max-time 10 \
            "$url" 2>/dev/null || echo "000")
    else
        http_status=$(curl -s -o /dev/null -w "%{http_code}" \
            -X "$method" \
            --max-time 10 \
            "$url" 2>/dev/null || echo "000")
    fi

    if [ "$http_status" = "$expected" ]; then
        pass "${method} ${path}  →  HTTP ${http_status}"
    elif [ "$http_status" = "000" ]; then
        fail "${method} ${path}  →  Could not connect (is the server running?)"
    else
        fail "${method} ${path}  →  Expected HTTP ${expected}, got HTTP ${http_status}"
    fi
}

# ---------------------------------------------------------------------------
# Helper: check JSON field in response body
# ---------------------------------------------------------------------------
check_json_field() {
    local path="$1"
    local field="$2"
    local url="${BASE_URL}${path}"

    local body
    body=$(curl -s --max-time 10 "$url" 2>/dev/null || echo "{}")

    if echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); assert '$field' in d" 2>/dev/null; then
        pass "${path}  response contains '${field}'"
    else
        fail "${path}  response missing '${field}' — body: ${body:0:120}"
    fi
}

# ---------------------------------------------------------------------------
# Test: GET /health
# ---------------------------------------------------------------------------
echo -e "${CYAN}[Health Check]${NC}"
check_endpoint GET /health 200
check_json_field /health status
echo ""

# ---------------------------------------------------------------------------
# Test: GET /api/status
# ---------------------------------------------------------------------------
echo -e "${CYAN}[Status Endpoint]${NC}"
check_endpoint GET /api/status 200
check_json_field /api/status systems
check_json_field /api/status timestamp

# Check all 6 systems are present
info "Checking all 6 systems are reported..."
STATUS_BODY=$(curl -s --max-time 10 "${BASE_URL}/api/status" 2>/dev/null || echo "{}")
EXPECTED_SYSTEMS=("primary-dc" "secondary-dc" "soc" "noc" "backup" "application")
for sys in "${EXPECTED_SYSTEMS[@]}"; do
    if echo "$STATUS_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); assert '$sys' in d.get('systems',{})" 2>/dev/null; then
        pass "System '${sys}' present in status response"
    else
        fail "System '${sys}' missing from status response"
    fi
done
echo ""

# ---------------------------------------------------------------------------
# Test: GET /api/stream (SSE)
# ---------------------------------------------------------------------------
echo -e "${CYAN}[SSE Stream]${NC}"
info "Connecting to SSE stream (will read 1 event then disconnect)..."

SSE_OUTPUT=$(curl -s -N \
    -H "Accept: text/event-stream" \
    --max-time 5 \
    "${BASE_URL}/api/stream" 2>/dev/null || true)

if echo "$SSE_OUTPUT" | grep -q "data:"; then
    pass "GET /api/stream  →  Received SSE data"
else
    fail "GET /api/stream  →  No SSE data received (server may not be running)"
fi
echo ""

# ---------------------------------------------------------------------------
# Test: POST /api/metrics
# ---------------------------------------------------------------------------
echo -e "${CYAN}[Metrics Ingestion]${NC}"
METRICS_PAYLOAD='{"systems":{"primary-dc":{"status":"online","cpu":30,"memory":45,"network":5.0}}}'
check_endpoint POST /api/metrics 200 "$METRICS_PAYLOAD"

# Invalid payload should return 400
check_endpoint POST /api/metrics 400 '{"bad":"payload"}'
echo ""

# ---------------------------------------------------------------------------
# Test: POST /api/simulate-attack
# ---------------------------------------------------------------------------
echo -e "${CYAN}[Attack Simulation]${NC}"
check_endpoint POST /api/simulate-attack 200 '{"phase":"start"}'
check_endpoint POST /api/simulate-attack 200 '{"phase":"spreading"}'
check_endpoint POST /api/simulate-attack 200 '{"phase":"encrypted"}'
check_endpoint POST /api/simulate-attack 200 '{"phase":"recovery"}'
check_endpoint POST /api/simulate-attack 400 '{"phase":"invalid_phase"}'
echo ""

# ---------------------------------------------------------------------------
# Test: Static dashboard
# ---------------------------------------------------------------------------
echo -e "${CYAN}[Static Dashboard]${NC}"
check_endpoint GET / 200
echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo -e "${CYAN}=================================================="
echo -e "  Summary"
echo -e "==================================================${NC}"
echo ""
echo -e "  ${GREEN}Passed: ${PASSED}${NC}"
if [ "$FAILED" -gt 0 ]; then
    echo -e "  ${RED}Failed: ${FAILED}${NC}"
    echo ""
    echo -e "  ${RED}❌ Some tests failed. See output above for details.${NC}"
    exit 1
else
    echo -e "  ${GREEN}✅ All tests passed!${NC}"
fi
echo ""
