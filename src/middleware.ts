import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getCorrelationIdFromRequest, generateCorrelationId } from '@/lib/monitoring/correlation';

/**
 * Parse a comma-separated list of IPs/CIDRs from an env var.
 * Returns null when the env var is not set (whitelist disabled).
 */
function parseIpWhitelist(envValue: string | undefined): Array<{ ip: string; cidr?: number }> | null {
  if (!envValue) return null;
  return envValue
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      const cidrMatch = entry.match(/^(.+)\/(\d{1,3})$/);
      if (cidrMatch) {
        return { ip: cidrMatch[1], cidr: parseInt(cidrMatch[2], 10) };
      }
      return { ip: entry };
    });
}

/**
 * Check whether a client IP falls within an allowlist entry.
 * Supports exact IP match and CIDR notation (e.g. 10.0.0.0/8).
 */
function isIpAllowed(clientIp: string, allowlist: Array<{ ip: string; cidr?: number }>): boolean {
  for (const entry of allowlist) {
    if (!entry.cidr) {
      // Exact match
      if (clientIp === entry.ip) return true;
      continue;
    }
    // CIDR match
    if (matchCidr(clientIp, entry.ip, entry.cidr)) return true;
  }
  return false;
}

/**
 * IPv4 CIDR matching.
 */
function matchCidr(ip: string, network: string, prefix: number): boolean {
  const ipNum = ipToInt(ip);
  const netNum = ipToInt(network);
  if (ipNum === null || netNum === null) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (netNum & mask);
}

function ipToInt(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Extract the client IP from the request.
 * Priority: req.ip → x-forwarded-for (first entry) → x-real-ip
 */
function getClientIp(req: NextRequest): string | null {
  // NextRequest doesn't expose req.ip directly in edge runtime,
  // so we rely on headers.
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return null;
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for middleware. Set it in .env or your deployment config.');
}

/**
 * RBAC map: API route prefix → allowed roles.
 * Routes not listed here require any authenticated user (JWT check still applies).
 */
const ROUTE_RBAC: Record<string, string[]> = {
  'tenants': ['SUPER_ADMIN'],
  'tenants/users': ['SUPER_ADMIN'],
  'security': ['SUPER_ADMIN', 'TENANT_ADMIN', 'TRUST_SAFETY'],
};

/**
 * Extract the API route key from the request URL.
 * e.g. /api/dashboard/xyz → 'dashboard', /api/tenants/users → 'tenants/users'
 */
function getRouteKey(pathname: string): string {
  const withoutPrefix = pathname.replace(/^\/api\//, '');
  const segments = withoutPrefix.split('/').filter(Boolean);
  if (segments.length >= 2 && segments[0] === 'tenants') {
    return segments[0] + '/' + segments[1];
  }
  return segments[0] || '';
}

function isRouteAllowed(routeKey: string, userRole: string): boolean {
  const allowedRoles = ROUTE_RBAC[routeKey];
  if (!allowedRoles) return true; // any authenticated user
  return allowedRoles.includes(userRole);
}

/**
 * Next.js Edge Middleware.
 *
 * Runs on every request BEFORE it reaches the API routes or pages.
 * Responsibilities:
 * 1. Verify JWT session cookie for all /api/* routes (except /api/auth and /api/health)
 * 2. Enforce RBAC at the middleware level for role-restricted routes
 * 3. Add security headers to all responses
 * 4. Block requests with invalid/expired tokens
 *
 * NOTE: Individual API routes should also use requireAuth()/requireTenantMatch()
 * from @/lib/rbac.ts for defense-in-depth tenant isolation.
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

  // Content Security Policy
  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // unsafe-inline/eval needed for Next.js runtime
    "style-src 'self' 'unsafe-inline'",                   // unsafe-inline needed for Tailwind/inline styles
    "img-src 'self' data: blob: https://z-cdn.chatglm.cn",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' ws: wss:",                         // allow WebSocket connections
    "frame-ancestors 'none'",                               // same as X-Frame-Options: DENY
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '));

  // Permission Policy — restrict browser features
  response.headers.set('Permissions-Policy', [
    'camera=()',          // no camera unless explicitly granted
    'microphone=()',      // no microphone
    'geolocation=(self)', // allow geolocation from same origin (needed for field agents)
    'payment=()',         // no payment API
  ].join(', '));

  // ─── Skip auth for non-API routes and public endpoints ──────────────────
  // API auth routes, health check, and tenant slug lookup are public
  const isPublicApi = pathname === '/api/auth' || pathname === '/api/health' || pathname === '/api/tenants';
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

  let payload: { role?: string; [key: string]: unknown };
  try {
    const key = new TextEncoder().encode(JWT_SECRET);
    const { payload: p } = await jwtVerify(token, key);
    payload = p as typeof payload;
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

  // ─── Session timeout enforcement ────────────────────────────────────────
  // NOTE: jwtVerify() above already rejects expired tokens via the `exp` claim.
  // The JWT is issued with a 24h expiry (set in auth.ts). Per-tenant session
  // timeout (tenant.sessionTimeoutMin) cannot be enforced here because this is
  // Edge middleware and we cannot perform DB queries. Per-tenant session
  // timeout enforcement is a future enhancement that will be implemented at
  // the API route level where DB access is available.

  // ─── IP whitelist enforcement ──────────────────────────────────────────
  // NOTE: Per-tenant IP whitelists (stored in the DB) cannot be checked in Edge
  // middleware. As a future enhancement, per-tenant IP enforcement will be added
  // at the API route level. For now, we support a global IP whitelist via the
  // IP_WHITELIST env var (comma-separated IPs/CIDRs). When set, ALL API
  // requests must originate from an allowed IP.
  const ipWhitelist = parseIpWhitelist(process.env.IP_WHITELIST);
  if (ipWhitelist) {
    const clientIp = getClientIp(req);
    if (!clientIp || !isIpAllowed(clientIp, ipWhitelist)) {
      return NextResponse.json(
        { error: 'Forbidden: IP not allowed' },
        { status: 403, headers: response.headers },
      );
    }
  }

  // ─── Enforce RBAC ─────────────────────────────────────────────────────
  const routeKey = getRouteKey(pathname);
  const userRole = (payload.role as string) || '';

  if (!isRouteAllowed(routeKey, userRole)) {
    return NextResponse.json(
      { error: 'Insufficient permissions for this action' },
      { status: 403, headers: response.headers },
    );
  }

  // ─── Correlation ID (Phase 15 integration) ──────────────────────────────
  // Forward existing correlation ID or generate a new one.
  // The api-handler wrapper will pick this up and use it for structured logging.
  const correlationId = getCorrelationIdFromRequest(req) || generateCorrelationId();
  response.headers.set('X-Correlation-ID', correlationId);

  // Token valid + RBAC check passed — continue to route handler
  return response;
}

export const config = {
  // Run on all API routes
  matcher: '/api/:path*',
};