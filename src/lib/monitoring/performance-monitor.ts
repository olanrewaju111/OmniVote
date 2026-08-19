/**
 * Client-Side Performance Monitoring — Phase 13
 *
 * React hook for measuring render time and Web Vitals.
 * Performance markers for arbitrary code sections.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────

interface PerformanceMetrics {
  renderTime: number | null;
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
}

// ─── usePerformanceMetrics Hook ────────────────────────────────────────

/**
 * React hook that tracks render time and Web Vitals (FCP, LCP, CLS).
 * Reports metrics to /api/metrics (fire-and-forget).
 */
export function usePerformanceMetrics(componentName?: string): PerformanceMetrics & {
  reportMetrics: () => void;
} {
  const renderStart = useRef<number>(0);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: null,
    fcp: null,
    lcp: null,
    cls: null,
  });
  const reportedRef = useRef(false);

  useEffect(() => {
    renderStart.current = performance.now();
  });

  useEffect(() => {
    const renderEnd = performance.now();
    const renderTime = renderEnd - renderStart.current;
    setMetrics(prev => ({ ...prev, renderTime }));

    // Track Web Vitals via PerformanceObserver
    if (typeof PerformanceObserver === 'undefined') return;

    let fcp: number | null = null;
    let lcp: number | null = null;
    let cls = 0;

    // FCP observer
    try {
      const fcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          fcp = entries[0].startTime;
        }
      });
      fcpObs.observe({ type: 'paint', buffered: true });
      // Read existing entries immediately
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
      if (fcpEntry) fcp = fcpEntry.startTime;
      fcpObs.disconnect();
    } catch {
      // Not supported
    }

    // LCP observer
    try {
      const lcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          lcp = entries[entries.length - 1].startTime;
        }
      });
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      if (lcpEntries.length > 0) {
        lcp = lcpEntries[lcpEntries.length - 1].startTime;
      }
      lcpObs.disconnect();
    } catch {
      // Not supported
    }

    // CLS observer
    try {
      const clsObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as unknown as { hadRecentInput: boolean }).hadRecentInput) {
            cls += (entry as unknown as { value: number }).value;
          }
        }
      });
      clsObs.observe({ type: 'layout-shift', buffered: true });
      const clsEntries = performance.getEntriesByType('layout-shift');
      for (const entry of clsEntries) {
        const e = entry as unknown as { hadRecentInput: boolean; value: number };
        if (!e.hadRecentInput) cls += e.value;
      }
      clsObs.disconnect();
    } catch {
      // Not supported
    }

    setMetrics({ renderTime, fcp, lcp, cls });
  }, []);

  const reportMetrics = useCallback(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;

    // Fire-and-forget
    if (typeof fetch === 'undefined') return;

    fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'web-vitals',
        component: componentName || 'unknown',
        renderTime: metrics.renderTime,
        fcp: metrics.fcp,
        lcp: metrics.lcp,
        cls: metrics.cls,
        timestamp: Date.now(),
      }),
    }).catch(() => {
      // Silently ignore — fire and forget
    });
  }, [componentName, metrics.fcp, metrics.lcp, metrics.cls, metrics.renderTime]);

  return { ...metrics, reportMetrics };
}

// ─── reportWebVitals ──────────────────────────────────────────────────

/**
 * Set up PerformanceObserver for navigation and paint timings.
 * Returns a cleanup function.
 */
export function reportWebVitals(onMetric?: (metric: { name: string; value: number; timestamp: number }) => void): () => void {
  const observers: PerformanceObserver[] = [];

  if (typeof PerformanceObserver === 'undefined') return () => {};

  const report = (name: string, entry: PerformanceEntry) => {
    const metric = {
      name,
      value: entry.startTime || entry.duration,
      timestamp: Date.now(),
    };
    if (onMetric) onMetric(metric);
  };

  // Navigation timing
  try {
    const navObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        report('navigation', entry);
      }
    });
    navObs.observe({ type: 'navigation', buffered: true });
    observers.push(navObs);
  } catch {
    // Not supported
  }

  // Paint timing
  try {
    const paintObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        report(entry.name, entry);
      }
    });
    paintObs.observe({ type: 'paint', buffered: true });
    observers.push(paintObs);
  } catch {
    // Not supported
  }

  return () => {
    for (const obs of observers) obs.disconnect();
  };
}

// ─── Performance Marker ────────────────────────────────────────────────

/**
 * Create a named performance marker for timing arbitrary code sections.
 *
 * @example
 * const marker = createPerformanceMarker('database-query');
 * marker.start();
 * // ... do work ...
 * const duration = marker.end();
 * console.log(`Query took ${marker.getDuration()}ms`);
 */
export function createPerformanceMarker(name: string) {
  let startTime = 0;
  let endTime = 0;
  const label = `ov-${name}`;

  return {
    start() {
      startTime = performance.now();
      try {
        performance.mark(`${label}-start`);
      } catch {
        // Ignore mark errors
      }
    },
    end(): number {
      endTime = performance.now();
      try {
        performance.mark(`${label}-end`);
        performance.measure(label, `${label}-start`, `${label}-end`);
      } catch {
        // Ignore measure errors
      }
      return endTime - startTime;
    },
    getDuration(): number {
      if (startTime === 0) return 0;
      if (endTime === 0) return performance.now() - startTime;
      return endTime - startTime;
    },
  };
}
