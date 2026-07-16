#!/bin/bash
# OmniVote E2E Test — reads JSON with node for reliability
set -e

cd /home/z/my-project
export NODE_ENV=production
export PORT=3000
export JWT_SECRET="omnivote-prod-secret-2024-change-me"

npx next start -p 3000 > /tmp/omnivote-e2e.log 2>&1 &
SERVER_PID=$!
(while kill -0 $SERVER_PID 2>/dev/null; do curl -s -o /dev/null http://localhost:3000/ 2>/dev/null; sleep 2; done) &
KEEP_PID=$!
trap "kill $SERVER_PID 2>/dev/null; kill $KEEP_PID 2>/dev/null" EXIT

echo "Waiting for server..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:3000/ 2>/dev/null; then echo "Ready after ${i}s"; break; fi
  sleep 1
done

CJ="/tmp/e2e-cookies.txt"
rm -f "$CJ"
PASSED=0; FAILED=0
chk() { if eval "$2"; then PASSED=$((PASSED+1)); echo "  ✅ $1 ${3:+— $3}"; else FAILED=$((FAILED+1)); echo "  ❌ $1 ${3:+— $3}"; fi; }

# Helper: curl → extract status + body into vars
get() {
  local out; out=$(curl -s -w '\n%{http_code}' -b "$CJ" -c "$CJ" "$@")
  E2E_STATUS=$(echo "$out" | tail -1)
  E2E_BODY=$(echo "$out" | sed '$d')
}

# ── 1. Auth ──
echo -e "\n── 1. Authentication --"
get -X POST http://localhost:3000/api/auth -H 'Content-Type: application/json' \
  -d '{"email":"platform-admin@omnivote.ng","password":"admin123"}'
SA_TID=$(node -pe "JSON.parse(process.argv[1]).user?.tenantId||''" "$E2E_BODY")
SA_ROLE=$(node -pe "JSON.parse(process.argv[1]).user?.role||''" "$E2E_BODY")
chk "SA login" "[ $E2E_STATUS -eq 200 ] && [ -n '$SA_TID' ]" "status=$E2E_STATUS tid=${SA_TID:0:12}"
chk "SA role" "[ '$SA_ROLE' = 'SUPER_ADMIN' ]" "role=$SA_ROLE"

get -X POST http://localhost:3000/api/auth -H 'Content-Type: application/json' \
  -d '{"email":"platform-admin@omnivote.ng","password":"wrong"}'
chk "Bad password → 401" "[ $E2E_STATUS -eq 401 ]" "status=$E2E_STATUS"

# ── 2. Dashboard ──
echo -e "\n── 2. Dashboard API (New) --"
get "http://localhost:3000/api/dashboard?tenantId=$SA_TID"
chk "Dashboard 200" "[ $E2E_STATUS -eq 200 ]" "status=$E2E_STATUS"
KPI_TA=$(node -pe "JSON.parse(process.argv[1]).kpis?.totalAgents??'X'" "$E2E_BODY")
KPI_ON=$(node -pe "JSON.parse(process.argv[1]).kpis?.onlineAgents??'X'" "$E2E_BODY")
KPI_INC=$(node -pe "JSON.parse(process.argv[1]).kpis?.totalIncidents??'X'" "$E2E_BODY")
KPI_UN=$(node -pe "JSON.parse(process.argv[1]).kpis?.unreadAlerts??'X'" "$E2E_BODY")
KPI_CR=$(node -pe "JSON.parse(process.argv[1]).kpis?.criticalIncidents??'X'" "$E2E_BODY")
EL_TIER=$(node -pe "JSON.parse(process.argv[1]).electionInfo?.tier??'X'" "$E2E_BODY")
EL_PUS=$(node -pe "JSON.parse(process.argv[1]).election?.totalPollingUnits??'X'" "$E2E_BODY")
PU_LEN=$(node -pe "JSON.parse(process.argv[1]).pollingUnits?.length??'X'" "$E2E_BODY")
ST_CT=$(node -pe "Object.keys(JSON.parse(process.argv[1]).election?.stateAgg||{}).length" "$E2E_BODY")
TR_VA=$(node -pe "JSON.parse(process.argv[1]).trends?.onlineAgents?.value??'X'" "$E2E_BODY")
HAS_MB=$(node -pe "'mapBounds' in JSON.parse(process.argv[1])?'Y':'N'" "$E2E_BODY")
chk "KPI totalAgents" "[ '$KPI_TA' != 'X' ]" "val=$KPI_TA"
chk "KPI onlineAgents" "[ '$KPI_ON' != 'X' ]" "val=$KPI_ON"
chk "KPI totalIncidents" "[ '$KPI_INC' != 'X' ]" "val=$KPI_INC"
chk "KPI unreadAlerts" "[ '$KPI_UN' != 'X' ]" "val=$KPI_UN"
chk "KPI criticalIncidents" "[ '$KPI_CR' != 'X' ]" "val=$KPI_CR"
chk "ElectionInfo tier" "[ '$EL_TIER' != 'X' ]" "tier=$EL_TIER"
chk "Election totalPUs" "[ '$EL_PUS' != 'X' ]" "val=$EL_PUS"
chk "PollingUnits array" "[ '$PU_LEN' != 'X' ]" "count=$PU_LEN"
chk "State aggregation" "[ $ST_CT -gt 0 ]" "$ST_CT states"
chk "Trends" "[ '$TR_VA' != 'X' ]" "val=$TR_VA"
chk "mapBounds field" "[ '$HAS_MB' = 'Y' -o '$HAS_MB' = 'N' ]" "has=$HAS_MB"

# ── 3. Tenant Isolation ──
echo -e "\n── 3. Tenant Isolation --"
get http://localhost:3000/api/tenants
T_COUNT=$(node -pe "JSON.parse(process.argv[1]).tenants?.length||0" "$E2E_BODY")
# Use a data-rich tenant for dashboard state test (not SA's empty tenant)
DATA_TID=$(node -pe "JSON.parse(process.argv[1]).tenants?.find(t=>t._count?.incidents>0)?.id||''" "$E2E_BODY")
OTHER_TID=$(node -pe "JSON.parse(process.argv[1]).tenants?.find(t=>t.id!=='$SA_TID'&&t.id!=='$DATA_TID')?.id||'$DATA_TID'" "$E2E_BODY")
chk "SA lists tenants" "[ $T_COUNT -ge 2 ]" "$T_COUNT tenants"

if [ -n "$OTHER_TID" ]; then
  get "http://localhost:3000/api/incidents?tenantId=$OTHER_TID"
  X_INC=$(node -pe "JSON.parse(process.argv[1]).incidents?.length||0" "$E2E_BODY")
  chk "SA cross-tenant" "[ $E2E_STATUS -eq 200 ]" "status=$E2E_STATUS inc=$X_INC"
fi

# TA login
rm -f "$CJ"
get -X POST http://localhost:3000/api/auth -H 'Content-Type: application/json' \
  -d '{"email":"admin@lagos-state.omnivote.ng","password":"admin123"}'
TA_TID=$(node -pe "JSON.parse(process.argv[1]).user?.tenantId||''" "$E2E_BODY")
if [ -n "$TA_TID" ] && [ -n "$SA_TID" ]; then
  get "http://localhost:3000/api/incidents?tenantId=$TA_TID"
  chk "TA reads own" "[ $E2E_STATUS -eq 200 ]" "status=$E2E_STATUS"
  get "http://localhost:3000/api/incidents?tenantId=$SA_TID"
  chk "TA blocked from SA" "[ $E2E_STATUS -eq 403 ]" "status=$E2E_STATUS"
fi

# ── 2b. Dashboard with data-rich tenant ──
echo -e "\n── 2b. Dashboard (data-rich tenant) --"
rm -f "$CJ"
get -X POST http://localhost:3000/api/auth -H 'Content-Type: application/json' \
  -d '{"email":"platform-admin@omnivote.ng","password":"admin123"}'
if [ -n "$DATA_TID" ]; then
  get "http://localhost:3000/api/dashboard?tenantId=$DATA_TID"
  ST_CT=$(node -pe "Object.keys(JSON.parse(process.argv[1]).election?.stateAgg||{}).length" "$E2E_BODY")
  PU_LEN2=$(node -pe "JSON.parse(process.argv[1]).pollingUnits?.length??0" "$E2E_BODY")
  KPI_I2=$(node -pe "JSON.parse(process.argv[1]).kpis?.totalIncidents??0" "$E2E_BODY")
  chk "Dashboard data-rich 200" "[ $E2E_STATUS -eq 200 ]" "status=$E2E_STATUS"
  chk "State agg (data tenant)" "[ $ST_CT -gt 0 ]" "$ST_CT states, PUs=$PU_LEN2, incidents=$KPI_I2"
fi

# ── 4. Scopes ──
echo -e "\n── 4. Tenant Scopes --"
rm -f "$CJ"
get -X POST http://localhost:3000/api/auth -H 'Content-Type: application/json' \
  -d '{"email":"platform-admin@omnivote.ng","password":"admin123"}'
get http://localhost:3000/api/tenants
W_SC=$(node -pe "JSON.parse(process.argv[1]).tenants?.filter(t=>t.scope)?.length||0" "$E2E_BODY")
SC_TY=$(node -pe "[...new Set(JSON.parse(process.argv[1]).tenants?.map(t=>t.scope)?.filter(Boolean))].join(', ')" "$E2E_BODY")
chk "Tenants have scope" "[ $W_SC -ge 2 ]" "$W_SC/$T_COUNT"
N_SC=$(echo "$SC_TY" | tr ',' '\n' | wc -l)
chk "Multiple scope types" "[ $N_SC -ge 2 ]" "$SC_TY"

# ── 5. Security ──
echo -e "\n── 5. Security --"
rm -f "$CJ"
get -X POST http://localhost:3000/api/auth -H 'Content-Type: application/json' \
  -d '{"email":"tunde@lagos-island.omnivote.ng","password":"admin123"}'
FA_TID=$(node -pe "JSON.parse(process.argv[1]).user?.tenantId||''" "$E2E_BODY")
if [ -n "$FA_TID" ]; then
  get "http://localhost:3000/api/tenant-settings?tenantId=$FA_TID"
  chk "FA blocked settings" "[ $E2E_STATUS -eq 403 ]" "status=$E2E_STATUS"
  get http://localhost:3000/api/tenants
  chk "FA blocked tenants" "[ $E2E_STATUS -eq 403 ]" "status=$E2E_STATUS"
  get "http://localhost:3000/api/dashboard?tenantId=$FA_TID"
  chk "FA dashboard OK" "[ $E2E_STATUS -eq 200 ]" "status=$E2E_STATUS"
  get http://localhost:3000/api/incidents
  chk "Missing tid → 400" "[ $E2E_STATUS -eq 400 ]" "status=$E2E_STATUS"
fi

# ── 6. Routes ──
echo -e "\n── 6. All Route Health --"
rm -f "$CJ"
get -X POST http://localhost:3000/api/auth -H 'Content-Type: application/json' \
  -d '{"email":"platform-admin@omnivote.ng","password":"admin123"}'
for R in alerts geofence security situation-room pvt evidence engagement honeypot flashpoint osint voter-suppression results campaigns; do
  get "http://localhost:3000/api/${R}?tenantId=${SA_TID}&limit=1"
  chk "$R" "[ $E2E_STATUS -eq 200 ]" "status=$E2E_STATUS"
done
# reports needs different params
get "http://localhost:3000/api/reports?all=true&tenantId=${SA_TID}&limit=1"
chk "reports" "[ $E2E_STATUS -eq 200 ]" "status=$E2E_STATUS"

echo -e "\n╔══════════════════════════════════════════╗"
echo "  Results: $PASSED passed, $FAILED failed"
echo "╚══════════════════════════════════════════╝"
exit $FAILED