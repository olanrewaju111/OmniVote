/**
 * Enhanced input validation beyond basic sanitize.ts.
 * Provides strict validation for emails, passwords, URLs, JSON depth,
 * phone numbers, IDs, and object sanitization.
 */

import { stripHtml } from '../sanitize';

// ─── Types ───────────────────────────────────────────────────────────────

type PasswordStrength = 'weak' | 'fair' | 'strong' | 'very-strong';

// ─── Email ───────────────────────────────────────────────────────────────

/**
 * Strict RFC 5322-ish email validation.
 * Rejects obviously invalid formats, checks length, domain structure.
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmed = email.trim();

  // Basic structure check
  // Allows: local-part@domain.tld
  // Local part: alphanumeric, dots, hyphens, underscores, plus signs
  // Domain: alphanumeric, hyphens, dots, with at least one TLD
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Length constraints (RFC 5321)
  const [localPart, domain] = trimmed.split('@');
  if (!localPart || !domain) {
    return { valid: false, error: 'Invalid email format' };
  }
  if (localPart.length > 64) {
    return { valid: false, error: 'Email local part exceeds 64 characters' };
  }
  if (domain.length > 255) {
    return { valid: false, error: 'Email domain exceeds 255 characters' };
  }
  if (trimmed.length > 320) {
    return { valid: false, error: 'Email exceeds 320 characters' };
  }

  // Check for consecutive dots
  if (localPart.includes('..') || domain.includes('..')) {
    return { valid: false, error: 'Email contains invalid consecutive dots' };
  }

  // Domain must have at least one dot (and TLD of 2+ chars)
  const domainParts = domain.split('.');
  if (domainParts.length < 2) {
    return { valid: false, error: 'Email domain must have a TLD' };
  }
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2) {
    return { valid: false, error: 'Email TLD must be at least 2 characters' };
  }

  return { valid: true };
}

// ─── Password ────────────────────────────────────────────────────────────

/**
 * Validate password strength.
 * Min 10 chars, requires uppercase, lowercase, number, special char.
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
  strength: PasswordStrength;
} {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'], strength: 'weak' };
  }

  if (password.length < 10) {
    errors.push('Password must be at least 10 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Common weak patterns
  if (/^(123456|password|qwerty|abc123|letmein|admin|welcome)/i.test(password)) {
    errors.push('Password is too common');
  }

  // Calculate strength
  let strength: PasswordStrength = 'weak';
  if (errors.length === 0) {
    // No errors = valid, calculate strength level
    let score = 0;
    if (password.length >= 10) score++;
    if (password.length >= 14) score++;
    if (password.length >= 20) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    // Variety bonus
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) score++;

    if (score >= 7) strength = 'very-strong';
    else if (score >= 5) strength = 'strong';
    else strength = 'fair';
  }

  return {
    valid: errors.length === 0,
    errors,
    strength,
  };
}

// ─── URL ─────────────────────────────────────────────────────────────────

/**
 * Validate and sanitize a URL.
 * Only http: and https: protocols are allowed.
 */
export function validateUrl(url: string): { valid: boolean; sanitized: string; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, sanitized: '', error: 'URL is required' };
  }

  const trimmed = url.trim();

  // Block javascript: protocol and other dangerous schemes
  if (/^\s*(javascript|data|vbscript|mhtml|x-javascript)\s*:/i.test(trimmed)) {
    return { valid: false, sanitized: '', error: 'Dangerous URL protocol detected' };
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, sanitized: '', error: `URL protocol '${parsed.protocol}' is not allowed. Only http and https are permitted.` };
    }

    // Sanitize: rebuild URL from parsed components (removes auth, fragments abuse)
    const sanitized = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;

    return { valid: true, sanitized };
  } catch {
    return { valid: false, sanitized: '', error: 'Invalid URL format' };
  }
}

// ─── JSON Depth ──────────────────────────────────────────────────────────

/**
 * Recursively check the nesting depth of a parsed JSON object.
 * Prevents JSON depth attacks (stack overflow via deeply nested objects).
 */
