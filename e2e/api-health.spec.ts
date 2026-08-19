import { test, expect } from '@playwright/test';

/**
 * API endpoint E2E tests for OmniVote.
 *
 * Covers: health, auth (GET), metrics, SLO, runbooks, and auth-protected routes.
 * Uses page.request (Playwright APIRequestContext) for pure API tests without
 * browser overhead.
 */

test.describe('API Endpoints', () => {

  // ── GET /api/health ────────────────────────────────────────────────────

  test('GET /api/health returns 200 with status ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('uptime');
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThan(0);
    expect(body).toHaveProperty('timestamp');
    // Verify ISO timestamp
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
    expect(body).toHaveProperty('database');
    expect(body.database.status).toBe('ok');
    expect(body).toHaveProperty('websocket');
  });

  // ── GET /api/auth (tenants list) ───────────────────────────────────────

  test('GET /api/auth returns tenants array', async ({ request }) => {
    const res = await request.get('/api/auth');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('authenticated');
    expect(body).toHaveProperty('tenants');
    expect(Array.isArray(body.tenants)).toBe(true);

    // If tenants exist, each should have id, name, slug
    if (body.tenants.length > 0) {
      const tenant = body.tenants[0];
      expect(tenant).toHaveProperty('id');
      expect(tenant).toHaveProperty('name');
      expect(tenant).toHaveProperty('slug');
    }
  });

  // ── GET /api/metrics (Prometheus format) ───────────────────────────────

  test('GET /api/metrics returns Prometheus text format containing omnivote', async ({
    request,
  }) => {
    const res = await request.get('/api/metrics');
    expect(res.status()).toBe(200);

    const body = await res.text();
    // All metric names start with 'omnivote_'
    expect(body).toContain('omnivote_');

    // Should have at least the uptime metric
    expect(body).toContain('omnivote_process_uptime_seconds');
  });

  // ── GET /api/slo ──────────────────────────────────────────────────────

  test('GET /api/slo returns SLO data', async ({ request }) => {
    const res = await request.get('/api/slo');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('sloDefinitions');
    expect(body).toHaveProperty('reports');
    expect(body).toHaveProperty('deploymentFreeze');
    expect(body).toHaveProperty('recentMetrics');

    // SLO definitions should be an array
    expect(Array.isArray(body.sloDefinitions)).toBe(true);
    expect(Array.isArray(body.reports)).toBe(true);
  });

  // ── GET /api/runbooks ─────────────────────────────────────────────────

  test('GET /api/runbooks returns runbook array', async ({ request }) => {
    const res = await request.get('/api/runbooks');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('runbooks');
    expect(Array.isArray(body.runbooks)).toBe(true);
    expect(typeof body.total).toBe('number');

    // If runbooks exist, verify structure
    if (body.runbooks.length > 0) {
      const rb = body.runbooks[0];
      expect(rb).toHaveProperty('id');
      expect(rb).toHaveProperty('title');
      expect(rb).toHaveProperty('severity');
      expect(rb).toHaveProperty('description');
    }
  });

  // ── Auth-protected endpoints (should return 4xx without cookie) ────────

  test('GET /api/dashboard without auth returns 4xx (protected)', async ({ request }) => {
    const res = await request.get('/api/dashboard');
    // Either 401 (middleware auth) or 400 (missing tenantId from route handler)
    // Both indicate the endpoint is properly protected
    expect([400, 401]).toContain(res.status());

    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test('GET /api/agents without auth returns 4xx (protected)', async ({ request }) => {
    const res = await request.get('/api/agents');
    // Either 401 (middleware auth) or 400 (missing tenantId from route handler)
    expect([400, 401]).toContain(res.status());

    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  // ── POST /api/auth with missing fields ────────────────────────────────

  test('POST /api/auth with missing email returns 400', async ({ request }) => {
    const res = await request.post('/api/auth', {
      data: { password: 'test' },
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('Email and password required');
  });

  test('POST /api/auth with missing password returns 400', async ({ request }) => {
    const res = await request.post('/api/auth', {
      data: { email: 'test@example.com' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/auth with empty body returns 400', async ({ request }) => {
    const res = await request.post('/api/auth', {
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});
