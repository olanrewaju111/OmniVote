#!/bin/bash
# Deploy and verify OmniVote Monitor
# Starts server, keeps it alive, runs verification, all in one process

STANDALONE_DIR="/home/z/my-project/.next/standalone"
LOG="/tmp/omnivote-prod.log"
BASE="http://127.0.0.1:3000"

# Start server in background
cd "$STANDALONE_DIR"
NODE_ENV=production PORT=3000 node server.js > "$LOG" 2>&1 &
SERVER_PID=$!

# Wait for server to be ready (up to 10s)
for i in $(seq 1 20); do
  if curl -s --connect-timeout 1 -o /dev/null "$BASE/api/auth" 2>/dev/null; then
    echo "Server ready (PID $SERVER_PID)"
    break
  fi
  sleep 0.5
done

# Quick connectivity check
if ! curl -s --connect-timeout 3 "$BASE/api/auth" | grep -q "tenants"; then
  echo "ERROR: Server not responding"
  cat "$LOG" | tail -10
  exit 1
fi

PASS=0
FAIL=0
TOTAL=0

check() {
  local desc="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL+1))
  if echo "$actual" | grep -q "$expected"; then
    PASS=$((PASS+1))
    echo "  PASS $desc"
  else
    FAIL=$((FAIL+1))
    echo "  FAIL $desc"
    echo "        expected: $expected"
    echo "        got: $(echo "$actual" | head -c 150)"
  fi
}

echo ""
echo "=== 1. LOGIN TESTS ==="

SA_RESP=$(curl -s --connect-timeout 5 -c /tmp/v-sa "$BASE/api/auth" -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"platform-admin@omnivote.ng","password":"admin123"}')
check "SA login" '"role":"SUPER_ADMIN"' "$SA_RESP"
SA_COOKIE=$(grep omnivote-session /tmp/v-sa 2>/dev/null | awk '{print $NF}')

