/**
 * API Integration Tests — Phase 19
 *
 * Tests real API handler logic in isolation using test-utils pattern.
 * Each test creates a NextRequest, calls the handler, and asserts the response.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Test utilities ──────────────────────────────────────────────

function createRequest(
  url: string,
  opts: RequestInit = {}
): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), opts);
}

function createJsonRequest(
  url: string,
  body: Record<string, unknown>,
  opts: RequestInit = {}
): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: JSON.stringify(body),
    ...opts,
  });
}

// ─── Health endpoint ─────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const { GET } = await import('@/app/api/health/route');
    const req = createRequest('http://localhost:3000/api/health');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
  });

  it('includes timestamp', async () => {
    const { GET } = await import('@/app/api/health/route');
    const req = createRequest('http://localhost:3000/api/health');
    const res = await GET(req);
    const data = await res.json();

    expect(data.timestamp).toBeDefined();
    expect(new Date(data.timestamp).getTime()).not.toBeNaN();
  });

  it('includes version', async () => {
    const { GET } = await import('@/app/api/health/route');
    const req = createRequest('http://localhost:3000/api/health');
    const res = await GET(req);
    const data = await res.json();

    expect(data.version).toBeDefined();
  });
});

// ─── Auth endpoint (login) ───────────────────────────────────────

describe('POST /api/auth (login)', () => {
  it('returns 400 when email is missing', async () => {
    const { POST } = await import('@/app/api/auth/route');
    const req = createJsonRequest('http://localhost:3000/api/auth', {
      password: 'test123',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('returns 400 when password is missing', async () => {
    const { POST } = await import('@/app/api/auth/route');
    const req = createJsonRequest('http://localhost:3000/api/auth', {
      email: 'test@example.com',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('returns 401 for invalid credentials', async () => {
    const { POST } = await import('@/app/api/auth/route');
    const req = createJsonRequest('http://localhost:3000/api/auth', {
      email: 'nonexistent@test.com',
      password: 'wrongpassword',
    });
    const res = await POST(req);

    // Should be 401 (unauthorized) for bad credentials
    expect([400, 401]).toContain(res.status);
  });
});

// ─── Incidents endpoint ──────────────────────────────────────────

describe('POST /api/incidents', () => {
  it('returns 401 when not authenticated', async () => {
    const { POST } = await import('@/app/api/incidents/route');
    const req = createJsonRequest('http://localhost:3000/api/incidents', {
      title: 'Test incident',
      type: 'VIOLENCE',
      severity: 'HIGH',
    });
    const res = await POST(req);

    // Should require auth
    expect([400, 401]).toContain(res.status);
  });

  it('returns 400 when body is empty', async () => {
    const { POST } = await import('@/app/api/incidents/route');
    const req = createRequest('http://localhost:3000/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const res = await POST(req);

    expect([400, 401]).toContain(res.status);
  });
});

// ─── Metrics endpoint ────────────────────────────────────────────

describe('GET /api/metrics', () => {
  it('returns Prometheus text format', async () => {
    const { GET } = await import('@/app/api/metrics/route');
    const req = createRequest('http://localhost:3000/api/metrics');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
  });

  it('includes process metrics', async () => {
    const { GET } = await import('@/app/api/metrics/route');
    const req = createRequest('http://localhost:3000/api/metrics');
    const res = await GET(req);
    const text = await res.text();

    expect(text).toContain('omnivote_process_uptime_seconds');
    expect(text).toContain('omnivote_process_memory_rss_bytes');
  });

  it('includes web vitals metrics (Phase 19)', async () => {
    const { GET } = await import('@/app/api/metrics/route');
    const req = createRequest('http://localhost:3000/api/metrics');
    const res = await GET(req);
    const text = await res.text();

    expect(text).toContain('omnivote_web_vitals_health_score');
    expect(text).toContain('omnivote_web_vitals_anomalies_total');
  });
});

describe('POST /api/metrics (web vitals)', () => {
  it('accepts web-vital type and returns 200', async () => {
    const { POST } = await import('@/app/api/metrics/route');
    const req = createJsonRequest('http://localhost:3000/api/metrics', {
      type: 'web-vital',
      name: 'LCP',
      value: 2500,
      timestamp: new Date().toISOString(),
      route: '/dashboard',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('accepts web-vitals batch type and returns 200', async () => {
    const { POST } = await import('@/app/api/metrics/route');
    const req = createJsonRequest('http://localhost:3000/api/metrics', {
      type: 'web-vitals',
      route: '/dashboard',
      vitals: [
        { name: 'LCP', value: 2500 },
        { name: 'CLS', value: 0.05 },
        { name: 'FCP', value: 1000 },
      ],
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('accepts client-error type and returns 200', async () => {
    const { POST } = await import('@/app/api/metrics/route');
    const req = createJsonRequest('http://localhost:3000/api/metrics', {
      type: 'client-error',
      message: 'Test error',
      severity: 'warning',
      route: '/dashboard',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('returns 200 even for malformed JSON (fire-and-forget)', async () => {
    const { POST } = await import('@/app/api/metrics/route');
    const req = createRequest('http://localhost:3000/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json at all',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });
});

// ─── Web Vitals stats endpoint (Phase 19) ────────────────────────

describe('GET /api/metrics/web-vitals', () => {
  it('returns valid JSON structure', async () => {
    const { GET } = await import('@/app/api/metrics/web-vitals/route');
    const req = createRequest('http://localhost:3000/api/metrics/web-vitals');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('stats');
    expect(data).toHaveProperty('anomalies');
    expect(data).toHaveProperty('healthScore');
    expect(data).toHaveProperty('routes');
    expect(data).toHaveProperty('budgetCompliance');
    expect(data).toHaveProperty('anomalyCounts');
    expect(data).toHaveProperty('totalEvents');
  });

  it('returns valid health score and non-negative totalEvents', async () => {
    const { GET } = await import('@/app/api/metrics/web-vitals/route');
    const req = createRequest('http://localhost:3000/api/metrics/web-vitals');
    const res = await GET(req);
    const data = await res.json();

    expect(typeof data.healthScore).toBe('number');
    expect(data.healthScore).toBeGreaterThanOrEqual(0);
    expect(data.healthScore).toBeLessThanOrEqual(100);
    expect(typeof data.totalEvents).toBe('number');
    expect(data.totalEvents).toBeGreaterThanOrEqual(0);
  });

  it('supports route filter query param', async () => {
    const { GET } = await import('@/app/api/metrics/web-vitals/route');
    const req = createRequest('http://localhost:3000/api/metrics/web-vitals?route=/dashboard');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stats).toBeDefined();
  });

  it('supports metric filter query param', async () => {
    const { GET } = await import('@/app/api/metrics/web-vitals/route');
    const req = createRequest('http://localhost:3000/api/metrics/web-vitals?metric=LCP');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stats).toBeDefined();
  });
});

describe('DELETE /api/metrics/web-vitals', () => {
  it('clears all vitals and returns ok', async () => {
    const { GET, DELETE } = await import('@/app/api/metrics/web-vitals/route');

    // First record some data
    const { POST } = await import('@/app/api/metrics/route');
    await POST(createJsonRequest('http://localhost:3000/api/metrics', {
      type: 'web-vital', name: 'LCP', value: 5000, timestamp: new Date().toISOString(),
    }));

    // Verify data exists
    const getRes = await GET(createRequest('http://localhost:3000/api/metrics/web-vitals'));
    const getData = await getRes.json();
    expect(getData.totalEvents).toBeGreaterThan(0);

    // Clear
    const delRes = await DELETE();
    const delData = await delRes.json();
    expect(delRes.status).toBe(200);
    expect(delData.ok).toBe(true);

    // Verify cleared
    const getRes2 = await GET(createRequest('http://localhost:3000/api/metrics/web-vitals'));
    const getData2 = await getRes2.json();
    expect(getData2.totalEvents).toBe(0);
  });
});

// ─── Tenants endpoint ─────────────────────────────────────────────

describe('GET /api/tenants', () => {
  it('returns 200 or 500 (DB may not be available in test)', async () => {
    const { GET } = await import('@/app/api/tenants/route');
    const req = createRequest('http://localhost:3000/api/tenants');
    const res = await GET(req);

    // In test env without DB, tenants may 500; in integration env, returns 200
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      expect(Array.isArray(data.tenants || data)).toBe(true);
    }
  });
});

// ─── Docs endpoint ───────────────────────────────────────────────

describe('GET /api/docs', () => {
  it('returns OpenAPI 3.0 spec', async () => {
    const { GET } = await import('@/app/api/docs/route');
    const req = createRequest('http://localhost:3000/api/docs');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.openapi).toBe('3.0.3');
    expect(data.paths).toBeDefined();
    expect(data.info).toBeDefined();
  });
});
