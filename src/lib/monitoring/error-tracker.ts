/**
 * Error Tracking Service — Phase 13
 *
 * In-memory error tracker designed to be swappable with Sentry.
 * Captures errors with context, supports querying by route, and auto-trims.
 */

import { randomUUID } from 'crypto';

// ─── Types ─────────────────────────────────────────────────────────────

export interface ErrorEvent {
  id: string;
  message: string;
  stack: string | undefined;
  timestamp: number;
  severity: 'error' | 'warning' | 'fatal';
  context: {
    userId?: string;
    tenantId?: string;
    route?: string;
    userAgent?: string;
    ipAddress?: string;
  };
  tags: string[];
  fingerprint: string;
}

// ─── Error Tracker ──────────────────────────────────────────────────────

const MAX_ERRORS = 10_000;

export class ErrorTracker {
  private errors: ErrorEvent[] = [];

  /**
   * Capture an error event. Returns the event ID.
   */
  capture(error: Error | string, context?: Partial<ErrorEvent>): string {
    const id = randomUUID();
    const message = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;
    const timestamp = Date.now();

    const event: ErrorEvent = {
      id,
      message,
      stack,
      timestamp,
      severity: context?.severity ?? 'error',
      context: {
        userId: context?.context?.userId,
        tenantId: context?.context?.tenantId,
        route: context?.context?.route,
        userAgent: context?.context?.userAgent,
        ipAddress: context?.context?.ipAddress,
      },
      tags: context?.tags ?? [],
      fingerprint: context?.fingerprint ?? message,
    };

    this.errors.push(event);

    // Auto-trim when exceeding max capacity
    if (this.errors.length > MAX_ERRORS) {
      this.errors = this.errors.slice(-MAX_ERRORS);
    }

    return id;
  }

  /**
   * Get the most recent errors, newest first.
   */
  getRecent(limit = 50): ErrorEvent[] {
    return this.errors.slice(-limit).reverse();
  }

  /**
   * Get errors filtered by route, newest first.
   */
  getByRoute(route: string, limit = 50): ErrorEvent[] {
    return this.errors
      .filter(e => e.context.route === route)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get aggregated error statistics.
   */
  getStats(): {
    total: number;
    bySeverity: Record<string, number>;
    byRoute: Record<string, number>;
    topRoutes: Array<{ route: string; count: number }>;
    lastHour: number;
    last24h: number;
  } {
    const bySeverity: Record<string, number> = {};
    const byRoute: Record<string, number> = {};
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    let lastHour = 0;
    let last24h = 0;

    for (const e of this.errors) {
      bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;

      const route = e.context.route || '(unknown)';
      byRoute[route] = (byRoute[route] || 0) + 1;

      if (e.timestamp >= oneHourAgo) lastHour++;
      if (e.timestamp >= twentyFourHoursAgo) last24h++;
    }

    const topRoutes = Object.entries(byRoute)
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total: this.errors.length,
      bySeverity,
      byRoute,
      topRoutes,
      lastHour,
      last24h,
    };
  }

  /**
   * Clear all captured errors.
   */
  clear(): void {
    this.errors = [];
  }
}

// Singleton export
export const errorTracker = new ErrorTracker();
