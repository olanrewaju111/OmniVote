/**
 * Web Vitals Aggregation Engine — Phase 19
 *
 * Collects, stores, and aggregates Core Web Vitals (LCP, FID/INP, CLS, FCP, TTFB)
 * received from client-side PerformanceObserver. Provides:
 *   - In-memory ring buffer storage (configurable capacity)
 *   - Per-route and global percentile statistics
 *   - Anomaly detection with configurable thresholds
 *   - Prometheus-compatible metric export
 *   - Periodic cleanup of stale entries
 */

/** Core Web Vitals as reported by web-vitals library */
export interface WebVitalEvent {
  /** Metric name: LCP, INP, CLS, FCP, TTFB */
  name: string;
  /** Numeric value (ms for timing metrics, unitless for CLS) */
  value: number;
  /** ISO timestamp when the metric was reported */
  timestamp: string;
  /** Optional route/page path */
  route?: string;
  /** Unique navigation ID for grouping */
  navigationId?: string;
  /** Device/connection context */
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  connectionType?: '4g' | '3g' | '2g' | 'slow-2g';
}

/** Aggregated statistics for a single metric */
export interface MetricStats {
  name: string;
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p75: number;
  p95: number;
  p99: number;
  stdDev: number;
}

/** Anomaly record */
export interface VitalAnomaly {
  id: string;
  metric: string;
  route: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: string;
  message: string;
}

/** Metric threshold config */
export interface MetricThresholds {
  /** "Good" threshold — values below this are acceptable */
  good: number;
  /** "Poor" threshold — values above this trigger critical alerts */
  poor: number;
  /** Unit label for display/log */
  unit: string;
}

/** Default thresholds based on Google's Core Web Vitals guidelines */
export const DEFAULT_THRESHOLDS: Record<string, MetricThresholds> = {
  LCP:  { good: 2500,  poor: 4000, unit: 'ms' },
  INP:  { good: 200,   poor: 500,  unit: 'ms' },
  FID:  { good: 100,   poor: 300,  unit: 'ms' },
  CLS:  { good: 0.1,   poor: 0.25, unit: '' },
  FCP:  { good: 1800,  poor: 3000, unit: 'ms' },
  TTFB: { good: 800,   poor: 1800, unit: 'ms' },
};

/** Ring buffer for efficient bounded storage */
class RingBuffer<T> {
  private buffer: (T | null)[];
  private head = 0;
  private count = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity).fill(null);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  getAll(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - this.count + i + this.capacity) % this.capacity;
      const item = this.buffer[idx];
      if (item) result.push(item);
    }
    return result;
  }

  get length(): number {
    return this.count;
  }

  clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this.count = 0;
  }
}

/**
 * WebVitalsAggregator — central engine for collecting and analyzing web vitals.
 */
export class WebVitalsAggregator {
  private events: RingBuffer<WebVitalEvent & { id: string }>;
  private anomalies: VitalAnomaly[] = [];
  private thresholds: Record<string, MetricThresholds>;
  private maxAnomalies: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private maxAgeMs: number;
  private readonly capacity: number;

  constructor(opts?: {
    maxEvents?: number;
    maxAnomalies?: number;
    maxAgeMs?: number;
    thresholds?: Record<string, MetricThresholds>;
  }) {
    this.capacity = opts?.maxEvents ?? 10000;
    this.events = new RingBuffer(this.capacity);
    this.maxAnomalies = opts?.maxAnomalies ?? 500;
    this.maxAgeMs = opts?.maxAgeMs ?? 30 * 60 * 1000; // 30 minutes
    this.thresholds = opts?.thresholds ?? DEFAULT_THRESHOLDS;
  }

