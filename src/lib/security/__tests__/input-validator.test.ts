import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateUrl,
  validateJsonDepth,
  validatePhoneNumber,
  validateId,
  sanitizeObject,
} from '../input-validator';

describe('Enhanced Input Validation', () => {
  // ─── Email ─────────────────────────────────────────────────────────────
  describe('validateEmail', () => {
    it('should accept valid emails', () => {
      expect(validateEmail('user@example.com').valid).toBe(true);
      expect(validateEmail('user.name+tag@domain.co.uk').valid).toBe(true);
      expect(validateEmail('admin@omnivote.ng').valid).toBe(true);
    });

    it('should reject empty email', () => {
      const result = validateEmail('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject missing @', () => {
      expect(validateEmail('userexample.com').valid).toBe(false);
    });

    it('should reject missing domain', () => {
      expect(validateEmail('user@').valid).toBe(false);
    });

    it('should reject single-char TLD', () => {
      expect(validateEmail('user@domain.x').valid).toBe(false);
    });

    it('should reject consecutive dots in local part', () => {
      expect(validateEmail('user..name@domain.com').valid).toBe(false);
    });

    it('should reject overly long local part (>64 chars)', () => {
      const longLocal = 'a'.repeat(65) + '@domain.com';
      expect(validateEmail(longLocal).valid).toBe(false);
    });

    it('should reject null', () => {
      expect(validateEmail(null as unknown as string).valid).toBe(false);
    });
  });

  // ─── Password ──────────────────────────────────────────────────────────
  describe('validatePassword', () => {
    it('should reject empty password', () => {
      const result = validatePassword('');
      expect(result.valid).toBe(false);
      expect(result.strength).toBe('weak');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject password shorter than 10 chars', () => {
      const result = validatePassword('Ab1!xyz');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 10 characters');
    });

    it('should reject password without uppercase', () => {
      const result = validatePassword('abcdefgh1!');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
    });

    it('should reject password without lowercase', () => {
      const result = validatePassword('ABCDEFGHI1!');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
    });

    it('should reject password without number', () => {
      const result = validatePassword('Abcdefghi!');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('number'))).toBe(true);
    });

    it('should reject password without special char', () => {
      const result = validatePassword('Abcdefghi1');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('special'))).toBe(true);
    });

    it('should accept valid password', () => {
      const result = validatePassword('StrongP@ss1');
      expect(result.valid).toBe(true);
      expect(['fair', 'strong', 'very-strong']).toContain(result.strength);
    });

    it('should reject common passwords', () => {
      const result = validatePassword('Password1!abc');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password is too common');
    });

    it('should rate very strong passwords', () => {
      const result = validatePassword('MyV3ryStr0ng&P@ssw0rd!2024x');
      expect(result.valid).toBe(true);
      expect(result.strength).toBe('very-strong');
    });
  });

  // ─── URL ──────────────────────────────────────────────────────────────
  describe('validateUrl', () => {
    it('should accept valid http URL', () => {
      const result = validateUrl('http://example.com/path');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toContain('http://example.com');
    });

    it('should accept valid https URL', () => {
      const result = validateUrl('https://example.com/path?q=1');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toContain('https://example.com');
    });

    it('should reject javascript: protocol', () => {
      const result = validateUrl('javascript:alert(1)');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Dangerous');
    });

    it('should reject data: protocol', () => {
      const result = validateUrl('data:text/html,<script>');
      expect(result.valid).toBe(false);
    });

    it('should reject vbscript: protocol', () => {
      const result = validateUrl('vbscript:msgbox');
      expect(result.valid).toBe(false);
    });

    it('should reject ftp: protocol', () => {
      const result = validateUrl('ftp://files.example.com');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should reject invalid URL', () => {
      const result = validateUrl('not a url');
      expect(result.valid).toBe(false);
    });

    it('should sanitize by removing auth and fragment', () => {
      const result = validateUrl('https://user:pass@example.com/path#frag');
      expect(result.valid).toBe(true);
      expect(result.sanitized).not.toContain('user:pass');
      expect(result.sanitized).not.toContain('#frag');
    });

    it('should reject empty URL', () => {
      const result = validateUrl('');
      expect(result.valid).toBe(false);
    });
  });

  // ─── JSON Depth ───────────────────────────────────────────────────────
  describe('validateJsonDepth', () => {
    it('should accept flat object', () => {
      expect(validateJsonDepth({ a: 1 }).valid).toBe(true);
    });

    it('should accept nested object within limit', () => {
      const nested = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: 1 } } } } } } } } } };
      expect(validateJsonDepth(nested, 11).valid).toBe(true);
    });

    it('should reject object exceeding default max depth (10)', () => {
      // Create 11-level deep object
      let obj: unknown = { value: 1 };
      for (let i = 0; i < 10; i++) {
        obj = { nested: obj };
      }
      const result = validateJsonDepth(obj);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('maximum allowed depth');
    });

    it('should reject array exceeding max depth', () => {
      let arr: unknown = [1];
      for (let i = 0; i < 10; i++) {
        arr = [arr];
      }
      const result = validateJsonDepth(arr, 10);
      expect(result.valid).toBe(false);
    });

    it('should accept with custom max depth', () => {
      let obj: unknown = { value: 1 };
      for (let i = 0; i < 10; i++) {
        obj = { nested: obj };
      }
      expect(validateJsonDepth(obj, 20).valid).toBe(true);
    });

    it('should accept primitive values', () => {
      expect(validateJsonDepth('string').valid).toBe(true);
      expect(validateJsonDepth(42).valid).toBe(true);
      expect(validateJsonDepth(null).valid).toBe(true);
      expect(validateJsonDepth(true).valid).toBe(true);
    });
  });

  // ─── Phone Number ─────────────────────────────────────────────────────
  describe('validatePhoneNumber', () => {
    it('should accept +234 format', () => {
      const result = validatePhoneNumber('+2348012345678');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('+2348012345678');
    });

    it('should accept 234 format (no +)', () => {
      const result = validatePhoneNumber('2348012345678');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('+2348012345678');
    });

    it('should accept 0xxx format', () => {
      const result = validatePhoneNumber('08012345678');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('+2348012345678');
    });

    it('should accept numbers starting with 7, 8, or 9', () => {
      expect(validatePhoneNumber('07012345678').valid).toBe(true);
      expect(validatePhoneNumber('09012345678').valid).toBe(true);
      expect(validatePhoneNumber('08012345678').valid).toBe(true);
    });

    it('should reject non-Nigerian numbers', () => {
      expect(validatePhoneNumber('+1234567890').valid).toBe(false);
    });

    it('should reject short numbers', () => {
      expect(validatePhoneNumber('0801').valid).toBe(false);
    });

    it('should strip formatting characters', () => {
      const result = validatePhoneNumber('+234 801 234 5678');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('+2348012345678');
    });

    it('should reject empty/null', () => {
      expect(validatePhoneNumber('').valid).toBe(false);
      expect(validatePhoneNumber(null as unknown as string).valid).toBe(false);
    });
  });

  // ─── ID Validation ────────────────────────────────────────────────────
  describe('validateId', () => {
    it('should accept UUID v4', () => {
      const result = validateId('550e8400-e29b-41d4-a716-446655440000');
      expect(result.valid).toBe(true);
    });

    it('should accept UUID with uppercase', () => {
      const result = validateId('550E8400-E29B-41D4-A716-446655440000');
      expect(result.valid).toBe(true);
    });

    it('should reject non-v4 UUID (version 1)', () => {
      const result = validateId('550e8400-e29b-11d4-a716-446655440000');
      expect(result.valid).toBe(false);
    });

    it('should accept CUID format', () => {
      const result = validateId('clh12abc30000000000000000');
      expect(result.valid).toBe(true);
    });

    it('should accept NanoID format (21 chars)', () => {
      const result = validateId('V1StGXR8_Z5jdHi6B-myT');
      expect(result.valid).toBe(true);
    });

    it('should reject random string', () => {
      const result = validateId('not-an-id');
      expect(result.valid).toBe(false);
    });

    it('should reject empty string', () => {
      const result = validateId('');
      expect(result.valid).toBe(false);
    });
  });

  // ─── Object Sanitization ──────────────────────────────────────────────
  describe('sanitizeObject', () => {
    it('should strip unknown keys by default', () => {
      const obj = { name: 'John', role: 'ADMIN', evil: '<script>' };
      const result = sanitizeObject(obj, ['name', 'role']);
      expect(result).toEqual({ name: 'John', role: 'ADMIN' });
      expect('evil' in result).toBe(false);
    });

    it('should sanitize string values by default', () => {
      const obj = { title: '<b>Hello</b>' };
      const result = sanitizeObject(obj, ['title']);
      expect(result.title).toBe('Hello');
    });

    it('should enforce max lengths when provided', () => {
      const obj = { bio: 'a very long bio text that goes on and on' };
      const result = sanitizeObject(obj, ['bio'], {
        maxLengths: { bio: 10 },
      });
      expect(result.bio.length).toBeLessThanOrEqual(10);
    });

    it('should keep unknown keys when stripUnknown is false', () => {
      const obj = { name: 'John', extra: 'data' };
      const result = sanitizeObject(obj, ['name'], { stripUnknown: false });
      expect(result.name).toBe('John');
      expect(result.extra).toBe('data');
    });

    it('should not sanitize strings when sanitizeStrings is false', () => {
      const obj = { html: '<b>bold</b>' };
      const result = sanitizeObject(obj, ['html'], { sanitizeStrings: false });
      expect(result.html).toBe('<b>bold</b>');
    });

    it('should handle empty object', () => {
      const result = sanitizeObject({}, ['name']);
      expect(result).toEqual({});
    });
  });
});
