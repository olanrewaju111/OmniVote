/**
 * Shared input validation and sanitization utilities for API routes.
 *
 * Usage:
 *   import { sanitize, validate, isValidEmail, VALIDATION_RULES } from '@/lib/validate';
 *
 *   const name = sanitize.str(body.name, { maxLength: 100, trim: true });
 *   const err = validate.str(name, 'name', { required: true, maxLength: 100 });
 *   if (err) return err;
 */

import { NextResponse } from 'next/server';

// ─── Pre-defined validation rules ────────────────────────────────────────

export const VALIDATION_RULES = {
  /** Standard name field */
  name: { maxLength: 100, required: true, trim: true },
  /** Email field */
  email: { maxLength: 254, required: true, trim: true, isEmail: true },
  /** Short description / title */
  title: { maxLength: 200, required: true, trim: true },
  /** Standard description / body text */
  description: { maxLength: 5000, trim: true },
  /** Long-form notes / comments */
  notes: { maxLength: 10000, trim: true },
  /** Subject line */
  subject: { maxLength: 200, required: true, trim: true },
  /** Message body */
  body: { maxLength: 10000, required: true, trim: true },
  /** Slug (URL-safe identifier) */
  slug: { maxLength: 50, required: true, trim: true, isSlug: true },
  /** Phone number */
  phone: { maxLength: 20, trim: true },
  /** Color hex */
  color: { maxLength: 7, trim: true, isColor: true },
  /** State name */
  state: { maxLength: 100, required: true, trim: true },
  /** LGA name */
  lga: { maxLength: 100, trim: true },
  /** Incident description */
  incidentDescription: { maxLength: 5000, required: true, trim: true },
  /** Password */
  password: { maxLength: 128, required: true },
  /** GPS coordinate */
  gpsLat: { min: -90, max: 90, isNumber: true },
  gpsLng: { min: -180, max: 180, isNumber: true },
} as const;

// ─── Sanitize helpers ────────────────────────────────────────────────────

export const sanitize = {
  /**
   * Sanitize a string value: trim, limit length, strip control characters.
   * Returns the sanitized string, or the fallback if input is not a string.
   */
  str(value: unknown, opts: { maxLength?: number; trim?: boolean; fallback?: string } = {}): string {
    const { maxLength = 10000, trim = true, fallback = '' } = opts;

    if (typeof value !== 'string') return fallback;

    let result = value;
    if (trim) result = result.trim();

    // Strip control characters (except tab, newline, carriage return)
    result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Truncate to maxLength
    if (result.length > maxLength) {
      result = result.substring(0, maxLength);
    }

    return result;
  },

  /**
   * Sanitize a numeric value, clamping to min/max range.
   * Returns the number, or the fallback if input is not a valid number.
   */
  num(value: unknown, opts: { min?: number; max?: number; fallback?: number; integer?: boolean } = {}): number {
    const { min = -Infinity, max = Infinity, fallback = 0, integer = false } = opts;

    let num: number;
    if (typeof value === 'number') {
      num = value;
    } else if (typeof value === 'string') {
      num = Number(value);
    } else {
      return fallback;
    }

    if (!Number.isFinite(num)) return fallback;
    if (integer) num = Math.trunc(num);
    return Math.min(max, Math.max(min, num));
  },

  /**
   * Sanitize a boolean value.
   */
  bool(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1) return true;
    if (value === 'false' || value === 0) return false;
    return fallback;
  },
};

// ─── Validation helpers ──────────────────────────────────────────────────

interface StrOpts {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  isEmail?: boolean;
  isSlug?: boolean;
  isColor?: boolean;
  isUuid?: boolean;
  pattern?: RegExp;
  label?: string; // Human-readable field name for error messages
}

/**
 * Validate a string value. Returns a NextResponse error if validation fails,
 * or null if the value passes.
 *
 * @example
 * const err = validate.str(body.name, 'name', { required: true, maxLength: 100, label: 'Agent name' });
 * if (err) return err;
 */
export function validate(
  value: unknown,
  fieldName: string,
  opts: StrOpts = {},
): NextResponse | null {
  const {
    required = false,
    minLength = 0,
    maxLength = 10000,
    isEmail = false,
    isSlug = false,
    isColor = false,
    isUuid = false,
    pattern,
    label = fieldName,
  } = opts;

  const str = typeof value === 'string' ? value.trim() : '';

  if (required && !str) {
    return NextResponse.json(
      { error: `${label} is required` },
      { status: 400 },
    );
  }

  if (!str && !required) return null; // Optional empty field is OK

  if (str.length < minLength) {
    return NextResponse.json(
      { error: `${label} must be at least ${minLength} characters` },
      { status: 400 },
    );
  }

  if (str.length > maxLength) {
    return NextResponse.json(
      { error: `${label} must be at most ${maxLength} characters` },
      { status: 400 },
    );
  }

  if (isEmail && !isValidEmail(str)) {
    return NextResponse.json(
      { error: `${label} must be a valid email address` },
      { status: 400 },
    );
  }

  if (isSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(str)) {
    return NextResponse.json(
      { error: `${label} must be a valid slug (lowercase, hyphens only)` },
      { status: 400 },
    );
  }

  if (isColor && !/^#[0-9A-Fa-f]{6}$/.test(str)) {
    return NextResponse.json(
      { error: `${label} must be a valid hex color (e.g., #FF0000)` },
      { status: 400 },
    );
  }

  if (isUuid && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return NextResponse.json(
      { error: `${label} must be a valid UUID` },
      { status: 400 },
    );
  }

  if (pattern && !pattern.test(str)) {
    return NextResponse.json(
      { error: `${label} has an invalid format` },
      { status: 400 },
    );
  }

  return null;
}

/**
 * Validate a numeric value. Returns a NextResponse error if validation fails,
 * or null if the value passes.
 */
export function validateNum(
  value: unknown,
  fieldName: string,
  opts: { required?: boolean; min?: number; max?: number; integer?: boolean; label?: string } = {},
): NextResponse | null {
  const { required = false, min = -Infinity, max = Infinity, integer = false, label = fieldName } = opts;

  if (value === undefined || value === null) {
    if (required) return NextResponse.json({ error: `${label} is required` }, { status: 400 });
    return null;
  }

  let num: number;
  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    num = Number(value);
  } else {
    return NextResponse.json({ error: `${label} must be a number` }, { status: 400 });
  }

  if (!Number.isFinite(num)) {
    return NextResponse.json({ error: `${label} must be a valid number` }, { status: 400 });
  }

  if (integer && !Number.isInteger(num)) {
    return NextResponse.json({ error: `${label} must be a whole number` }, { status: 400 });
  }

  if (num < min) {
    return NextResponse.json({ error: `${label} must be at least ${min}` }, { status: 400 });
  }

  if (num > max) {
    return NextResponse.json({ error: `${label} must be at most ${max}` }, { status: 400 });
  }

  return null;
}

/**
 * Validate that a value is one of a set of allowed values.
 */
export function validateEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowed: readonly T[],
  label?: string,
): NextResponse | null {
  if (!value || !allowed.includes(value as T)) {
    return NextResponse.json(
      { error: `${label || fieldName} must be one of: ${allowed.join(', ')}` },
      { status: 400 },
    );
  }
  return null;
}

// ─── Email validation ────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Basic email validation — checks format only, not deliverability.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 254;
}