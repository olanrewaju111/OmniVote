'use client';

import { useEffect } from 'react';
import { reportWebVitals } from '@/lib/monitoring/performance-monitor';

/**
 * PerformanceObserver component — Phase 15 integration.
 *
 * Mounts once at the root layout level. Sets up PerformanceObservers
 * for navigation, paint, and layout-shift timings. Reports metrics
 * fire-and-forget to /api/metrics for SLO tracking.
 *
 * This is a renderless component (returns null).
 */
export function PerformanceObserver() {
  useEffect(() => {
    const cleanup = reportWebVitals((metric) => {
      // Fire-and-forget POST to /api/metrics
      if (typeof fetch === 'undefined') return;
      fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'web-vital',
          name: metric.name,
          value: metric.value,
          timestamp: metric.timestamp,
        }),
      }).catch(() => {
        // Silently ignore
      });
    });

    return cleanup;
  }, []);

  return null;
}
