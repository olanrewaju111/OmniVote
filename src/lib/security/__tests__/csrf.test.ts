import { describe, it, expect, beforeEach } from 'vitest';
import { generateCsrfToken, validateCsrfToken, CsrfError, CSRF_COOKIE_NAME } from '../csrf';

describe('CSRF Protection', () => {
  describe('generateCsrfToken', () => {
    it('should return a 64-char hex token', () => {
      const { token } = generateCsrfToken();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it('should return a Set-Cookie header string', () => {
      const { cookieHeader, token } = generateCsrfToken();
      expect(cookieHeader).toContain(`${CSRF_COOKIE_NAME}=${token}`);
      expect(cookieHeader).toContain('SameSite=Strict');
      expect(cookieHeader).toContain('Path=/');
    });

    it('should generate unique tokens on each call', () => {
      const tokens = new Set(Array.from({ length: 20 }, () => generateCsrfToken().token));
      expect(tokens.size).toBe(20);
    });

    it('should include Secure in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const { cookieHeader } = generateCsrfToken();
      expect(cookieHeader).toContain('Secure');
      process.env.NODE_ENV = originalEnv;
    });

    it('should not include Secure in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const { cookieHeader } = generateCsrfToken();
      expect(cookieHeader).not.toContain('Secure');
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('validateCsrfToken', () => {
    it('should validate matching token from cookie', () => {
      const { token, cookieHeader } = generateCsrfToken();
      const req = new Request('http://localhost/api/test', {
        headers: { cookie: cookieHeader },
      });
      expect(validateCsrfToken(req, token)).toBe(true);
    });

    it('should reject mismatched token', () => {
      const { token, cookieHeader } = generateCsrfToken();
      const { token: wrongToken } = generateCsrfToken();
      const req = new Request('http://localhost/api/test', {
        headers: { cookie: cookieHeader },
      });
      expect(validateCsrfToken(req, wrongToken)).toBe(false);
    });

    it('should reject when no CSRF cookie exists', () => {
      const { token } = generateCsrfToken();
      const req = new Request('http://localhost/api/test', {
        headers: { cookie: 'other=value' },
      });
      expect(validateCsrfToken(req, token)).toBe(false);
    });

    it('should reject empty token', () => {
      const { cookieHeader } = generateCsrfToken();
      const req = new Request('http://localhost/api/test', {
        headers: { cookie: cookieHeader },
      });
      expect(validateCsrfToken(req, '')).toBe(false);
    });

    it('should reject token of different length', () => {
      const { cookieHeader } = generateCsrfToken();
      const req = new Request('http://localhost/api/test', {
        headers: { cookie: cookieHeader },
      });
      expect(validateCsrfToken(req, 'abcdef')).toBe(false);
    });

    it('should extract CSRF cookie from multiple cookies', () => {
      const { token, cookieHeader } = generateCsrfToken();
      const fullCookie = `session=abc; ${cookieHeader}; other=xyz`;
      const req = new Request('http://localhost/api/test', {
        headers: { cookie: fullCookie },
      });
      expect(validateCsrfToken(req, token)).toBe(true);
    });
  });

  describe('CsrfError', () => {
    it('should be an instance of Error', () => {
      const err = new CsrfError('test');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(CsrfError);
      expect(err.name).toBe('CsrfError');
      expect(err.message).toBe('test');
    });
  });
});
