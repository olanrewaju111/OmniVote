#!/usr/bin/env python3
"""
OmniVote Adversarial E2E Validation Test
Tests with attacker mindset: auth bypass, injection, XSS, tenant isolation, etc.
"""

import subprocess
import time
import json
import requests
import sys
import os

BASE = "http://localhost:3000"
PASS = 0
FAIL = 0
FINDINGS = []


def test(name, method, url, expected_code, data=None, headers=None, cookies=None):
    """Run a single API test."""
    global PASS, FAIL
    try:
        if method == "GET":
            r = requests.get(url, headers=headers, cookies=cookies, timeout=15)
        elif method == "POST":
            r = requests.post(url, json=data, headers=headers, cookies=cookies, timeout=15)
        elif method == "DELETE":
            r = requests.delete(url, headers=headers, cookies=cookies, timeout=15)
        elif method == "PUT":
            r = requests.put(url, json=data, headers=headers, cookies=cookies, timeout=15)
        elif method == "PATCH":
            r = requests.patch(url, json=data, headers=headers, cookies=cookies, timeout=15)
        else:
            r = requests.request(method, url, headers=headers, cookies=cookies, timeout=15)
        
        body_preview = r.text[:200] if r.text else "(empty)"
        if r.status_code == expected_code:
            print(f"  \033[32m[PASS]\033[0m {name} → HTTP {r.status_code}")
            PASS += 1
        else:
            print(f"  \033[31m[FAIL]\033[0m {name} → Expected {expected_code}, got {r.status_code}")
            print(f"         Body: {body_preview}")
            FAIL += 1
        return r
    except requests.exceptions.ConnectionError:
        print(f"  \033[31m[FAIL]\033[0m {name} → Connection refused (server down)")
        FAIL += 1
        return None
    except Exception as e:
        print(f"  \033[31m[FAIL]\033[0m {name} → Error: {e}")
        FAIL += 1
        return None


def get_session(email, password, tenant_id):
    """Login and return (session, response)."""
    s = requests.Session()
    try:
        r = s.post(f"{BASE}/api/auth", json={
            "email": email, "password": password, "tenantId": tenant_id
        }, timeout=15)
        return s, r
    except Exception as e:
        print(f"  Login error: {e}")
        return s, None


def get_tenant_ids():
    """Get list of tenant IDs from public endpoint."""
    try:
        r = requests.get(f"{BASE}/api/tenants", timeout=10)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list):
                return [t["id"] for t in data]
            return []
    except:
        return []
    return []


