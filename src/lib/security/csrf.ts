/**
 * CSRF Protection using the Double-Submit Cookie pattern.
 *
 * A random token is set in a non-httpOnly cookie (readable by JS for XHR/fetch)
 * and also returned to the client. The client must submit this token in a
 * custom header (e.g. x-csrf-token) with every mutating request. The server
 * then compares the cookie value with the header value — if they don't match,
 * the request is rejected.
 */

import { randomBytes } from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────

export class CsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsrfError';
  }
}

// ─── Constants ────────────────────────────────────────────────────────────

const CSRF_COOKIE_NAME = 'omnivote-csrf';
const CSRF_TOKEN_BYTE_LENGTH = 32; // 32 bytes → 64 hex chars

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Generate a crypto-random CSRF token (64 hex characters).
 */
function generateToken(): string {
  return randomBytes(CSRF_TOKEN_BYTE_LENGTH).toString('hex');
}

/**
 * Extract the CSRF cookie value from a Request's Cookie header.
 */
function extractCsrfCookie(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? match[1] : null;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Generate a new CSRF token and return the Set-Cookie header value
 * along with the token string.
 *
 * The cookie is non-httpOnly so client-side JS can read it via document.cookie
 * and attach it to requests as a header.
 */
export function generateCsrfToken(): {
  token: string;
  cookieHeader: string;
} {
  const token = generateToken();
  const isProduction = process.env.NODE_ENV === 'production';

  const cookieParts = [
    `${CSRF_COOKIE_NAME}=${token}`,
    'Path=/',
    'SameSite=Strict',
    isProduction ? 'Secure' : '',
    'HttpOnly=false',
  ].filter(Boolean);

  return {
    token,
    cookieHeader: cookieParts.join('; '),
  };
}

/**
 * Validate a CSRF token submitted by the client against the CSRF cookie.
 *
 * @param req - The incoming request (to read the cookie from)
 * @param token - The CSRF token submitted in the request body/header
 * @returns true if the cookie token matches the submitted token
 */
export function validateCsrfToken(req: Request, token: string): boolean {
  if (!token || typeof token !== 'string') return false;

  const cookieToken = extractCsrfCookie(req);
  if (!cookieToken) return false;

  // Constant-time comparison to prevent timing attacks
  if (cookieToken.length !== token.length) return false;

  let result = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    result |= cookieToken.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return result === 0;
}

export { CSRF_COOKIE_NAME };
