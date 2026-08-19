/**
 * Per-tenant enforcement utilities — Phase 20
 *
 * Implements two "future enhancement" items from middleware.ts:
 *   1. Per-tenant session timeout enforcement (based on tenant.sessionTimeoutMin)
 *   2. Per-tenant IP whitelist enforcement (based on tenant.ipWhitelist)
 *
 * These checks run at the API route level where DB access is available.
 * Use `enforceTenantPolicies(req, authUser)` at the top of protected routes.
 */

import { db } from '@/lib/db';
import type { JwtPayload } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/security/security-logger';

export interface TenantEnforcementResult {
  allowed: boolean;
  reason?: string;
  statusCode: number;
}

/**
 * Check if the user's session has exceeded the tenant's configured timeout.
 *
 * The JWT `iat` (issued-at) claim is compared against `tenant.sessionTimeoutMin`.
 * If the session was issued more than `sessionTimeoutMin` minutes ago, reject.
 *
 * Note: The JWT `exp` claim still provides a hard 24h maximum. This check
 * provides a SHORTER tenant-specific window on top of that.
 *
 * @returns enforcement result. If `allowed` is false, the route should return the
 *          provided statusCode and reason.
 */
export async function enforceSessionTimeout(
  authUser: JwtPayload,
  iat?: number,
): Promise<TenantEnforcementResult> {
  if (!iat) {
    // If no `iat` available, we can't enforce — allow through
    // (the JWT `exp` will still catch truly expired tokens)
    return { allowed: true, statusCode: 200 };
  }

  try {
    const tenant = await db.tenant.findUnique({
      where: { id: authUser.tenantId },
      select: { sessionTimeoutMin: true },
    });

    if (!tenant) {
      return { allowed: true, statusCode: 200 }; // Tenant not found — let other guards handle
    }

    const timeoutMs = tenant.sessionTimeoutMin * 60 * 1000;
    const sessionAge = Date.now() - (iat * 1000);

    if (sessionAge > timeoutMs) {
      logSecurityEvent({
        type: 'SESSION_TIMEOUT_ENFORCED',
        severity: 'warning',
        userId: authUser.userId,
        tenantId: authUser.tenantId,
        details: {
          sessionAgeMin: Math.round(sessionAge / 60000),
          timeoutMin: tenant.sessionTimeoutMin,
        },
      });

      return {
        allowed: false,
        reason: `Session expired: tenant requires re-authentication every ${tenant.sessionTimeoutMin} minutes`,
        statusCode: 401,
      };
    }

    return { allowed: true, statusCode: 200 };
  } catch {
    // DB error — don't block the request
    return { allowed: true, statusCode: 200 };
  }
}

/**
 * Check if the request's IP is in the tenant's IP whitelist.
 *
 * If `tenant.ipWhitelist` is `"[]"` (default) or empty, ALL IPs are allowed.
 * Otherwise, only IPs in the JSON array are permitted.
 * Supports exact IPs and CIDR notation (e.g., "192.168.1.0/24").
 */
export async function enforceIpWhitelist(
  authUser: JwtPayload,
  clientIp: string | null,
): Promise<TenantEnforcementResult> {
  // If no client IP (unlikely in production), allow through
  if (!clientIp) {
    return { allowed: true, statusCode: 200 };
  }

  try {
    const tenant = await db.tenant.findUnique({
      where: { id: authUser.tenantId },
      select: { ipWhitelist: true },
    });

    if (!tenant) {
      return { allowed: true, statusCode: 200 };
    }

    const whitelist: string[] = JSON.parse(tenant.ipWhitelist);
    if (whitelist.length === 0) {
      return { allowed: true, statusCode: 200 }; // Empty whitelist = allow all
    }

    const allowed = isIpInList(clientIp, whitelist);

    if (!allowed) {
      logSecurityEvent({
        type: 'IP_WHITELIST_BLOCKED',
        severity: 'critical',
        userId: authUser.userId,
        tenantId: authUser.tenantId,
        details: { clientIp, whitelistSize: whitelist.length },
      });

      return {
        allowed: false,
        reason: 'Access denied: your IP address is not in the tenant whitelist',
        statusCode: 403,
      };
    }

    return { allowed: true, statusCode: 200 };
  } catch {
    return { allowed: true, statusCode: 200 };
  }
}

/**
 * Combined enforcement: checks both session timeout and IP whitelist.
 * Extracts `iat` from the JWT automatically.
 *
 * Usage in API routes:
 * ```ts
 * const authUser = await getAuthUser(req);
 * if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *
 * const enforcement = await enforceTenantPolicies(req, authUser);
 * if (!enforcement.allowed) {
 *   return NextResponse.json({ error: enforcement.reason }, { status: enforcement.statusCode });
 * }
 * ```
 */
export async function enforceTenantPolicies(
  req: Request,
  authUser: JwtPayload,
): Promise<TenantEnforcementResult> {
  // Extract iat from JWT cookie for session timeout check
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/omnivote-session=([^;]+)/);
  let iat: number | undefined;

  if (match) {
    try {
      // Decode JWT payload without full verification (already verified by getAuthUser)
      const parts = match[1].split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        iat = payload.iat;
      }
    } catch {
      // Can't extract iat — skip timeout check
    }
  }

  // Check session timeout
  const timeoutResult = await enforceSessionTimeout(authUser, iat);
  if (!timeoutResult.allowed) return timeoutResult;

  // Check IP whitelist
  const clientIp = extractClientIp(req);
 const ipResult = await enforceIpWhitelist(authUser, clientIp);
  if (!ipResult.allowed) return ipResult;

  return { allowed: true, statusCode: 200 };
}

// ─── Internal helpers ──────────────────────────────────────────────

function extractClientIp(req: Request): string | null {
  // Check common proxy headers
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return null;
}

/**
 * Check if an IP matches any entry in the whitelist.
 * Supports exact IPs ("192.168.1.1") and CIDR notation ("10.0.0.0/8").
 */
function isIpInList(ip: string, whitelist: string[]): boolean {
  for (const entry of whitelist) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    if (trimmed.includes('/')) {
      // CIDR notation
      if (matchCIDR(ip, trimmed)) return true;
    } else {
      // Exact match
      if (ip === trimmed) return true;
    }
  }
  return false;
}

/**
 * Simple CIDR match (IPv4 only).
 * Returns true if `ip` falls within the `cidr` range.
 */
function matchCIDR(ip: string, cidr: string): boolean {
  const [networkStr, bitsStr] = cidr.split('/');
  const bits = parseInt(bitsStr, 10);
  if (isNaN(bits) || bits < 0 || bits > 32) return false;

  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(networkStr!);
  if (ipNum === null || networkNum === null) return false;

  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((ipNum & mask) >>> 0) === ((networkNum & mask) >>> 0);
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const octet of parts) {
    const n = parseInt(octet, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result;
}
