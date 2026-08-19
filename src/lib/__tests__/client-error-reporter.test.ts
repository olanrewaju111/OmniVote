/**
 * Tests for Phase 15 — Client Error Reporter
 *
 * Tests the fire-and-forget error reporting bridge.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { reportClientError, reportBoundaryError } from '@/lib/client-error-reporter';

describe('reportClientError', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should POST to /api/metrics with client-error type', () => {
    reportClientError({
      message: 'Test error',
      stack: 'at Component (app.tsx:10)',
      severity: 'error',
      tags: ['test'],
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/metrics');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.type).toBe('client-error');
    expect(body.message).toBe('Test error');
    expect(body.stack).toBe('at Component (app.tsx:10)');
    expect(body.severity).toBe('error');
    expect(body.tags).toEqual(['test']);
    expect(body.timestamp).toBeDefined();
  });

  it('should silently ignore fetch errors', () => {
    fetchSpy.mockRejectedValue(new Error('network error'));
    expect(() => reportClientError({ message: 'test' })).not.toThrow();
  });

  it('should default severity to error if not provided', () => {
    reportClientError({ message: 'test' });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.severity).toBeUndefined();
  });
});

describe('reportBoundaryError', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract error message and stack', () => {
    const error = new Error('render failed');
    const errorInfo = { componentStack: 'at App\n  at render' };

    reportBoundaryError(error, errorInfo as React.ErrorInfo, 'MyComponent');

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.message).toBe('render failed');
    expect(body.stack).toBe(error.stack);
    expect(body.componentStack).toBe('at App\n  at render');
    expect(body.tags).toEqual(['error-boundary', 'MyComponent']);
  });

  it('should tag as error-boundary without component name', () => {
    reportBoundaryError(new Error('fail'));
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.tags).toEqual(['error-boundary']);
  });

  it('should include route from window.location', () => {
    reportBoundaryError(new Error('fail'));
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.route).toBeDefined();
  });
});
