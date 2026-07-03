/**
 * RBAC (Role-Based Access Control) guard for API routes.
 *
 * Usage in an API route:
 *   import { requireAuth, requireRole } from '@/lib/rbac';
 *
 *   export async function GET(req: Request) {
 *     const auth = await requireAuth(req);
 *     if (auth.error) return auth.error;
 *     // auth.user is now typed as JwtPayload
 *   }
 *
 *   // Or with role check:
 *   const auth = await requireRole(req, 'SUPER_ADMIN', 'TENANT_ADMIN');
 *   if (auth.error) return auth.error;
 */

import { NextResponse } from 'next/server';
import { type JwtPayload, getAuthUser } from './auth';

// ─── Types ─────────────────────────────────────────────────────────────────

type AuthResult =
  | { error: NextResponse; user?: never }
  | { error?: never; user: JwtPayload };

// ─── RBAC configuration ────────────────────────────────────────────────────

/**
 * Maps each API route pattern to the roles allowed to access it.
 * Routes not listed here default to requiring any authenticated user.
 *
 * Format: prefix of the URL path (after /api/) → allowed roles.
 * '*' means any authenticated user.
 */
const ROUTE_RBAC: Record<string, string[] | '*'> = {
  // Tenant management — SUPER_ADMIN only
  'tenants': ['SUPER_ADMIN'],
  'tenants/users': ['SUPER_ADMIN'],

  // System health — SUPER_ADMIN only
  'system': ['SUPER_ADMIN'],

  // Security center — SUPER_ADMIN, TENANT_ADMIN, TRUST_SAFETY
  'security': ['SUPER_ADMIN', 'TENANT_ADMIN', 'TRUST_SAFETY'],

  // AI engine — SUPER_ADMIN, ANALYST, TRUST_SAFETY
  'ai': ['SUPER_ADMIN', 'ANALYST', 'TRUST_SAFETY'],

  // All other routes — any authenticated user
};

/**
 * Unauthenticated routes that should skip auth checks entirely.
 */
const PUBLIC_ROUTES = new Set([
  'auth',       // login/logout
  'health',     // health check
]);

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Extract the API route key from the request URL.
 * e.g. /api/dashboard/xyz → 'dashboard'
 */
function getRouteKey(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    // Remove /api/ prefix
    const withoutPrefix = pathname.replace(/^\/api\//, '');
    // Get the first segment
    const segments = withoutPrefix.split('/').filter(Boolean);
    // Handle multi-segment routes like tenants/users
    if (segments.length >= 2 && segments[0] === 'tenants') {
      return segments[0] + '/' + segments[1];
    }
    return segments[0] || '';
  } catch {
    return '';
  }
}

function isPublicRoute(routeKey: string): boolean {
  return PUBLIC_ROUTES.has(routeKey);
}

function isRouteAllowed(routeKey: string, userRole: string): boolean {
  const allowedRoles = ROUTE_RBAC[routeKey];
  // If no specific RBAC rule, allow any authenticated user
  if (!allowedRoles || allowedRoles === '*') return true;
  return allowedRoles.includes(userRole);
}

// ─── Guard functions ───────────────────────────────────────────────────────

/**
 * Require authentication. Returns the user payload or an error response.
 * Use this at the top of every protected API route handler.
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const routeKey = getRouteKey(req.url);

  // Skip auth for public routes
  if (isPublicRoute(routeKey)) {
    // For auth routes, still parse the user if token exists (for revalidation)
    const user = await getAuthUser(req);
    if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    return { user };
  }

  const user = await getAuthUser(req);
  if (!user) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }

  // Check RBAC
  if (!isRouteAllowed(routeKey, user.role)) {
    return { error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) };
  }

  return { user };
}

/**
 * Require authentication + specific role(s).
 * Convenience wrapper combining requireAuth with a role check.
 */
export async function requireRole(req: Request, ...roles: string[]): Promise<AuthResult> {
  const result = await requireAuth(req);
  if (result.error) return result;

  if (!roles.includes(result.user.role)) {
    return { error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) };
  }

  return result;
}

/**
 * Verify that the authenticated user belongs to the specified tenant.
 * Call this after requireAuth() when tenant isolation is needed.
 */
export function requireTenantMatch(user: JwtPayload, tenantId: string): NextResponse | null {
  // SUPER_ADMIN can access any tenant
  if (user.role === 'SUPER_ADMIN') return null;

  if (user.tenantId !== tenantId) {
    return NextResponse.json({ error: 'Tenant access denied' }, { status: 403 });
  }

  return null;
}