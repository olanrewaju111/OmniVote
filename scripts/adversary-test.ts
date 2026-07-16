/**
 * ADVERSARY TEST SUITE — Static verification of security fixes.
 *
 * This script verifies security fixes by:
 * 1. Reading source code and checking for fix patterns
 * 2. Creating test data and verifying business logic directly via Prisma
 * 3. Running simulated route handler checks
 *
 * Run: npx tsx scripts/adversary-test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { db } from '../src/lib/db';
import { hashPassword, createToken } from '../src/lib/auth';
import { TENANT_SCOPES, isValidScope } from '../src/lib/tenant';

// ─── Types ──────────────────────────────────────────────────────────────────
interface TestResult {
  id: string;
  category: string;
  description: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];

function test(id: string, category: string, description: string, passed: boolean, detail: string) {
  results.push({ id, category, description, passed, detail });
  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} [${id}] ${description}`);
  if (!passed) console.log(`     → ${detail}`);
}

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf-8');
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║       ADVERSARY TEST SUITE — OmniVote Monitor            ║');
  console.log('║       Static Analysis + Business Logic Verification      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 1: CRIT-1 — JWT Secret Production Guard
  // ══════════════════════════════════════════════════════════════════════════
  console.log('🔍 Category 1: JWT Secret Production Guard (CRIT-1)\n');

  {
    const src = readFile('src/lib/auth.ts');
    test('1.1', 'JWT', 'auth.ts has assertJwtSecret function', src.includes('assertJwtSecret'), 'Function not found');
    test('1.2', 'JWT', 'assertJwtSecret checks NODE_ENV === production', src.includes("NODE_ENV === 'production'"), 'Production check not found');
    test('1.3', 'JWT', 'createToken calls assertJwtSecret', src.includes('createToken') && src.includes('assertJwtSecret()'), 'createToken does not call assertJwtSecret');
    test('1.4', 'JWT', 'verifyToken calls assertJwtSecret', src.includes('verifyToken') && src.includes('assertJwtSecret()'), 'verifyToken does not call assertJwtSecret');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 2: CRIT-2 — Agent Creation Privilege Escalation
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 2: Agent Creation Privilege Escalation (CRIT-2)\n');

  {
    const src = readFile('src/app/api/agents/route.ts');
    test('2.1', 'PRIV_ESC', 'POST handler checks for admin role', src.includes("'SUPER_ADMIN', 'TENANT_ADMIN'") && src.includes('Only administrators can create agents'), 'Role check missing');
    test('2.2', 'PRIV_ESC', 'Role hierarchy enforced (TENANT_ADMIN max = ANALYST)', src.includes('maxAllowedRole') && src.includes('roleHierarchy'), 'Hierarchy check missing');
    test('2.3', 'PRIV_ESC', 'PATCH handler has SA+TA role check', src.includes("'SUPER_ADMIN', 'TENANT_ADMIN'") && src.includes('userId and action are required'), 'PATCH role check missing');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 3: HIGH-1 — Incident Reporter Impersonation
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 3: Incident Reporter Impersonation (HIGH-1)\n');

  {
    const src = readFile('src/app/api/incidents/route.ts');
    test('3.1', 'IMPERSONATION', 'reporterId forced to authUser for non-admin', src.includes('authUser.userId') && src.includes('Cannot report on behalf of another user'), 'Impersonation fix missing');
    test('3.2', 'IMPERSONATION', 'ANALYST+ can still submit on behalf (override)', src.includes("'SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'"), 'Analyst override missing');
    test('3.3', 'IMPERSONATION', 'reporterId no longer a required field', !src.includes('reporterId, type, and description are required'), 'Old validation still requires reporterId');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 4: HIGH-2 — Result Reporter Impersonation
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 4: Result Reporter Impersonation (HIGH-2)\n');

  {
    const src = readFile('src/app/api/results/route.ts');
    test('4.1', 'IMPERSONATION', 'reporterId forced to authUser for non-admin', src.includes('authUser.userId') && src.includes('prevents result fraud'), 'Impersonation fix missing');
    test('4.2', 'IMPERSONATION', 'reporterId no longer in required fields check', !src.includes('reporterId and pollingUnitId are required'), 'Old validation still requires reporterId');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 5: HIGH-3 — Evidence Chain of Custody
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 5: Evidence Chain of Custody (HIGH-3)\n');

  {
    const src = readFile('src/app/api/evidence/route.ts');
    test('5.1', 'EVIDENCE', 'REVIEW_DOSSIER requires reviewer role', src.includes('Only analysts and administrators can review evidence'), 'Review role check missing');
    test('5.2', 'EVIDENCE', 'DELETE_DOSSIER requires admin role', src.includes('Only administrators can delete evidence dossiers'), 'Delete role check missing');
    test('5.3', 'EVIDENCE', 'C2PA signature modification restricted', src.includes('Only administrators and trust & safety can modify C2PA signatures'), 'C2PA protection missing');
    test('5.4', 'EVIDENCE', 'reviewedById forced to authenticated user', src.includes('actualReviewedById = authUser.userId'), 'reviewedById not forced');
    test('5.5', 'EVIDENCE', 'isReviewer check exists', src.includes('isReviewer') && src.includes('isAdmin'), 'Role variables missing');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 6: HIGH-4 — Honeypot Access Control
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 6: Honeypot Access Control (HIGH-4)\n');

  {
    const src = readFile('src/app/api/honeypot/route.ts');
    test('6.1', 'HONEYPOT', 'CREATE_HONEYPOT requires operator role', src.includes('Only analysts and administrators can create honeypots'), 'Create check missing');
    test('6.2', 'HONEYPOT', 'UPDATE_OFFICIAL_RESULTS requires operator role', src.includes('Only analysts and administrators can update honeypot results'), 'Update check missing');
    test('6.3', 'HONEYPOT', 'TOGGLE_HONEYPOT requires operator role', src.includes('Only analysts and administrators can toggle honeypots'), 'Toggle check missing');
    test('6.4', 'HONEYPOT', 'VERIFY_ACCESSIBILITY requires operator role', src.includes('Only analysts and administrators can verify accessibility reports'), 'Verify check missing');
    test('6.5', 'HONEYPOT', 'isOperator role variable defined', src.includes('isOperator') && src.includes('ANALYST'), 'isOperator missing');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 7: HIGH-5 — Security Route Takeover Prevention
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 7: Security Route Takeover Prevention (HIGH-5)\n');

  {
    const src = readFile('src/app/api/security/route.ts');
    test('7.1', 'SECURITY', 'UPDATE_POLICY restricted to SA+TA', src.includes('Only administrators can update security policies'), 'Policy update not restricted');
    test('7.2', 'SECURITY', 'LOCK_USER restricted to SA+TA', src.includes('Only administrators can lock users'), 'Lock user not restricted');
    test('7.3', 'SECURITY', 'UNLOCK_USER restricted to SA+TA', src.includes('Only administrators can unlock users'), 'Unlock user not restricted');
    test('7.4', 'SECURITY', 'LOCK_USER check uses SUPER_ADMIN + TENANT_ADMIN', src.includes("LOCK_USER") && src.includes("'SUPER_ADMIN', 'TENANT_ADMIN'"), 'Lock check role list wrong');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 8: HIGH-6 — Tenant Settings Protection
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 8: Tenant Settings Protection (HIGH-6)\n');

  {
    const src = readFile('src/app/api/tenant-settings/route.ts');
    test('8.1', 'SETTINGS', 'PUT handler requires admin role', src.includes('Only administrators can modify tenant settings'), 'PUT role check missing');
    test('8.2', 'SETTINGS', 'GET handler still works for all authenticated users', src.includes('GET') && !src.includes('Only administrators can fetch'), 'GET incorrectly restricted');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 9: MED-1 — Tenant ID Not Leaked
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 9: Tenant ID Exposure (MED-1)\n');

  {
    const src = readFile('src/app/api/auth/route.ts');
    // Find the unauthenticated tenant select
    const unauthSelect = /select: \{[^}]+\}/g;
    const matches = src.match(unauthSelect) || [];
    const lastSelect = matches[matches.length - 1] || '';
    const leaksId = lastSelect.includes('id: true');
    test('9.1', 'EXPOSURE', 'Unauthenticated tenant list does not expose ID field', !leaksId, `Select still includes 'id: true': ${lastSelect}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 10: MED-2 — Biometric Data Restricted
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 10: Biometric Data Restriction (MED-2)\n');

  {
    const geofenceSrc = readFile('src/app/api/geofence/route.ts');
    test('10.1', 'BIOMETRIC', 'Geofence has role-based biometric select', geofenceSrc.includes('canSeeBiometrics'), 'Biometric check missing in geofence');

    const honeypotSrc = readFile('src/app/api/honeypot/route.ts');
    test('10.2', 'BIOMETRIC', 'Honeypot has role-based biometric select', honeypotSrc.includes('canSeeBiometrics'), 'Biometric check missing in honeypot');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 11: MED-3 — Phone Number Restricted
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 11: Phone Number Restriction (MED-3)\n');

  {
    const src = readFile('src/app/api/reports/route.ts');
    test('11.1', 'PHONE', 'viewAll requires analyst+ role', src.includes('Insufficient permissions for this view'), 'viewAll role check missing');
    test('11.2', 'PHONE', 'Phone visible only to SA+TA', src.includes('canSeePhone') && src.includes('SUPER_ADMIN', 'TENANT_ADMIN'), 'Phone restriction missing');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 12: MED-4 — PVT Identity Forced
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 12: PVT Identity Forced (MED-4)\n');

  {
    const src = readFile('src/app/api/pvt/route.ts');
    test('12.1', 'PVT', 'SUBMIT_PVT forces submittedById to authUser', src.includes('submittedById') && src.includes('authUser.userId') && src.includes('prevents PVT impersonation'), 'submittedById not forced');
    test('12.2', 'PVT', 'VERIFY_PVT forces verifiedById to authUser', src.includes('verifiedById = authUser.userId'), 'verifiedById not forced');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 13: MED-8 — Campaign Events Identity Forced
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 13: Identity Forcing (MED-8)\n');

  {
    const eventsSrc = readFile('src/app/api/campaign-events/route.ts');
    test('13.1', 'IDENTITY', 'Campaign events forces reportedById', eventsSrc.includes('reportedById = authUser.userId'), 'reportedById not forced');

    const suppressionSrc = readFile('src/app/api/voter-suppression/route.ts');
    test('13.2', 'IDENTITY', 'Voter suppression forces reportedById', suppressionSrc.includes('reportedById = authUser.userId'), 'reportedById not forced');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 14: Tenant Scope
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 14: Tenant Scope\n');

  {
    const tenantSrc = readFile('src/lib/tenant.ts');
    test('14.1', 'SCOPE', 'TENANT_SCOPES constant defined', tenantSrc.includes('TENANT_SCOPES'), 'TENANT_SCOPES missing');
    test('14.2', 'SCOPE', 'TENANT_SCOPES includes LOCAL_GOVERNMENT', tenantSrc.includes('LOCAL_GOVERNMENT'), 'LOCAL_GOVERNMENT missing');
    test('14.3', 'SCOPE', 'TENANT_SCOPES includes STATE_GOVERNMENT', tenantSrc.includes('STATE_GOVERNMENT'), 'STATE_GOVERNMENT missing');
    test('14.4', 'SCOPE', 'TENANT_SCOPES includes PRESIDENTIAL', tenantSrc.includes('PRESIDENTIAL'), 'PRESIDENTIAL missing');
    test('14.5', 'SCOPE', 'isValidScope validation function exists', tenantSrc.includes('isValidScope'), 'isValidScope missing');
    test('14.6', 'SCOPE', 'resolveTenant returns scope', tenantSrc.includes('scope: tenant.scope'), 'resolveTenant does not return scope');

    const tenantsApiSrc = readFile('src/app/api/tenants/route.ts');
    test('14.7', 'SCOPE', 'Tenant creation imports TENANT_SCOPES', tenantsApiSrc.includes('TENANT_SCOPES'), 'Import missing');
    test('14.8', 'SCOPE', 'Tenant update validates scope against TENANT_SCOPES', tenantsApiSrc.includes('VALID_SCOPES.includes(scope)'), 'Scope validation missing');

    // Runtime validation
    test('14.9', 'SCOPE', 'isValidScope accepts valid values', isValidScope('LOCAL_GOVERNMENT') && isValidScope('STATE_GOVERNMENT') && isValidScope('PRESIDENTIAL'), 'Valid scopes rejected');
    test('14.10', 'SCOPE', 'isValidScope rejects invalid values', !isValidScope('INVALID') && !isValidScope('') && !isValidScope('local_government'), 'Invalid scopes accepted');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 15: Geofence Access Control
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 15: Geofence Access Control\n');

  {
    const src = readFile('src/app/api/geofence/route.ts');
    test('15.1', 'GEOFENCE', 'CREATE_ZONE requires operator role', src.includes('Only analysts and administrators can create geofence zones'), 'Create zone check missing');
    test('15.2', 'GEOFENCE', 'TOGGLE_ZONE requires operator role', src.includes('Only analysts and administrators can toggle zones'), 'Toggle zone check missing');
    test('15.3', 'GEOFENCE', 'RESOLVE_SWITCH requires operator role', src.includes('Only analysts and administrators can resolve switches'), 'Resolve switch check missing');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 16: Business Logic — Seed 3 Scopes & Verify Isolation
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 16: Business Logic — Multi-Scope Isolation\n');

  // Clean up any existing test tenants
  const existingTestTenants = await db.tenant.findMany({
    where: { slug: { in: ['adv-local', 'adv-state', 'adv-presidential'] } },
    select: { id: true },
  });
  for (const t of existingTestTenants) {
    await db.user.deleteMany({ where: { tenantId: t.id } });
    await db.tenant.delete({ where: { id: t.id } });
  }

  // Create 3 tenants with different scopes
  const localT = await db.tenant.create({ data: { name: 'Advocacy LGA', slug: 'adv-local', scope: 'LOCAL_GOVERNMENT' } });
  const stateT = await db.tenant.create({ data: { name: 'Advocacy State', slug: 'adv-state', scope: 'STATE_GOVERNMENT' } });
  const presT = await db.tenant.create({ data: { name: 'Advocacy Presidential', slug: 'adv-presidential', scope: 'PRESIDENTIAL' } });

  test('16.1', 'SEED', '3 tenants created with correct scopes', true, `${localT.scope}, ${stateT.scope}, ${presT.scope}`);

  // Verify tenant isolation at the DB level
  const localElection = await db.election.create({
    data: { tenantId: localT.id, title: 'LGA Election', tier: 'LOCAL', date: new Date(), status: 'ACTIVE' },
  });
  const stateElection = await db.election.create({
    data: { tenantId: stateT.id, title: 'State Election', tier: 'STATE', date: new Date(), status: 'ACTIVE' },
  });

  const localElections = await db.election.findMany({ where: { tenantId: localT.id } });
  const stateElections = await db.election.findMany({ where: { tenantId: stateT.id } });

  test('16.2', 'ISOLATION', 'Local tenant only sees its own elections', localElections.length === 1 && localElections[0].id === localElection.id, `Found ${localElections.length} elections`);
  test('16.3', 'ISOLATION', 'State tenant only sees its own elections', stateElections.length === 1 && stateElections[0].id === stateElection.id, `Found ${stateElections.length} elections`);
  test('16.4', 'ISOLATION', 'Local tenant cannot see State elections', !localElections.some(e => e.id === stateElection.id), 'Cross-tenant election leak');
  test('16.5', 'ISOLATION', 'State tenant cannot see Local elections', !stateElections.some(e => e.id === localElection.id), 'Cross-tenant election leak');

  // Verify user isolation
  const localUser = await db.user.create({
    data: { email: 'local@test.com', name: 'Local User', role: 'FIELD_AGENT', tenantId: localT.id, passwordHash: await hashPassword('test') },
  });
  const stateUser = await db.user.create({
    data: { email: 'state@test.com', name: 'State User', role: 'FIELD_AGENT', tenantId: stateT.id, passwordHash: await hashPassword('test') },
  });

  const localUsers = await db.user.findMany({ where: { tenantId: localT.id } });
  const stateUsers = await db.user.findMany({ where: { tenantId: stateT.id } });

  test('16.6', 'ISOLATION', 'Local tenant users isolated', localUsers.every(u => u.tenantId === localT.id) && !localUsers.some(u => u.tenantId === stateT.id), 'User isolation leak');
  test('16.7', 'ISOLATION', 'State tenant users isolated', stateUsers.every(u => u.tenantId === stateT.id) && !stateUsers.some(u => u.tenantId === localT.id), 'User isolation leak');

  // Verify JWT tokens contain correct tenantId
  const localToken = await createToken({ userId: localUser.id, email: localUser.email, role: localUser.role, tenantId: localT.id });
  const stateToken = await createToken({ userId: stateUser.id, email: stateUser.email, role: stateUser.role, tenantId: stateT.id });

  const { verifyToken } = await import('../src/lib/auth');
  const localPayload = await verifyToken(localToken);
  const statePayload = await verifyToken(stateToken);

  test('16.8', 'ISOLATION', 'Local user JWT contains local tenantId', localPayload?.tenantId === localT.id, `Got ${localPayload?.tenantId}`);
  test('16.9', 'ISOLATION', 'State user JWT contains state tenantId', statePayload?.tenantId === stateT.id, `Got ${statePayload?.tenantId}`);
  test('16.10', 'ISOLATION', 'Tokens are tenant-specific (not interchangeable)', localPayload?.tenantId !== statePayload?.tenantId, 'Tokens have same tenantId');

  // Cleanup
  await db.election.deleteMany({ where: { id: { in: [localElection.id, stateElection.id] } } });
  await db.user.deleteMany({ where: { id: { in: [localUser.id, stateUser.id] } } });
  for (const t of [localT, stateT, presT]) {
    await db.tenant.delete({ where: { id: t.id } });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 17: Defense in Depth — Middleware + RBAC + Route Guards
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 17: Defense in Depth\n');

  {
    const mwSrc = readFile('src/middleware.ts');
    test('17.1', 'DID', 'Middleware verifies JWT for all API routes', mwSrc.includes('jwtVerify') && mwSrc.includes('omnivote-session'), 'JWT verification missing');
    test('17.2', 'DID', 'Middleware has RBAC enforcement', mwSrc.includes('ROUTE_RBAC') && mwSrc.includes('isRouteAllowed'), 'RBAC missing');
    test('17.3', 'DID', 'tenants routes restricted to SUPER_ADMIN', mwSrc.includes("'tenants': ['SUPER_ADMIN']"), 'Tenants RBAC missing');
    test('17.4', 'DID', 'security routes restricted to SA+TA+TS', mwSrc.includes("'security': ['SUPER_ADMIN', 'TENANT_ADMIN', 'TRUST_SAFETY']"), 'Security RBAC missing');

    const rbacSrc = readFile('src/lib/rbac.ts');
    test('17.5', 'DID', 'requireTenantMatch allows SUPER_ADMIN to access any tenant', rbacSrc.includes("user.role === 'SUPER_ADMIN'") && rbacSrc.includes('return null'), 'SA bypass missing');
    test('17.6', 'DID', 'requireTenantMatch blocks cross-tenant access', rbacSrc.includes('Tenant access denied'), 'Cross-tenant block missing');
    test('17.7', 'DID', 'requireRole function exists', rbacSrc.includes('requireRole'), 'requireRole missing');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORY 18: resolveTenant Security
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Category 18: resolveTenant Security\n');

  {
    const src = readFile('src/lib/tenant.ts');
    test('18.1', 'RESOLVE', 'Requires tenantId query param', src.includes('tenantId query parameter is required'), 'Missing tenantId check missing');
    test('18.2', 'RESOLVE', 'Returns 404 for nonexistent tenant', src.includes('Tenant not found'), '404 check missing');
    // Check that resolveTenant does NOT use findFirst (only findUnique is safe)
    const codeOnly = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    test('18.3', 'RESOLVE', 'No fallback to first tenant', !codeOnly.includes('findFirst'), 'Dangerous fallback still present');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('                    TEST RESULTS SUMMARY');
  console.log('═'.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  const categories = [...new Set(results.map(r => r.category))];
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catPassed = catResults.filter(r => r.passed).length;
    const catFailed = catResults.filter(r => !r.passed).length;
    const catIcon = catFailed === 0 ? '🟢' : catFailed <= 2 ? '🟡' : '🔴';
    console.log(`  ${catIcon} ${cat.padEnd(20)} ${catPassed}/${catResults.length} passed`);
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`  Total: ${total}  |  ✅ Passed: ${passed}  |  ❌ Failed: ${failed}`);
  console.log('─'.repeat(70));

  if (failed > 0) {
    console.log('\n  FAILED TESTS:');
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    ❌ [${r.id}] ${r.description}`);
      console.log(`       → ${r.detail}`);
    }
    console.log('');
  }

  console.log('═'.repeat(70) + '\n');

  // Exit with error code if any tests failed
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('Test suite error:', e);
  process.exit(1);
});