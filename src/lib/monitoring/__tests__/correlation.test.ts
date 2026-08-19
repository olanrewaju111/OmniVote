import { describe, it, expect } from 'vitest';
import { generateCorrelationId, getCorrelationIdFromRequest, withCorrelationId } from '../correlation';

describe('correlation', () => {
  describe('generateCorrelationId', () => {
    it('generates a string starting with ov-', () => {
      const id = generateCorrelationId();
      expect(id).toMatch(/^ov-/);
    });

    it('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 50 }, () => generateCorrelationId()));
      expect(ids.size).toBe(50);
    });
  });

  describe('getCorrelationIdFromRequest', () => {
    it('reads from X-Correlation-ID header', () => {
      const req = new Request('http://localhost', {
        headers: { 'X-Correlation-ID': 'ov-test-123' },
      });
      expect(getCorrelationIdFromRequest(req)).toBe('ov-test-123');
    });

    it('falls back to X-Request-ID header', () => {
      const req = new Request('http://localhost', {
        headers: { 'X-Request-ID': 'req-456' },
      });
      expect(getCorrelationIdFromRequest(req)).toBe('req-456');
    });

    it('prefers X-Correlation-ID over X-Request-ID', () => {
      const req = new Request('http://localhost', {
        headers: {
          'X-Correlation-ID': 'ov-pref',
          'X-Request-ID': 'req-other',
        },
      });
      expect(getCorrelationIdFromRequest(req)).toBe('ov-pref');
    });

    it('returns null when no correlation headers present', () => {
      const req = new Request('http://localhost');
      expect(getCorrelationIdFromRequest(req)).toBeNull();
    });
  });

  describe('withCorrelationId', () => {
    it('returns headers with X-Correlation-ID', () => {
      const req = new Request('http://localhost');
      const headers = withCorrelationId(req, 'ov-my-id');
      expect(headers['X-Correlation-ID']).toBe('ov-my-id');
    });
  });
});
