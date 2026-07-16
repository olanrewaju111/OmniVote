#!/bin/bash
# Adversarial Security Tests - curl-based
set -uo pipefail  # Don't use -e (exit on error) as some curl calls intentionally fail

BASE="http://127.0.0.1:3001"
PASS=0; FAIL=0; TOTAL=0

# Get tenant IDs from DB using python
LOCAL_ID=$(python3 -c "import sqlite3; c=sqlite3.connect('/home/z/my-project/db/custom.db'); print(c.execute(\"SELECT id FROM Tenant WHERE slug='lagos-island-lga'\").fetchone()[0])")
STATE_ID=$(python3 -c "import sqlite3; c=sqlite3.connect('/home/z/my-project/db/custom.db'); print(c.execute(\"SELECT id FROM Tenant WHERE slug='kano-state-obs'\").fetchone()[0])")
PRES_ID=$(python3 -c "import sqlite3; c=sqlite3.connect('/home/z/my-project/db/custom.db'); print(c.execute(\"SELECT id FROM Tenant WHERE slug='presidential-ng'\").fetchone()[0])")

echo "═══════════════════════════════════════════════════════════"
echo "  ADVERSARIAL SECURITY TEST SUITE (curl)"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Tenants:"
echo "  LOCAL: $LOCAL_ID"
echo "  STATE: $STATE_ID"
echo "  PRES:  $PRES_ID"
echo ""

# Login helper — stores cookie
COOKIE_JAR="/tmp/adversarial-test-cookies.txt"
rm -f "$COOKIE_JAR"

do_login() {
  local email="$1"
  local pw="$2"
  curl -s -X POST "$BASE/api/auth" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$pw\"}" \
    -c "$COOKIE_JAR" > /dev/null 2>&1 || true
}

# Test helper
test_api() {
  local name="$1" method="$2" path="$3" expect="$4" body="${5:-}"
  TOTAL=$((TOTAL + 1))
  local args=(-X "$method" -b "$COOKIE_JAR" -o /tmp/adv-test-out.json -w '%{http_code}' -s)
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' -d "$body")
  fi
  local status
  status=$(curl "${args[@]}" "$BASE$path" 2>/dev/null || echo "000")
  if [ "$status" = "$expect" ]; then
    echo "  ✅ $name: $status"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name: expected $expect, got $status"
    FAIL=$((FAIL + 1))
  fi
}

# ── Phase 1: Auth ─────────────────────────────────────────────────────
echo "── Phase 1: Authentication ──────────────────────────────"
do_login "admin@lagos-island-lga.omnivote.ng" "password123"
test_api "Unauthenticated (no cookie) → 401" GET "/api/dashboard?tenantId=$LOCAL_ID" "401"

rm -f "$COOKIE_JAR"
test_api "No cookie at all → 401" GET "/api/incidents?tenantId=$LOCAL_ID" "401"

# Login properly
do_login "admin@lagos-island-lga.omnivote.ng" "password123"
test_api "Authenticated login → 200" POST "/api/auth" "200" '{"email":"admin@lagos-island-lga.omnivote.ng","password":"password123"}'

# ── Phase 2: VULN-2 — Missing tenantId returns 400 ─────────────────
echo ""
echo "── Phase 2: VULN-2 — No tenantId fallback removed ──────"
test_api "Dashboard no tenantId → 400" GET "/api/dashboard" "400"
test_api "Incidents no tenantId → 400" GET "/api/incidents" "400"
test_api "Alerts no tenantId → 400" GET "/api/alerts" "400"
test_api "PVT no tenantId → 400" GET "/api/pvt" "400"
test_api "Agents no tenantId → 400" GET "/api/agents" "400"
test_api "Evidence no tenantId → 400" GET "/api/evidence" "400"

# ── Phase 3: Cross-tenant isolation ─────────────────────────────────
echo ""
echo "── Phase 3: Cross-tenant isolation ─────────────────────"
do_login "admin@lagos-island-lga.omnivote.ng" "password123"
test_api "LOCAL→STATE dashboard → 403" GET "/api/dashboard?tenantId=$STATE_ID" "403"
test_api "LOCAL→PRES incidents → 403" GET "/api/incidents?tenantId=$PRES_ID" "403"
test_api "LOCAL→STATE alerts → 403" GET "/api/alerts?tenantId=$STATE_ID" "403"
test_api "LOCAL→PRES agents → 403" GET "/api/agents?tenantId=$PRES_ID" "403"
test_api "LOCAL→STATE evidence → 403" GET "/api/evidence?tenantId=$STATE_ID" "403"
test_api "LOCAL→PRES PVT → 403" GET "/api/pvt?tenantId=$PRES_ID" "403"
test_api "LOCAL→STATE situation-room → 403" GET "/api/situation-room?tenantId=$STATE_ID" "403"
test_api "LOCAL→PRES geofence → 403" GET "/api/geofence?tenantId=$PRES_ID" "403"
test_api "LOCAL→STATE campaigns → 403" GET "/api/campaigns?tenantId=$STATE_ID" "403"
test_api "LOCAL→PRES OSINT → 403" GET "/api/osint?tenantId=$PRES_ID" "403"
test_api "LOCAL→STATE engagement → 403" GET "/api/engagement?tenantId=$STATE_ID" "403"
test_api "LOCAL→PRES results → 403" GET "/api/results?tenantId=$PRES_ID" "403"