TA_RESP=$(curl -s --connect-timeout 5 -c /tmp/v-ta "$BASE/api/auth" -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@lagos-island-lga.omnivote.ng","password":"admin123"}')
check "TA login" '"role":"TENANT_ADMIN"' "$TA_RESP"
TA_COOKIE=$(grep omnivote-session /tmp/v-ta 2>/dev/null | awk '{print $NF}')

AN_RESP=$(curl -s --connect-timeout 5 -c /tmp/v-an "$BASE/api/auth" -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"funke@lagos-island-lga.omnivote.ng","password":"admin123"}')
check "Analyst login" '"role":"ANALYST"' "$AN_RESP"
AN_COOKIE=$(grep omnivote-session /tmp/v-an 2>/dev/null | awk '{print $NF}')

FA_RESP=$(curl -s --connect-timeout 5 -c /tmp/v-fa "$BASE/api/auth" -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"tunde@lagos-island-lga.omnivote.ng","password":"admin123"}')
check "FA login" '"role":"FIELD_AGENT"' "$FA_RESP"
FA_COOKIE=$(grep omnivote-session /tmp/v-fa 2>/dev/null | awk '{print $NF}')

echo ""
echo "=== 2. TENANT ISOLATION ==="

# Get tenant IDs
TENANTS_RESP=$(curl -s --connect-timeout 5 -b "omnivote-session=$SA_COOKIE" "$BASE/api/tenants")
LAGOS_ID=$(echo "$TENANTS_RESP" | python3 -c "import sys,json;ts=json.load(sys.stdin)['tenants'];print([t['id'] for t in ts if 'lagos' in t['slug']][0])" 2>/dev/null)
KANO_ID=$(echo "$TENANTS_RESP" | python3 -c "import sys,json;ts=json.load(sys.stdin)['tenants'];print([t['id'] for t in ts if 'kano' in t['slug']][0])" 2>/dev/null)
echo "  Lagos: ${LAGOS_ID:0:8}...  Kano: ${KANO_ID:0:8}..."

SA_L=$(curl -s --connect-timeout 5 -b "omnivote-session=$SA_COOKIE" "$BASE/api/alerts?tenantId=$LAGOS_ID")
check "SA reads Lagos alerts" '"alerts"' "$SA_L"

SA_K=$(curl -s --connect-timeout 5 -b "omnivote-session=$SA_COOKIE" "$BASE/api/alerts?tenantId=$KANO_ID")
check "SA reads Kano alerts" '"alerts"' "$SA_K"

TA_K=$(curl -s --connect-timeout 5 -b "omnivote-session=$TA_COOKIE" "$BASE/api/alerts?tenantId=$KANO_ID")
check "TA blocked from Kano" 'Tenant access denied' "$TA_K"

TA_L=$(curl -s --connect-timeout 5 -b "omnivote-session=$TA_COOKIE" "$BASE/api/alerts?tenantId=$LAGOS_ID")
check "TA reads own tenant" '"alerts"' "$TA_L"

echo ""
echo "=== 3. RBAC TESTS ==="

FA_SEC=$(curl -s --connect-timeout 5 -b "omnivote-session=$FA_COOKIE" "$BASE/api/security?tenantId=$LAGOS_ID")
check "FA blocked from security" 'Insufficient permissions' "$FA_SEC"

FA_TS=$(curl -s --connect-timeout 5 -b "omnivote-session=$FA_COOKIE" "$BASE/api/tenant-settings?tenantId=$LAGOS_ID")
check "FA blocked from tenant-settings" 'Access denied' "$FA_TS"

FA_AG=$(curl -s --connect-timeout 5 -b "omnivote-session=$FA_COOKIE" "$BASE/api/agents?tenantId=$LAGOS_ID")
check "FA can list agents" '"users"' "$FA_AG"

AN_CR=$(curl -s --connect-timeout 5 -b "omnivote-session=$AN_COOKIE" "$BASE/api/agents?tenantId=$LAGOS_ID" -X POST \
  -H 'Content-Type: application/json' \
  -d '{"name":"hacker","email":"hacker@test.com","role":"FIELD_AGENT"}')
check "Analyst blocked from agent creation" 'Only administrators' "$AN_CR"

echo ""
echo "=== 4. TENANT SCOPE ==="

SCOPES=$(curl -s --connect-timeout 5 -b "omnivote-session=$SA_COOKIE" "$BASE/api/tenants")
check "Tenants have scope" 'LOCAL_GOVERNMENT' "$SCOPES"

TA_SET=$(curl -s --connect-timeout 5 -b "omnivote-session=$TA_COOKIE" "$BASE/api/tenant-settings?tenantId=$LAGOS_ID")
check "TA reads scope in settings" '"scope"' "$TA_SET"

TA_SCOPE_CHG=$(curl -s --connect-timeout 5 -b "omnivote-session=$TA_COOKIE" "$BASE/api/tenant-settings?tenantId=$LAGOS_ID" -X PUT \
  -H 'Content-Type: application/json' \
  -d '{"scope":"PRESIDENTIAL"}')
check "TA blocked from scope change" 'Only platform Super Admin' "$TA_SCOPE_CHG"

echo ""
echo "=== 5. SECURITY FIXES VERIFICATION ==="

# Unauthenticated request blocked
UNAUTH=$(curl -s --connect-timeout 5 "$BASE/api/incidents?tenantId=$LAGOS_ID")
check "Unauthenticated blocked" 'Authentication required' "$UNAUTH"

# Missing tenantId blocked
NO_TID=$(curl -s --connect-timeout 5 -b "omnivote-session=$SA_COOKIE" "$BASE/api/alerts")
check "Missing tenantId returns 400" 'tenantId query parameter is required' "$NO_TID"

# FA cannot lock users
FA_LOCK=$(curl -s --connect-timeout 5 -b "omnivote-session=$FA_COOKIE" "$BASE/api/security?tenantId=$LAGOS_ID" -X POST \
  -H 'Content-Type: application/json' \
  -d '{"action":"LOCK_USER","userId":"some-id"}')
check "FA blocked from LOCK_USER" 'Insufficient permissions' "$FA_LOCK"

# FA cannot log security events
FA_LOG=$(curl -s --connect-timeout 5 -b "omnivote-session=$FA_COOKIE" "$BASE/api/security?tenantId=$LAGOS_ID" -X POST \
  -H 'Content-Type: application/json' \
  -d '{"action":"LOG_EVENT","eventType":"TEST","description":"test"}')
check "FA blocked from LOG_EVENT" 'Only operators' "$FA_LOG"

echo ""
echo "=========================================="
echo "  RESULTS: $PASS / $TOTAL passed, $FAIL failed"
echo "=========================================="

# Keep server alive after verification
echo ""
echo "Server running on port 3000 (PID $SERVER_PID)"
echo "Verification complete at $(date)"