import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth module before importing rate-limit (which imports getAuthUser from auth)
vi.mock('../auth', () => ({
  getAuthUser: vi.fn(),
}));

import { rateLimit, withRateLimitHeaders } from '../rate-limit';

// Helper to create a mock NextRequest
function createMockRequest(url = 'http://localhost:3000/api/test', userId?: string) {
  const headers = new Headers();
  if (userId) headers.set('x-ratelimit-userid', userId);
  return new NextRequest(url, { headers });
}

describe('rateLimit', () => {
  // Clear the module-level store before each test
  // Since the store is module-scoped, we need to be careful.
  // We use unique route keys per test to avoid cross-contamination.

  it('allows the first request', () => {
    const req = createMockRequest('http://localhost:3000/api/test-allow', 'user-a');
    const result = rateLimit(req, { maxBurst: 2, burstWindowMs: 10_000 });
    expect(result.limited).toBe(false);
  });

  it('returns limited=true when burst exceeded', () => {
    const req = createMockRequest('http://localhost:3000/api/test-burst', 'user-b');

    // First 2 are allowed (maxBurst=2)
    expect(rateLimit(req, { maxBurst: 2, burstWindowMs: 10_000 }).limited).toBe(false);
    expect(rateLimit(req, { maxBurst: 2, burstWindowMs: 10_000 }).limited).toBe(false);

    // Third should be rate limited
    const result = rateLimit(req, { maxBurst: 2, burstWindowMs: 10_000 });
    expect(result.limited).toBe(true);
    if (result.limited) {
      expect(result.response.status).toBe(429);
    }
  });

  it('uses anonymous as default userId', () => {
    const req = createMockRequest('http://localhost:3000/api/test-anon');
    const result = rateLimit(req, { maxBurst: 1, burstWindowMs: 10_000 });
    expect(result.limited).toBe(false);

    const result2 = rateLimit(req, { maxBurst: 1, burstWindowMs: 10_000 });
    expect(result2.limited).toBe(true);
  });

  it('separates limits by userId', () => {
    const req1 = createMockRequest('http://localhost:3000/api/test-sep', 'user-x');
    const req2 = createMockRequest('http://localhost:3000/api/test-sep', 'user-y');

    // user-x uses up their burst
    expect(rateLimit(req1, { maxBurst: 1, burstWindowMs: 10_000 }).limited).toBe(false);
    expect(rateLimit(req1, { maxBurst: 1, burstWindowMs: 10_000 }).limited).toBe(true);

    // user-y should still be allowed
    expect(rateLimit(req2, { maxBurst: 1, burstWindowMs: 10_000 }).limited).toBe(false);
  });

  it('separates limits by route', () => {
    const req1 = createMockRequest('http://localhost:3000/api/route-a', 'user-z');
    const req2 = createMockRequest('http://localhost:3000/api/route-b', 'user-z');

    expect(rateLimit(req1, { maxBurst: 1, burstWindowMs: 10_000 }).limited).toBe(false);
    expect(rateLimit(req1, { maxBurst: 1, burstWindowMs: 10_000 }).limited).toBe(true);

    // Same user, different route — should be allowed
    expect(rateLimit(req2, { maxBurst: 1, burstWindowMs: 10_000 }).limited).toBe(false);
  });

  it('includes Retry-After header when limited', async () => {
    const req = createMockRequest('http://localhost:3000/api/test-retry', 'user-r');

    rateLimit(req, { maxBurst: 1, burstWindowMs: 10_000 });
    const result = rateLimit(req, { maxBurst: 1, burstWindowMs: 10_000 });

    expect(result.limited).toBe(true);
    if (result.limited) {
      expect(result.response.headers.get('Retry-After')).toBeTruthy();
    }
  });

  it('works with preset category strings', () => {
    const req = createMockRequest('http://localhost:3000/api/test-cat', 'user-cat');
    // 'mutation-delete' has maxBurst: 5
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(req, 'mutation-delete').limited).toBe(false);
    }
    expect(rateLimit(req, 'mutation-delete').limited).toBe(true);
  });
});

describe('withRateLimitHeaders', () => {
  it('adds X-RateLimit headers to response', () => {
    const req = createMockRequest('http://localhost:3000/api/test-headers', 'user-h');
    rateLimit(req, { maxBurst: 10, burstWindowMs: 10_000 });

    const response = new Response(null, { status: 200 });
    const enhanced = withRateLimitHeaders(response as any, req, { maxBurst: 10, burstWindowMs: 10_000 });

    expect(enhanced.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(enhanced.headers.get('X-RateLimit-Remaining')).toBe('9');
  });
});
