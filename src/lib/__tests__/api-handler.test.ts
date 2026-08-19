/**
 * Tests for Phase 15 — Unified API Handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetCorrelationId, mockGenerateCorrelationId, mockRecord, mockCreateTimer, mockActiveInc, mockCapture, mockWithError } = vi.hoisted(() => ({
  mockGetCorrelationId: vi.fn(() => null),
  mockGenerateCorrelationId: vi.fn(() => 'ov-test-cid'),
  mockRecord: vi.fn(() => ({ durationMs: 10 })),
  mockCreateTimer: vi.fn(() => mockRecord),
  mockActiveInc: { increment: vi.fn(), decrement: vi.fn(), getValue: vi.fn(() => 0) },
  mockCapture: vi.fn(() => 'err-id'),
  mockWithError: vi.fn(() => ({
    info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(),
  })),
}));

vi.mock('@/lib/monitoring/correlation', () => ({
  getCorrelationIdFromRequest: (...a: unknown[]) => mockGetCorrelationId(...a),
  generateCorrelationId: (...a: unknown[]) => mockGenerateCorrelationId(...a),
}));

vi.mock('@/lib/sre/request-logger', () => ({
  createRequestTimer: (...a: unknown[]) => mockCreateTimer(...a),
  activeConnections: mockActiveInc,
}));

vi.mock('@/lib/monitoring/error-tracker', () => ({
  errorTracker: { capture: (...a: unknown[]) => mockCapture(...a) },
}));

vi.mock('@/lib/monitoring/log-aggregator', () => ({
  logger: { withContext: (...a: unknown[]) => mockWithError(...a) },
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn().mockResolvedValue(null),
}));

import { withApiHandler } from '@/lib/api-handler';

describe('withApiHandler', () => {
  beforeEach(() => {
    // Reset call history only (not implementations)
    mockGetCorrelationId.mockClear();
    mockGetCorrelationId.mockReturnValue(null);
    mockGenerateCorrelationId.mockClear();
    mockGenerateCorrelationId.mockReturnValue('ov-test-cid');
    mockRecord.mockClear();
    mockRecord.mockReturnValue({ durationMs: 10 });
    mockCreateTimer.mockClear();
    mockCreateTimer.mockReturnValue(mockRecord);
    mockActiveInc.increment.mockClear();
    mockActiveInc.decrement.mockClear();
    mockCapture.mockClear();
    mockCapture.mockReturnValue('err-id');
    mockWithError.mockClear();
    mockWithError.mockReturnValue({
      info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(),
    });
  });

  it('should return response with X-Correlation-ID header', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('{}'));
    const wrapped = withApiHandler('GET', '/api/test', handler);
    const res = await wrapped(new Request('http://localhost/api/test'));
    expect(res.headers.get('X-Correlation-ID')).toBe('ov-test-cid');
  });

  it('should forward existing correlation ID', async () => {
    mockGetCorrelationId.mockReturnValue('ov-existing');
    const handler = vi.fn().mockResolvedValue(new Response('{}'));
    const wrapped = withApiHandler('GET', '/api/test', handler);
    const res = await wrapped(new Request('http://localhost/api/test'));
    expect(res.headers.get('X-Correlation-ID')).toBe('ov-existing');
    expect(mockGenerateCorrelationId).not.toHaveBeenCalled();
  });

  it('should manage active connections gauge', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('{}'));
    const wrapped = withApiHandler('GET', '/api/test', handler);
    await wrapped(new Request('http://localhost/api/test'));
    expect(mockActiveInc.increment).toHaveBeenCalled();
    expect(mockActiveInc.decrement).toHaveBeenCalled();
  });

  it('should record request on success', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const wrapped = withApiHandler('GET', '/api/test', handler);
    await wrapped(new Request('http://localhost/api/test'));
    expect(mockRecord).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('should capture error on handler failure', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('DB fail'));
    const wrapped = withApiHandler('GET', '/api/test', handler);
    const res = await wrapped(new Request('http://localhost/api/test'));
    expect(mockCapture).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        severity: 'error',
        tags: expect.arrayContaining(['GET', '/api/test', 'api-handler']),
      }),
    );
    expect(res.status).toBe(500);
  });

  it('should include correlation ID in error response body', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('fail'));
    const wrapped = withApiHandler('GET', '/api/test', handler);
    const res = await wrapped(new Request('http://localhost/api/test'));
    expect(res.headers.get('X-Correlation-ID')).toBe('ov-test-cid');
    const body = await res.json();
    expect(body.correlationId).toBe('ov-test-cid');
  });

  it('should pass correlationId in handler context', async () => {
    let capturedCtx: { correlationId: string } | null = null;
    const handler = vi.fn((_req, ctx) => {
      capturedCtx = ctx as { correlationId: string };
      return new Response('{}');
    });
    const wrapped = withApiHandler('GET', '/api/test', handler);
    await wrapped(new Request('http://localhost/api/test'));
    expect(capturedCtx!.correlationId).toBe('ov-test-cid');
  });

  it('should decrement connections even on error', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('boom'));
    const wrapped = withApiHandler('GET', '/api/test', handler);
    await wrapped(new Request('http://localhost/api/test'));
    expect(mockActiveInc.decrement).toHaveBeenCalledTimes(1);
  });

  it('should hide error details in production', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const handler = vi.fn().mockRejectedValue(new Error('secret'));
    const wrapped = withApiHandler('GET', '/api/test', handler);
    const res = await wrapped(new Request('http://localhost/api/test'));
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
    process.env.NODE_ENV = orig;
  });

  it('should show error details in development', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const handler = vi.fn().mockRejectedValue(new Error('debug msg'));
    const wrapped = withApiHandler('GET', '/api/test', handler);
    const res = await wrapped(new Request('http://localhost/api/test'));
    const body = await res.json();
    expect(body.error).toBe('debug msg');
    process.env.NODE_ENV = orig;
  });
});
