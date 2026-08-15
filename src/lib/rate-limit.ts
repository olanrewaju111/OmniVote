/**
 * Global in-memory sliding-window rate limiter for API routes.
 *
 * Design:
 *   - Per-key sliding window (key = route prefix + userId).
 *   - Two tiers: "burst" (short window, high rate) and "sustained" (long window, lower rate).
 *   - Auto-cleanup of stale entries every 5 minutes.
 *   - In production, replace the Map with Redis (Upstash / ioredis).
 *
 * Usage in a route handler:
 *   import { rateLimit, RateLimitConfig } from '@/lib/rate-limit';
 *
 *   const rl = rateLimit(req, { maxBurst: 5, burstWindowMs: 60_000, maxSustained: 20, sustainedWindowMs: 300_000 });
 *   if (rl.limited) return rl.response;
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from './auth';

// ─── Types ───────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Max requests in the burst window (default: 10) */
  maxBurst?: number;
  /** Burst window duration in ms (default: 10 000 = 10s) */
  burstWindowMs?: number;
  /** Max requests in the sustained window (default: 30) */
  maxSustained?: number;
  /** Sustained window duration in ms (default: 60 000 = 1min) */
  sustainedWindowMs?: number;
  /** Override the route key (defaults to URL pathname) */
  routeKey?: string;
}

interface RateLimitResult {
  limited: true;
  response: NextResponse;
}

interface RateLimitPass {
  limited: false;
}

type RateLimitCheck = RateLimitResult | RateLimitPass;

// ─── In-memory store ────────────────────────────────────────────────────

interface TimestampEntry {
  timestamps: number[];
}

const store = new Map<string, TimestampEntry>();

let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  // The maximum sustained window we allow is 10 minutes.
  // Anything older than 10 minutes is definitely stale.
  const maxAge = 10 * 60 * 1000;
  for (const [key, entry] of store) {
    // Filter out timestamps older than maxAge
    entry.timestamps = entry.timestamps.filter(t => now - t < maxAge);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

// ─── Pre-defined configs per route category ─────────────────────────────

type RouteCategory =
  | 'auth-login'      // login attempts — already handled separately
  | 'mutation-write'  // standard POST/PUT/PATCH that creates/updates data
  | 'mutation-delete' // DELETE operations — destructive, extra cautious
  | 'mutation-bulk'   // bulk operations (BULK_ENGAGE, etc.)
  | 'mutation-admin'  // admin-only actions (REMOTE_WIPE, LOCK_USER, etc.)
  | 'field-submit'    // field agent data submission (incidents, results, PVT)
  | 'read-heavy'      // GET endpoints that are expensive (no rate limit by default)
  | 'whatsapp';       // WhatsApp operations — bridge interactions

const DEFAULT_CONFIGS: Record<RouteCategory, RateLimitConfig> = {
  'auth-login': { maxBurst: 5, burstWindowMs: 60_000, maxSustained: 10, sustainedWindowMs: 300_000 },
  'mutation-write': { maxBurst: 10, burstWindowMs: 10_000, maxSustained: 30, sustainedWindowMs: 60_000 },
  'mutation-delete': { maxBurst: 5, burstWindowMs: 10_000, maxSustained: 15, sustainedWindowMs: 60_000 },
  'mutation-bulk': { maxBurst: 3, burstWindowMs: 10_000, maxSustained: 8, sustainedWindowMs: 60_000 },
  'mutation-admin': { maxBurst: 5, burstWindowMs: 10_000, maxSustained: 15, sustainedWindowMs: 60_000 },
  'field-submit': { maxBurst: 15, burstWindowMs: 10_000, maxSustained: 60, sustainedWindowMs: 60_000 },
  'read-heavy': { maxBurst: 30, burstWindowMs: 10_000, maxSustained: 100, sustainedWindowMs: 60_000 },
  'whatsapp': { maxBurst: 10, burstWindowMs: 10_000, maxSustained: 30, sustainedWindowMs: 60_000 },
};

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Check rate limit for a request. Call at the top of any handler you want to protect.
 *
 * @example
 * // Using a preset category:
 * const rl = rateLimit(req, 'mutation-write');
 * if (rl.limited) return rl.response;
 *
 * @example
 * // Using a custom config:
 * const rl = rateLimit(req, { maxBurst: 5, burstWindowMs: 60_000 });
 * if (rl.limited) return rl.response;
 */
export function rateLimit(
  req: NextRequest,
  configOrCategory: RateLimitConfig | RouteCategory = 'mutation-write',
): RateLimitCheck {
  // Periodic cleanup
  cleanup();

  const config: RateLimitConfig =
    typeof configOrCategory === 'string'
      ? { ...DEFAULT_CONFIGS[configOrCategory] }
      : configOrCategory;

  const maxBurst = config.maxBurst ?? 10;
  const burstWindowMs = config.burstWindowMs ?? 10_000;
  const maxSustained = config.maxSustained ?? 30;
  const sustainedWindowMs = config.sustainedWindowMs ?? 60_000;

  // Derive the rate-limit key from user identity + route
  const userId = req.headers.get('x-ratelimit-userid') || 'anonymous';
  const routeKey = config.routeKey || new URL(req.url).pathname.replace(/^\/api\//, '');
  const key = `${routeKey}:${userId}`;

  const now = Date.now();
  const entry = store.get(key) || { timestamps: [] as number[] };

  // Prune old timestamps for both windows
  const burstCutoff = now - burstWindowMs;
  const sustainedCutoff = now - sustainedWindowMs;
  entry.timestamps = entry.timestamps.filter(t => t > sustainedCutoff);

  // Count requests in each window
  const burstCount = entry.timestamps.filter(t => t > burstCutoff).length;
  const sustainedCount = entry.timestamps.length;

  // Check both limits
  if (burstCount >= maxBurst) {
    const retryAfterMs = entry.timestamps
      .filter(t => t > burstCutoff)[0] + burstWindowMs - now;
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    store.set(key, entry);
    return {
      limited: true,
      response: NextResponse.json(
        { error: 'Too many requests. Please slow down.', retryAfterSeconds: retryAfterSec },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSec),
            'X-RateLimit-Limit': String(maxBurst),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil((entry.timestamps[0] + burstWindowMs) / 1000)),
          },
        },
      ),
    };
  }

  if (sustainedCount >= maxSustained) {
    const retryAfterMs = entry.timestamps[0] + sustainedWindowMs - now;
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    store.set(key, entry);
    return {
      limited: true,
      response: NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before trying again.', retryAfterSeconds: retryAfterSec },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSec),
            'X-RateLimit-Limit': String(maxSustained),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil((entry.timestamps[0] + sustainedWindowMs) / 1000)),
          },
        },
      ),
    };
  }

  // Record this request
  entry.timestamps.push(now);
  store.set(key, entry);

  // Return remaining info in headers for legitimate requests
  // (callers can spread these onto their successful response if desired)
  void { remaining: maxBurst - burstCount - 1, sustainedRemaining: maxSustained - sustainedCount - 1 };

  return { limited: false };
}

