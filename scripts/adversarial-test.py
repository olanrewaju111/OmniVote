#!/usr/bin/env python3
"""
Adversarial Security Tests - Self-contained.
Starts server, warms up routes, runs tests, all in one process.
"""
import json
import sqlite3
import subprocess
import sys
import time
import os
import signal
import urllib.request
import urllib.error
import http.cookiejar

BASE = "http://127.0.0.1:3001"
passed = 0
failed = 0
total = 0
server_proc = None

def start_server():
    global server_proc
    # Kill any existing
    os.system("pkill -f 'next dev' 2>/dev/null")
    time.sleep(1)
    server_proc = subprocess.Popen(
        ["npx", "next", "dev", "--port", "3001", "-H", "0.0.0.0"],
        cwd="/home/z/my-project",
        stdout=open("/tmp/nextdev.log", "w"),
        stderr=subprocess.STDOUT,
    )
    # Wait for ready
    for i in range(30):
        time.sleep(1)
        try:
            urllib.request.urlopen(f"{BASE}/", timeout=2)
            print(f"Server ready after {i+1}s")
            return True
        except:
            continue
    print("FAILED to start server")
    return False

def warmup():
    """Warmup auth route only — let other routes compile on demand."""
    try:
        sp.run(["curl", "-s", "-o", "/dev/null", f"{BASE}/api/auth",
              "-X", "POST", "-H", "Content-Type: application/json",
              "-d", '{"email":"admin@lagos-island-lga.omnivote.ng","password":"password123"}'],
             timeout=10, capture_output=True)
    except: pass
    print("Auth route warmed up.")

def wait_for_server():
    """Re-check server is alive, restart if needed."""
    try:
        urllib.request.urlopen(f"{BASE}/api/dashboard", timeout=3)
        return True
    except urllib.error.HTTPError:
        return True  # Got a response (even 400)
    except:
        return False

# Cookie management
cookie_jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))

def api_req(method, path, body=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    if data:
        req.add_header('Content-Type', 'application/json')
    try:
        resp = opener.open(req, timeout=10)
        return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            body_text = e.read().decode()
            return e.code, json.loads(body_text)
        except:
            return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}

def login(email, password):
    global cookie_jar, opener
    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
    data = json.dumps({"email": email, "password": password}).encode()
    req = urllib.request.Request(f"{BASE}/api/auth", data=data, method='POST')
    req.add_header('Content-Type', 'application/json')
    try:
        resp = opener.open(req, timeout=10)
        return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        print(f"    ⚠ Login failed: {e}")
        return 0

def test(name, method, path, expect, body=None):
    global passed, failed, total
    total += 1
    status, data = api_req(method, path, body)
    if status == expect:
        print(f"  ✅ {name}: {status}")
        passed += 1
    else:
        detail = json.dumps(data)[:80] if data else ""
        print(f"  ❌ {name}: expected {expect}, got {status} — {detail}")
        failed += 1
    return status, data

