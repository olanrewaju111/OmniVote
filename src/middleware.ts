import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'omnivote-dev-secret-change-in-production';

/**
 * Next.js Edge Middleware.
 *
 * Runs on every request BEFORE it reaches the API routes or pages.
 * Responsibilities:
 * 1. Verify JWT session cookie for all /api/* routes (except /api/auth and /api/health)
 * 2. Add security headers to all responses
 * 3. Block requests with invalid/expired tokens
 *
 * NOTE: This is a first-pass guard. Individual API routes should also
 * use requireAuth() from @/lib/rbac.ts for tenant isolation and fine-grained RBAC.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ─── Security headers on ALL responses ─────────────────────────────────
  const response = NextResponse.next();

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // XSS protection (legacy browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HSTS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // ─── Skip auth for non-API routes and public endpoints ──────────────────
  // API auth routes and health check are public
  const isPublicApi = pathname === '/api/auth' || pathname === '/api/health';
  // Static assets, _next internals, favicon, etc.
  const isStatic = pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname === '/favicon.ico';
  // Non-API routes (the SPA page) — let client handle auth state
  const isApiRoute = pathname.startsWith('/api/');

  if (!isApiRoute || isPublicApi || isStatic) {
    return response;
  }

  // ─── Verify JWT for all other API routes ───────────────────────────────
  const token = req.cookies.get('omnivote-session')?.value;
  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401, headers: response.headers },
    );
  }

  try {
    const key = new TextEncoder().encode(JWT_SECRET);
    await jwtVerify(token, key);
    // Token is valid — continue to the API route
    return response;
  } catch {
    // Token is invalid or expired
    const errorResponse = NextResponse.json(
      { error: 'Session expired. Please sign in again.' },
      { status: 401, headers: response.headers },
    );
    // Clear the expired cookie
    errorResponse.cookies.set('omnivote-session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return errorResponse;
  }
}

export const config = {
  // Run on all API routes
  matcher: '/api/:path*',
};