  /**
   * Record a single web vital event.
   * Automatically checks thresholds and generates anomalies.
   */
  record(event: WebVitalEvent): void {
    const id = `${event.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.events.push({ ...event, id });
    this.checkAnomaly({ ...event, id });
  }

  /**
   * Record a batch of web vital events (efficient for bulk uploads).
   */
  recordBatch(events: WebVitalEvent[]): void {
    for (const event of events) {
      this.record(event);
    }
  }

  /** Check if a value exceeds thresholds and create anomaly if needed */
  private checkAnomaly(event: WebVitalEvent & { id: string }): void {
    const config = this.thresholds[event.name];
    if (!config) return;

    let severity: 'warning' | 'critical' | null = null;
    let message = '';

    if (event.value > config.poor) {
      severity = 'critical';
      message = `${event.name} is ${event.value}${config.unit} (threshold: ${config.poor}${config.unit}) on ${event.route || 'unknown route'}`;
    } else if (event.value > config.good) {
      severity = 'warning';
      message = `${event.name} is ${event.value}${config.unit} (threshold: ${config.good}${config.unit}) on ${event.route || 'unknown route'}`;
    }

    if (severity && this.anomalies.length < this.maxAnomalies) {
      this.anomalies.push({
        id: event.id,
        metric: event.name,
        route: event.route || 'unknown',
        value: event.value,
        threshold: severity === 'critical' ? config.poor : config.good,
        severity,
        timestamp: event.timestamp || new Date().toISOString(),
        message,
      });
    }
  }

  /**
   * Get percentile statistics for a metric, optionally filtered by route.
   */
  getStats(metricName: string, route?: string): MetricStats | null {
    const events = this.events.getAll().filter(
      e => e.name === metricName && (!route || e.route === route)
    );

    if (events.length === 0) return null;

    const values = events.map(e => e.value).sort((a, b) => a - b);
    const n = values.length;

    return {
      name: metricName,
      count: n,
      min: values[0],
      max: values[n - 1],
      mean: values.reduce((s, v) => s + v, 0) / n,
      median: this.percentile(values, 50),
      p75: this.percentile(values, 75),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99),
      stdDev: this.standardDeviation(values),
    };
  }

  /** Get stats for all metrics, optionally filtered by route */
  getAllStats(route?: string): Record<string, MetricStats> {
    const result: Record<string, MetricStats> = {};
    const allEvents = this.events.getAll();

    // Get unique metric names
    const metricNames = new Set(allEvents.map(e => e.name));

    for (const name of metricNames) {
      const stats = this.getStats(name, route);
      if (stats) result[name] = stats;
    }

    return result;
  }

  /** Get all routes that have reported vitals */
  getRoutes(): string[] {
    const routes = new Set<string>();
    for (const e of this.events.getAll()) {
      if (e.route) routes.add(e.route);
    }
    return Array.from(routes).sort();
  }

  /** Get anomalies, optionally filtered */
  getAnomalies(opts?: {
    metric?: string;
    severity?: 'warning' | 'critical';
    route?: string;
    limit?: number;
  }): VitalAnomaly[] {
    let result = [...this.anomalies];

    if (opts?.metric) result = result.filter(a => a.metric === opts.metric);
    if (opts?.severity) result = result.filter(a => a.severity === opts.severity);
    if (opts?.route) result = result.filter(a => a.route === opts.route);

    // Return most recent first
    result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (opts?.limit) result = result.slice(0, opts.limit);

    return result;
  }

  /** Get anomaly counts by severity */
  getAnomalyCounts(): { total: number; warning: number; critical: number } {
    return {
      total: this.anomalies.length,
      warning: this.anomalies.filter(a => a.severity === 'warning').length,
      critical: this.anomalies.filter(a => a.severity === 'critical').length,
    };
  }

  /**
   * Get a simple health score (0-100) based on recent vitals.
   * 100 = all vitals in "good" range, 0 = all in "poor" range.
   */
  getHealthScore(): number {
    const allEvents = this.events.getAll();
    if (allEvents.length === 0) return 100;

    let good = 0;
    let needsImprovement = 0;
    let poor = 0;

    for (const e of allEvents) {
      const config = this.thresholds[e.name];
      if (!config) continue;

      if (e.value <= config.good) good++;
      else if (e.value <= config.poor) needsImprovement++;
      else poor++;
    }

    const total = good + needsImprovement + poor;
    // Score: 100 for all good, 50 for needs-improvement, 0 for poor
    return Math.round(((good * 100 + needsImprovement * 50) / total));
  }

  /**
   * Get performance budget compliance.
   * Returns a map of metric -> { compliant, currentP75, target }.
   */
  getBudgetCompliance(budgetOverrides?: Record<string, number>): Record<string, {
    compliant: boolean;
    currentP75: number;
    target: number;
    unit: string;
  }> {
    const result: Record<string, {
      compliant: boolean;
      currentP75: number;
      target: number;
      unit: string;
    }> = {};

    for (const [metric, config] of Object.entries(this.thresholds)) {
      const stats = this.getStats(metric);
      const target = budgetOverrides?.[metric] ?? config.good;
      const currentP75 = stats?.p75 ?? 0;

      result[metric] = {
        compliant: currentP75 <= target,
        currentP75: Math.round(currentP75 * 100) / 100,
        target,
        unit: config.unit,
      };
    }

    return result;
  }

  /** Export as Prometheus text format */
  toPrometheus(): string {
    const lines: string[] = [];

    // Summary stats per metric
    const allStats = this.getAllStats();
    for (const [metric, stats] of Object.entries(allStats)) {
      lines.push(`# HELP omnivote_web_vital_${metric.toLowerCase()} ${metric} value`);
      lines.push(`# TYPE omnivote_web_vital_${metric.toLowerCase()} summary`);
      lines.push(`omnivote_web_vital_${metric.toLowerCase()}_count ${stats.count}`);
      lines.push(`omnivote_web_vital_${metric.toLowerCase()}{{quantile="0.5"}} ${stats.median}`);
      lines.push(`omnivote_web_vital_${metric.toLowerCase()}_{{quantile="0.75"}} ${stats.p75}`);
      lines.push(`omnivote_web_vital_${metric.toLowerCase()}_{{quantile="0.95"}} ${stats.p95}`);
      lines.push(`omnivote_web_vital_${metric.toLowerCase()}_{{quantile="0.99"}} ${stats.p99}`);
      lines.push('');
    }

