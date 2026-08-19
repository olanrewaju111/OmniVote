import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth module to avoid JWT_SECRET requirement
vi.mock('../../../lib/auth', () => ({
  getAuthUser: vi.fn(),
}));

// Mock rate-limit module
vi.mock('../../../lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ limited: false })),
}));

import { createRouteGuard } from '../request-guard';
import { getAuthUser } from '../../../lib/auth';
import { rateLimit } from '../../../lib/rate-limit';
import { generateCsrfToken } from '../csrf';

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedRateLimit = vi.mocked(rateLimit);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetAuthUser.mockResolvedValue(null);
  mockedRateLimit.mockReturnValue({ limited: false });
});

describe('createRouteGuard', () => {
  it('should allow request with no options', async () => {
    const guard = createRouteGuard();
    const req = new Request('http://localhost/api/test', { method: 'GET' });
    const result = await guard(req);
    expect(result.allowed).toBe(true);
  });

  it('should allow GET request with requireAuth when user is authenticated', async () => {
    const mockUser = { userId: 'u1', email: 'test@test.com', role: 'ADMIN', tenantId: 't1' };
    mockedGetAuthUser.mockResolvedValue(mockUser);

    const guard = createRouteGuard({ requireAuth: true });
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: { cookie: 'omnivote-session=token' },
    });
    const result = await guard(req);

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.user?.userId).toBe('u1');
    }
  });

  it('should reject request with requireAuth when not authenticated', async () => {
    const guard = createRouteGuard({ requireAuth: true });
    const req = new Request('http://localhost/api/test', { method: 'GET' });
    const result = await guard(req);

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.response.status).toBe(401);
    }
  });

  it('should reject POST with requireCsrf when no CSRF token', async () => {
    const guard = createRouteGuard({ requireCsrf: true });
    const req = new Request('http://localhost/api/test', { method: 'POST' });
    const result = await guard(req);

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.response.status).toBe(403);
    }
  });

  it('should allow POST with requireCsrf when valid CSRF token', async () => {
    const { token, cookieHeader } = generateCsrfToken();
    const guard = createRouteGuard({ requireCsrf: true });
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': token,
      },
    });
    const result = await guard(req);

    expect(result.allowed).toBe(true);
  });

  it('should not check CSRF on GET requests', async () => {
    const guard = createRouteGuard({ requireCsrf: true });
    const req = new Request('http://localhost/api/test', { method: 'GET' });
    const result = await guard(req);

    expect(result.allowed).toBe(true);
  });

  it('should handle OPTIONS preflight with CORS enabled', async () => {
    const guard = createRouteGuard({ corsEnabled: true });
    const req = new Request('http://localhost/api/test', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost' },
    });
    const result = await guard(req);

    // OPTIONS returns 204 (not an error, but not "allowed" for the route handler)
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.response.status).toBe(204);
    }
  });

  it('should include corsHeaders when CORS is enabled', async () => {
    const guard = createRouteGuard({ corsEnabled: true });
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: { origin: 'http://localhost' },
    });
    const result = await guard(req);

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.corsHeaders).toBeDefined();
    }
  });

  it('should pass through rate limiting when enabled', async () => {
    const guard = createRouteGuard({ rateLimitCategory: 'mutation-write' });
    const req = new Request('http://localhost/api/test', { method: 'POST' });
    const result = await guard(req);

    expect(rateLimit).toHaveBeenCalled();
    expect(result.allowed).toBe(true);
  });

  it('should return rate limit response when limited', async () => {
    mockedRateLimit.mockReturnValue({
      limited: true,
      response: new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    const guard = createRouteGuard({ rateLimitCategory: 'mutation-write' });
    const req = new Request('http://localhost/api/test', { method: 'POST' });
    const result = await guard(req);

    expect(result.allowed).toBe(false);
  });
});