# ── Phase 4: VULN-3 — WhatsApp tenant enforcement ───────────────────
echo ""
echo "── Phase 4: VULN-3 — WhatsApp tenant enforcement ───────"
test_api "WhatsApp send no tenantId → 400" PUT "/api/whatsapp?action=send" "400" '{"toPhone":"+1234","body":"test"}'
test_api "WhatsApp send cross-tenant → 403" PUT "/api/whatsapp?action=send" "403" "{\"tenantId\":\"$STATE_ID\",\"toPhone\":\"+1234\",\"body\":\"test\"}"

# ── Phase 5: VULN-1 — No cross-tenant PU leak ──────────────────────
echo ""
echo "── Phase 5: VULN-1 — Polling unit isolation ────────────"
do_login "admin@lagos-island-lga.omnivote.ng" "password123"
curl -sf -b "$COOKIE_JAR" -o /tmp/adv-test-out.json "$BASE/api/dashboard?tenantId=$LOCAL_ID"

TOTAL=$((TOTAL + 1))
# Check all PUs are in Lagos
PU_STATES=$(cat /tmp/adv-test-out.json | python3 -c "
import json,sys
data = json.load(sys.stdin)
pus = data.get('pollingUnits', [])
states = set(pu.get('state','') for pu in pus)
print(' '.join(states))
print(str(len(pus)))
" 2>/dev/null || echo "PARSE_ERROR 0")

PU_COUNT=$(echo "$PU_STATES" | tail -1)
PU_STATES_ONLY=$(echo "$PU_STATES" | head -1)

if echo "$PU_STATES_ONLY" | grep -qv "Kano\|Rivers\|Enugu\|Abuja" && [ "$PU_COUNT" = "3" ]; then
  echo "  ✅ LOCAL dashboard: only Lagos PUs ($PU_COUNT units) — no leak"
  PASS=$((PASS + 1))
else
  echo "  ❌ LOCAL dashboard: PU states = '$PU_STATES_ONLY' (count=$PU_COUNT) — potential leak!"
  FAIL=$((FAIL + 1))
fi

# ── Phase 6: VULN-4 — Cross-tenant result submission ───────────────
echo ""
echo "── Phase 6: VULN-4 — Result submission isolation ───────"

# Get LOCAL agent ID
LOCAL_AGENT=$(python3 -c "import sqlite3; c=sqlite3.connect('/home/z/my-project/db/custom.db'); print(c.execute(\"SELECT id FROM User WHERE tenantId='$LOCAL_ID' AND role='FIELD_AGENT' LIMIT 1\").fetchone()[0])")
# Get STATE polling unit ID
STATE_PU=$(python3 -c "import sqlite3; c=sqlite3.connect('/home/z/my-project/db/custom.db'); print(c.execute(\"SELECT PollingUnit.id FROM PollingUnit JOIN Election ON PollingUnit.electionId=Election.id WHERE Election.tenantId='$STATE_ID' LIMIT 1\").fetchone()[0])")

test_api "Submit result cross-tenant PU → 403" POST "/api/results" "403" "{\"reporterId\":\"$LOCAL_AGENT\",\"pollingUnitId\":\"$STATE_PU\",\"totalVotesCast\":100,\"accreditedVoters\":120,\"totalValidVotes\":95,\"rejectedBallots\":5,\"partyResults\":[{\"party\":\"APC\",\"votes\":50}]}"

# ── Phase 7: VULN-6 — PVT election tenant check ────────────────────
echo ""
echo "── Phase 7: VULN-6 — PVT election tenant check ─────────"

STATE_ELECTION=$(python3 -c "import sqlite3; c=sqlite3.connect('/home/z/my-project/db/custom.db'); print(c.execute(\"SELECT id FROM Election WHERE tenantId='$STATE_ID' LIMIT 1\").fetchone()[0])")
LOCAL_PU=$(python3 -c "import sqlite3; c=sqlite3.connect('/home/z/my-project/db/custom.db'); print(c.execute(\"SELECT PollingUnit.id FROM PollingUnit JOIN Election ON PollingUnit.electionId=Election.id WHERE Election.tenantId='$LOCAL_ID' LIMIT 1\").fetchone()[0])")

test_api "Submit PVT cross-tenant election → 403" POST "/api/pvt?tenantId=$LOCAL_ID" "403" "{\"action\":\"SUBMIT_PVT\",\"electionId\":\"$STATE_ELECTION\",\"pollingUnitId\":\"$LOCAL_PU\",\"submittedById\":\"$LOCAL_AGENT\",\"totalVotesCast\":50,\"partyResults\":[{\"party\":\"APC\",\"votes\":25}]}"

# ── Phase 8: Scope verification ─────────────────────────────────────
echo ""
echo "── Phase 8: Tenant scope verification ──────────────────"
do_login "admin@lagos-island-lga.omnivote.ng" "password123"

curl -sf -b "$COOKIE_JAR" -o /tmp/adv-test-out.json "$BASE/api/tenant-settings?tenantId=$LOCAL_ID"
TOTAL=$((TOTAL + 1))
SCOPE=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('scope',''))" < /tmp/adv-test-out.json 2>/dev/null || echo "")
if [ "$SCOPE" = "LOCAL_GOVERNMENT" ]; then
  echo "  ✅ LOCAL tenant scope = LOCAL_GOVERNMENT"
  PASS=$((PASS + 1))
