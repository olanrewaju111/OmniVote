import { describe, it, expect } from 'vitest';
import { sanitize, validate, validateNum, validateEnum, isValidEmail, VALIDATION_RULES } from '../validate';

// ─── sanitize.str ─────────────────────────────────────────────────────────

describe('sanitize.str', () => {
  it('trims whitespace by default', () => {
    expect(sanitize.str('  hello  ')).toBe('hello');
  });

  it('does not trim when trim=false', () => {
    expect(sanitize.str('  hello  ', { trim: false })).toBe('  hello  ');
  });

  it('truncates to maxLength', () => {
    expect(sanitize.str('abcdef', { maxLength: 3 })).toBe('abc');
  });

  it('strips control characters', () => {
    expect(sanitize.str('hello\x00world')).toBe('helloworld');
  });

  it('preserves tabs and newlines', () => {
    // trim=true by default, so trailing newline is trimmed. Tab is kept.
    expect(sanitize.str('hello\tworld\n')).toBe('hello\tworld');
  });

  it('returns fallback for non-string input', () => {
    expect(sanitize.str(123, { fallback: 'default' })).toBe('default');
    expect(sanitize.str(null, { fallback: 'default' })).toBe('default');
    expect(sanitize.str(undefined, { fallback: 'default' })).toBe('default');
  });

  it('returns empty string as default fallback', () => {
    expect(sanitize.str(123)).toBe('');
  });
});

// ─── sanitize.num ─────────────────────────────────────────────────────────

describe('sanitize.num', () => {
  it('returns a number as-is within range', () => {
    expect(sanitize.num(5, { min: 0, max: 10 })).toBe(5);
  });

  it('clamps to min', () => {
    expect(sanitize.num(-5, { min: 0 })).toBe(0);
  });

  it('clamps to max', () => {
    expect(sanitize.num(15, { max: 10 })).toBe(10);
  });

  it('parses string numbers', () => {
    expect(sanitize.num('42')).toBe(42);
  });

  it('truncates when integer=true', () => {
    expect(sanitize.num(3.7, { integer: true })).toBe(3);
  });

  it('returns fallback for non-numeric input', () => {
    expect(sanitize.num('abc', { fallback: -1 })).toBe(-1);
  });

  it('returns fallback for NaN', () => {
    expect(sanitize.num(NaN, { fallback: -1 })).toBe(-1);
  });

  it('returns fallback for Infinity', () => {
    expect(sanitize.num(Infinity, { fallback: -1 })).toBe(-1);
  });
});

// ─── sanitize.bool ────────────────────────────────────────────────────────

describe('sanitize.bool', () => {
  it('returns true for boolean true', () => {
    expect(sanitize.bool(true)).toBe(true);
  });

  it('returns false for boolean false', () => {
    expect(sanitize.bool(false)).toBe(false);
  });

  it('returns true for string "true"', () => {
    expect(sanitize.bool('true')).toBe(true);
  });

  it('returns false for string "false"', () => {
    expect(sanitize.bool('false')).toBe(false);
  });

  it('returns true for number 1', () => {
    expect(sanitize.bool(1)).toBe(true);
  });

  it('returns false for number 0', () => {
    expect(sanitize.bool(0)).toBe(false);
  });

  it('returns fallback for other values', () => {
    expect(sanitize.bool('yes', true)).toBe(true);
    expect(sanitize.bool('no', false)).toBe(false);
    expect(sanitize.bool(null, true)).toBe(true);
  });
});

// ─── validate (string) ───────────────────────────────────────────────────

