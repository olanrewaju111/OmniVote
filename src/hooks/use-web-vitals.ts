/**
 * useWebVitals — Client-side Real User Monitoring (RUM) hook.
 *
 * Collects Core Web Vitals (LCP, INP, CLS, FCP, TTFB) from the browser's
 * PerformanceObserver API and sends them to /api/metrics for aggregation.
 *
 * Features:
 *   - Uses the standard `web-vitals` library when available, falls back to raw PerformanceObserver
 *   - Batches metrics and sends them together to reduce network overhead
 *   - Respects Page Visibility API: pauses collection when tab is hidden
 *   - Throttles reporting to avoid excessive POST calls
 *   - Supports custom reporting callback for unit testing / custom backends
 *
 * Phase 21: Real-time Web Vitals pipeline
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────

export interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  navigationType?: string;
  timestamp: string;
  route: string;
}

interface UseWebVitalsOptions {
  /** Enable metric collection (default: true in production) */
  enabled?: boolean;
  /** Batch interval in ms (default: 5000) */
  batchInterval?: number;
  /** Max batch size before immediate flush (default: 20) */
  maxBatchSize?: number;
  /** Custom reporting callback — overrides default fetch to /api/metrics */
  onReport?: (metrics: WebVitalMetric[]) => void;
  /** Route override — defaults to window.location.pathname */
  route?: string;
}

// ─── Connection info helpers ──────────────────────────────────────────

function getDeviceType(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return 'mobile';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  return 'desktop';
}

function getConnectionType(): string {
  if (typeof window === 'undefined') return 'unknown';
  const conn = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
  return conn?.effectiveType || 'unknown';
}

// ─── Raw PerformanceObserver fallback ─────────────────────────────────

/**
 * Fallback metric collection using raw PerformanceObserver when the
 * web-vitals library is not bundled (e.g. tests, SSR).
 * Covers LCP, FCP, CLS, and TTFB. INP is not available via raw PO.
 */
