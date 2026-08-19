/**
 * Web Vitals Aggregator — unit tests
 * Phase 19
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebVitalsAggregator, DEFAULT_THRESHOLDS } from '@/lib/monitoring/web-vitals-aggregator';

describe('WebVitalsAggregator', () => {
  let agg: WebVitalsAggregator;

  beforeEach(() => {
    agg = new WebVitalsAggregator({
      maxEvents: 100,
      maxAnomalies: 50,
      maxAgeMs: 60_000,
    });
  });

  // ─── Recording ────────────────────────────────────────────────
  describe('record / recordBatch', () => {
    it('records a single event', () => {
      agg.record({ name: 'LCP', value: 2000, timestamp: new Date().toISOString() });
      expect(agg.getTotalEvents()).toBe(1);
    });

    it('records a batch of events', () => {
      const events = [
        { name: 'LCP', value: 2000, timestamp: new Date().toISOString() },
        { name: 'CLS', value: 0.05, timestamp: new Date().toISOString() },
        { name: 'FCP', value: 1000, timestamp: new Date().toISOString() },
      ];
      agg.recordBatch(events);
      expect(agg.getTotalEvents()).toBe(3);
    });

    it('respects maxEvents capacity (ring buffer)', () => {
      for (let i = 0; i < 150; i++) {
        agg.record({ name: 'LCP', value: 1000 + i, timestamp: new Date().toISOString() });
      }
      // Should be capped at 100
      expect(agg.getTotalEvents()).toBe(100);
    });

    it('stores route information', () => {
      agg.record({ name: 'LCP', value: 2000, timestamp: new Date().toISOString(), route: '/dashboard' });
      const routes = agg.getRoutes();
      expect(routes).toContain('/dashboard');
    });
  });

  // ─── Statistics ────────────────────────────────────────────────
  describe('getStats', () => {
    it('returns null for unknown metric', () => {
      expect(agg.getStats('NONEXISTENT')).toBeNull();
    });

    it('computes correct statistics for a single value', () => {
      agg.record({ name: 'LCP', value: 2500, timestamp: new Date().toISOString() });
      const stats = agg.getStats('LCP');
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(1);
      expect(stats!.min).toBe(2500);
      expect(stats!.max).toBe(2500);
      expect(stats!.mean).toBe(2500);
      expect(stats!.median).toBe(2500);
      expect(stats!.p75).toBe(2500);
      expect(stats!.p95).toBe(2500);
      expect(stats!.p99).toBe(2500);
      expect(stats!.stdDev).toBe(0);
    });

    it('computes correct percentiles for multiple values', () => {
      const values = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000];
      for (const v of values) {
        agg.record({ name: 'LCP', value: v, timestamp: new Date().toISOString() });
      }
      const stats = agg.getStats('LCP');
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(9);
      expect(stats!.min).toBe(1000);
      expect(stats!.max).toBe(5000);
      expect(stats!.median).toBe(3000); // Middle of 9 values
      expect(stats!.p75).toBeGreaterThan(3000);
      expect(stats!.p95).toBeGreaterThan(4000);
      expect(stats!.p99).toBeGreaterThanOrEqual(4950);
      expect(stats!.stdDev).toBeGreaterThan(0);
    });

    it('filters by route', () => {
      agg.record({ name: 'LCP', value: 1000, timestamp: new Date().toISOString(), route: '/dashboard' });
      agg.record({ name: 'LCP', value: 3000, timestamp: new Date().toISOString(), route: '/login' });
      agg.record({ name: 'LCP', value: 2000, timestamp: new Date().toISOString(), route: '/dashboard' });

      const dashStats = agg.getStats('LCP', '/dashboard');
      expect(dashStats).not.toBeNull();
      expect(dashStats!.count).toBe(2);
      expect(dashStats!.mean).toBe(1500);
    });

    it('getAllStats returns all metric types', () => {
      agg.record({ name: 'LCP', value: 2500, timestamp: new Date().toISOString() });
      agg.record({ name: 'CLS', value: 0.1, timestamp: new Date().toISOString() });
      agg.record({ name: 'FCP', value: 1500, timestamp: new Date().toISOString() });

      const all = agg.getAllStats();
      expect(Object.keys(all)).toHaveLength(3);
      expect(all['LCP'].count).toBe(1);
      expect(all['CLS'].count).toBe(1);
      expect(all['FCP'].count).toBe(1);
    });
  });

  // ─── Anomaly Detection ─────────────────────────────────────────
  describe('anomaly detection', () => {
    it('creates warning anomaly for values above good threshold', () => {
      agg.record({ name: 'LCP', value: 3000, timestamp: new Date().toISOString(), route: '/dashboard' });
      const anomalies = agg.getAnomalies();
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].severity).toBe('warning');
      expect(anomalies[0].metric).toBe('LCP');
      expect(anomalies[0].route).toBe('/dashboard');
    });

    it('creates critical anomaly for values above poor threshold', () => {
      agg.record({ name: 'LCP', value: 5000, timestamp: new Date().toISOString(), route: '/slow-page' });
      const anomalies = agg.getAnomalies();
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].severity).toBe('critical');
      expect(anomalies[0].message).toContain('slow-page');
    });

    it('does not create anomaly for good values', () => {
      agg.record({ name: 'LCP', value: 2000, timestamp: new Date().toISOString() });
      expect(agg.getAnomalies()).toHaveLength(0);
    });

    it('does not create anomaly for unknown metrics', () => {
      agg.record({ name: 'UNKNOWN_METRIC', value: 99999, timestamp: new Date().toISOString() });
      expect(agg.getAnomalies()).toHaveLength(0);
    });

    it('respects maxAnomalies limit', () => {
      const smallAgg = new WebVitalsAggregator({ maxAnomalies: 3 });
      for (let i = 0; i < 10; i++) {
        smallAgg.record({ name: 'LCP', value: 5000, timestamp: new Date().toISOString() });
      }
      expect(smallAgg.getAnomalies()).toHaveLength(3);
    });

    it('filters anomalies by metric', () => {
      agg.record({ name: 'LCP', value: 5000, timestamp: new Date().toISOString() });
      agg.record({ name: 'CLS', value: 0.5, timestamp: new Date().toISOString() });
      agg.record({ name: 'LCP', value: 5000, timestamp: new Date().toISOString() });

      const lcpAnomalies = agg.getAnomalies({ metric: 'LCP' });
      expect(lcpAnomalies).toHaveLength(2);
      expect(lcpAnomalies.every(a => a.metric === 'LCP')).toBe(true);
    });

    it('filters anomalies by severity', () => {
      agg.record({ name: 'LCP', value: 3000, timestamp: new Date().toISOString() }); // warning
      agg.record({ name: 'LCP', value: 5000, timestamp: new Date().toISOString() }); // critical

      const criticals = agg.getAnomalies({ severity: 'critical' });
      expect(criticals).toHaveLength(1);
      expect(criticals[0].severity).toBe('critical');
    });

    it('returns anomaly counts', () => {
      agg.record({ name: 'LCP', value: 3000, timestamp: new Date().toISOString() }); // warning
      agg.record({ name: 'LCP', value: 5000, timestamp: new Date().toISOString() }); // critical
      agg.record({ name: 'CLS', value: 0.5, timestamp: new Date().toISOString() });  // critical

      const counts = agg.getAnomalyCounts();
      expect(counts.warning).toBe(1);
      expect(counts.critical).toBe(2);
      expect(counts.total).toBe(3);
    });

    it('limits returned anomalies', () => {
      for (let i = 0; i < 10; i++) {
        agg.record({ name: 'LCP', value: 5000, timestamp: new Date().toISOString() });
      }
      const limited = agg.getAnomalies({ limit: 3 });
      expect(limited).toHaveLength(3);
    });
  });

  // ─── Health Score ──────────────────────────────────────────────
  describe('getHealthScore', () => {
    it('returns 100 when no events', () => {
      expect(agg.getHealthScore()).toBe(100);
    });

    it('returns 100 when all metrics are good', () => {
      agg.record({ name: 'LCP', value: 1000, timestamp: new Date().toISOString() });
      agg.record({ name: 'CLS', value: 0.01, timestamp: new Date().toISOString() });
      agg.record({ name: 'FCP', value: 500, timestamp: new Date().toISOString() });
      expect(agg.getHealthScore()).toBe(100);
    });

    it('returns lower score for mixed quality', () => {
      agg.record({ name: 'LCP', value: 1000, timestamp: new Date().toISOString() }); // good
      agg.record({ name: 'LCP', value: 3000, timestamp: new Date().toISOString() }); // needs-improvement
      agg.record({ name: 'LCP', value: 5000, timestamp: new Date().toISOString() }); // poor
      // Score = (100 + 50 + 0) / 3 = 50
      expect(agg.getHealthScore()).toBe(50);
    });

    it('returns 0 when all metrics are poor', () => {
      agg.record({ name: 'LCP', value: 5000, timestamp: new Date().toISOString() });
      agg.record({ name: 'CLS', value: 1.0, timestamp: new Date().toISOString() });
      expect(agg.getHealthScore()).toBe(0);
    });
  });

  // ─── Budget Compliance ─────────────────────────────────────────
  describe('getBudgetCompliance', () => {
    it('returns compliance for all configured metrics', () => {
      agg.record({ name: 'LCP', value: 2000, timestamp: new Date().toISOString() });
      const compliance = agg.getBudgetCompliance();
      // Should have entries for all default thresholds
      expect(Object.keys(compliance)).toContain('LCP');
      expect(Object.keys(compliance)).toContain('CLS');
      expect(Object.keys(compliance)).toContain('FCP');
    });

    it('reports compliant when p75 is under target', () => {
      for (let i = 0; i < 10; i++) {
        agg.record({ name: 'LCP', value: 2000, timestamp: new Date().toISOString() });
      }
      const compliance = agg.getBudgetCompliance();
      expect(compliance['LCP'].compliant).toBe(true);
      expect(compliance['LCP'].currentP75).toBe(2000);
    });

    it('reports non-compliant when p75 exceeds target', () => {
      for (let i = 0; i < 10; i++) {
        agg.record({ name: 'LCP', value: 5000, timestamp: new Date().toISOString() });
      }
      const compliance = agg.getBudgetCompliance();
      expect(compliance['LCP'].compliant).toBe(false);
    });

    it('supports custom budget overrides', () => {
      for (let i = 0; i < 10; i++) {
        agg.record({ name: 'LCP', value: 3000, timestamp: new Date().toISOString() });
      }
      // With a strict 1000ms budget, should be non-compliant
      const compliance = agg.getBudgetCompliance({ LCP: 1000 });
      expect(compliance['LCP'].compliant).toBe(false);
      expect(compliance['LCP'].target).toBe(1000);
    });
  });

  // ─── Prometheus Export ──────────────────────────────────────────
  describe('toPrometheus', () => {
    it('returns valid Prometheus format', () => {
      agg.record({ name: 'LCP', value: 2500, timestamp: new Date().toISOString() });
      const output = agg.toPrometheus();

      expect(output).toContain('# HELP');
      expect(output).toContain('# TYPE');
      expect(output).toContain('omnivote_web_vital_lcp_count 1');
      expect(output).toContain('omnivote_web_vitals_health_score');
      expect(output).toContain('omnivote_web_vitals_anomalies_total');
    });

    it('includes summary quantiles', () => {
      for (let i = 0; i < 10; i++) {
        agg.record({ name: 'LCP', value: 2000 + i * 100, timestamp: new Date().toISOString() });
      }
      const output = agg.toPrometheus();
      expect(output).toContain('quantile="0.5"');
      expect(output).toContain('quantile="0.75"');
      expect(output).toContain('quantile="0.95"');
      expect(output).toContain('quantile="0.99"');
    });
  });

  // ─── Routes ────────────────────────────────────────────────────
  describe('getRoutes', () => {
    it('returns empty array when no routes recorded', () => {
      expect(agg.getRoutes()).toEqual([]);
    });

    it('returns unique sorted routes', () => {
      agg.record({ name: 'LCP', value: 1000, timestamp: new Date().toISOString(), route: '/dashboard' });
      agg.record({ name: 'LCP', value: 2000, timestamp: new Date().toISOString(), route: '/login' });
      agg.record({ name: 'LCP', value: 1500, timestamp: new Date().toISOString(), route: '/dashboard' });

      const routes = agg.getRoutes();
      expect(routes).toEqual(['/dashboard', '/login']);
    });
  });

  // ─── Clear / Reset ─────────────────────────────────────────────
  describe('clear', () => {
    it('clears all events and anomalies', () => {
      agg.record({ name: 'LCP', value: 5000, timestamp: new Date().toISOString() });
      agg.record({ name: 'CLS', value: 0.5, timestamp: new Date().toISOString() });
      expect(agg.getTotalEvents()).toBe(2);
      expect(agg.getAnomalies()).toHaveLength(2);

      agg.clear();

      expect(agg.getTotalEvents()).toBe(0);
      expect(agg.getAnomalies()).toHaveLength(0);
      expect(agg.getHealthScore()).toBe(100);
    });
  });

  // ─── Cleanup ───────────────────────────────────────────────────
  describe('cleanup', () => {
    it('removes stale events based on maxAgeMs', () => {
      const now = Date.now();
      agg.record({ name: 'LCP', value: 2000, timestamp: new Date(now - 120_000).toISOString() }); // stale
      agg.record({ name: 'LCP', value: 1000, timestamp: new Date(now - 10_000).toISOString() }); // fresh
      agg.record({ name: 'CLS', value: 0.5, timestamp: new Date(now - 120_000).toISOString() }); // stale anomaly

      // Manually trigger cleanup
      agg.startCleanup(1); // 1ms interval

      // Wait a bit for the interval to fire
      return new Promise(resolve => {
        setTimeout(() => {
          agg.stopCleanup();
          // Fresh event should remain
          expect(agg.getTotalEvents()).toBeLessThanOrEqual(1);
          resolve(undefined);
        }, 100);
      });
    });
  });

  // ─── Buffer Utilization ────────────────────────────────────────
  describe('getBufferUtilization', () => {
    it('returns 0 when empty', () => {
      expect(agg.getBufferUtilization()).toBe(0);
    });

    it('returns correct utilization', () => {
      const utilAgg = new WebVitalsAggregator({ maxEvents: 10 });
      for (let i = 0; i < 5; i++) {
        utilAgg.record({ name: 'LCP', value: 1000, timestamp: new Date().toISOString() });
      }
      expect(utilAgg.getBufferUtilization()).toBe(0.5);
    });
  });

  // ─── DEFAULT_THRESHOLDS ────────────────────────────────────────
  describe('DEFAULT_THRESHOLDS', () => {
    it('defines thresholds for all core web vitals', () => {
      expect(DEFAULT_THRESHOLDS.LCP).toBeDefined();
      expect(DEFAULT_THRESHOLDS.INP).toBeDefined();
      expect(DEFAULT_THRESHOLDS.CLS).toBeDefined();
      expect(DEFAULT_THRESHOLDS.FCP).toBeDefined();
      expect(DEFAULT_THRESHOLDS.TTFB).toBeDefined();
      expect(DEFAULT_THRESHOLDS.FID).toBeDefined();
    });

    it('has good < poor for all metrics', () => {
      for (const [name, t] of Object.entries(DEFAULT_THRESHOLDS)) {
        expect(t.good, `${name}: good should be less than poor`).toBeLessThan(t.poor);
        expect(t.unit, `${name}: unit should be defined`).toBeDefined();
      }
    });
  });
});
