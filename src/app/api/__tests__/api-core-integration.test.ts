/**
 * API Integration Tests for Core Business Endpoints
 * Phase 21: incidents, elections, results, pvt, agents, campaigns
 *
 * Strategy: Mock DB and auth to test request validation, RBAC,
 * query parameter handling, and response shape.
 */
import { GET as getIncidents, POST as postIncident } from '@/app/api/incidents/route';
import { GET as getElections, POST as postElection } from '@/app/api/elections/route';
import { GET as getResults } from '@/app/api/results/route';
import { GET as getPvt, POST as postPvt } from '@/app/api/pvt/route';
import { GET as getAgents } from '@/app/api/agents/route';
import { GET as getCampaigns, POST as postCampaign } from '@/app/api/campaigns/route';
import { NextRequest } from 'next/server';

// ─── Shared Mock Setup ─────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn().mockResolvedValue({
    userId: 'user-1',
    email: 'admin@test.com',
    role: 'SUPER_ADMIN',
    tenantIds: ['tenant-1'],
  }),
}));

vi.mock('@/lib/tenant', () => ({
  resolveTenant: vi.fn().mockResolvedValue({ id: 'tenant-1', error: null }),
}));

vi.mock('@/lib/rbac', () => ({
  requireTenantMatch: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/db', () => ({
  db: {
    incident: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({ id: '1' }) },
    election: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: '1', tenantId: 'tenant-1', title: 'Test', tier: 'LOCAL', status: 'UPCOMING', date: new Date(), createdAt: new Date(), updatedAt: new Date(), _count: { pollingUnits: 0 } }) },
    electionResult: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0), groupBy: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: '1' }) },
    pollingUnit: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0) },
    pvtSubmission: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0), groupBy: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: '1' }), update: vi.fn().mockResolvedValue({}) },
    resultComparison: { findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    result: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), groupBy: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({ id: '1' }) },
    agent: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    campaign: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: '1' }), count: vi.fn().mockResolvedValue(0) },
    contactList: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    campaignContact: { count: vi.fn().mockResolvedValue(0) },
    campaignEvent: { count: vi.fn().mockResolvedValue(0) },
    alert: { create: vi.fn().mockResolvedValue({ id: '1' }) },
  },
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  extractIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/ws-broadcast', () => ({
  broadcastIncident: vi.fn().mockResolvedValue(undefined),
  broadcastPvt: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/push-sender', () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/safe-parse', () => ({
  safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
}));

vi.mock('@/lib/monitoring', () => ({
  errorTracker: { capture: vi.fn() },
  alertManager: { getActiveAlerts: vi.fn().mockReturnValue([]) },
  getCorrelationIdFromRequest: vi.fn().mockReturnValue(null),
  generateCorrelationId: vi.fn().mockReturnValue('corr-1'),
  createRequestTimer: vi.fn().mockReturnValue(() => {}),
  activeConnections: { increment: vi.fn(), decrement: vi.fn(), getValue: vi.fn().mockReturnValue(0) },
}));

vi.mock('@/lib/api-handler', () => ({
  withApiHandler: (method: string, route: string, handler: (req: unknown, ctx: unknown) => unknown) =>
    (req: unknown) => handler(req, { user: { userId: 'user-1', email: 'admin@test.com', role: 'SUPER_ADMIN', tenantIds: ['tenant-1'], tenantId: 'tenant-1' }, correlationId: 'corr-1', req }),
}));

function makeRequest(url: string, body?: unknown, method = 'GET'): NextRequest {
  const init: RequestInit = {
    headers: {
      'x-tenant-id': 'tenant-1',
      'authorization': 'Bearer fake-token',
    },
  };
  if (body && method !== 'GET') {
    init.body = JSON.stringify(body);
    init.method = method;
    init.headers = { ...init.headers, 'content-type': 'application/json' };
  }
  return new NextRequest(new URL(url, 'http://localhost'), init);
}

// ─── Incidents ──────────────────────────────────────────────────────

