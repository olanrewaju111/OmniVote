/**
 * TOTP (Time-based One-Time Password) utilities for OmniVote 2FA.
 * Implements RFC 6238 using HMAC-SHA1 with 30-second steps.
 */

import crypto from 'crypto';

/** Generate a 32-char Base32 secret */
export function generateSecret(): string {
  const bytes = crypto.randomBytes(20);
  return base32Encode(bytes).slice(0, 32);
}

/** Generate a 6-digit TOTP code from a base32 secret */
export function generateTOTP(secret: string): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 30000);
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(Buffer.from(counter.toString(16).padStart(16, '0'), 'hex'));
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 1000000).toString().padStart(6, '0');
}

/** Verify a TOTP code against a secret (±1 step window) */
export function verifyTOTP(secret: string, code: string): boolean {
  const normalized = code.replace(/\s/g, '');
  const key = base32Decode(secret);
  const now = Math.floor(Date.now() / 30000);
  for (let delta = -1; delta <= 1; delta++) {
    const counter = now + delta;
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(Buffer.from(counter.toString(16).padStart(16, '0'), 'hex'));
    const digest = hmac.digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);
    const otp = (binary % 1000000).toString().padStart(6, '0');
    if (otp === normalized) return true;
  }
  return false;
}

/** Generate otpauth:// URI for QR code scanning */
export function generateOTPAuthURI(email: string, secret: string): string {
  const params = new URLSearchParams({
    secret,
    issuer: 'OmniVote',
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/OmniVote:${encodeURIComponent(email)}?${params.toString()}`;
}

// ─── Internal Base32 helpers ────────────────────────────────────────────────

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = '';
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }
  let result = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    result += BASE32_CHARS[parseInt(bits.slice(i, i + 5), 2)];
  }
  return result;
}

function base32Decode(str: string): Buffer {
  let bits = '';
  for (const char of str.toUpperCase()) {
    const val = BASE32_CHARS.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}
