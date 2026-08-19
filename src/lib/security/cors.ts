/**
 * CORS configuration utility.
 * Reads allowed origins from ALLOWED_ORIGINS env var (comma-separated).
 * Falls back to same-origin if not configured.
 */

// ─── Configuration ───────────────────────────────────────────────────────

/**
 * Parse allowed origins from env var.
 * Returns null if not set (meaning same-origin only).
 */
function getAllowedOrigins(): string[] {
  const env = process.env.ALLOWED_ORIGINS;
  if (!env) return [];

  return env
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
}

let cachedOrigins: string[] | null = null;

function getOrigins(): string[] {
  if (cachedOrigins === null) {
    cachedOrigins = getAllowedOrigins();
  }
  return cachedOrigins;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Check if an origin is in the allowed list.
 * If no ALLOWED_ORIGINS is set, only same-origin requests are implicitly allowed.
 */
export function isOriginAllowed(origin: string): boolean {
  const allowed = getOrigins();
  if (allowed.length === 0) return false; // No explicit origins = same-origin only
  return allowed.includes(origin);
}

/**
 * Get CORS headers for a given origin.
 * For allowed origins, returns full CORS headers.
 * For disallowed origins, returns minimal/no CORS headers.
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  // No Origin header = same-origin request, no CORS headers needed
  if (!origin) return {};

  if (!isOriginAllowed(origin)) {
    // Return minimal headers for non-allowed origins
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours preflight cache
  };
}

/**
 * Reset the origin cache. Useful for testing.
 */
export function _resetOriginCache(): void {
  cachedOrigins = null;
}
