/**
 * Structured Request Logger — Phase 12
 *
 * Captures per-request metrics for SLO tracking.
 * Designed to be called from API routes via `logRequest()`.
 * Feeds data into the SLO tracker.
 */

import { sloTracker, type SLIRecord } from './slo-tracker';

// ─── Latency Histogram Buckets (Prometheus-style) ─────────────────────

const LATENCY_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000]; // ms

interface HistogramBucket {
 le: number; // less-than-or-equal boundary (Infinity for last bucket)
 count: number;
}

export interface RequestLogEntry {
 method: string;
 route: string;
 statusCode: number;
 durationMs: number;
 clientIp?: string;
 userAgent?: string;
 userId?: string;
 tenantId?: string;
 error?: string;
 timestamp: number;
}

/**
 * In-memory latency histogram per route.
 * Used for the /api/metrics endpoint (Prometheus text format).
 */
class LatencyHistogram {
  private data = new Map<string, HistogramBucket[]>();

  record(route: string, durationMs: number): void {
    if (!this.data.has(route)) {
      this.data.set(route, LATENCY_BUCKETS.map(le => ({ le, count: 0 })).concat([{ le: Infinity, count: 0 }]));
    }
    const buckets = this.data.get(route)!;
    for (const bucket of buckets) {
      if (durationMs <= bucket.le) {
        bucket.count++;
      }
    }
  }

  getBuckets(route: string): HistogramBucket[] {
    return this.data.get(route) || [];
  }

  getAllRoutes(): string[] {
    return Array.from(this.data.keys());
  }

  /**
 * Generate Prometheus histogram exposition format.
 */
  toPrometheus(route: string): string {
    const buckets = this.getBuckets(route);
    if (buckets.length === 0) return '';
    const escapedRoute = route.replace(/[^a-zA-Z0-9_]/g, '_');
    let lines = '';
    for (const b of buckets) {
      const le = b.le === Infinity ? '+Inf' : b.le;
      lines += `omnivote_http_request_duration_seconds_bucket{route="${escapedRoute}",le="${le}"} ${b.count}\n`;
    }
    // _sum and _count
    const total = buckets[buckets.length - 1].count;
    // Calculate sum from raw data — we need to track this separately
    // For now, estimate from buckets (not exact but acceptable for initial impl)
    lines += `omnivote_http_request_duration_seconds_count{route="${escapedRoute}"} ${total}\n`;
    return lines;
  }

  reset(): void {
    this.data.clear();
  }
}

// ─── Request Counter ───────────────────────────────────────────────────

class RequestCounter {
  private total = 0;
  private errors5xx = 0;
  private errors4xx = 0;
  private byRoute = new Map<string, number>();
  private byStatus = new Map<string, number>();
  private byMethod = new Map<string, number>();

  increment(method: string, route: string, statusCode: number): void {
    this.total++;
    if (statusCode >= 500) this.errors5xx++;
    if (statusCode >= 400 && statusCode < 500) this.errors4xx++;
    this.byRoute.set(route, (this.byRoute.get(route) || 0) + 1);
    const statusKey = String(statusCode);
    this.byStatus.set(statusKey, (this.byStatus.get(statusKey) || 0) + 1);
    this.byMethod.set(method, (this.byMethod.get(method) || 0) + 1);
  }

  getMetrics(): {
    total: number;
    errors5xx: number;
    errors4xx: number;
    byRoute: Record<string, number>;
    byStatus: Record<string, number>;
    byMethod: Record<string, number>;
  } {
    return {
      total: this.total,
      errors5xx: this.errors5xx,
      errors4xx: this.errors4xx,
      byRoute: Object.fromEntries(this.byRoute),
      byStatus: Object.fromEntries(this.byStatus),
      byMethod: Object.fromEntries(this.byMethod),
    };
  }

  reset(): void {
    this.total = 0;
    this.errors5xx = 0;
    this.errors4xx = 0;
    this.byRoute.clear();
    this.byStatus.clear();
    this.byMethod.clear();
  }
}

// ─── Active Connections Gauge ──────────────────────────────────────────

class ActiveConnectionsGauge {
  private count = 0;

  increment(): void { this.count++; }
  decrement(): void { this.count = Math.max(0, this.count - 1); }
  getValue(): number { return this.count; }
}

// ─── Singleton instances ───────────────────────────────────────────────

export const latencyHistogram = new LatencyHistogram();
export const requestCounter = new RequestCounter();
export const activeConnections = new ActiveConnectionsGauge();

// ─── Main logging function ─────────────────────────────────────────────

/**
 * Log a completed API request.
 * Call this at the end of every API route handler.
 *
 * @example
 * // In an API route:
 * const start = Date.now();
 * // ... handle request ...
 * logRequest({
 *   method: 'GET',
 *   route: '/api/dashboard',
 *   statusCode: 200,
 *   durationMs: Date.now() - start,
 *   userId: user.id,
 *   tenantId: user.tenantId,
 * });
 */
export function logRequest(entry: RequestLogEntry): void {
  // 1. Feed the SLO tracker
  const sliRecord: SLIRecord = {
    timestamp: entry.timestamp,
    success: entry.statusCode >= 200 && entry.statusCode < 500,
    durationMs: entry.durationMs,
    route: entry.route,
    statusCode: entry.statusCode,
  };
  sloTracker.record(sliRecord);

  // 2. Feed the latency histogram
  latencyHistogram.record(entry.route, entry.durationMs);

  // 3. Feed the request counter
  requestCounter.increment(entry.method, entry.route, entry.statusCode);

  // 4. Structured console log (for log aggregators like Loki)
  const level = entry.statusCode >= 500 ? 'error' : entry.statusCode >= 400 ? 'warn' : 'info';
  const log = {
    msg: 'api_request',
    method: entry.method,
    route: entry.route,
    status: entry.statusCode,
    duration_ms: entry.durationMs,
    ...(entry.clientIp && { client_ip: entry.clientIp }),
    ...(entry.userId && { user_id: entry.userId }),
    ...(entry.tenantId && { tenant_id: entry.tenantId }),
    ...(entry.error && { error: entry.error }),
  };

  switch (level) {
    case 'error':
      console.error(JSON.stringify(log));
      break;
    case 'warn':
      console.warn(JSON.stringify(log));
      break;
    default:
      // Don't log successful requests at info level in production to reduce noise
      if (process.env.NODE_ENV !== 'production') {
        console.info(JSON.stringify(log));
      }
  }
}

/**
 * Create a timing helper for use in API routes.
 * Returns a function that records the request when called.
 *
 * @example
 * const { record } = createRequestTimer('GET', '/api/incidents');
 * try {
 *   // ... handle request ...
 *   return record(200, { userId: user.id });
 * } catch (err) {
 *   return record(500, { error: String(err) });
 * }
 */
export function createRequestTimer(method: string, route: string) {
  const start = Date.now();
  return function record(
    statusCode: number,
    extra?: { clientIp?: string; userId?: string; tenantId?: string; error?: string }
  ) {
    const entry: RequestLogEntry = {
      method,
      route,
      statusCode,
      durationMs: Date.now() - start,
      timestamp: start,
      ...extra,
    };
    logRequest(entry);
    return entry;
  };
}
