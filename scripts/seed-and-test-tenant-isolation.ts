/**
 * OmniVote Monitor v2.1 — Multi-Tenant Seed + Isolation Test Suite
 *
 * This script:
 * 1. Seeds 3 tenants (LOCAL, STATE, PRESIDENTIAL) with cross-role users
 * 2. Creates elections + polling units + sample data per tenant
 * 3. Runs tenant isolation tests against ALL API routes
 *
 * Run:  cd /home/z/my-project && bun scripts/seed-and-test-tenant-isolation.ts
 */

import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

const db = new PrismaClient();

// ─── Config ─────────────────────────────────────────────────────────────────
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'omnivote-dev-secret-change-in-production',
);
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

// ─── Types ──────────────────────────────────────────────────────────────────
interface TestUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  tenantName: string;
  token: string; // JWT for auth
}

interface TenantData {
  id: string;
  name: string;
  slug: string;
  tier: string;
  color: string;
  mapBounds: { minLat: number; maxLat: number; minLng: number; maxLng: number; label: string };
}

// ─── JWT Helper ─────────────────────────────────────────────────────────────
async function createToken(payload: { userId: string; email: string; role: string; tenantId: string }): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

// ─── HTTP Helper ────────────────────────────────────────────────────────────
async function apiCall(
  method: string,
  path: string,
  token: string | null,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Cookie'] = `omnivote-session=${token}`;
  }
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

// ─── Test Framework ─────────────────────────────────────────────────────────
let totalTests = 0;
let passedTests = 0;
let failedTests: { name: string; expected: string; got: string }[] = [];