else
  echo "  ❌ LOCAL tenant scope = '$SCOPE' (expected LOCAL_GOVERNMENT)"
  FAIL=$((FAIL + 1))
fi

do_login "admin@kano-state-obs.omnivote.ng" "password123"
curl -sf -b "$COOKIE_JAR" -o /tmp/adv-test-out.json "$BASE/api/tenant-settings?tenantId=$STATE_ID"
TOTAL=$((TOTAL + 1))
SCOPE=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('scope',''))" < /tmp/adv-test-out.json 2>/dev/null || echo "")
if [ "$SCOPE" = "STATE_GOVERNMENT" ]; then
  echo "  ✅ STATE tenant scope = STATE_GOVERNMENT"
  PASS=$((PASS + 1))
else
  echo "  ❌ STATE tenant scope = '$SCOPE' (expected STATE_GOVERNMENT)"
  FAIL=$((FAIL + 1))
fi

do_login "admin@presidential-ng.omnivote.ng" "password123"
curl -sf -b "$COOKIE_JAR" -o /tmp/adv-test-out.json "$BASE/api/tenant-settings?tenantId=$PRES_ID"
TOTAL=$((TOTAL + 1))
SCOPE=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('scope',''))" < /tmp/adv-test-out.json 2>/dev/null || echo "")
if [ "$SCOPE" = "PRESIDENTIAL" ]; then
  echo "  ✅ PRES tenant scope = PRESIDENTIAL"
  PASS=$((PASS + 1))
else
  echo "  ❌ PRES tenant scope = '$SCOPE' (expected PRESIDENTIAL)"
  FAIL=$((FAIL + 1))
fi

# All tenants returned with scope by SUPER_ADMIN
curl -sf -b "$COOKIE_JAR" -o /tmp/adv-test-out.json "$BASE/api/tenants"
TOTAL=$((TOTAL + 1))
TENANT_COUNT=$(python3 -c "import json,sys; print(len(json.load(sys.stdin).get('tenants',[])))" < /tmp/adv-test-out.json 2>/dev/null || echo "0")
ALL_SCOPES=$(python3 -c "
import json,sys
data = json.load(sys.stdin)
scopes = set(t.get('scope','') for t in data.get('tenants',[]))
print(','.join(sorted(scopes)))
" < /tmp/adv-test-out.json 2>/dev/null || echo "")

if [ "$TENANT_COUNT" = "3" ] && echo "$ALL_SCOPES" | grep -q "LOCAL_GOVERNMENT" && echo "$ALL_SCOPES" | grep -q "STATE_GOVERNMENT" && echo "$ALL_SCOPES" | grep -q "PRESIDENTIAL"; then
  echo "  ✅ All 3 tenants with correct scopes: $ALL_SCOPES"
  PASS=$((PASS + 1))
else
  echo "  ❌ Tenants: count=$TENANT_COUNT, scopes='$ALL_SCOPES'"
  FAIL=$((FAIL + 1))
fi

# ── Phase 9: Positive tests (same-tenant access) ────────────────────
echo ""
echo "── Phase 9: Same-tenant access (positive) ─────────────"
do_login "admin@lagos-island-lga.omnivote.ng" "password123"
test_api "Own dashboard → 200" GET "/api/dashboard?tenantId=$LOCAL_ID" "200"
test_api "Own incidents → 200" GET "/api/incidents?tenantId=$LOCAL_ID" "200"
test_api "Own alerts → 200" GET "/api/alerts?tenantId=$LOCAL_ID" "200"
test_api "Own agents → 200" GET "/api/agents?tenantId=$LOCAL_ID" "200"
test_api "Own evidence → 200" GET "/api/evidence?tenantId=$LOCAL_ID" "200"
test_api "Own PVT → 200" GET "/api/pvt?tenantId=$LOCAL_ID" "200"
test_api "Own situation-room → 200" GET "/api/situation-room?tenantId=$LOCAL_ID" "200"

# ── Summary ─────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  RESULTS: $PASS/$TOTAL passed, $FAIL failed"
if [ "$FAIL" = "0" ]; then
  echo "  🟢 ALL TESTS PASSED — Tenant isolation is secure"
else
  echo "  🔴 $FAIL TEST(S) FAILED — Review output above"
fi
echo "═══════════════════════════════════════════════════════════"
echo ""

rm -f "$COOKIE_JAR" /tmp/adv-test-out.json
exit $FAIL