function observeRawPerformanceObserver(
  onMetric: (metric: WebVitalMetric) => void,
  route: string,
) {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  // FCP
  try {
    const fcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        const value = entry.startTime;
        const rating = value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
        onMetric({ name: 'FCP', value, rating, delta: value, timestamp: new Date().toISOString(), route });
      }
    });
    fcpObs.observe({ type: 'first-contentful-paint', buffered: true });
  } catch {
    // FCP not supported
  }

  // LCP
  try {
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) {
        const value = last.startTime;
        const rating = value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
        onMetric({ name: 'LCP', value, rating, delta: value, timestamp: new Date().toISOString(), route });
      }
    });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // LCP not supported
  }

  // CLS
  try {
    let clsValue = 0;
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as unknown as { hadRecentInput: boolean; value: number };
        if (!layoutShift.hadRecentInput) {
          clsValue += layoutShift.value;
        }
      }
      const rating = clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor';
      onMetric({ name: 'CLS', value: clsValue, rating, delta: clsValue, timestamp: new Date().toISOString(), route });
    });
    clsObs.observe({ type: 'layout-shift', buffered: true });
  } catch {
    // CLS not supported
  }

  // TTFB
  try {
    const ttfbObs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        const navEntry = entry as unknown as { responseStart: number; requestStart: number };
        const value = navEntry.responseStart - navEntry.requestStart;
        const rating = value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
        onMetric({ name: 'TTFB', value, rating, delta: value, timestamp: new Date().toISOString(), route });
      }
    });
    ttfbObs.observe({ type: 'navigation', buffered: true });
  } catch {
    // TTFB not supported
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────

/**
 * Hook that collects Core Web Vitals and reports them to the server.
 *
 * Usage in layout.tsx or providers.tsx:
 * ```tsx
 * useWebVitals({ enabled: process.env.NODE_ENV === 'production' });
 * ```
 */
export function useWebVitals({
  enabled = true,
  batchInterval = 5000,
  maxBatchSize = 20,
  onReport,
  route: routeOverride,
}: UseWebVitalsOptions = {}) {
  const batchRef = useRef<WebVitalMetric[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onReportRef = useRef(onReport);
  const routeRef = useRef(routeOverride);

  // Keep callback refs current
  useEffect(() => {
    onReportRef.current = onReport;
    routeRef.current = routeOverride;
  }, [onReport, routeOverride]);

  // Flush the current batch to the server or custom callback
  const flush = useCallback(() => {
    if (batchRef.current.length === 0) return;

    const batch = batchRef.current.splice(0);

    if (onReportRef.current) {
      // Custom reporting (e.g. tests, analytics)
      onReportRef.current(batch);
      return;
    }

    // Default: POST to /api/metrics
    fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'web-vitals',
        route: routeRef.current || (typeof window !== 'undefined' ? window.location.pathname : '/'),
        vitals: batch.map((m) => ({
          name: m.name,
          value: m.value,
          rating: m.rating,
          timestamp: m.timestamp,
          deviceType: getDeviceType(),
          connectionType: getConnectionType(),
        })),
      }),
      keepalive: true, // Ensure the request completes even if page unloads
    }).catch(() => {
      // Fire-and-forget: metrics are non-critical
    });
  }, []);

  // Add a metric to the batch, auto-flush if batch is full
  const addMetric = useCallback((metric: WebVitalMetric) => {
    batchRef.current.push(metric);
    if (batchRef.current.length >= maxBatchSize) {
      flush();
    }
  }, [flush, maxBatchSize]);

  // Collect metrics on mount
  useEffect(() => {
    if (!enabled) return;

    const route = routeRef.current || (typeof window !== 'undefined' ? window.location.pathname : '/');

    // Try the web-vitals library first
    let cleanup: (() => void) | undefined;

    // Dynamic import of web-vitals library (aliased in vitest.config.ts for tests)
    import('web-vitals').then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      const cleanupLCP = onLCP((metric) => {
        addMetric({
          name: 'LCP',
          value: metric.value,
          rating: metric.rating,
          delta: metric.delta,
          navigationType: metric.navigationType,
          timestamp: new Date().toISOString(),
          route,
        });
      });

      const cleanupINP = onINP((metric) => {
        addMetric({
          name: 'INP',
          value: metric.value,
          rating: metric.rating,
          delta: metric.delta,
          navigationType: metric.navigationType,
          timestamp: new Date().toISOString(),
          route,
        });
      });

      const cleanupCLS = onCLS((metric) => {
        addMetric({
          name: 'CLS',
          value: metric.value,
          rating: metric.rating,
          delta: metric.delta,
          timestamp: new Date().toISOString(),
          route,
        });
      });

      const cleanupFCP = onFCP((metric) => {
        addMetric({
          name: 'FCP',
          value: metric.value,
          rating: metric.rating,
          delta: metric.delta,
          timestamp: new Date().toISOString(),
          route,
        });
      });

      const cleanupTTFB = onTTFB((metric) => {
        addMetric({
          name: 'TTFB',
          value: metric.value,
          rating: metric.rating,
          delta: metric.delta,
          navigationType: metric.navigationType,
          timestamp: new Date().toISOString(),
          route,
        });
      });

      cleanup = () => {
        cleanupLCP();
        cleanupINP();
        cleanupCLS();
        cleanupFCP();
        cleanupTTFB();
      };
    }).catch(() => {
      // web-vitals library not available — use raw PerformanceObserver
      observeRawPerformanceObserver(addMetric, route);
    });

    // Periodic batch flush
    timerRef.current = setInterval(flush, batchInterval);

    // Flush on page hide / beforeunload to avoid data loss
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };

    const handleBeforeUnload = () => {
      flush();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      cleanup?.();
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flush(); // Flush remaining on unmount
    };
  }, [enabled, batchInterval, addMetric, flush]);

  // Return flush for manual trigger (e.g. testing)
  return { flush };
}