function assert(
  name: string,
  condition: boolean,
  expected: string,
  got: string,
) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ ${name}`);
  } else {
    failedTests.push({ name, expected, got });
    console.log(`  ❌ ${name} — expected ${expected}, got ${got}`);
  }
}

// ─── Phase 1: Seed Data ────────────────────────────────────────────────────
const TENANTS: TenantData[] = [
  {
    name: 'Lagos Island LGA Election Monitor',
    slug: 'lagos-island-lga',
    tier: 'LOCAL',
    color: '#f59e0b',
    mapBounds: { minLat: 6.42, maxLat: 6.46, minLng: 3.38, maxLng: 3.42, label: 'Lagos Island LGA' },
  },
  {
    name: 'Rivers State Election Monitor',
    slug: 'rivers-state',
    tier: 'STATE',
    color: '#3b82f6',
    mapBounds: { minLat: 4.5, maxLat: 5.2, minLng: 6.5, maxLng: 7.1, label: 'Rivers State' },
  },
  {
    name: 'Nigeria Presidential Election Monitor',
    slug: 'nigeria-presidential',
    tier: 'PRESIDENTIAL',
    color: '#10b981',
    mapBounds: { minLat: 4.0, maxLat: 14.0, minLng: 2.5, maxLng: 15.0, label: 'Nigeria (full)' },
  },
];

const ROLE_CONFIGS = [
  { role: 'SUPER_ADMIN', nameSuffix: 'Super Admin' },
  { role: 'TENANT_ADMIN', nameSuffix: 'Tenant Admin' },
  { role: 'ANALYST', nameSuffix: 'Analyst' },
  { role: 'TRUST_SAFETY', nameSuffix: 'Trust & Safety' },
  { role: 'FIELD_AGENT', nameSuffix: 'Field Agent' },
];

async function seedDatabase(): Promise<{ tenants: TenantData[]; users: TestUser[] }> {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  PHASE 1: Seeding Multi-Tenant Database                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Clean slate
  console.log('Cleaning database...');
  await db.$transaction(async (tx) => {
    // Delete in FK-safe order
    await tx.campaignMessage.deleteMany();
    await tx.stegoScanResult.deleteMany();
    await tx.agentCheckIn.deleteMany();
    await tx.pvtSubmission.deleteMany();
    await tx.resultComparison.deleteMany();
    await tx.honeypotUnit.deleteMany();
    await tx.accessibilityReport.deleteMany();
    await tx.deadMansSwitch.deleteMany();
    await tx.agentMessage.deleteMany();
    await tx.electionResult.deleteMany();
    await tx.alert.deleteMany();
    await tx.incident.deleteMany();
    await tx.securityEvent.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.evidenceDossier.deleteMany();
    await tx.geofenceZone.deleteMany();
    await tx.campaignEvent.deleteMany();
    await tx.voterSuppressionReport.deleteMany();
    await tx.osintPost.deleteMany();
    await tx.flashpointForecast.deleteMany();
    await tx.wargameScenario.deleteMany();
    await tx.campaign.deleteMany();
    await tx.contactList.deleteMany();
    await tx.pollingUnit.deleteMany();
    await tx.election.deleteMany();
    await tx.user.deleteMany();
    await tx.tenant.deleteMany();
  });
  console.log('  Database cleaned.\n');

  const createdTenants: TenantData[] = [];
  const allUsers: TestUser[] = [];

  for (const t of TENANTS) {
    console.log(`Creating tenant: ${t.name} (${t.tier})`);

    const tenant = await db.tenant.create({
      data: {
        name: t.name,
        slug: t.slug,
        primaryColor: t.color,
        mapBounds: JSON.stringify(t.mapBounds),
      },
    });
    createdTenants.push({ ...t, id: tenant.id });

    // Create users for each role
    for (const rc of ROLE_CONFIGS) {
      const email = `${t.slug}-${rc.role.toLowerCase()}@test.omnivote.ng`;
      const name = `${t.slug.split('-')[0].toUpperCase()} ${rc.nameSuffix}`;

      const user = await db.user.create({
        data: {
          email,
          name,
          role: rc.role,
          tenantId: tenant.id,
          isOnline: rc.role === 'FIELD_AGENT',
        },
      });

      const token = await createToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      });

      allUsers.push({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: tenant.id,
        tenantName: t.name,
        token,
      });

      console.log(`  Created user: ${name} (${rc.role}) — ${email}`);
    }

    // Create election
    const electionDate = t.tier === 'LOCAL'
      ? '2026-08-15T08:00:00.000Z'
      : t.tier === 'STATE'
        ? '2026-10-11T08:00:00.000Z'
        : '2027-02-21T08:00:00.000Z';

    const election = await db.election.create({
      data: {
        tenantId: tenant.id,
        title: `${t.name} — ${t.tier} Election 2026`,
        tier: t.tier,
        status: 'ACTIVE',
        date: new Date(electionDate),
      },
    });
    console.log(`  Created election: ${election.title}`);

    // Create 3 polling units per tenant
    const pus = await Promise.all([
      db.pollingUnit.create({
        data: {
          electionId: election.id,
          name: `${t.slug.split('-')[0].toUpperCase()} PU 001`,
          code: `${t.slug.toUpperCase().replace(/-/g, '_')}_PU_001`,
          state: t.tier === 'LOCAL' ? 'Lagos' : t.tier === 'STATE' ? 'Rivers' : 'FCT',
          lga: t.tier === 'LOCAL' ? 'Lagos Island' : t.tier === 'STATE' ? 'Port Harcourt' : 'AMAC',
          ward: 'Ward 1',
          latitude: t.mapBounds.minLat + 0.01,
          longitude: t.mapBounds.minLng + 0.01,
          registeredVoters: 500 + Math.floor(Math.random() * 500),
          status: 'OPEN',
        },
      }),
      db.pollingUnit.create({
        data: {
          electionId: election.id,
          name: `${t.slug.split('-')[0].toUpperCase()} PU 002`,
          code: `${t.slug.toUpperCase().replace(/-/g, '_')}_PU_002`,
          state: t.tier === 'LOCAL' ? 'Lagos' : t.tier === 'STATE' ? 'Rivers' : 'FCT',
          lga: t.tier === 'LOCAL' ? 'Lagos Island' : t.tier === 'STATE' ? 'Port Harcourt' : 'AMAC',
          ward: 'Ward 2',
          latitude: t.mapBounds.minLat + 0.02,
          longitude: t.mapBounds.minLng + 0.02,
          registeredVoters: 400 + Math.floor(Math.random() * 400),
          status: 'OPEN',
        },
      }),
      db.pollingUnit.create({
        data: {
          electionId: election.id,
          name: `${t.slug.split('-')[0].toUpperCase()} PU 003`,
          code: `${t.slug.toUpperCase().replace(/-/g, '_')}_PU_003`,
          state: t.tier === 'LOCAL' ? 'Lagos' : t.tier === 'STATE' ? 'Rivers' : 'FCT',
          lga: t.tier === 'LOCAL' ? 'Lagos Island' : t.tier === 'STATE' ? 'Port Harcourt' : 'AMAC',
          ward: 'Ward 3',
          latitude: t.mapBounds.minLat + 0.03,
          longitude: t.mapBounds.minLng + 0.03,
          registeredVoters: 600 + Math.floor(Math.random() * 600),
          status: 'PENDING',
        },
      }),
    ]);
    console.log(`  Created ${pus.length} polling units`);

    // Create sample incidents
    const fieldAgent = allUsers.find(u => u.tenantId === tenant.id && u.role === 'FIELD_AGENT');
    if (fieldAgent) {
      await db.incident.create({
        data: {
          tenantId: tenant.id,
          pollingUnitId: pus[0].id,
          reportedById: fieldAgent.id,
          type: 'OBSERVATION',
          severity: 'MEDIUM',
          description: `Test observation for ${t.name}`,
          gpsLatitude: t.mapBounds.minLat + 0.01,
          gpsLongitude: t.mapBounds.minLng + 0.01,
        },
      });
      console.log('  Created 1 sample incident');
    }

    // Create sample alerts
    await db.alert.create({
      data: {
        tenantId: tenant.id,
        type: 'OPERATIONAL',
        category: 'INFO',
        title: `Election day kickoff — ${t.name}`,
        description: `Monitoring has started for the ${t.tier.toLowerCase()} election.`,
      },
    });
    console.log('  Created 1 sample alert');

    // Create sample OSINT post
    await db.osintPost.create({
      data: {
        tenantId: tenant.id,
        platform: 'X',
        postId: `test_${t.slug}_001`,
        author: `@testuser_${t.slug}`,
        content: `Sample election monitoring post for ${t.name}`,
        sentiment: 'NEUTRAL',
        category: 'ELECTION_NEWS',
        publishedAt: new Date(),
      },
    });
    console.log('  Created 1 sample OSINT post');

    // Create sample flashpoint forecast
    await db.flashpointForecast.create({
      data: {
        tenantId: tenant.id,
        state: t.tier === 'LOCAL' ? 'Lagos' : t.tier === 'STATE' ? 'Rivers' : 'FCT',
        riskScores: JSON.stringify({ violence: 0.3, intimidation: 0.2, logistics: 0.1, overall: 0.2 }),
        riskLevel: 'MEDIUM',
        forecast: JSON.stringify([{ date: '2026-08-15', overall: 0.2, violence: 0.1 }]),
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    console.log('  Created 1 flashpoint forecast');

    console.log('');
  }

  // Create one SUPER_ADMIN user that spans all tenants (platform admin)
  const platformSA = allUsers.find(u => u.role === 'SUPER_ADMIN' && u.tenantName.includes('Presidential'));
  console.log(`\nPlatform Super Admin: ${platformSA?.email} (${platformSA?.tenantId})\n`);

  return { tenants: createdTenants, users: allUsers };
}

// ─── Phase 2: Tenant Isolation Tests ───────────────────────────────────────
async function runIsolationTests(tenants: TenantData[], users: TestUser[]) {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  PHASE 2: Tenant Isolation Tests                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Helper: get specific user
  const user = (tenantName: string, role: string) =>
    users.find(u => u.tenantName.includes(tenantName) && u.role === role)!;
  const tenant = (name: string) => tenants.find(t => t.name.includes(name))!;

  const LOCAL = tenant('Lagos Island');
  const STATE = tenant('Rivers State');
  const PRES = tenant('Nigeria Presidential');

  // ─── Test Group 1: Cross-Tenant READ Isolation ─────────────────────────
  console.log('── Group 1: Cross-Tenant READ Isolation ──\n');

  // 1a. Dashboard
  {
    const localAdmin = user('Lagos Island', 'TENANT_ADMIN');
    const stateRes = await apiCall('GET', `/api/dashboard?tenantId=${STATE.id}`, localAdmin.token);
    assert('Dashboard: Lagos admin cannot read Rivers dashboard', stateRes.status === 403, '403', String(stateRes.status));
  }

  // 1b. Incidents
  {
    const localAdmin = user('Lagos Island', 'TENANT_ADMIN');
    const stateRes = await apiCall('GET', `/api/incidents?tenantId=${STATE.id}`, localAdmin.token);
    assert('Incidents: Lagos admin cannot read Rivers incidents', stateRes.status === 403, '403', String(stateRes.status));
  }

  // 1c. Alerts
  {
    const stateAdmin = user('Rivers State', 'TENANT_ADMIN');
    const presRes = await apiCall('GET', `/api/alerts?tenantId=${PRES.id}`, stateAdmin.token);
    assert('Alerts: Rivers admin cannot read Presidential alerts', presRes.status === 403, '403', String(presRes.status));
  }

  // 1d. Results
  {
    const presAnalyst = user('Nigeria Presidential', 'ANALYST');
    const localRes = await apiCall('GET', `/api/results?tenantId=${LOCAL.id}`, presAnalyst.token);
    assert('Results: Presidential analyst cannot read Lagos results', localRes.status === 403, '403', String(localRes.status));
  }

  // 1e. Agents
  {
    const localTA = user('Lagos Island', 'TENANT_ADMIN');
    const stateRes = await apiCall('GET', `/api/agents?tenantId=${STATE.id}`, localTA.token);
    assert('Agents: Lagos admin cannot read Rivers agents', stateRes.status === 403, '403', String(stateRes.status));
  }

  // 1f. OSINT
  {
    const stateAnalyst = user('Rivers State', 'ANALYST');
    const presRes = await apiCall('GET', `/api/osint?tenantId=${PRES.id}`, stateAnalyst.token);
    assert('OSINT: Rivers analyst cannot read Presidential OSINT', presRes.status === 403, '403', String(presRes.status));
  }

  // 1g. Security Events
  {
    const localTA = user('Lagos Island', 'TENANT_ADMIN');
    const presRes = await apiCall('GET', `/api/security?tenantId=${PRES.id}`, localTA.token);
    assert('Security: Lagos admin cannot read Presidential security events', presRes.status === 403, '403', String(presRes.status));
  }

  // 1h. Situation Room
  {
    const stateAnalyst = user('Rivers State', 'ANALYST');
    const localRes = await apiCall('GET', `/api/situation-room?tenantId=${LOCAL.id}`, stateAnalyst.token);
    assert('Situation Room: Rivers analyst cannot read Lagos situation data', localRes.status === 403, '403', String(localRes.status));
  }

  // 1i. Geofence
  {
    const presAdmin = user('Nigeria Presidential', 'TENANT_ADMIN');
    const localRes = await apiCall('GET', `/api/geofence?tenantId=${LOCAL.id}`, presAdmin.token);
    assert('Geofence: Presidential admin cannot read Lagos geofences', localRes.status === 403, '403', String(localRes.status));
  }

  // 1j. Campaigns
  {
    const localAdmin = user('Lagos Island', 'TENANT_ADMIN');
    const stateRes = await apiCall('GET', `/api/campaigns?tenantId=${STATE.id}`, localAdmin.token);
    assert('Campaigns: Lagos admin cannot read Rivers campaigns', stateRes.status === 403, '403', String(stateRes.status));
  }

  // 1k. Campaign Events
  {
    const stateAdmin = user('Rivers State', 'TENANT_ADMIN');
    const presRes = await apiCall('GET', `/api/campaign-events?tenantId=${PRES.id}`, stateAdmin.token);
    assert('Campaign Events: Rivers admin cannot read Presidential events', presRes.status === 403, '403', String(presRes.status));
  }

  // 1l. PVT
  {
    const localAnalyst = user('Lagos Island', 'ANALYST');
    const stateRes = await apiCall('GET', `/api/pvt?tenantId=${STATE.id}`, localAnalyst.token);
    assert('PVT: Lagos analyst cannot read Rivers PVT data', stateRes.status === 403, '403', String(stateRes.status));
  }

  // 1m. Evidence
  {
    const stateTS = user('Rivers State', 'TRUST_SAFETY');
    const presRes = await apiCall('GET', `/api/evidence?tenantId=${PRES.id}`, stateTS.token);
    assert('Evidence: Rivers T&S cannot read Presidential evidence', presRes.status === 403, '403', String(presRes.status));
  }

  // 1n. Flashpoint
  {
    const localAdmin = user('Lagos Island', 'TENANT_ADMIN');
    const stateRes = await apiCall('GET', `/api/flashpoint?tenantId=${STATE.id}`, localAdmin.token);
    assert('Flashpoint: Lagos admin cannot read Rivers flashpoints', stateRes.status === 403, '403', String(stateRes.status));
  }

  // 1o. Honeypot
  {
    const stateTS = user('Rivers State', 'TRUST_SAFETY');
    const localRes = await apiCall('GET', `/api/honeypot?tenantId=${LOCAL.id}`, stateTS.token);
    assert('Honeypot: Rivers T&S cannot read Lagos honeypot data', localRes.status === 403, '403', String(localRes.status));
  }

  // 1p. Voter Suppression
  {
    const presAdmin = user('Nigeria Presidential', 'TENANT_ADMIN');
    const stateRes = await apiCall('GET', `/api/voter-suppression?tenantId=${STATE.id}`, presAdmin.token);
    assert('Voter Suppression: Presidential admin cannot read Rivers reports', stateRes.status === 403, '403', String(stateRes.status));
  }

  // 1q. Engagement
  {
    const localAnalyst = user('Lagos Island', 'ANALYST');
    const stateRes = await apiCall('GET', `/api/engagement?tenantId=${STATE.id}`, localAnalyst.token);
    assert('Engagement: Lagos analyst cannot read Rivers engagement data', stateRes.status === 403, '403', String(stateRes.status));
  }

  // 1r. Reports
  {
    const stateAdmin = user('Rivers State', 'TENANT_ADMIN');
    const localRes = await apiCall('GET', `/api/reports?tenantId=${LOCAL.id}`, stateAdmin.token);
    assert('Reports: Rivers admin cannot read Lagos reports', localRes.status === 403, '403', String(localRes.status));
  }

  // 1s. Tenant Settings
  {
    const localAdmin = user('Lagos Island', 'TENANT_ADMIN');
    const stateRes = await apiCall('GET', `/api/tenant-settings?tenantId=${STATE.id}`, localAdmin.token);
    assert('Tenant Settings: Lagos admin cannot read Rivers settings', stateRes.status === 403, '403', String(stateRes.status));
  }

  // 1t. Tenants Users
  {
    const stateAdmin = user('Rivers State', 'TENANT_ADMIN');
    const presRes = await apiCall('GET', `/api/tenants/users?tenantId=${PRES.id}`, stateAdmin.token);
    assert('Tenants Users: Rivers admin cannot read Presidential users', presRes.status === 403, '403', String(presRes.status));
  }

  // ─── Test Group 2: Same-Tenant READ Success ────────────────────────────
  console.log('\n── Group 2: Same-Tenant READ Success ──\n');

  {
    const localAdmin = user('Lagos Island', 'TENANT_ADMIN');
    const res = await apiCall('GET', `/api/dashboard?tenantId=${LOCAL.id}`, localAdmin.token);
    assert('Dashboard: Lagos admin CAN read own dashboard', res.status === 200, '200', String(res.status));
  }

  {
    const stateAdmin = user('Rivers State', 'TENANT_ADMIN');
    const res = await apiCall('GET', `/api/incidents?tenantId=${STATE.id}`, stateAdmin.token);
    assert('Incidents: Rivers admin CAN read own incidents', res.status === 200, '200', String(res.status));
  }

  {
    const presAnalyst = user('Nigeria Presidential', 'ANALYST');
    const res = await apiCall('GET', `/api/alerts?tenantId=${PRES.id}`, presAnalyst.token);
    assert('Alerts: Presidential analyst CAN read own alerts', res.status === 200, '200', String(res.status));
  }

  {
    const localAdmin = user('Lagos Island', 'TENANT_ADMIN');
    const res = await apiCall('GET', `/api/tenants/users?tenantId=${LOCAL.id}`, localAdmin.token);
    assert('Tenants Users: Lagos admin CAN read own users', res.status === 200, '200', String(res.status));
  }

  {
    const stateTS = user('Rivers State', 'TRUST_SAFETY');
    const res = await apiCall('GET', `/api/osint?tenantId=${STATE.id}`, stateTS.token);
    assert('OSINT: Rivers T&S CAN read own OSINT', res.status === 200, '200', String(res.status));
  }

  {
    const presAdmin = user('Nigeria Presidential', 'TENANT_ADMIN');
    const res = await apiCall('GET', `/api/tenant-settings?tenantId=${PRES.id}`, presAdmin.token);
    assert('Tenant Settings: Presidential admin CAN read own settings', res.status === 200, '200', String(res.status));
  }

  // ─── Test Group 3: Unauthenticated Access ──────────────────────────────
  console.log('\n── Group 3: Unauthenticated Access ──\n');

  {
    const res = await apiCall('GET', `/api/dashboard?tenantId=${LOCAL.id}`, null);
    assert('Unauth: GET dashboard returns 401', res.status === 401, '401', String(res.status));
  }

  {
    const res = await apiCall('GET', `/api/incidents?tenantId=${STATE.id}`, null);
    assert('Unauth: GET incidents returns 401', res.status === 401, '401', String(res.status));
  }

  {
    const res = await apiCall('GET', `/api/agents?tenantId=${PRES.id}`, null);
    assert('Unauth: GET agents returns 401', res.status === 401, '401', String(res.status));
  }

  // ─── Test Group 4: Cross-Tenant WRITE Isolation ───────────────────────
  console.log('\n── Group 4: Cross-Tenant WRITE Isolation ──\n');

  // 4a. POST /api/incidents — cross-tenant blocked
  {
    const localAgent = user('Lagos Island', 'FIELD_AGENT');
    const stateAgent = user('Rivers State', 'FIELD_AGENT');
    const res = await apiCall('POST', '/api/incidents', localAgent.token, {
      reporterId: stateAgent.id, // Using Rivers agent as reporter
      type: 'VIOLENCE',
      severity: 'HIGH',
      description: 'Cross-tenant attack attempt',
    });
    assert('POST Incidents: Lagos agent cannot create incident in Rivers (cross-tenant reporter)',
      res.status === 403, '403', String(res.status));
  }

  // 4b. POST /api/results — cross-tenant blocked
  {
    const localAgent = user('Lagos Island', 'FIELD_AGENT');
    const stateAgent = user('Rivers State', 'FIELD_AGENT');
    // Get a Rivers polling unit
    const riversPUs = await db.pollingUnit.findMany({
      where: { election: { tenantId: STATE.id } },
      select: { id: true },
      take: 1,
    });
    if (riversPUs.length > 0) {
      const res = await apiCall('POST', '/api/results', localAgent.token, {
        reporterId: stateAgent.id,
        pollingUnitId: riversPUs[0].id,
        totalVotesCast: 999,
      });
      assert('POST Results: Lagos agent cannot submit results for Rivers (cross-tenant reporter)',
        res.status === 403, '403', String(res.status));
    }
  }

  // 4c. PATCH /api/agents — cross-tenant blocked
  {
    const localAdmin = user('Lagos Island', 'TENANT_ADMIN');
    const stateAgent = user('Rivers State', 'FIELD_AGENT');
    const res = await apiCall('PATCH', '/api/agents', localAdmin.token, {
      userId: stateAgent.id,
      action: 'TOGGLE_ONLINE',
    });
    assert('PATCH Agents: Lagos admin cannot modify Rivers agent', res.status === 403, '403', String(res.status));
  }

  // 4d. POST /api/campaigns — cross-tenant blocked
  {
    const stateAdmin = user('Rivers State', 'TENANT_ADMIN');
    const res = await apiCall('POST', `/api/campaigns?tenantId=${LOCAL.id}`, stateAdmin.token, {
      name: 'Cross-tenant attack',
      templateName: 'test',
      templateBody: 'test body',
    });
    assert('POST Campaigns: Rivers admin cannot create campaign in Lagos', res.status === 403, '403', String(res.status));
  }

  // 4e. POST /api/geofence — cross-tenant blocked
  {
    const localAdmin = user('Lagos Island', 'TENANT_ADMIN');
    const res = await apiCall('POST', `/api/geofence?tenantId=${STATE.id}`, localAdmin.token, {
      name: 'Cross-tenant geofence',
      state: 'Rivers',
      centerLat: 4.8,
      centerLng: 6.9,
      radiusMeters: 1000,
    });
    assert('POST Geofence: Lagos admin cannot create geofence in Rivers', res.status === 403, '403', String(res.status));
  }

  // 4f. POST /api/flashpoint — cross-tenant blocked
  {
    const stateAdmin = user('Rivers State', 'TENANT_ADMIN');
    const res = await apiCall('POST', `/api/flashpoint?tenantId=${PRES.id}`, stateAdmin.token, {
      state: 'FCT',
      riskLevel: 'HIGH',
    });
    assert('POST Flashpoint: Rivers admin cannot create forecast in Presidential', res.status === 403, '403', String(res.status));
  }

  // 4g. POST /api/honeypot — cross-tenant blocked
  {
    const presTS = user('Nigeria Presidential', 'TRUST_SAFETY');
    const res = await apiCall('POST', `/api/honeypot?tenantId=${LOCAL.id}`, presTS.token, {
      action: 'CREATE_HONEYPOT',
    });
    assert('POST Honeypot: Presidential T&S cannot create honeypot in Lagos', res.status === 403, '403', String(res.status));
  }

  // 4h. POST /api/evidence — cross-tenant blocked
  {
    const localTS = user('Lagos Island', 'TRUST_SAFETY');
    const res = await apiCall('POST', `/api/evidence?tenantId=${STATE.id}`, localTS.token, {
      action: 'CREATE_DOSSIER',
      title: 'Cross-tenant evidence',
    });
    assert('POST Evidence: Lagos T&S cannot create dossier in Rivers', res.status === 403, '403', String(res.status));
  }

  // 4i. POST /api/engagement — cross-tenant blocked
  {
    const stateAdmin = user('Rivers State', 'TENANT_ADMIN');
    const res = await apiCall('POST', `/api/engagement?tenantId=${LOCAL.id}`, stateAdmin.token, {
      action: 'SEND_MESSAGE',
      agentId: user('Lagos Island', 'FIELD_AGENT').id,
      subject: 'Cross-tenant message',
      body: 'Should be blocked',
    });
    assert('POST Engagement: Rivers admin cannot send message to Lagos agent', res.status === 403, '403', String(res.status));
  }

  // 4j. POST /api/campaign-events — cross-tenant blocked
  {
    const localAdmin = user('Lagos Island', 'TENANT_ADMIN');
    const res = await apiCall('POST', `/api/campaign-events?tenantId=${STATE.id}`, localAdmin.token, {
      eventType: 'RALLY',
      title: 'Cross-tenant event',
      state: 'Rivers',
      eventDate: '2026-08-20',
    });
    assert('POST Campaign Events: Lagos admin cannot create event in Rivers', res.status === 403, '403', String(res.status));
  }

  // 4k. POST /api/pvt — cross-tenant blocked
  {
    const stateAnalyst = user('Rivers State', 'ANALYST');
    const res = await apiCall('POST', `/api/pvt?tenantId=${PRES.id}`, stateAnalyst.token, {
      action: 'CREATE_PVT',
    });
    assert('POST PVT: Rivers analyst cannot create PVT in Presidential', res.status === 403, '403', String(res.status));
  }

  // 4l. POST /api/security — cross-tenant blocked
  {
    const localAdmin = user('Lagos Island', 'TENANT_ADMIN');
    const res = await apiCall('POST', `/api/security?tenantId=${STATE.id}`, localAdmin.token, {
      action: 'LOG_EVENT',
      eventType: 'LOGIN_SUCCESS',
      description: 'Cross-tenant security event',
    });
    assert('POST Security: Lagos admin cannot log event in Rivers', res.status === 403, '403', String(res.status));
  }

  // 4m. POST /api/voter-suppression — cross-tenant blocked
  {
    const presAdmin = user('Nigeria Presidential', 'TENANT_ADMIN');
    const res = await apiCall('POST', `/api/voter-suppression?tenantId=${LOCAL.id}`, presAdmin.token, {
      reportType: 'FALSE_POLLING_INFO',
      title: 'Cross-tenant suppression',
      description: 'Should be blocked',
      state: 'Lagos',
    });
    assert('POST Voter Suppression: Presidential admin cannot create report in Lagos',
      res.status === 403, '403', String(res.status));
  }

  // 4n. POST /api/whatsapp send — unauthenticated blocked
  {
    const res = await apiCall('PUT', '/api/whatsapp?action=send', null, {
      tenantId: LOCAL.id,
      toPhone: '+2348000000001',
      body: 'Cross-tenant whatsapp',
    });
    assert('PUT WhatsApp send: Unauthenticated request blocked', res.status === 401, '401', String(res.status));
  }

  // ─── Test Group 5: SUPER_ADMIN Cross-Tenant Access ─────────────────────
  console.log('\n── Group 5: SUPER_ADMIN Cross-Tenant Access (allowed) ──\n');

  {
    const presSA = user('Nigeria Presidential', 'SUPER_ADMIN');
    const res = await apiCall('GET', `/api/dashboard?tenantId=${LOCAL.id}`, presSA.token);
    assert('SUPER_ADMIN: CAN read any tenant dashboard (Lagos)', res.status === 200, '200', String(res.status));
  }

  {
    const presSA = user('Nigeria Presidential', 'SUPER_ADMIN');
    const res = await apiCall('GET', `/api/incidents?tenantId=${STATE.id}`, presSA.token);
    assert('SUPER_ADMIN: CAN read any tenant incidents (Rivers)', res.status === 200, '200', String(res.status));
  }

  {
    const presSA = user('Nigeria Presidential', 'SUPER_ADMIN');
    const res = await apiCall('GET', `/api/tenants`, presSA.token);
    assert('SUPER_ADMIN: CAN list all tenants', res.status === 200, '200', String(res.status));
  }

  {
    const presSA = user('Nigeria Presidential', 'SUPER_ADMIN');
    const res = await apiCall('GET', `/api/tenants/users?tenantId=${LOCAL.id}`, presSA.token);
    assert('SUPER_ADMIN: CAN view any tenant\'s users', res.status === 200, '200', String(res.status));
  }

  // ─── Test Group 6: Data Containment Verification ───────────────────────
  console.log('\n── Group 6: Data Containment (query returns only own data) ──\n');

  {
    const localAdmin = user('Lagos Island', 'TENANT_ADMIN');
    const res = await apiCall('GET', `/api/incidents?tenantId=${LOCAL.id}`, localAdmin.token);
    const data = res.data as { incidents?: { id: string }[] } | null;
    const incidents = data?.incidents || [];
    // Verify no incident belongs to another tenant by checking count
    const allIncidents = await db.incident.findMany({
      where: { tenantId: LOCAL.id },
      select: { id: true },
    });
    assert(`Data Containment: Lagos incidents count matches DB (${incidents.length} vs ${allIncidents.length})`,
      incidents.length === allIncidents.length, String(allIncidents.length), String(incidents.length));
  }

  {
    const stateAdmin = user('Rivers State', 'TENANT_ADMIN');
    const res = await apiCall('GET', `/api/alerts?tenantId=${STATE.id}`, stateAdmin.token);
    const data = res.data as { alerts?: { id: string }[] } | null;
    const alerts = data?.alerts || [];
    const allAlerts = await db.alert.findMany({
      where: { tenantId: STATE.id },
      select: { id: true },
    });
    assert(`Data Containment: Rivers alerts count matches DB (${alerts.length} vs ${allAlerts.length})`,
      alerts.length === allAlerts.length, String(allAlerts.length), String(alerts.length));
  }

  {
    const presAnalyst = user('Nigeria Presidential', 'ANALYST');
    const res = await apiCall('GET', `/api/osint?tenantId=${PRES.id}`, presAnalyst.token);
    const data = res.data as { posts?: { id: string }[] } | null;
    const posts = data?.posts || [];
    const allPosts = await db.osintPost.findMany({
      where: { tenantId: PRES.id },
      select: { id: true },
    });
    assert(`Data Containment: Presidential OSINT count matches DB (${posts.length} vs ${allPosts.length})`,
      posts.length === allPosts.length, String(allPosts.length), String(posts.length));
  }

  // ─── Test Group 7: Tenant Scope Verification ──────────────────────────
  console.log('\n── Group 7: Tenant Scope (LOCAL/STATE/PRESIDENTIAL) ──\n');

  {
    const localElection = await db.election.findFirst({
      where: { tenantId: LOCAL.id },
      select: { tier: true },
    });
    assert('Tenant Scope: Lagos tenant has LOCAL election',
      localElection?.tier === 'LOCAL', 'LOCAL', localElection?.tier || 'NOT FOUND');
  }

  {
    const stateElection = await db.election.findFirst({
      where: { tenantId: STATE.id },
      select: { tier: true },
    });
    assert('Tenant Scope: Rivers tenant has STATE election',
      stateElection?.tier === 'STATE', 'STATE', stateElection?.tier || 'NOT FOUND');
  }

  {
    const presElection = await db.election.findFirst({
      where: { tenantId: PRES.id },
      select: { tier: true },
    });
    assert('Tenant Scope: Presidential tenant has PRESIDENTIAL election',
      presElection?.tier === 'PRESIDENTIAL', 'PRESIDENTIAL', presElection?.tier || 'NOT FOUND');
  }

  // Verify map bounds per tenant
  {
    const localSettings = await db.tenant.findUnique({
      where: { id: LOCAL.id },
      select: { mapBounds: true },
    });
    const bounds = localSettings?.mapBounds ? JSON.parse(localSettings.mapBounds) : null;
    assert('Tenant Scope: Lagos has LGA-scoped map bounds',
      bounds?.label === 'Lagos Island LGA', 'Lagos Island LGA', bounds?.label || 'NOT SET');
  }

  {
    const stateSettings = await db.tenant.findUnique({
      where: { id: STATE.id },
      select: { mapBounds: true },
    });
    const bounds = stateSettings?.mapBounds ? JSON.parse(stateSettings.mapBounds) : null;
    assert('Tenant Scope: Rivers has state-scoped map bounds',
      bounds?.label === 'Rivers State', 'Rivers State', bounds?.label || 'NOT SET');
  }

  {
    const presSettings = await db.tenant.findUnique({
      where: { id: PRES.id },
      select: { mapBounds: true },
    });
    const bounds = presSettings?.mapBounds ? JSON.parse(presSettings.mapBounds) : null;
    assert('Tenant Scope: Presidential has Nigeria-wide map bounds',
      bounds?.label === 'Nigeria (full)', 'Nigeria (full)', bounds?.label || 'NOT SET');
  }

  // ─── Test Group 8: PATCH /api/agents Same-Tenant ──────────────────────
  console.log('\n── Group 8: PATCH Agents Same-Tenant ──\n');

  {
    const localAdmin = user('Lagos Island', 'TENANT_ADMIN');
    const localAgent = user('Lagos Island', 'FIELD_AGENT');
    const res = await apiCall('PATCH', '/api/agents', localAdmin.token, {
      userId: localAgent.id,
      action: 'TOGGLE_ONLINE',
    });
    assert('PATCH Agents: Lagos admin CAN toggle own tenant agent', res.status === 200, '200', String(res.status));
  }

  {
    const stateAdmin = user('Rivers State', 'TENANT_ADMIN');
    const stateAgent = user('Rivers State', 'FIELD_AGENT');
    const res = await apiCall('PATCH', '/api/agents', stateAdmin.token, {
      userId: stateAgent.id,
      action: 'SET_OFFLINE',
    });
    assert('PATCH Agents: Rivers admin CAN set own tenant agent offline', res.status === 200, '200', String(res.status));
  }

  // ─── Test Group 9: Role-Based Access ──────────────────────────────────
  console.log('\n── Group 9: Role-Based Access Control ──\n');

  {
    const fieldAgent = user('Lagos Island', 'FIELD_AGENT');
    const res = await apiCall('GET', `/api/dashboard?tenantId=${LOCAL.id}`, fieldAgent.token);
    assert('RBAC: FIELD_AGENT cannot access dashboard', res.status === 403, '403', String(res.status));
  }

  {
    const analyst = user('Rivers State', 'ANALYST');
    const res = await apiCall('GET', `/api/dashboard?tenantId=${STATE.id}`, analyst.token);
    assert('RBAC: ANALYST CAN access dashboard', res.status === 200, '200', String(res.status));
  }

  {
    const trustSafety = user('Nigeria Presidential', 'TRUST_SAFETY');
    const res = await apiCall('GET', `/api/incidents?tenantId=${PRES.id}`, trustSafety.token);
    assert('RBAC: TRUST_SAFETY CAN access incidents', res.status === 200, '200', String(res.status));
  }

  {
    const fieldAgent = user('Lagos Island', 'FIELD_AGENT');
    const res = await apiCall('GET', `/api/tenants`, fieldAgent.token);
    assert('RBAC: FIELD_AGENT cannot list all tenants', res.status === 403, '403', String(res.status));
  }

  {
    const tenantAdmin = user('Rivers State', 'TENANT_ADMIN');
    const res = await apiCall('GET', `/api/tenants`, tenantAdmin.token);
    assert('RBAC: TENANT_ADMIN cannot list all tenants', res.status === 403, '403', String(res.status));
  }

  // ─── Test Group 10: POST Incidents/Results Same-Tenant ───────────────
  console.log('\n── Group 10: POST Incidents/Results Same-Tenant (allowed) ──\n');

  {
    const localAgent = user('Lagos Island', 'FIELD_AGENT');
    const localPUs = await db.pollingUnit.findMany({
      where: { election: { tenantId: LOCAL.id } },
      select: { id: true },
      take: 1,
    });
    if (localPUs.length > 0) {
      const res = await apiCall('POST', '/api/incidents', localAgent.token, {
        reporterId: localAgent.id,
        pollingUnitId: localPUs[0].id,
        type: 'LOGISTICS',
        severity: 'LOW',
        description: 'Materials arrived late — same tenant test',
      });
      assert('POST Incidents: Lagos agent CAN create incident in own tenant',
        res.status === 201, '201', String(res.status));
    }
  }

  {
    const stateAgent = user('Rivers State', 'FIELD_AGENT');
    const statePUs = await db.pollingUnit.findMany({
      where: { election: { tenantId: STATE.id } },
      select: { id: true },
      take: 1,
    });
    if (statePUs.length > 0) {
      const res = await apiCall('POST', '/api/results', stateAgent.token, {
        reporterId: stateAgent.id,
        pollingUnitId: statePUs[0].id,
        totalVotesCast: 342,
        accreditedVoters: 400,
        totalValidVotes: 330,
        rejectedBallots: 12,
        partyResults: [
          { party: 'APC', votes: 180 },
          { party: 'PDP', votes: 150 },
        ],
      });
      assert('POST Results: Rivers agent CAN submit results in own tenant',
        res.status === 201, '201', String(res.status));
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  OmniVote Monitor v2.1 — Tenant Isolation Test Suite    ║');
  console.log('║  Testing 3 tenants: LOCAL, STATE, PRESIDENTIAL          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  try {
    const { tenants, users } = await seedDatabase();
    await runIsolationTests(tenants, users);

    // ─── Summary ────────────────────────────────────────────────────────
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  TEST RESULTS                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log(`  Total:  ${totalTests}`);
    console.log(`  Passed: ${passedTests} ✅`);
    console.log(`  Failed: ${failedTests.length} ❌`);

    if (failedTests.length > 0) {
      console.log('\n  Failed tests:');
      for (const f of failedTests) {
        console.log(`    ❌ ${f.name} — expected ${f.expected}, got ${f.got}`);
      }
    }

    console.log('\n  Tenant Isolation: ' + (failedTests.length === 0 ? '✅ PERFECT' : '❌ GAPS FOUND'));
    console.log('');
  } catch (err) {
    console.error('Test suite error:', err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();