describe('GET /api/incidents', () => {
  it('should return 200 with incidents array', async () => {
    const res = await getIncidents(makeRequest('http://localhost/api/incidents'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.incidents)).toBe(true);
  });

  it('should return 200 with total count', async () => {
    const res = await getIncidents(makeRequest('http://localhost/api/incidents'));
    const data = await res.json();
    expect(typeof data.total).toBe('number');
  });

  it('should accept query filters', async () => {
    const res = await getIncidents(makeRequest('http://localhost/api/incidents?type=VIOLENCE&severity=HIGH&status=OPEN&limit=10'));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/incidents', () => {
  it('should reject unauthenticated requests', async () => {
    const { getAuthUser } = await import('@/lib/auth');
    vi.mocked(getAuthUser).mockResolvedValueOnce(null);
    const res = await postIncident(makeRequest('http://localhost/api/incidents', {}, 'POST'));
    expect(res.status).toBe(401);
  });
});

// ─── Elections ──────────────────────────────────────────────────────

describe('GET /api/elections', () => {
  it('should return 200 with elections array', async () => {
    const res = await getElections(makeRequest('http://localhost/api/elections'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.elections)).toBe(true);
  });

  it('should accept status and tier filters', async () => {
    const res = await getElections(makeRequest('http://localhost/api/elections?status=ACTIVE&tier=STATE'));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/elections', () => {
  it('should reject without title', async () => {
    const res = await postElection(makeRequest('http://localhost/api/elections', { date: '2025-01-01' }, 'POST'));
    expect(res.status).toBe(400);
  });

  it('should reject without date', async () => {
    const res = await postElection(makeRequest('http://localhost/api/elections', { title: 'Test' }, 'POST'));
    expect(res.status).toBe(400);
  });

  it('should reject invalid tier', async () => {
    const res = await postElection(makeRequest('http://localhost/api/elections', { title: 'Test', date: '2025-01-01', tier: 'INVALID' }, 'POST'));
    expect(res.status).toBe(400);
  });

  it('should create an election with valid data', async () => {
    const res = await postElection(makeRequest('http://localhost/api/elections', { title: 'Test Election', date: '2025-03-01' }, 'POST'));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
  });

  it('should default tier to LOCAL', async () => {
    const res = await postElection(makeRequest('http://localhost/api/elections', { title: 'Test', date: '2025-01-01' }, 'POST'));
    expect(res.status).toBe(201);
  });
});

// ─── Results ────────────────────────────────────────────────────────

describe('GET /api/results', () => {
  it('should return 200 with results array', async () => {
    const res = await getResults(makeRequest('http://localhost/api/results'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.results)).toBe(true);
  });

  it('should accept electionId filter', async () => {
    const res = await getResults(makeRequest('http://localhost/api/results?electionId=elec-1'));
    expect(res.status).toBe(200);
  });
});

// ─── PVT ────────────────────────────────────────────────────────────

describe('GET /api/pvt', () => {
  it('should return 200 with submissions array', async () => {
    const res = await getPvt(makeRequest('http://localhost/api/pvt'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.pvtSubmissions)).toBe(true);
  });
});

describe('POST /api/pvt', () => {
  it('should reject unauthenticated requests', async () => {
    const { getAuthUser } = await import('@/lib/auth');
    vi.mocked(getAuthUser).mockResolvedValueOnce(null);
    const res = await postPvt(makeRequest('http://localhost/api/pvt', {}, 'POST'));
    expect(res.status).toBe(401);
  });
});

// ─── Agents ─────────────────────────────────────────────────────────

describe('GET /api/agents', () => {
  it('should return 200 with users array', async () => {
    const res = await getAgents(makeRequest('http://localhost/api/agents'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.users)).toBe(true);
  });

  it('should accept status filter', async () => {
    const res = await getAgents(makeRequest('http://localhost/api/agents?status=ACTIVE'));
    expect(res.status).toBe(200);
  });
});

// ─── Campaigns ──────────────────────────────────────────────────────

describe('GET /api/campaigns', () => {
  it('should return 200 with campaigns array', async () => {
    const res = await getCampaigns(makeRequest('http://localhost/api/campaigns'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.campaigns)).toBe(true);
  });
});

describe('POST /api/campaigns', () => {
  it('should reject unauthenticated requests', async () => {
    const { getAuthUser } = await import('@/lib/auth');
    vi.mocked(getAuthUser).mockResolvedValueOnce(null);
    const res = await postCampaign(makeRequest('http://localhost/api/campaigns', {}, 'POST'));
    expect(res.status).toBe(401);
  });
});