def main():
    global passed, failed, total

    # Get tenant IDs
    conn = sqlite3.connect('/home/z/my-project/db/custom.db')
    def q(sql, params=None):
        return conn.execute(sql, params or []).fetchone()[0]

    LOCAL_ID = q("SELECT id FROM Tenant WHERE slug='lagos-island-lga'")
    STATE_ID = q("SELECT id FROM Tenant WHERE slug='kano-state-obs'")
    PRES_ID  = q("SELECT id FROM Tenant WHERE slug='presidential-ng'")
    LOCAL_AGENT = q("SELECT id FROM User WHERE tenantId=? AND role='FIELD_AGENT' LIMIT 1", (LOCAL_ID,))
    STATE_ELECTION = q("SELECT id FROM Election WHERE tenantId=? LIMIT 1", (STATE_ID,))
    LOCAL_PU = q("SELECT PollingUnit.id FROM PollingUnit JOIN Election ON PollingUnit.electionId=Election.id WHERE Election.tenantId=? LIMIT 1", (LOCAL_ID,))
    STATE_PU = q("SELECT PollingUnit.id FROM PollingUnit JOIN Election ON PollingUnit.electionId=Election.id WHERE Election.tenantId=? LIMIT 1", (STATE_ID,))
    conn.close()

    print("═══════════════════════════════════════════════════════════")
    print("  ADVERSARIAL SECURITY TEST SUITE")
    print("═══════════════════════════════════════════════════════════\n")
    print(f"Tenants:\n  LOCAL: {LOCAL_ID}\n  STATE: {STATE_ID}\n  PRES:  {PRES_ID}\n")

    # Phase 1: Auth
    print("── Phase 1: Authentication ──────────────────────────────")
    test("Unauthenticated (no login) → 401", "GET", f"/api/dashboard?tenantId={LOCAL_ID}", 401)

    # Phase 2: VULN-2
    print("\n── Phase 2: VULN-2 — No tenantId fallback removed ──────")
    login("admin@lagos-island-lga.omnivote.ng", "password123")
    test("Dashboard no tenantId → 400", "GET", "/api/dashboard", 400)
    test("Incidents no tenantId → 400", "GET", "/api/incidents", 400)
    test("Alerts no tenantId → 400", "GET", "/api/alerts", 400)
    test("PVT no tenantId → 400", "GET", "/api/pvt", 400)
    test("Agents no tenantId → 400", "GET", "/api/agents", 400)
    test("Evidence no tenantId → 400", "GET", "/api/evidence", 400)

    # Phase 3: Cross-tenant isolation
    print("\n── Phase 3: Cross-tenant isolation ─────────────────────")
    login("admin@lagos-island-lga.omnivote.ng", "password123")
    test("LOCAL→STATE dashboard → 403", "GET", f"/api/dashboard?tenantId={STATE_ID}", 403)
    test("LOCAL→PRES incidents → 403", "GET", f"/api/incidents?tenantId={PRES_ID}", 403)
    test("LOCAL→STATE alerts → 403", "GET", f"/api/alerts?tenantId={STATE_ID}", 403)
    test("LOCAL→PRES agents → 403", "GET", f"/api/agents?tenantId={PRES_ID}", 403)
    test("LOCAL→STATE evidence → 403", "GET", f"/api/evidence?tenantId={STATE_ID}", 403)
    test("LOCAL→PRES PVT → 403", "GET", f"/api/pvt?tenantId={PRES_ID}", 403)
    test("LOCAL→STATE situation-room → 403", "GET", f"/api/situation-room?tenantId={STATE_ID}", 403)
    test("LOCAL→PRES geofence → 403", "GET", f"/api/geofence?tenantId={PRES_ID}", 403)
    test("LOCAL→STATE campaigns → 403", "GET", f"/api/campaigns?tenantId={STATE_ID}", 403)
    test("LOCAL→PRES OSINT → 403", "GET", f"/api/osint?tenantId={PRES_ID}", 403)
    test("LOCAL→STATE engagement → 403", "GET", f"/api/engagement?tenantId={STATE_ID}", 403)
    test("LOCAL→PRES results → 403", "GET", f"/api/results?tenantId={PRES_ID}", 403)

    # Phase 4: VULN-3
    print("\n── Phase 4: VULN-3 — WhatsApp tenant enforcement ───────")
    test("WhatsApp send no tenantId → 400", "PUT", "/api/whatsapp?action=send", 400, {"toPhone": "+1234", "body": "test"})
    test("WhatsApp send cross-tenant → 403", "PUT", "/api/whatsapp?action=send", 403, {"tenantId": STATE_ID, "toPhone": "+1234", "body": "test"})

    # Phase 5: VULN-1
    print("\n── Phase 5: VULN-1 — Polling unit isolation ────────────")
    login("admin@lagos-island-lga.omnivote.ng", "password123")
    status, data = test("LOCAL dashboard returns own data", "GET", f"/api/dashboard?tenantId={LOCAL_ID}", 200)
    if data.get("pollingUnits"):
        states = set(pu.get("state", "") for pu in data["pollingUnits"])
        total += 1
        if all(s == "Lagos" for s in states) and len(data["pollingUnits"]) == 3:
            print(f"    → All {len(data['pollingUnits'])} PUs are in Lagos ✅ (no cross-tenant leak)")
            passed += 1
        else:
            print(f"    ❌ PU states: {states} — potential leak!")
            failed += 1

    # Phase 6: VULN-4
    print("\n── Phase 6: VULN-4 — Result submission isolation ───────")
    test("Submit result cross-tenant PU → 403", "POST", "/api/results", 403, {
        "reporterId": LOCAL_AGENT, "pollingUnitId": STATE_PU,
        "totalVotesCast": 100, "accreditedVoters": 120,
        "totalValidVotes": 95, "rejectedBallots": 5,
        "partyResults": [{"party": "APC", "votes": 50}]
    })

    # Phase 7: VULN-6
    print("\n── Phase 7: VULN-6 — PVT election tenant check ─────────")
    test("Submit PVT cross-tenant election → 403", "POST", f"/api/pvt?tenantId={LOCAL_ID}", 403, {
        "action": "SUBMIT_PVT", "electionId": STATE_ELECTION,
        "pollingUnitId": LOCAL_PU, "submittedById": LOCAL_AGENT,
        "totalVotesCast": 50, "partyResults": [{"party": "APC", "votes": 25}]
    })

    # Phase 8: Scope
    print("\n── Phase 8: Tenant scope verification ──────────────────")
    login("admin@lagos-island-lga.omnivote.ng", "password123")
    _, data = test("LOCAL settings include scope", "GET", f"/api/tenant-settings?tenantId={LOCAL_ID}", 200)
    total += 1
    if data.get("scope") == "LOCAL_GOVERNMENT":
        print("    → Scope = LOCAL_GOVERNMENT ✅"); passed += 1
    else:
        print(f"    ❌ Scope = {data.get('scope')}"); failed += 1

    login("admin@kano-state-obs.omnivote.ng", "password123")
    _, data = test("STATE settings include scope", "GET", f"/api/tenant-settings?tenantId={STATE_ID}", 200)
    total += 1
    if data.get("scope") == "STATE_GOVERNMENT":
        print("    → Scope = STATE_GOVERNMENT ✅"); passed += 1
    else:
        print(f"    ❌ Scope = {data.get('scope')}"); failed += 1

    login("admin@presidential-ng.omnivote.ng", "password123")
    _, data = test("PRES settings include scope", "GET", f"/api/tenant-settings?tenantId={PRES_ID}", 200)
    total += 1
    if data.get("scope") == "PRESIDENTIAL":
        print("    → Scope = PRESIDENTIAL ✅"); passed += 1
    else:
        print(f"    ❌ Scope = {data.get('scope')}"); failed += 1

    # List all tenants — must use platform SUPER_ADMIN
    login("platform-admin@omnivote.ng", "password123")
    _, data = test("List all tenants with scopes", "GET", "/api/tenants", 200)
    total += 1
    tenants = data.get("tenants", [])
    scopes = set(t.get("scope", "") for t in tenants)
    if len(tenants) == 3 and scopes == {"LOCAL_GOVERNMENT", "STATE_GOVERNMENT", "PRESIDENTIAL"}:
        print(f"    → All 3 tenants with correct scopes ✅"); passed += 1
    else:
        print(f"    ❌ count={len(tenants)}, scopes={scopes}"); failed += 1

    # Phase 9: Positive tests
    print("\n── Phase 9: Same-tenant access (positive) ─────────────")
    login("admin@lagos-island-lga.omnivote.ng", "password123")
    test("Own dashboard → 200", "GET", f"/api/dashboard?tenantId={LOCAL_ID}", 200)
    test("Own incidents → 200", "GET", f"/api/incidents?tenantId={LOCAL_ID}", 200)
    test("Own alerts → 200", "GET", f"/api/alerts?tenantId={LOCAL_ID}", 200)
    test("Own agents → 200", "GET", f"/api/agents?tenantId={LOCAL_ID}", 200)
    test("Own evidence → 200", "GET", f"/api/evidence?tenantId={LOCAL_ID}", 200)
    test("Own PVT → 200", "GET", f"/api/pvt?tenantId={LOCAL_ID}", 200)
    test("Own situation-room → 200", "GET", f"/api/situation-room?tenantId={LOCAL_ID}", 200)

    # Summary
    print("\n═══════════════════════════════════════════════════════════")
    print(f"  RESULTS: {passed}/{total} passed, {failed} failed")
    if failed == 0:
        print("  🟢 ALL TESTS PASSED — Tenant isolation is secure")
    else:
        print(f"  🔴 {failed} TEST(S) FAILED — Review output above")
    print("═══════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    if not start_server():
        sys.exit(1)
    warmup()
    main()
    if server_proc:
        server_proc.terminate()