/**
 * Middleware-style helper: wraps rate-limit check with automatic user ID extraction
 * from the JWT. Use this in API routes that already have auth.
 *
 * @example
 * const rl = await rateLimitByUser(req, 'mutation-delete');
 * if (rl.limited) return rl.response;
 */
export async function rateLimitByUser(
  req: NextRequest,
  configOrCategory: RateLimitConfig | RouteCategory = 'mutation-write',
): Promise<RateLimitCheck> {
  // Clone request with user ID header for the rate limiter
  try {
    const user = await getAuthUser(req);
    if (user) {
      const headers = new Headers(req.headers);
      headers.set('x-ratelimit-userid', user.userId);
      const reqWithUser = new NextRequest(req.url, { headers, method: req.method });
      return rateLimit(reqWithUser, configOrCategory);
    }
  } catch {
    // If JWT verification fails, fall through to anonymous limiting
  }
  return rateLimit(req, configOrCategory);
}

/**
 * Add rate limit info headers to a successful response.
 * Call this on the response you're about to return after a rateLimit() check passes.
 */
export function withRateLimitHeaders(
  response: NextResponse,
  req: NextRequest,
  config: RateLimitConfig = {},
): NextResponse {
  const userId = req.headers.get('x-ratelimit-userid') || 'anonymous';
  const routeKey = config.routeKey || new URL(req.url).pathname.replace(/^\/api\//, '');
  const key = `${routeKey}:${userId}`;
  const entry = store.get(key);

  if (entry) {
    const now = Date.now();
    const burstWindowMs = config.burstWindowMs ?? 10_000;
    const maxBurst = config.maxBurst ?? 10;
    const burstCutoff = now - burstWindowMs;
    const burstCount = entry.timestamps.filter(t => t > burstCutoff).length;

    response.headers.set('X-RateLimit-Limit', String(maxBurst));
    response.headers.set('X-RateLimit-Remaining', String(Math.max(0, maxBurst - burstCount)));
  }

  return response;
}

export type { RouteCategory };