describe('validate', () => {
  it('returns null for valid required string', () => {
    expect(validate('hello', 'name', { required: true })).toBeNull();
  });

  it('returns error for missing required string', () => {
    const result = validate('', 'name', { required: true });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
  });

  it('returns error when minLength not met', () => {
    const result = validate('ab', 'name', { minLength: 3 });
    expect(result).not.toBeNull();
  });

  it('returns error when maxLength exceeded', () => {
    const result = validate('abcdefghij', 'name', { maxLength: 5 });
    expect(result).not.toBeNull();
  });

  it('returns null for optional empty field', () => {
    expect(validate('', 'name', { required: false })).toBeNull();
  });

  it('validates email format', () => {
    expect(validate('bad', 'email', { isEmail: true })).not.toBeNull();
    expect(validate('good@example.com', 'email', { isEmail: true })).toBeNull();
  });

  it('validates slug format', () => {
    expect(validate('Invalid Slug', 'slug', { isSlug: true })).not.toBeNull();
    expect(validate('valid-slug', 'slug', { isSlug: true })).toBeNull();
  });

  it('validates color format', () => {
    expect(validate('red', 'color', { isColor: true })).not.toBeNull();
    expect(validate('#FF0000', 'color', { isColor: true })).toBeNull();
    expect(validate('#ff0000', 'color', { isColor: true })).toBeNull();
  });

  it('validates UUID format', () => {
    expect(validate('not-a-uuid', 'id', { isUuid: true })).not.toBeNull();
    expect(validate('550e8400-e29b-41d4-a716-446655440000', 'id', { isUuid: true })).toBeNull();
  });

  it('validates custom pattern', () => {
    expect(validate('abc', 'field', { pattern: /^[0-9]+$/ })).not.toBeNull();
    expect(validate('123', 'field', { pattern: /^[0-9]+$/ })).toBeNull();
  });

  it('uses custom label in error messages', async () => {
    const result = validate('', 'name', { required: true, label: 'Agent Name' });
    const body = await result!.json();
    expect(body.error).toContain('Agent Name');
  });

  it('handles non-string input gracefully', () => {
    // null/undefined become '' after typeof check
    const result = validate(null, 'name', { required: true });
    expect(result).not.toBeNull();
  });
});

// ─── validateNum ──────────────────────────────────────────────────────────

describe('validateNum', () => {
  it('returns null for valid number', () => {
    expect(validateNum(5, 'count')).toBeNull();
  });

  it('returns error for missing required value', () => {
    const result = validateNum(undefined, 'count', { required: true });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
  });

  it('returns error for non-numeric input', () => {
    const result = validateNum('abc', 'count');
    expect(result).not.toBeNull();
  });

  it('returns error for NaN', () => {
    const result = validateNum(NaN, 'count');
    expect(result).not.toBeNull();
  });

  it('checks min bound', () => {
    expect(validateNum(-1, 'count', { min: 0 })).not.toBeNull();
    expect(validateNum(0, 'count', { min: 0 })).toBeNull();
  });

  it('checks max bound', () => {
    expect(validateNum(101, 'count', { max: 100 })).not.toBeNull();
    expect(validateNum(100, 'count', { max: 100 })).toBeNull();
  });

  it('checks integer constraint', () => {
    expect(validateNum(3.5, 'count', { integer: true })).not.toBeNull();
    expect(validateNum(3, 'count', { integer: true })).toBeNull();
  });

  it('returns null for optional undefined', () => {
    expect(validateNum(undefined, 'count')).toBeNull();
  });
});

// ─── validateEnum ─────────────────────────────────────────────────────────

describe('validateEnum', () => {
  it('returns null for valid enum value', () => {
    expect(validateEnum('active', 'status', ['active', 'inactive'])).toBeNull();
  });

  it('returns error for invalid enum value', () => {
    const result = validateEnum('pending', 'status', ['active', 'inactive']);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
  });

  it('returns error for null/undefined', () => {
    const result = validateEnum(null, 'status', ['active', 'inactive']);
    expect(result).not.toBeNull();
  });
});

// ─── isValidEmail ─────────────────────────────────────────────────────────

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@domain.co')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
  });

  it('rejects emails exceeding 254 characters', () => {
    const longLocal = 'a'.repeat(250);
    expect(isValidEmail(`${longLocal}@example.com`)).toBe(false);
  });
});

// ─── VALIDATION_RULES ─────────────────────────────────────────────────────

describe('VALIDATION_RULES', () => {
  it('has expected rule keys', () => {
    expect(VALIDATION_RULES).toHaveProperty('name');
    expect(VALIDATION_RULES).toHaveProperty('email');
    expect(VALIDATION_RULES).toHaveProperty('password');
    expect(VALIDATION_RULES).toHaveProperty('gpsLat');
    expect(VALIDATION_RULES).toHaveProperty('gpsLng');
  });
});
