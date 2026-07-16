/**
 * Adversarial Test Seed Script
 * =============================
 * Creates 3 tenants with different scopes and sample data to test:
 * 1. Tenant isolation — no cross-tenant data leakage
 * 2. Scope-based behavior validation
 * 3. RBAC enforcement
 * 4. Edge cases an attacker would probe
 *
 * Usage: bun run scripts/adversarial-seed.ts
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const db = new PrismaClient();

const SCOPES = ['LOCAL_GOVERNMENT', 'STATE_GOVERNMENT', 'PRESIDENTIAL'] as const;

interface TenantSeed {
  name: string;
  slug: string;
  scope: string;
  primaryColor: string;
  admin: { name: string; email: string };
  users: { name: string; email: string; role: string }[];
  election: { title: string; tier: string; state?: string };
  pollingUnits: { code: string; name: string; state: string; lga: string; ward: string; lat: number; lng: number; registeredVoters: number }[];
}

const TENANTS: TenantSeed[] = [
  {
    name: 'Lagos Island LGA Monitor',
    slug: 'lagos-island-lga',
    scope: 'LOCAL_GOVERNMENT',
    primaryColor: '#f59e0b',
    admin: { name: 'LGA Admin Adebayo', email: 'admin@lagos-island-lga.omnivote.ng' },
    users: [
      { name: 'Agent Tunde', email: 'tunde@lagos-island-lga.omnivote.ng', role: 'FIELD_AGENT' },
      { name: 'Analyst Funke', email: 'funke@lagos-island-lga.omnivote.ng', role: 'ANALYST' },
    ],
    election: { title: 'Lagos Island LCDA Chairmanship', tier: 'LOCAL', state: 'Lagos' },
    pollingUnits: [
      { code: 'LI/001', name: 'St. Peters Primary School', state: 'Lagos', lga: 'Lagos Island', ward: 'Ward A', lat: 6.4500, lng: 3.3900, registeredVoters: 450 },
      { code: 'LI/002', name: 'Tinubu Square Polling Booth', state: 'Lagos', lga: 'Lagos Island', ward: 'Ward A', lat: 6.4520, lng: 3.3920, registeredVoters: 380 },
      { code: 'LI/003', name: 'Obalende Community Hall', state: 'Lagos', lga: 'Lagos Island', ward: 'Ward B', lat: 6.4450, lng: 3.4100, registeredVoters: 520 },
    ],
  },
  {
    name: 'Kano State Election Observer',
    slug: 'kano-state-obs',
    scope: 'STATE_GOVERNMENT',
    primaryColor: '#3b82f6',
    admin: { name: 'State Admin Musa', email: 'admin@kano-state-obs.omnivote.ng' },
    users: [
      { name: 'Agent Amina', email: 'amina@kano-state-obs.omnivote.ng', role: 'FIELD_AGENT' },
      { name: 'Trust Saf Ibrahim', email: 'ibrahim@kano-state-obs.omnivote.ng', role: 'TRUST_SAFETY' },
    ],
    election: { title: 'Kano State Gubernatorial Election 2027', tier: 'STATE', state: 'Kano' },
    pollingUnits: [
      { code: 'KN/001', name: 'Gidan Murtala Polling Unit', state: 'Kano', lga: 'Kano Municipal', ward: 'Ward 1', lat: 12.0020, lng: 8.5920, registeredVoters: 650 },
      { code: 'KN/002', name: 'Sabo Primary School', state: 'Kano', lga: 'Nassarawa', ward: 'Ward 3', lat: 11.9950, lng: 8.5850, registeredVoters: 420 },
      { code: 'KN/003', name: 'Dala Town Hall', state: 'Kano', lga: 'Dala', ward: 'Ward 2', lat: 12.0300, lng: 8.5500, registeredVoters: 580 },
    ],
  },
  {
    name: 'Presidential Election Monitor',
    slug: 'presidential-ng',
    scope: 'PRESIDENTIAL',
    primaryColor: '#8b5cf6',
    admin: { name: 'Presidential Admin Ngozi', email: 'admin@presidential-ng.omnivote.ng' },
    users: [
      { name: 'Agent Chukwu', email: 'chukwu@presidential-ng.omnivote.ng', role: 'FIELD_AGENT' },
      { name: 'Analyst Bisi', email: 'bisi@presidential-ng.omnivote.ng', role: 'ANALYST' },
      { name: 'Trust Saf Emeka', email: 'emeka@presidential-ng.omnivote.ng', role: 'TRUST_SAFETY' },
    ],
    election: { title: 'Nigeria Presidential Election 2027', tier: 'PRESIDENTIAL' },
    pollingUnits: [
      { code: 'AB/001', name: 'Abuja International Conference Centre', state: 'Abuja FCT', lga: 'Abuja Municipal', ward: 'Central', lat: 9.0579, lng: 7.4951, registeredVoters: 800 },
      { code: 'LG/001', name: 'Enugu State University Gate', state: 'Enugu', lga: 'Enugu North', ward: 'Ward 4', lat: 6.4300, lng: 7.5000, registeredVoters: 700 },
      { code: 'RV/001', name: 'Port Harcourt City Stadium', state: 'Rivers', lga: 'Port Harcourt', ward: 'Ward 8', lat: 4.8100, lng: 7.0200, registeredVoters: 600 },
    ],
  },
];

async function seed() {
  console.log('=== ADVERSARIAL TEST SEED ===\n');

  // 1. Clean existing data (in reverse dependency order)
  console.log('🧹 Cleaning existing data...');
  const tables = [
    'resultComparison', 'pvtSubmission', 'stegoScanResult',
    'campaignMessage', 'agentCheckIn', 'honeypotUnit', 'accessibilityReport',
    'deadMansSwitch', 'electionResult', 'agentMessage', 'alert',
    'incident', 'securityEvent', 'auditLog', 'evidenceDossier',
    'geofenceZone', 'campaignEvent', 'voterSuppressionReport',
    'osintPost', 'flashpointForecast', 'wargameScenario',
    'campaign', 'contactList', 'pollingUnit', 'election', 'user', 'tenant',
  ] as const;

  for (const table of tables) {
    try {
      await (db[table] as any).deleteMany();
    } catch (e) {
      console.log(`  ⚠ Could not clean ${table}: ${(e as Error).message.slice(0, 60)}`);
    }
  }
  console.log('  ✅ Cleaned\n');

  // 2. Create tenants with data
  const tenantIds: Record<string, string> = {};
  const userIds: Record<string, Record<string, string>> = {};

  for (const t of TENANTS) {
    console.log(`📦 Creating tenant: ${t.name} [${t.scope}]`);

    // Verify scope is valid
    if (!SCOPES.includes(t.scope as any)) {
      console.error(`  ❌ Invalid scope: ${t.scope}`);
      continue;
    }

    const passwordHash = await hash('password123', 12);

    // Create tenant with admin
    const tenant = await db.tenant.create({
      data: {
        name: t.name,
        slug: t.slug,
        scope: t.scope,
        primaryColor: t.primaryColor,
        isActive: true,
        users: {
          create: [
            // Tenant admin uses TENANT_ADMIN (not SUPER_ADMIN) to test tenant isolation
            { email: t.admin.email, name: t.admin.name, role: 'TENANT_ADMIN', passwordHash },
            ...t.users.map(u => ({ email: u.email, name: u.name, role: u.role, passwordHash })),
          ],
        },
      },
      include: { users: true },
    });

    tenantIds[t.slug] = tenant.id;
    userIds[t.slug] = {};
    for (const u of tenant.users) {
      userIds[t.slug][u.email] = u.id;
    }

    // Create election
    const election = await db.election.create({
      data: {
        tenantId: tenant.id,
        title: t.election.title,
        tier: t.election.tier,
        status: 'ACTIVE',
        date: new Date('2027-02-14'),
      },
    });

    // Create polling units
    for (const pu of t.pollingUnits) {
      await db.pollingUnit.create({
        data: {
          electionId: election.id,
          code: pu.code,
          name: pu.name,
          state: pu.state,
          lga: pu.lga,
          ward: pu.ward,
          latitude: pu.lat,
          longitude: pu.lng,
          registeredVoters: pu.registeredVoters,
          totalVotes: 0,
          turnout: 0,
          status: 'OPEN',
        },
      });
    }

    // Create some incidents (only for first user per tenant)
    const agentId = tenant.users.find(u => u.role === 'FIELD_AGENT')?.id;
    if (agentId) {
      await db.incident.create({
        data: {
          tenantId: tenant.id,
          type: 'VIOLENCE',
          severity: 'HIGH',
          description: 'Test incident for adversarial testing',
          status: 'PENDING',
          reportedById: agentId,
          pollingUnitId: (await db.pollingUnit.findFirst({ where: { electionId: election.id } }))!.id,
        },
      });

      await db.alert.create({
        data: {
          tenantId: tenant.id,
          type: 'SECURITY',
          category: 'WARNING',
          title: 'Security alert during test',
          description: 'Test alert for adversarial testing',
        },
      });
    }

    console.log(`  ✅ Created: ${tenant.users.length} users, 1 election, ${t.pollingUnits.length} polling units, 1 incident, 1 alert\n`);
  }

  // 2. Create a platform SUPER_ADMIN (separate from any tenant)
  const platformAdminHash = await hash('password123', 12);
  // The first tenant will serve as the platform admin's tenant
  const platformTenant = await db.tenant.findFirst();
  if (platformTenant) {
    await db.user.create({
      data: {
        email: 'platform-admin@omnivote.ng',
        name: 'Platform Super Admin',
        role: 'SUPER_ADMIN',
        tenantId: platformTenant.id,
        passwordHash: platformAdminHash,
      },
    });
  }

  // 3. Print test credentials
  console.log('=== TEST CREDENTIALS ===\n');
  console.log('All users have password: password123\n');

  console.log('[PLATFORM] Platform Super Admin');
  console.log('  SUPER_ADMIN: platform-admin@omnivote.ng');
  console.log('');

  for (const t of TENANTS) {
    console.log(`[${t.scope}] ${t.name}`);
    console.log(`  Admin:     ${t.admin.email}`);
    for (const u of t.users) {
      console.log(`  ${u.role}: ${u.email}`);
    }
    console.log(`  Tenant ID: ${tenantIds[t.slug]}`);
    console.log('');
  }

  // 4. Print adversarial test scenarios
  console.log('=== ADVERSARIAL TEST SCENARIOS ===\n');
  console.log('1. Cross-tenant data access:');
  console.log('   Log in as admin@lagos-island-lga.omnivote.ng');
  console.log('   Try to fetch dashboard with ?tenantId=' + tenantIds['kano-state-obs']);
  console.log('   Expected: 403 Tenant access denied\n');

  console.log('2. No tenantId parameter:');
  console.log('   Call /api/dashboard (no query params)');
  console.log('   Expected: 400 tenantId query parameter is required\n');

  console.log('3. WhatsApp send without tenantId:');
  console.log('   POST /api/whatsapp?action=send { toPhone: "+1234" }');
  console.log('   Expected: 400 tenantId is required\n');

  console.log('4. Cross-tenant polling unit reference:');
  console.log('   Submit results with pollingUnitId from another tenant');
  console.log('   Expected: 403 Polling unit not found in your tenant\n');

  console.log('5. Cross-tenant PVT election reference:');
  console.log('   Submit PVT with electionId from another tenant');
  console.log('   Expected: 403 Election not found in your tenant\n');

  console.log('6. Agent deletion with tenant-scoped audit:');
  console.log('   Delete an agent and verify only that tenant\'s audit logs are removed\n');

  console.log('7. Scope validation:');
  console.log('   Verify each tenant\'s scope badge displays correctly');
  console.log('   LOCAL_GOVERNMENT = amber, STATE_GOVERNMENT = blue, PRESIDENTIAL = violet\n');

  console.log('=== SEED COMPLETE ===');
}

seed()
  .catch(e => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());