export function validateJsonDepth(
  obj: unknown,
  maxDepth: number = 10,
): { valid: boolean; error?: string } {
  function checkDepth(value: unknown, currentDepth: number): boolean {
    if (currentDepth > maxDepth) return false;

    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.every(item => checkDepth(item, currentDepth + 1));
      }
      return Object.values(value as Record<string, unknown>).every(
        v => checkDepth(v, currentDepth + 1),
      );
    }
    return true;
  }

  if (checkDepth(obj, 1)) {
    return { valid: true };
  }

  return { valid: false, error: `JSON object exceeds maximum allowed depth of ${maxDepth}` };
}

// ─── Phone Number ────────────────────────────────────────────────────────

/**
 * Validate and sanitize a Nigerian phone number.
 * Accepts formats: +234XXXXXXXXXX, 234XXXXXXXXXX, 0XXXXXXXXXX
 * Normalizes to +234XXXXXXXXXX format.
 */
export function validatePhoneNumber(phone: string): { valid: boolean; sanitized: string } {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, sanitized: '' };
  }

  // Strip all non-digit characters except leading +
  const cleaned = phone.trim().replace(/[^+\d]/g, '');

  let digits: string;
  if (cleaned.startsWith('+234')) {
    digits = cleaned.slice(1); // Remove +, keep 234...
  } else if (cleaned.startsWith('234')) {
    digits = cleaned;
  } else if (cleaned.startsWith('0')) {
    digits = '234' + cleaned.slice(1);
  } else {
    return { valid: false, sanitized: '' };
  }

  // Nigerian numbers: 234 + 10 digits (e.g., 2348012345678)
  const nigerianRegex = /^234[789]\d{9}$/;
  if (!nigerianRegex.test(digits)) {
    return { valid: false, sanitized: '' };
  }

  return { valid: true, sanitized: '+' + digits };
}

// ─── ID Validation ───────────────────────────────────────────────────────

/**
 * Validate an ID string as UUID v4 or CUID format.
 */
export function validateId(id: string): { valid: boolean; error?: string } {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'ID is required' };
  }

  const trimmed = id.trim();

  // UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) {
    return { valid: true };
  }

  // CUID: starts with 'c' followed by alphanumeric, min 7 chars
  // Also supports CUID2: starts with alphanumeric, min 7 chars
  const cuidRegex = /^c[a-z0-9]{6,}$/i;
  if (cuidRegex.test(trimmed)) {
    return { valid: true };
  }

  // NanoID: 21 chars, URL-safe base64
  const nanoIdRegex = /^[A-Za-z0-9_-]{21}$/;
  if (nanoIdRegex.test(trimmed)) {
    return { valid: true };
  }

  return { valid: false, error: 'ID must be a valid UUID, CUID, or NanoID' };
}

// ─── Object Sanitization ─────────────────────────────────────────────────

/**
 * Sanitize an object by whitelisting allowed keys.
 * Optionally strips unknown keys, sanitizes string values, and enforces max lengths.
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  allowedKeys: string[],
  options?: {
    stripUnknown?: boolean;
    sanitizeStrings?: boolean;
    maxLengths?: Record<string, number>;
  },
): T {
  const {
    stripUnknown = true,
    sanitizeStrings = true,
    maxLengths = {},
  } = options || {};

  const result = {} as Record<string, unknown>;
  const allowedSet = new Set(allowedKeys);

  for (const [key, value] of Object.entries(obj)) {
    if (!allowedSet.has(key)) {
      if (stripUnknown) continue;
      // If not stripping, keep but don't sanitize
      result[key] = value;
      continue;
    }

    let processedValue: unknown = value;

    if (sanitizeStrings && typeof value === 'string') {
      processedValue = stripHtml(value.trim());
      const maxLen = maxLengths[key];
      if (maxLen !== undefined && typeof processedValue === 'string') {
        processedValue = processedValue.substring(0, maxLen);
      }
    }

    result[key] = processedValue;
  }

  return result as T;
}
