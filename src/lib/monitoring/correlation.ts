/**
 * Request Correlation ID Management — Phase 13
 *
 * Generates and propagates correlation IDs across service boundaries.
 * Reads from standard headers (X-Correlation-ID, X-Request-ID).
 */

import { randomUUID } from 'crypto';

/**
 * Generate a new correlation ID prefixed with 'ov-' for OmniVote.
 */
export function generateCorrelationId(): string {
  return `ov-${randomUUID()}`;
}

/**
 * Extract a correlation ID from incoming request headers.
 * Checks X-Correlation-ID first, then X-Request-ID.
 * Returns null if neither header is present.
 */
export function getCorrelationIdFromRequest(req: Request): string | null {
  return (
    req.headers.get('x-correlation-id') ||
    req.headers.get('x-request-id') ||
    null
  );
}

/**
 * Return a headers record with the correlation ID set.
 * Useful for forwarding the ID to downstream services.
 */
export function withCorrelationId(_req: Request, id: string): Record<string, string> {
  return {
    'X-Correlation-ID': id,
  };
}
