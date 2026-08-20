/**
 * CSRF enforcement helper for API routes.
 *
 * Usage at the top of any mutating (POST/PUT/PATCH/DELETE) handler:
 *
 *   import { requireCsrf } from '@/lib/security/csrf-enforce';
 *   export async function POST(req: NextRequest) {
 *     const csrfErr = requireCsrf(req);
 *     if (csrfErr) return csrfErr;
 *     // ... handler logic
 *   }
 *
 * The CSRF cookie (omnivote-csrf) is set on login. The client reads it
 * via document.cookie and sends it as the x-csrf-token header.
 * This module validates the header matches the cookie (double-submit pattern).
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCsrfToken, CSRF_COOKIE_NAME, generateCsrfToken } from './csrf';
import { logSecurityEvent } from './security-logger';

/**
 * Validate CSRF token on a mutating request.
 * Returns a 403 response if validation fails, or null if it passes.
 *
 * Safe to call on non-mutating methods — returns null for GET/HEAD/OPTIONS.
 */
export function requireCsrf(req: NextRequest): NextResponse | null {
  // Only enforce on state-changing methods
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null;
  }

  const csrfToken = req.headers.get('x-csrf-token') || '';

  if (!validateCsrfToken(req, csrfToken)) {
    // Log the CSRF failure for security monitoring
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';

    logSecurityEvent({
      type: 'CSRF_FAILURE',
      severity: 'critical',
      ipAddress: ip,
      details: {
        url: req.url,
        method: req.method,
        hasCsrfCookie: !!req.headers.get('cookie')?.includes(CSRF_COOKIE_NAME),
        hasCsrfHeader: !!csrfToken,
      },
    });

    return NextResponse.json(
      { error: 'Invalid CSRF token. Refresh the page and try again.' },
      { status: 403 },
    );
  }

  return null;
}

/**
 * Set CSRF cookie on a response (e.g., after successful login).
 * Call this on the response object before returning it.
 */
export function setCsrfCookie(response: NextResponse): void {
  const { token, cookieHeader } = generateCsrfToken();
  // Extract just the token value from the cookie string
  const match = cookieHeader.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]*)`));
  if (match) {
    response.cookies.set(CSRF_COOKIE_NAME, match[1], {
      path: '/',
      sameSite: 'strict',
      httpOnly: false, // must be readable by JS for double-submit pattern
      secure: process.env.NODE_ENV === 'production',
    });
  }
}
