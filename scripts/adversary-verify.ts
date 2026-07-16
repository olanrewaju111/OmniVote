#!/usr/bin/env node
/**
 * Adversary verification test — runs against the LIVE production server.
 * Tests the key security fixes from the audit.
 */
const BASE = 'http://127.0.0.1:3000';

let passed = 0, failed = 0;
const results = [];

async function login(email, password) {
  const r = await fetch(`${BASE}/api/auth`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = r.headers.get('set-cookie') || '';
  const cookie = setCookie.match(/omnivote-session=([^;]+)/)?.[1] || '';
  const data = await r.json();
  return { cookie, data, status: r.status };
}

async function api(path, opts = {}, cookie = '') {
  const headers = { ...opts.headers, ...(cookie ? { Cookie: `omnivote-session=${cookie}` } : {}) };
  const r = await fetch(`${BASE}${path}`, { ...opts, headers });
  let data;
  try { data = await r.json(); } catch { data = null; }
  return { status: r.status, data };
}

function test(name, condition, detail = '') {
  if (condition) {
    passed++;
    results.push(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    results.push(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('ADVERSARY VERIFICATION — Production Server');
  console.log('═'.repeat(60));

  // === SETUP: Get sessions ===
  const sa = await login('platform-admin@omnivote.ng', 'admin123');
  const ta = await login('admin@lagos-island-lga.omnivote.ng', 'admin123');
  const analyst = await login('funke@lagos-island-lga.omnivote.ng', 'admin123');
  const fa = await login('tunde@lagos-island-lga.omnivote.ng', 'admin123');

  const saCookie = sa.cookie;
  const taCookie = ta.cookie;
  const analystCookie = analyst.cookie;
  const faCookie = fa.cookie;
  const saTenantId = sa.data.user.tenantId;
  const taTenantId = ta.data.user.tenantId;

  // Get second tenant ID
  const tenantsR = await api('/api/tenants', {}, saCookie);
  const tenants = tenantsR.data?.tenants || [];
  const otherTenant = tenants.find(t => t.id !== saTenantId);

  console.log(`\nSA tenant: ${saTenantId}, TA tenant: ${taTenantId}`);
  console.log(`Other tenant: ${otherTenant?.id || 'N/A'} (${otherTenant?.name || 'N/A'})`);
  console.log(`Other tenant users: ${otherTenant?._count?.users || 0}`);

  // === TESTS ===
  console.log('\n── 1. AUTHENTICATION & AUTHORIZATION ──');

  // Unauthenticated access
  const unauthDash = await api('/api/dashboard');
  test('Unauthenticated dashboard blocked', unauthDash.status === 401 || unauthDash.data?.error, `status=${unauthDash.status}`);

  const unauthTenants = await api('/api/tenants');
  test('Unauthenticated tenants blocked', unauthTenants.status === 403, `status=${unauthTenants.status}`);

  // FIELD_AGENT cannot access admin endpoints
  const faTenants = await api('/api/tenants', {}, faCookie);
  test('FIELD_AGENT blocked from /api/tenants', faTenants.status === 403, `status=${faTenants.status}`);

  const faSettings = await api(`/api/tenant-settings?tenantId=${taTenantId}`, {}, faCookie);
  test('FIELD_AGENT blocked from tenant-settings GET', faSettings.status === 403, `status=${faSettings.status}`);

  const faSettingsPut = await api(`/api/tenant-settings?tenantId=${taTenantId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' }, faCookie);
  test('FIELD_AGENT blocked from tenant-settings PUT', faSettingsPut.status === 403, `status=${faSettingsPut.status}`);

  console.log('\n── 2. TENANT ISOLATION ──');

  // TA cannot see other tenant's users
  if (otherTenant) {
    const taOtherUsers = await api(`/api/tenants/users?tenantId=${otherTenant.id}`, {}, taCookie);
    test('TA blocked from other tenant users', taOtherUsers.status === 403, `status=${taOtherUsers.status}`);
  }

  // TA cannot modify other tenant settings
  if (otherTenant) {
    const taOtherSettings = await api(`/api/tenant-settings?tenantId=${otherTenant.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"scope":"LOCAL_GOVERNMENT"}' }, taCookie);
    test('TA blocked from other tenant settings PUT', taOtherSettings.status === 403, `status=${taOtherSettings.status}`);
  }

  // Analyst cannot access other tenant data
  if (otherTenant) {
    const analystOther = await api(`/api/tenant-settings?tenantId=${otherTenant.id}`, {}, analystCookie);
    test('Analyst blocked from other tenant settings', analystOther.status === 403, `status=${analystOther.status}`);
  }

  console.log('\n── 3. SCOPE SECURITY ──');

  // Only SA can change scope
  const taScope = await api(`/api/tenant-settings?tenantId=${taTenantId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"scope":"PRESIDENTIAL"}' }, taCookie);
  test('TA cannot change scope', taScope.status === 403, `status=${taScope.status}`);

  const analystScope = await api(`/api/tenant-settings?tenantId=${taTenantId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"scope":"PRESIDENTIAL"}' }, analystCookie);
  test('Analyst cannot change scope', analystScope.status === 403, `status=${analystScope.status}`);

  const faScope = await api(`/api/tenant-settings?tenantId=${taTenantId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"scope":"PRESIDENTIAL"}' }, faCookie);
  test('FA cannot change scope', faScope.status === 403, `status=${faScope.status}`);

  // SA CAN change scope
  const saScope = await api(`/api/tenant-settings?tenantId=${saTenantId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"scope":"LOCAL_GOVERNMENT"}' }, saCookie);
  test('SA can change scope', saScope.status === 200 && saScope.data?.scope === 'LOCAL_GOVERNMENT', `scope=${saScope.data?.scope}`);

  // Invalid scope rejected
  const saBadScope = await api(`/api/tenant-settings?tenantId=${saTenantId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"scope":"INVALID"}' }, saCookie);
  test('Invalid scope rejected', saBadScope.status === 400, `status=${saBadScope.status}`);

  // Restore scope
  await api(`/api/tenant-settings?tenantId=${saTenantId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"scope":"STATE_GOVERNMENT"}' }, saCookie);

  console.log('\n── 4. INCIDENT SECURITY (reporterId forced) ──');

  // Try to submit incident with spoofed reporterId
  const spoofIncident = await api(`/api/incidents?tenantId=${saTenantId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reporterId: saTenantId, type: 'VIOLENCE', severity: 'HIGH', description: 'Test', gpsLatitude: 6.5, gpsLongitude: 3.4, pollingUnitId: 'fake' }),
  }, faCookie);
  // Should either succeed with forced reporterId or fail with validation - but NOT use the spoofed ID
  test('Incident reporterId not spoofable', spoofIncident.status !== 200 || spoofIncident.data?.reportedById !== saTenantId, `status=${spoofIncident.status}`);

  console.log('\n── 5. AGENT CREATION SECURITY ──');

  // FA cannot create agents
  const faCreateAgent = await api(`/api/agents?tenantId=${taTenantId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Hacker', email: 'hacker@evil.com', role: 'SUPER_ADMIN' }),
  }, faCookie);
  test('FA cannot create agents', faCreateAgent.status === 403, `status=${faCreateAgent.status}`);

  // Analyst cannot create agents with elevated role
  const analystCreateAgent = await api(`/api/agents?tenantId=${taTenantId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Hacker2', email: 'hacker2@evil.com', role: 'SUPER_ADMIN' }),
  }, analystCookie);
  test('Analyst cannot create SUPER_ADMIN agent', analystCreateAgent.status === 403, `status=${analystCreateAgent.status}`);

  console.log('\n── 6. SECURITY ENDPOINT PROTECTION ──');

  // FA cannot lock users
  const faLock = await api(`/api/security?tenantId=${taTenantId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'LOCK_USER', userId: sa.data.user.id }),
  }, faCookie);
  test('FA cannot lock users', faLock.status === 403, `status=${faLock.status}`);

  // Analyst cannot lock users
  const analystLock = await api(`/api/security?tenantId=${taTenantId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'LOCK_USER', userId: fa.data.user.id }),
  }, analystCookie);
  test('Analyst cannot lock users', analystLock.status === 403, `status=${analystLock.status}`);

  console.log('\n── 7. RATE LIMITING ──');

  // Test rate limiting (5 attempts)
  let rateLimited = false;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${BASE}/api/auth`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@test.com', password: 'wrong' }),
    });
    if (r.status === 429) { rateLimited = true; break; }
  }
  test('Login rate limiting works', rateLimited, rateLimited ? 'blocked after 5+ attempts' : 'not triggered');

  // === RESULTS ===
  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log('═'.repeat(60));
  results.forEach(r => console.log(r));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });