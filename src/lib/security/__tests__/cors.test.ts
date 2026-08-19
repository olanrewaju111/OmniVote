import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCorsHeaders, isOriginAllowed, _resetOriginCache } from '../cors';

describe('CORS Configuration', () => {
  beforeEach(() => {
    _resetOriginCache();
  });

  describe('isOriginAllowed', () => {
    it('should return false when no origins are configured', () => {
      const originalEnv = process.env.ALLOWED_ORIGINS;
      delete process.env.ALLOWED_ORIGINS;
      _resetOriginCache();
      expect(isOriginAllowed('https://example.com')).toBe(false);
      process.env.ALLOWED_ORIGINS = originalEnv;
    });

    it('should return true for configured origin', () => {
      process.env.ALLOWED_ORIGINS = 'https://app.omnivote.ng,https://admin.omnivote.ng';
      _resetOriginCache();
      expect(isOriginAllowed('https://app.omnivote.ng')).toBe(true);
      expect(isOriginAllowed('https://admin.omnivote.ng')).toBe(true);
    });

    it('should return false for non-configured origin', () => {
      process.env.ALLOWED_ORIGINS = 'https://app.omnivote.ng';
      _resetOriginCache();
      expect(isOriginAllowed('https://evil.com')).toBe(false);
    });

    it('should handle trailing/leading whitespace in env var', () => {
      process.env.ALLOWED_ORIGINS = '  https://app.omnivote.ng , https://admin.omnivote.ng  ';
      _resetOriginCache();
      expect(isOriginAllowed('https://app.omnivote.ng')).toBe(true);
      expect(isOriginAllowed('https://admin.omnivote.ng')).toBe(true);
    });

    it('should handle empty entries in env var', () => {
      process.env.ALLOWED_ORIGINS = 'https://app.omnivote.ng,,https://admin.omnivote.ng';
      _resetOriginCache();
      expect(isOriginAllowed('https://app.omnivote.ng')).toBe(true);
      expect(isOriginAllowed('https://admin.omnivote.ng')).toBe(true);
    });
  });

  describe('getCorsHeaders', () => {
    it('should return empty headers for null origin', () => {
      expect(getCorsHeaders(null)).toEqual({});
    });

    it('should return empty headers for disallowed origin', () => {
      delete process.env.ALLOWED_ORIGINS;
      _resetOriginCache();
      expect(getCorsHeaders('https://evil.com')).toEqual({});
    });

    it('should return full CORS headers for allowed origin', () => {
      process.env.ALLOWED_ORIGINS = 'https://app.omnivote.ng';
      _resetOriginCache();
      const headers = getCorsHeaders('https://app.omnivote.ng');

      expect(headers['Access-Control-Allow-Origin']).toBe('https://app.omnivote.ng');
      expect(headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(headers['Access-Control-Allow-Methods']).toContain('POST');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
      expect(headers['Access-Control-Max-Age']).toBe('86400');
    });

    it('should include X-CSRF-Token in allowed headers', () => {
      process.env.ALLOWED_ORIGINS = 'https://app.omnivote.ng';
      _resetOriginCache();
      const headers = getCorsHeaders('https://app.omnivote.ng');
      expect(headers['Access-Control-Allow-Headers']).toContain('X-CSRF-Token');
    });
  });
});