    // Health score gauge
    lines.push('# HELP omnivote_web_vitals_health_score Overall web vitals health score (0-100)');
    lines.push('# TYPE omnivote_web_vitals_health_score gauge');
    lines.push(`omnivote_web_vitals_health_score ${this.getHealthScore()}`);
    lines.push('');

    // Anomaly counters
    const counts = this.getAnomalyCounts();
    lines.push('# HELP omnivote_web_vitals_anomalies_total Total web vitals anomalies');
    lines.push('# TYPE omnivote_web_vitals_anomalies_total counter');
    lines.push(`omnivote_web_vitals_anomalies_total{severity="warning"} ${counts.warning}`);
    lines.push(`omnivote_web_vitals_anomalies_total{severity="critical"} ${counts.critical}`);
    lines.push('');

    return lines.join('\n');
  }

  /** Clear all data */
  clear(): void {
    this.events.clear();
    this.anomalies = [];
  }

  /** Get current buffer fill rate (0-1) */
  getBufferUtilization(): number {
    return this.events.length / this.capacity;
  }

  /** Get total events recorded */
  getTotalEvents(): number {
    return this.events.length;
  }

  /** Start automatic cleanup of stale events */
  startCleanup(intervalMs?: number): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => {
      this.cleanupStale();
    }, intervalMs ?? 60_000);
  }

  /** Stop automatic cleanup */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /** Remove events older than maxAgeMs */
  private cleanupStale(): void {
    const cutoff = Date.now() - this.maxAgeMs;
    const allEvents = this.events.getAll();
    if (allEvents.length === 0) return;

    // Re-create buffer with only fresh events
    const fresh = allEvents.filter(e => {
      const ts = new Date(e.timestamp).getTime();
      return ts > cutoff;
    });

    this.events.clear();
    for (const e of fresh) {
      this.events.push(e);
    }

    // Also clean anomalies
    this.anomalies = this.anomalies.filter(a => {
      const ts = new Date(a.timestamp).getTime();
      return ts > cutoff;
    });
  }

  // ─── Statistical helpers ───────────────────────────────────────

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];

    const index = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const squaredDiffs = values.map(v => (v - mean) ** 2);
    const variance = squaredDiffs.reduce((s, v) => s + v, 0) / (values.length - 1);
    return Math.sqrt(variance);
  }
}

/**
 * Global singleton for web vitals aggregation.
 * Access via import { webVitalsAggregator } from this module.
 */
let _instance: WebVitalsAggregator | null = null;

export function getWebVitalsAggregator(): WebVitalsAggregator {
  if (!_instance) {
    _instance = new WebVitalsAggregator();
    // Start auto-cleanup every 5 minutes
    _instance.startCleanup(300_000);
  }
  return _instance;
}

export const webVitalsAggregator = new Proxy({} as WebVitalsAggregator, {
  get(_target, prop) {
    const instance = getWebVitalsAggregator();
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});
