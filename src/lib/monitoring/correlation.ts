/**
 * Request Correlation ID Management — Phase 13
 *
 * Generates and propagates correlation IDs across service boundaries.
 * Reads from standard headers (X-Correlation-ID, X-Request-ID).
 *
 * NOTE: Uses Web Crypto API (crypto.randomUUID()) for Edge Runtime compatibility.
 */

/**
 * Generate a new correlation ID prefixed with 'ov-' for OmniVote.
 * Uses the global Web Crypto API which works in both Edge Runtime and Node.js.
 */
export function generateCorrelationId(): string {
  // crypto.randomUUID() is available in Edge Runtime, Node.js 19+, and all browsers.
  // For Node.js < 19 fallback, we use a simple pseudo-random hex string.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ov-${crypto.randomUUID()}`;
  }
  // Fallback: generate a v4-like UUID from Math.random (non-secure, but acceptable for correlation IDs)
  const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `ov-${hex()}${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}`;
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
