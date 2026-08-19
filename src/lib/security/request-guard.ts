/**
 * Unified API route guard that combines multiple security checks.
 * Simplifies API route security boilerplate by composing:
 *   - Authentication (JWT cookie verification)
 *   - CSRF validation (double-submit cookie pattern)
 *   - Rate limiting
 *   - CORS headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, type JwtPayload } from '../auth';
import { validateCsrfToken } from './csrf';
import { rateLimit, type RateLimitConfig, type RouteCategory } from '../rate-limit';
import { getCorsHeaders } from './cors';
import { logSecurityEvent } from './security-logger';

// ─── Types ───────────────────────────────────────────────────────────────

type RouteGuardResult =
  | { allowed: true; user?: JwtPayload; corsHeaders: Record<string, string> }
  | { allowed: false; response: NextResponse };

interface RouteGuardOptions {
  requireAuth?: boolean;
  requireCsrf?: boolean;
  rateLimitCategory?: string;
  rateLimitConfig?: RateLimitConfig;
  corsEnabled?: boolean;
}

// ─── Helper: extract client IP ───────────────────────────────────────────

function extractIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  return realIp?.trim() || 'unknown';
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Create a route guard function for use in API route handlers.
 *
 * @example
 * ```ts
 * const guard = createRouteGuard({ requireAuth: true, requireCsrf: true, rateLimitCategory: 'mutation-write' });
 * export async function POST(req: NextRequest) {
 *   const check = await guard(req);
 *   if (!check.allowed) return check.response;
 *   // check.user is available
 * }
 * ```
 */
export function createRouteGuard(options: RouteGuardOptions = {}) {
  const {
    requireAuth = false,
    requireCsrf = false,
    rateLimitCategory,
    rateLimitConfig,
    corsEnabled = false,
  } = options;

  return async function guard(req: Request): Promise<RouteGuardResult> {
    // 1. CORS headers
    let corsHeaders: Record<string, string> = {};
    if (corsEnabled) {
      const origin = req.headers.get('origin');
      corsHeaders = getCorsHeaders(origin);

      // Handle preflight
      if (req.method === 'OPTIONS') {
        return {
          allowed: false,
          response: new NextResponse(null, {
            status: 204,
            headers: corsHeaders,
          }),
        };
      }
    }

    // 2. Rate limiting
    if (rateLimitCategory || rateLimitConfig) {
      const nextReq = new NextRequest(req.url, {
        headers: req.headers,
        method: req.method,
      });
      const rlConfig = rateLimitConfig || (rateLimitCategory as RouteCategory);
      const rl = rateLimit(nextReq, rlConfig);
      if (rl.limited) {
        logSecurityEvent({
          type: 'RATE_LIMITED',
          severity: 'warning',
          ipAddress: extractIp(req),
          details: { url: req.url, method: req.method },
        });
        return { allowed: false, response: rl.response };
      }
    }

    // 3. Authentication
    let user: JwtPayload | undefined;
    if (requireAuth) {
      const authUser = await getAuthUser(req);
      if (!authUser) {
        logSecurityEvent({
          type: 'TOKEN_EXPIRED',
          severity: 'warning',
          ipAddress: extractIp(req),
          details: { url: req.url, method: req.method },
        });
        return {
          allowed: false,
          response: NextResponse.json(
            { error: 'Authentication required' },
            { status: 401, headers: corsHeaders },
          ),
        };
      }
      user = authUser;
    }

    // 4. CSRF validation
    if (requireCsrf) {
      // Only validate on mutating methods
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const csrfToken = req.headers.get('x-csrf-token') || '';
        if (!validateCsrfToken(req, csrfToken)) {
          logSecurityEvent({
            type: 'CSRF_FAILURE',
            severity: 'critical',
            userId: user?.userId,
            ipAddress: extractIp(req),
            details: { url: req.url, method: req.method },
          });
          return {
            allowed: false,
            response: NextResponse.json(
              { error: 'Invalid CSRF token' },
              { status: 403, headers: corsHeaders },
            ),
          };
        }
      }
    }

    return { allowed: true, user, corsHeaders };
  };
}
