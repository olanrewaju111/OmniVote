/**
 * Unified API Handler — Phase 15
 *
 * Wraps API route handlers with cross-cutting concerns:
 *   - Correlation ID propagation (Phase 13)
 *   - SRE request logging + SLO tracking (Phase 12)
 *   - Error tracking (Phase 13)
 *   - Structured logging (Phase 13)
 *   - Active connections gauge
 *
 * Usage:
 *   export const GET = withApiHandler('GET', '/api/incidents', async (req, ctx) => {
 *     const { user, correlationId } = ctx;
 *     return NextResponse.json({ data: 'ok' });
 *   });
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCorrelationIdFromRequest, generateCorrelationId } from '@/lib/monitoring/correlation';
import { createRequestTimer, activeConnections } from '@/lib/sre/request-logger';
import { errorTracker } from '@/lib/monitoring/error-tracker';
import { logger } from '@/lib/monitoring/log-aggregator';
import { getAuthUser, type JwtPayload } from '@/lib/auth';

// ─── Types ─────────────────────────────────────────────────────────────

export interface ApiContext {
  /** Correlation ID for this request */
  correlationId: string;
  /** Authenticated user (undefined if not auth'd) */
  user?: JwtPayload;
  /** Raw NextRequest */
  req: NextRequest;
}

type ApiHandlerFn = (
  req: NextRequest,
  ctx: ApiContext,
) => Promise<NextResponse> | NextResponse;

interface WithApiHandlerOptions {
  /** If true, resolves JWT and provides user in context. Default: true */
  requireAuth?: boolean;
}

// ─── Extract client IP ────────────────────────────────────────────────

function extractIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  return realIp?.trim() || 'unknown';
}

// ─── The wrapper ──────────────────────────────────────────────────────

/**
 * Wrap an API route handler with observability and error tracking.
 *
 * Automatically:
 * 1. Generates or forwards a correlation ID
 * 2. Resolves the authenticated user (if requireAuth !== false)
 * 3. Creates a request timer for SLO tracking
 * 4. Logs the request via structured logger
 * 5. Tracks errors in the error tracker
 * 6. Sets correlation ID on the response header
 * 7. Manages the active connections gauge
 */
export function withApiHandler(
  method: string,
  route: string,
  handler: ApiHandlerFn,
  options: WithApiHandlerOptions = {},
) {
  const { requireAuth = true } = options;

  return async function wrappedHandler(req: NextRequest): Promise<NextResponse> {
    // 1. Correlation ID
    const correlationId = getCorrelationIdFromRequest(req) || generateCorrelationId();
    const reqLogger = logger.withContext({ correlationId, route });

    // 2. Auth
    let user: JwtPayload | undefined;
    if (requireAuth) {
      try {
        const authResult = await getAuthUser(req);
        if (authResult) user = authResult;
      } catch {
        // Auth error — will be caught below
      }
    }

    // 3. Start metrics
    const record = createRequestTimer(method, route);
    activeConnections.increment();
    const ip = extractIp(req);

    reqLogger.info(`Request started`, { method, ip, userId: user?.userId });

    try {
      const ctx: ApiContext = { correlationId, user, req };
      const response = await handler(req, ctx);

      // Set correlation ID on response
      response.headers.set('X-Correlation-ID', correlationId);

      // Record success
      record(response.status, {
        clientIp: ip,
        userId: user?.userId,
        tenantId: user?.tenantId,
      });

      reqLogger.info(`Request completed`, {
        method,
        status: response.status,
        durationMs: Date.now(),
      });

      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Track the error
      errorTracker.capture(error instanceof Error ? error : new Error(errorMsg), {
        severity: 'error',
        context: {
          userId: user?.userId,
          tenantId: user?.tenantId,
          route,
          ipAddress: ip,
        },
        tags: [method, route, 'api-handler'],
        fingerprint: `${method} ${route}:${errorMsg}`,
      });

      reqLogger.error(`Request failed`, {
        method,
        error: errorMsg,
        stack: errorStack,
      });

      // Record failure
      record(500, {
        clientIp: ip,
        userId: user?.userId,
        tenantId: user?.tenantId,
        error: errorMsg,
      });

      // Don't leak internal errors in production
      const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : errorMsg;

      const errorResponse = NextResponse.json(
        { error: message, correlationId },
        {
          status: 500,
          headers: { 'X-Correlation-ID': correlationId },
        },
      );

      return errorResponse;
    } finally {
      activeConnections.decrement();
    }
  };
}
