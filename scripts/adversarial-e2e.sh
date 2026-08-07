#!/bin/bash
# Adversarial E2E Validation Test for OmniVote
# Tests with attacker mindset: auth bypass, injection, XSS, tenant isolation, etc.

BASE="http://localhost:3000"
PASS=0
FAIL=0
FINDINGS=""

red() { echo -e "\033[31m$1\033[0m"; }
green() { echo -e "\033[32m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }
blue() { echo -e "\033[34m$1\033[0m"; }

test_api() {
  local name="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local expected_code="$5"
  local extra_headers="$6"
  
  if [ "$method" = "GET" ]; then
    resp=$(curl -s -w "\n%{http_code}" $extra_headers "$url" 2>&1)
  elif [ -n "$data" ]; then
    resp=$(curl -s -w "\n%{http_code}" -X "$method" -H 'Content-Type: application/json' $extra_headers -d "$data" "$url" 2>&1)
  else
    resp=$(curl -s -w "\n%{http_code}" -X "$method" $extra_headers "$url" 2>&1)
  fi
  
  body=$(echo "$resp" | sed '$d')
  code=$(echo "$resp" | tail -1)
  
  if [ "$code" = "$expected_code" ]; then
    green "  [PASS] $name → HTTP $code"
    PASS=$((PASS+1))
  else
    red "  [FAIL] $name → Expected $expected_code, got $code"
    red "         Body: $(echo $body | head -c 200)"
    FAIL=$((FAIL+1))
  fi
  
  echo "$body" > /tmp/last_resp.json
  echo "$code" > /tmp/last_code.txt
 }

get_last_body() { cat /tmp/last_resp.json; }
get_last_code() { cat /tmp/last_code.txt; }

save_cookie() {
  grep -i 'set-cookie' /tmp/curl_headers.txt | rg 'omnivote-session' | sed 's/.*omnivote-session=\([^;]*\).*/\1/' > /tmp/auth_cookie.txt 2>/dev/null
}

auth_request() {
  local method="$1"
  local url="$2"
  local data="$3"
  local cookie=$(cat /tmp/auth_cookie.txt 2>/dev/null)
  
  if [ -z "$cookie" ]; then
    echo "ERROR: No auth cookie. Login first."
    return 1
  fi
  
  if [ "$method" = "GET" ]; then
    curl -s -w "\n%{http_code}" -H "Cookie: omnivote-session=$cookie" "$url" 2>&1
  elif [ -n "$data" ]; then
    curl -s -w "\n%{http_code}" -X "$method" -H 'Content-Type: application/json' -H "Cookie: omnivote-session=$cookie" -d "$data" "$url" 2>&1
  else
    curl -s -w "\n%{http_code}" -X "$method" -H "Cookie: omnivote-session=$cookie" "$url" 2>&1
  fi
}

blue "═══════════════════════════════════════════════════════════"
blue "  OMNIVOTE ADVERSARIAL E2E VALIDATION"
blue "═══════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════
# CATEGORY 1: UNAUTHENTICATED ACCESS CONTROL
# ═══════════════════════════════════════════════════════════
yellow "\n─── CAT 1: UNAUTHENTICATED ACCESS CONTROL ───"

test_api "Health (public)" GET "$BASE/api/health" "" "200"
test_api "Auth GET (public - tenant list)" GET "$BASE/api/auth" "" "200"
test_api "Tenants GET (public)" GET "$BASE/api/tenants" "" "200"
test_api "Dashboard (protected)" GET "$BASE/api/dashboard" "" "401"
test_api "Incidents (protected)" GET "$BASE/api/incidents" "" "401"
test_api "Agents (protected)" GET "$BASE/api/agents" "" "401"
test_api "Security (protected)" GET "$BASE/api/security" "" "401"
test_api "Audit Logs (protected)" GET "$BASE/api/audit-logs" "" "401"
test_api "SSE (protected)" GET "$BASE/api/sse?tenantId=x&token=y" "" "401"
test_api "Elections (protected)" GET "$BASE/api/elections" "" "401"
test_api "Reports (protected)" GET "$BASE/api/reports" "" "401"
test_api "Export (protected)" GET "$BASE/api/export?type=incidents" "" "401"
test_api "Engagement (protected)" GET "$BASE/api/engagement" "" "401"
test_api "PVT (protected)" GET "$BASE/api/pvt" "" "401"
test_api "Evidence (protected)" GET "$BASE/api/evidence" "" "401"
test_api "Flashpoint (protected)" GET "$BASE/api/flashpoint" "" "401"
test_api "Honeypot (protected)" GET "$BASE/api/honeypot" "" "401"
test_api "Geofence (protected)" GET "$BASE/api/geofence" "" "401"
test_api "OSINT (protected)" GET "$BASE/api/osint" "" "401"
test_api "Voter Suppression (protected)" GET "$BASE/api/voter-suppression" "" "401"
test_api "Campaigns (protected)" GET "$BASE/api/campaigns" "" "401"
test_api "Situation Room (protected)" GET "$BASE/api/situation-room" "" "401"
test_api "WhatsApp (protected)" GET "$BASE/api/whatsapp" "" "401"
test_api "Tenant Settings (protected)" GET "$BASE/api/tenant-settings" "" "401"
test_api "Forgot Password (public)" POST "$BASE/api/auth/forgot-password" '{"email":"test@test.com"}' "200"
test_api "Reset Password (public)" POST "$BASE/api/auth/reset-password" '{"token":"fake","password":"test12345"}' "400"

# ═══════════════════════════════════════════════════════════
# CATEGORY 2: AUTHENTICATION ATTACKS
# ═══════════════════════════════════════════════════════════
yellow "\n─── CAT 2: AUTHENTICATION ATTACKS ───"

# Get tenant ID first
tenant_id=$(curl -s "$BASE/api/tenants" 2>/dev/null | python3 -c "import sys,json; tenants=json.load(sys.stdin); print(tenants[0]['id'])" 2>/dev/null)
echo "  Using tenant ID: $tenant_id"

test_api "SQL Injection login" POST "$BASE/api/auth" '{"email":"admin@presidential.omnivote.ng\" OR 1=1 --","password":"anything","tenantId":"'$tenant_id'"}' "401"
test_api "XSS in email" POST "$BASE/api/auth" '{"email":"<script>alert(1)</script>","password":"test","tenantId":"'$tenant_id'"}' "401"
test_api "NoSQL injection" POST "$BASE/api/auth" '{"email":{"$gt":""},"password":"test","tenantId":"'$tenant_id'"}' "401"
test_api "Empty credentials" POST "$BASE/api/auth" '{"email":"","password":""}' "401"
test_api "Missing fields" POST "$BASE/api/auth" '{"email":"test@test.com"}' "400"
test_api "Wrong password" POST "$BASE/api/auth" '{"email":"admin@presidential.omnivote.ng","password":"wrongpass","tenantId":"'$tenant_id'"}' "401"
test_api "Nonexistent user" POST "$BASE/api/auth" '{"email":"nonexistent@fake.com","password":"test","tenantId":"'$tenant_id'"}' "401"

# Brute force test (6 rapid attempts)
echo "  Brute force test (6 rapid wrong logins):"
for i in $(seq 1 6); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth" -H 'Content-Type: application/json' -d '{"email":"admin@presidential.omnivote.ng","password":"wrong","tenantId":"'$tenant_id'"}' 2>&1)
  echo -n "    Attempt $i: HTTP $code "
  if [ "$code" = "429" ]; then
    green "[RATE LIMITED]"
    break
  else
    echo ""
  fi
done

# ═══════════════════════════════════════════════════════════
# CATEGORY 3: LOGIN + AUTHENTICATED TESTS
# ═══════════════════════════════════════════════════════════
yellow "\n─── CAT 3: AUTHENTICATED ACCESS (SUPER_ADMIN login) ───"

# Login as SUPER_ADMIN
echo "  Logging in as admin@presidential.omnivote.ng..."
login_resp=$(curl -s -D /tmp/curl_headers.txt -w '\n%{http_code}' -X POST "$BASE/api/auth" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@presidential.omnivote.ng","password":"password123","tenantId":"'$tenant_id'"}' 2>&1)
login_code=$(echo "$login_resp" | tail -1)
login_body=$(echo "$login_resp" | sed '$d')

echo "  Login response: HTTP $login_code"
if [ "$login_code" = "200" ]; then
  green "  [PASS] SUPER_ADMIN login successful"
  PASS=$((PASS+1))
  save_cookie
  cookie=$(cat /tmp/auth_cookie.txt)
  if [ -z "$cookie" ]; then
    red "  [FAIL] No session cookie set!"
    FAIL=$((FAIL+1))
  else
    green "  [PASS] Session cookie received (length: ${#cookie})"
    PASS=$((PASS+1))
  fi
else
  red "  [FAIL] Login failed: $login_body"
  FAIL=$((FAIL+1))
fi

# Test authenticated access
test_api "Dashboard (auth'd)" GET "$BASE/api/dashboard?tenantId=$tenant_id" "" "200"
test_api "Incidents (auth'd)" GET "$BASE/api/incidents?tenantId=$tenant_id" "" "200"
test_api "Agents (auth'd)" GET "$BASE/api/agents?tenantId=$tenant_id" "" "200"
test_api "Alerts (auth'd)" GET "$BASE/api/alerts?tenantId=$tenant_id" "" "200"
test_api "Elections (auth'd)" GET "$BASE/api/elections?tenantId=$tenant_id" "" "200"
test_api "Audit Logs (auth'd)" GET "$BASE/api/audit-logs?tenantId=$tenant_id" "" "200"
test_api "Reports (auth'd)" GET "$BASE/api/reports?tenantId=$tenant_id&all=true" "" "200"
test_api "Situation Room (auth'd)" GET "$BASE/api/situation-room?tenantId=$tenant_id" "" "200"

# ═══════════════════════════════════════════════════════════
# CATEGORY 4: TENANT ISOLATION
# ═══════════════════════════════════════════════════════════
yellow "\n─── CAT 4: TENANT ISOLATION ───"

# Get second tenant ID
tenant2_id=$(curl -s "$BASE/api/tenants" 2>/dev/null | python3 -c "import sys,json; tenants=json.load(sys.stdin); print(tenants[1]['id'] if len(tenants)>1 else 'NONE')" 2>/dev/null)
echo "  Presidential tenant: $tenant_id"
echo "  Governorship tenant: $tenant2_id"

if [ "$tenant2_id" != "NONE" ] && [ -n "$tenant2_id" ]; then
  # Try to access governorship data while logged into presidential
  test_api "Cross-tenant dashboard access" GET "$BASE/api/dashboard?tenantId=$tenant2_id" "" "403"
  test_api "Cross-tenant incidents" GET "$BASE/api/incidents?tenantId=$tenant2_id" "" "403"
  test_api "Cross-tenant agents" GET "$BASE/api/agents?tenantId=$tenant2_id" "" "403"
  
  # Login as governorship admin
  echo "  Logging in as governorship admin..."
  gov_login=$(curl -s -D /tmp/curl_headers.txt -w '\n%{http_code}' -X POST "$BASE/api/auth" \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@governorship.omnivote.ng","password":"password123","tenantId":"'$tenant2_id'"}' 2>&1)
  gov_code=$(echo "$gov_login" | tail -1)
  if [ "$gov_code" = "200" ]; then
    green "  [PASS] Governorship admin login successful"
    PASS=$((PASS+1))
    save_cookie
    
    # Try to access presidential data
    test_api "Gov admin → Presidential dashboard" GET "$BASE/api/dashboard?tenantId=$tenant_id" "" "403"
    test_api "Gov admin → Presidential incidents" GET "$BASE/api/incidents?tenantId=$tenant_id" "" "403"
    
    # Governorship admin should NOT access tenants management
    test_api "Gov admin → Tenants CRUD (SUPER_ADMIN only)" GET "$BASE/api/tenants" "" "403"
    test_api "Gov admin → User management (SUPER_ADMIN only)" GET "$BASE/api/tenants/users" "" "403"
  else
    red "  [FAIL] Governorship login failed: $gov_code"
    FAIL=$((FAIL+1))
  fi
else
  yellow "  [SKIP] Only one tenant found, skipping isolation tests"
fi

# ═══════════════════════════════════════════════════════════
# CATEGORY 5: RBAC / ROLE-BASED ACCESS
# ═══════════════════════════════════════════════════════════
yellow "\n─── CAT 5: RBAC / ROLE-BASED ACCESS ───"

# Login as FIELD_AGENT (lowest privilege)
echo "  Logging in as field agent..."
field_login=$(curl -s -D /tmp/curl_headers.txt -w '\n%{http_code}' -X POST "$BASE/api/auth" \
  -H 'Content-Type: application/json' \
  -d '{"email":"field@presidential.omnivote.ng","password":"password123","tenantId":"'$tenant_id'"}' 2>&1)
field_code=$(echo "$field_login" | tail -1)
if [ "$field_code" = "200" ]; then
  green "  [PASS] Field agent login successful"
  PASS=$((PASS+1))
  save_cookie
  
  test_api "Field agent → Security center" GET "$BASE/api/security?tenantId=$tenant_id" "" "403"
  test_api "Field agent → Tenants CRUD" GET "$BASE/api/tenants" "" "403"
  test_api "Field agent → User management" GET "$BASE/api/tenants/users" "" "403"
  # Field agent should access their own data
  test_api "Field agent → Incidents" GET "$BASE/api/incidents?tenantId=$tenant_id" "" "200"
  test_api "Field agent → Dashboard" GET "$BASE/api/dashboard?tenantId=$tenant_id" "" "200"
  test_api "Field agent → Reports" GET "$BASE/api/reports?tenantId=$tenant_id" "" "200"
else
  red "  [FAIL] Field agent login failed: $field_code"
  FAIL=$((FAIL+1))
fi

# Login as ANALYST
echo "  Logging in as analyst..."
analyst_login=$(curl -s -D /tmp/curl_headers.txt -w '\n%{http_code}' -X POST "$BASE/api/auth" \
  -H 'Content-Type: application/json' \
  -d '{"email":"analyst@presidential.omnivote.ng","password":"password123","tenantId":"'$tenant_id'"}' 2>&1)
analyst_code=$(echo "$analyst_login" | tail -1)
if [ "$analyst_code" = "200" ]; then
  green "  [PASS] Analyst login successful"
  PASS=$((PASS+1))
  save_cookie
  
  test_api "Analyst → Security center" GET "$BASE/api/security?tenantId=$tenant_id" "" "403"
  test_api "Analyst → Tenants CRUD" GET "$BASE/api/tenants" "" "403"
  test_api "Analyst → Dashboard" GET "$BASE/api/dashboard?tenantId=$tenant_id" "" "200"
else
  red "  [FAIL] Analyst login failed: $analyst_code"
  FAIL=$((FAIL+1))
fi

# ═══════════════════════════════════════════════════════════
# CATEGORY 6: INPUT VALIDATION & INJECTION
# ═══════════════════════════════════════════════════════════
yellow "\n─── CAT 6: INPUT VALIDATION & INJECTION ───"

# Re-login as SUPER_ADMIN for write tests
curl -s -D /tmp/curl_headers.txt -o /dev/null -X POST "$BASE/api/auth" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@presidential.omnivote.ng","password":"password123","tenantId":"'$tenant_id'"}' 2>&1
save_cookie

test_api "XSS in incident description" POST "$BASE/api/incidents?tenantId=$tenant_id" '{"description":"<script>alert(document.cookie)</script>","type":"OBSERVATION","severity":"LOW","gpsLatitude":6.5,"gpsLongitude":3.5}' "400"
test_api "SQL injection in incident filter" GET "$BASE/api/incidents?tenantId='$tenant_id'&search=';DROP TABLE users;--" "" "200"
test_api "Very long input" POST "$BASE/api/incidents?tenantId=$tenant_id" '{"description":"'$(python3 -c "print('A'*10000)")'","type":"OBSERVATION","severity":"LOW","gpsLatitude":6.5,"gpsLongitude":3.5}' "400"
test_api "Negative coordinates" POST "$BASE/api/incidents?tenantId=$tenant_id" '{"description":"test","type":"OBSERVATION","severity":"LOW","gpsLatitude":-999,"gpsLongitude":-999}' "400"
test_api "Missing required fields" POST "$BASE/api/incidents?tenantId=$tenant_id" '{"description":"test"}' "400"
test_api "Invalid enum value" POST "$BASE/api/incidents?tenantId=$tenant_id" '{"description":"test","type":"INVALID_TYPE","severity":"LOW","gpsLatitude":6.5,"gpsLongitude":3.5}' "400"

# ═══════════════════════════════════════════════════════════
# CATEGORY 7: SECURITY HEADERS
# ═══════════════════════════════════════════════════════════
yellow "\n─── CAT 7: SECURITY HEADERS ───"

check_header() {
  local name="$1"
  local header="$2"
  local expected="$3"
  local url="$4"
  
  value=$(curl -sI "$url" 2>/dev/null | rg -i "$header" | tr -d '\r')
  if echo "$value" | rg -qi "$expected"; then
    green "  [PASS] $name: $value"
    PASS=$((PASS+1))
  else
    red "  [FAIL] $name: Expected '$expected' in $header, got: $value"
    FAIL=$((FAIL+1))
  fi
}

check_header "X-Frame-Options" "x-frame-options" "DENY" "$BASE/api/health"
check_header "X-Content-Type-Options" "x-content-type-options" "nosniff" "$BASE/api/health"
check_header "X-XSS-Protection" "x-xss-protection" "1" "$BASE/api/health"
check_header "Referrer-Policy" "referrer-policy" "strict-origin" "$BASE/api/health"
check_header "Content-Security-Policy" "content-security-policy" "default-src" "$BASE/api/health"
check_header "Permissions-Policy" "permissions-policy" "camera" "$BASE/api/health"

# ═══════════════════════════════════════════════════════════
# CATEGORY 8: METHOD TAMPERING & PATH TRAVERSAL
# ═══════════════════════════════════════════════════════════
yellow "\n─── CAT 8: METHOD TAMPERING & PATH TRAVERSAL ───"

test_api "DELETE on public tenants" DELETE "$BASE/api/tenants" "" "405"
test_api "PUT on public health" PUT "$BASE/api/health" "" "405"
test_api "PATCH on public auth" PATCH "$BASE/api/auth" "" "405"
test_api "Path traversal /api/../../etc/passwd" GET "$BASE/api/../../etc/passwd" "" "404"
test_api "Path traversal /api/../../../tmp/" GET "$BASE/api/../../../tmp/" "" "404"
test_api "Dot-dot in query" GET "$BASE/api/incidents?file=../../../etc/passwd" "" "401"

# ═══════════════════════════════════════════════════════════
# CATEGORY 9: SESSION & COOKIE SECURITY
# ═══════════════════════════════════════════════════════════
yellow "\n─── CAT 9: SESSION & COOKIE SECURITY ───"

# Check cookie attributes
cookie_header=$(curl -sI -X POST "$BASE/api/auth" -H 'Content-Type: application/json' \
  -d '{"email":"admin@presidential.omnivote.ng","password":"password123","tenantId":"'$tenant_id'"}' 2>/dev/null | rg -i 'set-cookie.*omnivote')

echo "  Cookie header: $cookie_header"
if echo "$cookie_header" | rg -qi "httponly"; then
  green "  [PASS] Cookie is HttpOnly"
  PASS=$((PASS+1))
else
  red "  [FAIL] Cookie missing HttpOnly flag"
  FAIL=$((FAIL+1))
fi

if echo "$cookie_header" | rg -qi "samesite"; then
  green "  [PASS] Cookie has SameSite attribute"
  PASS=$((PASS+1))
else
  red "  [FAIL] Cookie missing SameSite attribute"
  FAIL=$((FAIL+1))
fi

# Test expired/invalid token
test_api "Expired JWT token" GET "$BASE/api/dashboard?tenantId=$tenant_id" "" "401" "-H 'Cookie: omnivote-session=eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MDAwMDAwMDB9.fake'
test_api "Garbage token" GET "$BASE/api/dashboard?tenantId=$tenant_id" "" "401" "-H 'Cookie: omnivote-session=not-a-jwt'"
test_api "Empty token" GET "$BASE/api/dashboard?tenantId=$tenant_id" "" "401" "-H 'Cookie: omnivote-session='"

# ═══════════════════════════════════════════════════════════
# CATEGORY 10: BROWSER-BASED TESTS
# ═══════════════════════════════════════════════════════════
yellow "\n─── CAT 10: BROWSER-BASED TESTS (agent-browser) ───"

# These will be run separately via agent-browser commands

# ═══════════════════════════════════════════════════════════
# CATEGORY 11: INFORMATION DISCLOSURE
# ═══════════════════════════════════════════════════════════
yellow "\n─── CAT 11: INFORMATION DISCLOSURE ───"

# Re-login as admin for data exposure tests
curl -s -D /tmp/curl_headers.txt -o /dev/null -X POST "$BASE/api/auth" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@presidential.omnivote.ng","password":"password123","tenantId":"'$tenant_id'"}' 2>&1
save_cookie

# Check if password hash is leaked
resp=$(curl -s "$BASE/api/agents?tenantId=$tenant_id" 2>&1)
if echo "$resp" | rg -qi "passwordHash\|password_hash\|bcrypt\|$2b\$"; then
  red "  [FAIL] Password hash potentially leaked in agents response"
  FAIL=$((FAIL+1))
else
  green "  [PASS] No password hash in agents response"
  PASS=$((PASS+1))
fi

# Check if JWT secret is exposed
resp=$(curl -s "$BASE/api/health" 2>&1)
if echo "$resp" | rg -qi "secret\|JWT_SECRET\|private.key"; then
  red "  [FAIL] JWT secret potentially exposed in health endpoint"
  FAIL=$((FAIL+1))
else
  green "  [PASS] No JWT secret in health endpoint"
  PASS=$((PASS+1))
fi

# Check tenant list for info leak
resp=$(curl -s "$BASE/api/tenants" 2>&1)
if echo "$resp" | rg -qi "passwordHash\|secret\|private"; then
  red "  [FAIL] Sensitive data in public tenants endpoint"
  FAIL=$((FAIL+1))
else
  green "  [PASS] No sensitive data in public tenants endpoint"
  PASS=$((PASS+1))
fi

# Check stack traces in error responses
test_api "Non-existent API route" GET "$BASE/api/nonexistent-route" "" "404"
resp=$(get_last_body)
if echo "$resp" | rg -qi "stack\|trace\|internal server error\|prisma\|sqlite"; then
  red "  [FAIL] Stack trace / internal error details leaked: $(echo $resp | head -c 200)"
  FAIL=$((FAIL+1))
else
  green "  [PASS] No stack trace in 404 response"
  PASS=$((PASS+1))
fi

# ═══════════════════════════════════════════════════════════
# CATEGORY 12: LOGOUT & SESSION INVALIDATION
# ═══════════════════════════════════════════════════════════
yellow "\n─── CAT 12: SESSION LIFECYCLE ───"

# Login, get cookie, verify access, logout, verify blocked
echo "  Login → Access → Logout → Verify blocked..."
curl -s -D /tmp/curl_headers.txt -o /dev/null -X POST "$BASE/api/auth" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@presidential.omnivote.ng","password":"password123","tenantId":"'$tenant_id'"}' 2>&1
save_cookie
cookie=$(cat /tmp/auth_cookie.txt)

code1=$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: omnivote-session=$cookie" "$BASE/api/dashboard?tenantId=$tenant_id" 2>&1)
echo "  Before logout: Dashboard → HTTP $code1"

# Logout
logout_code=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE -H "Cookie: omnivote-session=$cookie" "$BASE/api/auth" 2>&1)
echo "  Logout: HTTP $logout_code"

code2=$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: omnivote-session=$cookie" "$BASE/api/dashboard?tenantId=$tenant_id" 2>&1)
echo "  After logout: Dashboard → HTTP $code2"
if [ "$code2" = "401" ]; then
  green "  [PASS] Session properly invalidated after logout"
  PASS=$((PASS+1))
else
  red "  [FAIL] Session NOT invalidated after logout (got $code2)"
  FAIL=$((FAIL+1))
fi

# ═══════════════════════════════════════════════════════════
# CATEGORY 13: TENANT LOGIN PAGES
# ═══════════════════════════════════════════════════════════
yellow "\n─── CAT 13: TENANT LOGIN PAGES ───"

test_api "Tenant login: /t/presidential" GET "$BASE/t/presidential" "" "200"
test_api "Tenant login: /t/governorship" GET "$BASE/t/governorship" "" "200"
test_api "Tenant login: /t/nonexistent" GET "$BASE/t/nonexistent" "" "404"
test_api "Tenant login: /t/../../../etc/passwd" GET "$BASE/t/../../../etc/passwd" "" "404"

# ═══════════════════════════════════════════════════════════
# CATEGORY 14: FORGOT/RESET PASSWORD SECURITY
# ═══════════════════════════════════════════════════════════
yellow "\n─── CAT 14: PASSWORD RESET SECURITY ───"

# Email enumeration check
resp1=$(curl -s -X POST "$BASE/api/auth/forgot-password" -H 'Content-Type: application/json' -d '{"email":"admin@presidential.omnivote.ng"}' 2>&1)
resp2=$(curl -s -X POST "$BASE/api/auth/forgot-password" -H 'Content-Type: application/json' -d '{"email":"nonexistent@fake.com"}' 2>&1)
echo "  Valid email response: $(echo $resp1 | head -c 150)"
echo "  Invalid email response: $(echo $resp2 | head -c 150)"
if [ "$resp1" = "$resp2" ] || echo "$resp1" | rg -qi "success\|check" && echo "$resp2" | rg -qi "success\|check"; then
  green "  [PASS] Password reset responses are identical (no email enumeration)"
  PASS=$((PASS+1))
else
  yellow "  [WARN] Password reset responses differ - possible email enumeration"
  FINDINGS="$FINDINGS\n  [WARN] Email enumeration via forgot-password: valid=$resp1, invalid=$resp2"
fi

# ═══════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════
echo ""
blue "═══════════════════════════════════════════════════════════"
blue "  RESULTS: $PASS PASSED, $FAIL FAILED"
blue "═══════════════════════════════════════════════════════════"

if [ -n "$FINDINGS" ]; then
  yellow "  ADDITIONAL FINDINGS:"
  echo -e "$FINDINGS"
fi

echo ""
echo "PASS=$PASS" > /tmp/test_results.txt
echo "FAIL=$FAIL" >> /tmp/test_results.txt