def main():
    global PASS, FAIL, FINDINGS
    
    print("\033[34m═══════════════════════════════════════════════════════════")
    print("  OMNIVOTE ADVERSARIAL E2E VALIDATION")
    print("═══════════════════════════════════════════════════════════\033[0m")
    
    # Wait for server
    print("\nWaiting for server...")
    for i in range(60):
        try:
            r = requests.get(f"{BASE}/api/health", timeout=2)
            if r.status_code == 200:
                print(f"Server ready after {i+1}s")
                break
        except:
            pass
        time.sleep(1)
    else:
        print("\033[31mERROR: Server never became ready\033[0m")
        sys.exit(1)
    
    # ═══════════════════════════════════════════════════════════
    # CAT 1: UNAUTHENTICATED ACCESS CONTROL
    # ═══════════════════════════════════════════════════════════
    print("\n\033[33m─── CAT 1: UNAUTHENTICATED ACCESS CONTROL ───\033[0m")
    
    test("Health endpoint (public)", "GET", f"{BASE}/api/health", 200)
    test("Auth GET - tenant list (public)", "GET", f"{BASE}/api/auth", 200)
    test("Tenants GET (public)", "GET", f"{BASE}/api/tenants", 200)
    test("Dashboard (protected)", "GET", f"{BASE}/api/dashboard", 401)
    test("Incidents (protected)", "GET", f"{BASE}/api/incidents", 401)
    test("Agents (protected)", "GET", f"{BASE}/api/agents", 401)
    test("Security (protected)", "GET", f"{BASE}/api/security", 401)
    test("Audit Logs (protected)", "GET", f"{BASE}/api/audit-logs", 401)
    test("Elections (protected)", "GET", f"{BASE}/api/elections", 401)
    test("Reports (protected)", "GET", f"{BASE}/api/reports", 401)
    test("Export (protected)", "GET", f"{BASE}/api/export?type=incidents", 401)
    test("Engagement (protected)", "GET", f"{BASE}/api/engagement", 401)
    test("PVT (protected)", "GET", f"{BASE}/api/pvt", 401)
    test("Evidence (protected)", "GET", f"{BASE}/api/evidence", 401)
    test("Flashpoint (protected)", "GET", f"{BASE}/api/flashpoint", 401)
    test("Honeypot (protected)", "GET", f"{BASE}/api/honeypot", 401)
    test("Geofence (protected)", "GET", f"{BASE}/api/geofence", 401)
    test("OSINT (protected)", "GET", f"{BASE}/api/osint", 401)
    test("Voter Suppression (protected)", "GET", f"{BASE}/api/voter-suppression", 401)
    test("Campaigns (protected)", "GET", f"{BASE}/api/campaigns", 401)
    test("Situation Room (protected)", "GET", f"{BASE}/api/situation-room", 401)
    test("WhatsApp (protected)", "GET", f"{BASE}/api/whatsapp", 401)
    test("Tenant Settings (protected)", "GET", f"{BASE}/api/tenant-settings", 401)
    test("Forgot Password (public)", "POST", f"{BASE}/api/auth/forgot-password", 200,
         data={"email": "test@test.com"})
    test("Reset Password (public)", "POST", f"{BASE}/api/auth/reset-password", 400,
         data={"token": "fake", "password": "test12345"})
    
    # ═══════════════════════════════════════════════════════════
    # CAT 2: AUTHENTICATION ATTACKS
    # ═══════════════════════════════════════════════════════════
    print("\n\033[33m─── CAT 2: AUTHENTICATION ATTACKS ───\033[0m")
    
    tenant_ids = get_tenant_ids()
    tid = tenant_ids[0] if tenant_ids else ""
    print(f"  Using tenant ID: {tid}")
    
    if tid:
        test("SQL Injection login", "POST", f"{BASE}/api/auth", 401,
             data={"email": 'admin@presidential.omnivote.ng" OR 1=1 --', "password": "anything", "tenantId": tid})
        test("XSS in email", "POST", f"{BASE}/api/auth", 401,
             data={"email": "<script>alert(1)</script>", "password": "test", "tenantId": tid})
        test("NoSQL injection", "POST", f"{BASE}/api/auth", 401,
             data={"email": {"$gt": ""}, "password": "test", "tenantId": tid})
        test("Empty credentials", "POST", f"{BASE}/api/auth", 401,
             data={"email": "", "password": "", "tenantId": tid})
        test("Missing password field", "POST", f"{BASE}/api/auth", 400,
             data={"email": "test@test.com", "tenantId": tid})
        test("Wrong password", "POST", f"{BASE}/api/auth", 401,
             data={"email": "admin@presidential.omnivote.ng", "password": "wrongpass", "tenantId": tid})
        test("Nonexistent user", "POST", f"{BASE}/api/auth", 401,
             data={"email": "nonexistent@fake.com", "password": "test", "tenantId": tid})
        
        # Brute force test
        print("  Brute force test (6 rapid wrong logins):")
        rate_limited = False
        for i in range(6):
            try:
                r = requests.post(f"{BASE}/api/auth", json={
                    "email": "admin@presidential.omnivote.ng",
                    "password": "wrong",
                    "tenantId": tid
                }, timeout=10)
                if r.status_code == 429:
                    print(f"    Attempt {i+1}: HTTP 429 \033[32m[RATE LIMITED]\033[0m")
                    rate_limited = True
                    PASS += 1
                    break
                else:
                    print(f"    Attempt {i+1}: HTTP {r.status_code}")
            except:
                print(f"    Attempt {i+1}: Connection error")
        if not rate_limited:
            print("    \033[31m[WARN] No rate limiting triggered after 6 attempts\033[0m")
            FINDINGS.append("No rate limiting after 6 rapid login attempts")
    else:
        print("  [SKIP] No tenant ID available")
    
    # ═══════════════════════════════════════════════════════════
    # CAT 3: AUTHENTICATED ACCESS
    # ═══════════════════════════════════════════════════════════
    print("\n\033[33m─── CAT 3: AUTHENTICATED ACCESS (SUPER_ADMIN) ───\033[0m")
    
    if tid:
        s, r = get_session("admin@presidential.omnivote.ng", "password123", tid)
        if r and r.status_code == 200:
            print(f"  \033[32m[PASS]\033[0m SUPER_ADMIN login successful")
            PASS += 1
            
            # Check cookie
            cookies = s.cookies
            has_session = any('omnivote-session' in c.name for c in cookies)
            if has_session:
                print(f"  \033[32m[PASS]\033[0m Session cookie received")
                PASS += 1
            else:
                print(f"  \033[31m[FAIL]\033[0m No session cookie in response")
                FAIL += 1
            
            # Test authenticated access
            test("Dashboard (auth'd)", "GET", f"{BASE}/api/dashboard?tenantId={tid}", 200, cookies=cookies)
            test("Incidents (auth'd)", "GET", f"{BASE}/api/incidents?tenantId={tid}", 200, cookies=cookies)
            test("Agents (auth'd)", "GET", f"{BASE}/api/agents?tenantId={tid}", 200, cookies=cookies)
            test("Alerts (auth'd)", "GET", f"{BASE}/api/alerts?tenantId={tid}", 200, cookies=cookies)
            test("Elections (auth'd)", "GET", f"{BASE}/api/elections?tenantId={tid}", 200, cookies=cookies)
            test("Audit Logs (auth'd)", "GET", f"{BASE}/api/audit-logs?tenantId={tid}", 200, cookies=cookies)
            test("Reports (auth'd)", "GET", f"{BASE}/api/reports?tenantId={tid}&all=true", 200, cookies=cookies)
            test("Situation Room (auth'd)", "GET", f"{BASE}/api/situation-room?tenantId={tid}", 200, cookies=cookies)
        else:
            code = r.status_code if r else 'N/A'
            print(f"  \033[31m[FAIL]\033[0m SUPER_ADMIN login failed: HTTP {code}")
            FAIL += 1
    
    # ═══════════════════════════════════════════════════════════
    # CAT 4: TENANT ISOLATION
    # ═══════════════════════════════════════════════════════════
    print("\n\033[33m─── CAT 4: TENANT ISOLATION ───\033[0m")
    
    if len(tenant_ids) >= 2:
        tid1 = tenant_ids[0]
        tid2 = tenant_ids[1]
        print(f"  Tenant 1: {tid1}")
        print(f"  Tenant 2: {tid2}")
        
        # Login to tenant 1, try to access tenant 2
        s1, r1 = get_session("admin@presidential.omnivote.ng", "password123", tid1)
        if r1 and r1.status_code == 200:
            test("Cross-tenant dashboard access", "GET", f"{BASE}/api/dashboard?tenantId={tid2}", 403, cookies=s1.cookies)
            test("Cross-tenant incidents", "GET", f"{BASE}/api/incidents?tenantId={tid2}", 403, cookies=s1.cookies)
            test("Cross-tenant agents", "GET", f"{BASE}/api/agents?tenantId={tid2}", 403, cookies=s1.cookies)
        
        # Login as tenant 2 admin, try tenant 1
        s2, r2 = get_session("admin@governorship.omnivote.ng", "password123", tid2)
        if r2 and r2.status_code == 200:
            print(f"  \033[32m[PASS]\033[0m Governorship admin login successful")
            PASS += 1
            test("Gov admin -> Presidential dashboard", "GET", f"{BASE}/api/dashboard?tenantId={tid1}", 403, cookies=s2.cookies)
            test("Gov admin -> Presidential incidents", "GET", f"{BASE}/api/incidents?tenantId={tid1}", 403, cookies=s2.cookies)
            test("Gov admin -> Tenants CRUD", "GET", f"{BASE}/api/tenants", 403, cookies=s2.cookies)
            test("Gov admin -> User management", "GET", f"{BASE}/api/tenants/users", 403, cookies=s2.cookies)
        else:
            code = r2.status_code if r2 else 'N/A'
            print(f"  \033[31m[FAIL]\033[0m Governorship admin login failed: HTTP {code}")
            FAIL += 1
    else:
        print(f"  [SKIP] Need >=2 tenants, found {len(tenant_ids)}")
    
    # ═══════════════════════════════════════════════════════════
    # CAT 5: RBAC / ROLE-BASED ACCESS
    # ═══════════════════════════════════════════════════════════
    print("\n\033[33m─── CAT 5: RBAC / ROLE-BASED ACCESS ───\033[0m")
    
    if tid:
        # Field agent
        sf, rf = get_session("field@presidential.omnivote.ng", "password123", tid)
        if rf and rf.status_code == 200:
            print(f"  \033[32m[PASS]\033[0m Field agent login successful")
            PASS += 1
            test("Field -> Security center", "GET", f"{BASE}/api/security?tenantId={tid}", 403, cookies=sf.cookies)
            test("Field -> Tenants CRUD", "GET", f"{BASE}/api/tenants", 403, cookies=sf.cookies)
            test("Field -> User management", "GET", f"{BASE}/api/tenants/users", 403, cookies=sf.cookies)
            test("Field -> Incidents", "GET", f"{BASE}/api/incidents?tenantId={tid}", 200, cookies=sf.cookies)
            test("Field -> Dashboard", "GET", f"{BASE}/api/dashboard?tenantId={tid}", 200, cookies=sf.cookies)
        else:
            print(f"  \033[31m[FAIL]\033[0m Field agent login failed")
            FAIL += 1
        
        # Analyst
        sa, ra = get_session("analyst@presidential.omnivote.ng", "password123", tid)
        if ra and ra.status_code == 200:
            print(f"  \033[32m[PASS]\033[0m Analyst login successful")
            PASS += 1
            test("Analyst -> Security center", "GET", f"{BASE}/api/security?tenantId={tid}", 403, cookies=sa.cookies)
            test("Analyst -> Tenants CRUD", "GET", f"{BASE}/api/tenants", 403, cookies=sa.cookies)
            test("Analyst -> Dashboard", "GET", f"{BASE}/api/dashboard?tenantId={tid}", 200, cookies=sa.cookies)
        else:
            print(f"  \033[31m[FAIL]\033[0m Analyst login failed")
            FAIL += 1
    
    # ═══════════════════════════════════════════════════════════
    # CAT 6: INPUT VALIDATION & INJECTION
    # ═══════════════════════════════════════════════════════════
    print("\n\033[33m─── CAT 6: INPUT VALIDATION & INJECTION ───\033[0m")
    
    if tid:
        sa2, ra2 = get_session("admin@presidential.omnivote.ng", "password123", tid)
        if ra2 and ra2.status_code == 200:
            test("XSS in incident description", "POST", f"{BASE}/api/incidents?tenantId={tid}", 400,
                 data={"description": "<script>alert(document.cookie)</script>", "type": "OBSERVATION", "severity": "LOW", "gpsLatitude": 6.5, "gpsLongitude": 3.5},
                 cookies=sa2.cookies)
            test("SQL injection in filter", "GET", f"{BASE}/api/incidents?tenantId={tid}&search=';DROP TABLE users;--", 200, cookies=sa2.cookies)
            test("Very long input (10K chars)", "POST", f"{BASE}/api/incidents?tenantId={tid}", 400,
                 data={"description": "A" * 10000, "type": "OBSERVATION", "severity": "LOW", "gpsLatitude": 6.5, "gpsLongitude": 3.5},
                 cookies=sa2.cookies)
            test("Negative coordinates", "POST", f"{BASE}/api/incidents?tenantId={tid}", 400,
                 data={"description": "test", "type": "OBSERVATION", "severity": "LOW", "gpsLatitude": -999, "gpsLongitude": -999},
                 cookies=sa2.cookies)
            test("Missing required fields", "POST", f"{BASE}/api/incidents?tenantId={tid}", 400,
                 data={"description": "test"},
                 cookies=sa2.cookies)
            test("Invalid enum value", "POST", f"{BASE}/api/incidents?tenantId={tid}", 400,
                 data={"description": "test", "type": "INVALID_TYPE", "severity": "LOW", "gpsLatitude": 6.5, "gpsLongitude": 3.5},
                 cookies=sa2.cookies)
            
            # Check for password hash leak in agents response
            r_agents = requests.get(f"{BASE}/api/agents?tenantId={tid}", cookies=sa2.cookies, timeout=10)
            if r_agents.status_code == 200:
                body = r_agents.text
                if any(x in body.lower() for x in ['passwordhash', 'password_hash', '$2b$', 'bcrypt']):
                    print(f"  \033[31m[FAIL]\033[0m Password hash leaked in agents response")
                    FAIL += 1
                    FINDINGS.append("CRITICAL: Password hash leaked in agents API response")
                else:
                    print(f"  \033[32m[PASS]\033[0m No password hash in agents response")
                    PASS += 1
    
    # ═══════════════════════════════════════════════════════════
    # CAT 7: SECURITY HEADERS
    # ═══════════════════════════════════════════════════════════
    print("\n\033[33m─── CAT 7: SECURITY HEADERS ───\033[0m")
    
    try:
        r = requests.head(f"{BASE}/api/health", timeout=10)
        h = r.headers
        
        def check_header(name, key, expected):
            global PASS, FAIL
            val = h.get(key, "")
            if expected.lower() in val.lower():
                print(f"  \033[32m[PASS]\033[0m {name}: {val[:80]}")
                PASS += 1
            else:
                print(f"  \033[31m[FAIL]\033[0m {name}: Expected '{expected}', got: {val}")
                FAIL += 1
        
        check_header("X-Frame-Options", "x-frame-options", "DENY")
        check_header("X-Content-Type-Options", "x-content-type-options", "nosniff")
        check_header("X-XSS-Protection", "x-xss-protection", "1")
        check_header("Referrer-Policy", "referrer-policy", "strict-origin")
        check_header("Content-Security-Policy", "content-security-policy", "default-src")
        check_header("Permissions-Policy", "permissions-policy", "camera")
    except Exception as e:
        print(f"  \033[31m[ERROR]\033[0m Could not check headers: {e}")
        FAIL += 6
    
    # ═══════════════════════════════════════════════════════════
    # CAT 8: METHOD TAMPERING & PATH TRAVERSAL
    # ═══════════════════════════════════════════════════════════
    print("\n\033[33m─── CAT 8: METHOD TAMPERING & PATH TRAVERSAL ───\033[0m")
    
    test("DELETE on public tenants", "DELETE", f"{BASE}/api/tenants", 405)
    test("PUT on public health", "PUT", f"{BASE}/api/health", 405)
    test("PATCH on public auth", "PATCH", f"{BASE}/api/auth", 405)
    test("Path traversal /api/../../etc/passwd", "GET", f"{BASE}/api/../../etc/passwd", 404)
    test("Path traversal /api/../../../tmp/", "GET", f"{BASE}/api/../../../tmp/", 404)
    
    # ═══════════════════════════════════════════════════════════
    # CAT 9: SESSION & COOKIE SECURITY
    # ═══════════════════════════════════════════════════════════
    print("\n\033[33m─── CAT 9: SESSION & COOKIE SECURITY ───\033[0m")
    
    if tid:
        # Check cookie attributes
        try:
            s3, r3 = get_session("admin@presidential.omnivote.ng", "password123", tid)
            if r3 and r3.status_code == 200:
                for cookie in s3.cookies:
                    if 'omnivote-session' in cookie.name:
                        print(f"  Cookie: {cookie.name}={str(cookie.value)[:30]}...")
                        if cookie.has_nonstandard_attr('HttpOnly') or 'httponly' in str(cookie).lower():
                            print(f"  \033[32m[PASS]\033[0m Cookie is HttpOnly")
                            PASS += 1
                        else:
                            print(f"  \033[31m[FAIL]\033[0m Cookie missing HttpOnly")
                            FAIL += 1
                        if cookie.get_nonstandard_attr('SameSite') or 'samesite' in str(cookie).lower():
                            print(f"  \033[32m[PASS]\033[0m Cookie has SameSite")
                            PASS += 1
                        else:
                            print(f"  \033[31m[FAIL]\033[0m Cookie missing SameSite")
                            FAIL += 1
                        break
        except Exception as e:
            print(f"  Cookie check error: {e}")
        
        # Test invalid tokens
        test("Expired JWT token", "GET", f"{BASE}/api/dashboard?tenantId={tid}", 401,
             headers={"Cookie": "omnivote-session=eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MDAwMDAwMDB9.fake"})
        test("Garbage token", "GET", f"{BASE}/api/dashboard?tenantId={tid}", 401,
             headers={"Cookie": "omnivote-session=not-a-jwt"})
        test("Empty token", "GET", f"{BASE}/api/dashboard?tenantId={tid}", 401,
             headers={"Cookie": "omnivote-session="})
    
    # ═══════════════════════════════════════════════════════════
    # CAT 10: INFORMATION DISCLOSURE
    # ═══════════════════════════════════════════════════════════
    print("\n\033[33m─── CAT 10: INFORMATION DISCLOSURE ───\033[0m")
    
    r_health = test("Health - no JWT secret leak", "GET", f"{BASE}/api/health", 200)
    if r_health:
        if any(x in r_health.text.lower() for x in ['secret', 'jwt_secret', 'private.key']):
            print(f"  \033[31m[FAIL]\033[0m JWT secret potentially exposed in health endpoint")
            FAIL += 1
            FINDINGS.append("JWT secret exposed in health endpoint")
        else:
            print(f"  \033[32m[PASS]\033[0m No JWT secret in health endpoint")
            PASS += 1
    
    r_tenant = test("Public tenants - no sensitive data", "GET", f"{BASE}/api/tenants", 200)
    if r_tenant:
        if any(x in r_tenant.text.lower() for x in ['passwordhash', 'secret', 'private', 'internal']):
            print(f"  \033[31m[FAIL]\033[0m Sensitive data in public tenants endpoint")
            FAIL += 1
        else:
            print(f"  \033[32m[PASS]\033[0m No sensitive data in public tenants endpoint")
            PASS += 1
    
    r_404 = test("Non-existent route - no stack trace", "GET", f"{BASE}/api/nonexistent", 404)
    if r_404:
        if any(x in r_404.text.lower() for x in ['stack', 'prisma', 'sqlite', 'internal server error', 'trace']):
            print(f"  \033[31m[FAIL]\033[0m Stack trace leaked in error response")
            FAIL += 1
            FINDINGS.append("Stack trace/internal error details leaked in 404 response")
        else:
            print(f"  \033[32m[PASS]\033[0m No stack trace in error response")
            PASS += 1
    
    # ═══════════════════════════════════════════════════════════
    # CAT 11: SESSION LIFECYCLE
    # ═══════════════════════════════════════════════════════════
    print("\n\033[33m─── CAT 11: SESSION LIFECYCLE ───\033[0m")
    
    if tid:
        s4, r4 = get_session("admin@presidential.omnivote.ng", "password123", tid)
        if r4 and r4.status_code == 200:
            # Verify access before logout
            r_before = requests.get(f"{BASE}/api/dashboard?tenantId={tid}", cookies=s4.cookies, timeout=10)
            print(f"  Before logout: Dashboard → HTTP {r_before.status_code}")
            
            # Logout
            r_logout = s4.delete(f"{BASE}/api/auth", timeout=10)
            print(f"  Logout: HTTP {r_logout.status_code}")
            
            # Verify blocked after logout
            r_after = requests.get(f"{BASE}/api/dashboard?tenantId={tid}", cookies=s4.cookies, timeout=10)
            if r_after.status_code == 401:
                print(f"  \033[32m[PASS]\033[0m Session invalidated after logout")
                PASS += 1
            else:
                print(f"  \033[31m[FAIL]\033[0m Session NOT invalidated (got {r_after.status_code})")
                FAIL += 1
                FINDINGS.append("Session not properly invalidated after logout")
    
    # ═══════════════════════════════════════════════════════════
    # CAT 12: TENANT LOGIN PAGES
    # ═══════════════════════════════════════════════════════════
    print("\n\033[33m─── CAT 12: TENANT LOGIN PAGES ───\033[0m")
    
    test("Tenant login /t/presidential", "GET", f"{BASE}/t/presidential", 200)
    test("Tenant login /t/governorship", "GET", f"{BASE}/t/governorship", 200)
    test("Tenant login /t/nonexistent", "GET", f"{BASE}/t/nonexistent", 404)
    
    # ═══════════════════════════════════════════════════════════
    # CAT 13: PASSWORD RESET SECURITY
    # ═══════════════════════════════════════════════════════════
    print("\n\033[33m─── CAT 13: PASSWORD RESET SECURITY ───\033[0m")
    
    r_valid = requests.post(f"{BASE}/api/auth/forgot-password", json={"email": "admin@presidential.omnivote.ng"}, timeout=10)
    r_invalid = requests.post(f"{BASE}/api/auth/forgot-password", json={"email": "nonexistent@fake.com"}, timeout=10)
    
    print(f"  Valid email: {r_valid.status_code} - {r_valid.text[:100]}")
    print(f"  Invalid email: {r_invalid.status_code} - {r_invalid.text[:100]}")
    
    # Check if responses are distinguishable (email enumeration)
    if r_valid.status_code != r_invalid.status_code or r_valid.text != r_invalid.text:
        if r_valid.status_code == r_invalid.status_code and 'success' in r_valid.text.lower() and 'success' in r_invalid.text.lower():
            print(f"  \033[32m[PASS]\033[0m Responses similar enough (both return success)")
            PASS += 1
        else:
            print(f"  \033[33m[WARN]\033[0m Responses differ - possible email enumeration")
            FINDINGS.append(f"Possible email enumeration: valid={r_valid.status_code}/{r_valid.text[:80]}, invalid={r_invalid.status_code}/{r_invalid.text[:80]}")
    else:
        print(f"  \033[32m[PASS]\033[0m Password reset responses identical")
        PASS += 1
    
    # ═══════════════════════════════════════════════════════════
    # SUMMARY
    # ═══════════════════════════════════════════════════════════
    print(f"\n\033[34m═══════════════════════════════════════════════════════════")
    print(f"  RESULTS: {PASS} PASSED, {FAIL} FAILED")
    print(f"═══════════════════════════════════════════════════════════\033[0m")
    
    if FINDINGS:
        print(f"\n\033[33m  ADDITIONAL FINDINGS ({len(FINDINGS)}):\033[0m")
        for f in FINDINGS:
            print(f"  - {f}")
    
    # Save results
    with open("/tmp/adversarial_results.json", "w") as fp:
        json.dump({"pass": PASS, "fail": FAIL, "findings": FINDINGS}, fp, indent=2)
    
    return FAIL == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
