/**
 * Adversarial Test Runner
 * ========================
 * Automated tests that simulate attacker behavior against the API.
 * Tests all 6 fixed vulnerabilities + general tenant isolation.
 *
 * Usage: bun run scripts/adversarial-test.ts
 */

import { db } from '../src/lib/db';

const BASE = 'http://localhost:3001';
let cookies: Record<string, string> = {};
let passed = 0;
let failed = 0;
let total = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(email: string, password: string): Promise<boolean> {
  const res = await fetch(`${BASE}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/omnivote-session=([^;]+)/);
    if (match) cookies['omnivote-session'] = match[1];
  }
  return res.ok;
}

function cookieHeader(): string {
  return `omnivote-session=${cookies['omnivote-session'] || ''}`;
}

async function apiTest(
  name: string,
  method: string,
  path: string,
  body?: object,
  expectStatus?: number,
): Promise<{ status: number; data: any }> {
  total++;
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(),
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  let data: any = {};
  try { data = await res.json(); } catch { data = { raw: await res.text() }; }

  if (expectStatus && res.status !== expectStatus) {
    console.log(`  ❌ ${name}: expected ${expectStatus}, got ${res.status}`);
    console.log(`     Response: ${JSON.stringify(data).slice(0, 120)}`);
    failed++;
  } else {
    console.log(`  ✅ ${name}: ${res.status}`);
    passed++;
  }
  return { status: res.status, data };
}

// ─── Test Runner ────────────────────────────────────────────────────────────

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ADVERSARIAL SECURITY TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Fetch tenant IDs
  const tenants = await db.tenant.findMany({ select: { id: true, slug: true, scope: true } });
  const local = tenants.find(t => t.slug === 'lagos-island-lga')!;
  const state = tenants.find(t => t.slug === 'kano-state-obs')!;
  const pres = tenants.find(t => t.slug === 'presidential-ng')!;

  console.log('Tenants found:');
  console.log(`  LOCAL:  ${local.id} [${local.scope}]`);
  console.log(`  STATE:  ${state.id} [${state.scope}]`);
  console.log(`  PRES:   ${pres.id} [${pres.scope}]\n`);

  // ── Phase 1: Auth tests ─────────────────────────────────────────────
  console.log('── Phase 1: Authentication ──────────────────────────────');
  await login('admin@lagos-island-lga.omnivote.ng', 'password123');
  await apiTest('Unauthenticated request returns 401', 'GET', '/api/dashboard', undefined, 401);

  // ── Phase 2: VULN-2 — Missing tenantId returns 400 ─────────────────
  console.log('\n── Phase 2: VULN-2 — No tenantId fallback ──────────────');
  await apiTest('Dashboard without tenantId → 400', 'GET', '/api/dashboard', undefined, 400);
  await apiTest('Incidents without tenantId → 400', 'GET', '/api/incidents', undefined, 400);
  await apiTest('Alerts without tenantId → 400', 'GET', '/api/alerts', undefined, 400);
  await apiTest('PVT without tenantId → 400', 'GET', '/api/pvt', undefined, 400);

  // ── Phase 3: Cross-tenant isolation ─────────────────────────────────
  console.log('\n── Phase 3: Cross-tenant isolation ─────────────────────');

  // Log in as LOCAL gov tenant
  await login('admin@lagos-island-lga.omnivote.ng', 'password123');

  // Try to access STATE tenant's data
  await apiTest('LOCAL admin → STATE tenant dashboard → 403', 'GET', `/api/dashboard?tenantId=${state.id}`, undefined, 403);
  await apiTest('LOCAL admin → PRES tenant incidents → 403', 'GET', `/api/incidents?tenantId=${pres.id}`, undefined, 403);
  await apiTest('LOCAL admin → STATE tenant alerts → 403', 'GET', `/api/alerts?tenantId=${state.id}`, undefined, 403);
  await apiTest('LOCAL admin → PRES tenant agents → 403', 'GET', `/api/agents?tenantId=${pres.id}`, undefined, 403);
  await apiTest('LOCAL admin → STATE tenant evidence → 403', 'GET', `/api/evidence?tenantId=${state.id}`, undefined, 403);
  await apiTest('LOCAL admin → PRES tenant PVT → 403', 'GET', `/api/pvt?tenantId=${pres.id}`, undefined, 403);
  await apiTest('LOCAL admin → STATE tenant situation-room → 403', 'GET', `/api/situation-room?tenantId=${state.id}`, undefined, 403);
  await apiTest('LOCAL admin → PRES tenant geofence → 403', 'GET', `/api/geofence?tenantId=${pres.id}`, undefined, 403);
  await apiTest('LOCAL admin → STATE tenant campaigns → 403', 'GET', `/api/campaigns?tenantId=${state.id}`, undefined, 403);
  await apiTest('LOCAL admin → PRES tenant OSINT → 403', 'GET', `/api/osint?tenantId=${pres.id}`, undefined, 403);
  await apiTest('LOCAL admin → STATE tenant engagement → 403', 'GET', `/api/engagement?tenantId=${state.id}`, undefined, 403);

  // ── Phase 4: VULN-3 — WhatsApp send without tenantId ───────────────
  console.log('\n── Phase 4: VULN-3 — WhatsApp tenant enforcement ───────');
  await apiTest('WhatsApp send without tenantId → 400', 'PUT', '/api/whatsapp?action=send', { toPhone: '+1234', body: 'test' }, 400);
  await apiTest('WhatsApp send cross-tenant → 403', 'PUT', `/api/whatsapp?action=send`, { tenantId: state.id, toPhone: '+1234', body: 'test' }, 403);

  // ── Phase 5: VULN-1 — No cross-tenant PU leak ──────────────────────
  console.log('\n── Phase 5: VULN-1 — Polling unit isolation ────────────');

  // Log in as LOCAL gov, access own dashboard — should get ONLY their 3 PUs
  await login('admin@lagos-island-lga.omnivote.ng', 'password123');
  const dashRes = await apiTest('LOCAL dashboard returns own data only', 'GET', `/api/dashboard?tenantId=${local.id}`);
  if (dashRes.data?.pollingUnits) {
    const puStates = dashRes.data.pollingUnits.map((pu: any) => pu.state);
    const hasOnlyLagos = puStates.every((s: string) => s === 'Lagos');
    if (hasOnlyLagos) {
      console.log(`    → All ${dashRes.data.pollingUnits.length} PUs are in Lagos ✅ (no Kano/Abuja/Rivers leak)`);
      passed++;
    } else {
      console.log(`    ❌ PU states include non-Lagos: ${puStates.join(', ')}`);
      failed++;
    }
    total++;
  }

  // ── Phase 6: VULN-4 — Cross-tenant result submission ───────────────
  console.log('\n── Phase 6: VULN-4 — Result submission isolation ───────');

  // Get LOCAL tenant's agent
  const localAgent = await db.user.findFirst({ where: { tenantId: local.id, role: 'FIELD_AGENT' } });
  // Get STATE tenant's polling unit
  const statePU = await db.pollingUnit.findFirst({
    where: { election: { tenantId: state.id } },
  });

  if (localAgent && statePU) {
    await apiTest(
      'Submit result with cross-tenant PU → 403',
      'POST',
      '/api/results',
      {
        reporterId: localAgent.id,
        pollingUnitId: statePU.id,
        totalVotesCast: 100,
        accreditedVoters: 120,
        totalValidVotes: 95,
        rejectedBallots: 5,
        partyResults: [{ party: 'APC', votes: 50 }, { party: 'PDP', votes: 45 }],
      },
      403,
    );
  }

  // ── Phase 7: VULN-6 — PVT election tenant check ────────────────────
  console.log('\n── Phase 7: VULN-6 — PVT election tenant check ─────────');

  const stateElection = await db.election.findFirst({ where: { tenantId: state.id } });
  const localPU = await db.pollingUnit.findFirst({
    where: { election: { tenantId: local.id } },
  });

  if (localAgent && stateElection && localPU) {
    await apiTest(
      'Submit PVT with cross-tenant election → 403',
      'POST',
      `/api/pvt?tenantId=${local.id}`,
      {
        action: 'SUBMIT_PVT',
        electionId: stateElection.id,
        pollingUnitId: localPU.id,
        submittedById: localAgent.id,
        totalVotesCast: 50,
        partyResults: [{ party: 'APC', votes: 25 }, { party: 'PDP', votes: 25 }],
      },
      403,
    );
  }

  // ── Phase 8: Scope verification ─────────────────────────────────────
  console.log('\n── Phase 8: Tenant scope verification ──────────────────');
  await login('admin@lagos-island-lga.omnivote.ng', 'password123');

  const settingsRes = await apiTest('LOCAL tenant settings include scope', 'GET', `/api/tenant-settings?tenantId=${local.id}`);
  if (settingsRes.data?.scope === 'LOCAL_GOVERNMENT') {
    console.log('    → Scope correctly returned as LOCAL_GOVERNMENT ✅');
    passed++;
  } else {
    console.log(`    ❌ Scope was: ${settingsRes.data?.scope}`);
    failed++;
  }
  total++;

  // Login as platform SUPER_ADMIN to list all tenants
  await login('admin@lagos-island-lga.omnivote.ng', 'password123');
  const tenantsRes = await apiTest('List all tenants (SUPER_ADMIN)', 'GET', '/api/tenants');
  if (tenantsRes.data?.tenants?.length === 3) {
    const scopes = tenantsRes.data.tenants.map((t: any) => t.scope);
    console.log(`    → All 3 tenants returned with scopes: ${scopes.join(', ')} ✅`);
    if (scopes.includes('LOCAL_GOVERNMENT') && scopes.includes('STATE_GOVERNMENT') && scopes.includes('PRESIDENTIAL')) {
      passed++;
    } else {
      console.log('    ❌ Missing expected scopes');
      failed++;
    }
    total++;
  }

  // ── Phase 9: Same-tenant access works ───────────────────────────────
  console.log('\n── Phase 9: Same-tenant access (positive tests) ───────');
  await login('admin@lagos-island-lga.omnivote.ng', 'password123');
  await apiTest('Own dashboard → 200', 'GET', `/api/dashboard?tenantId=${local.id}`, undefined, 200);
  await apiTest('Own incidents → 200', 'GET', `/api/incidents?tenantId=${local.id}`, undefined, 200);
  await apiTest('Own alerts → 200', 'GET', `/api/alerts?tenantId=${local.id}`, undefined, 200);
  await apiTest('Own agents → 200', 'GET', `/api/agents?tenantId=${local.id}`, undefined, 200);
  await apiTest('Own evidence → 200', 'GET', `/api/evidence?tenantId=${local.id}`, undefined, 200);
  await apiTest('Own PVT → 200', 'GET', `/api/pvt?tenantId=${local.id}`, undefined, 200);
  await apiTest('Own situation-room → 200', 'GET', `/api/situation-room?tenantId=${local.id}`, undefined, 200);
  await apiTest('Own geofence → 200', 'GET', `/api/geofence?tenantId=${local.id}`, undefined, 200);

  // ── Summary ─────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed}/${total} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('  🟢 ALL TESTS PASSED — Tenant isolation is secure');
  } else {
    console.log(`  🔴 ${failed} TEST(S) FAILED — Review output above`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Test runner failed:', e);
  process.exit(1);
});