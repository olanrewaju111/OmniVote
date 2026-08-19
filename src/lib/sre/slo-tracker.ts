/**
 * SLO Tracker for OmniVote — Phase 12
 *
 * In-memory SLO/SLI tracking with error budget calculation.
 * Persists to a JSON file for restart recovery.
 * Designed for single-instance deployment; upgrade to Redis/Postgres for multi-instance.
 */

import { promises as fs } from 'fs';
import path from 'path';

// ─── Types ─────────────────────────────────────────────────────────────

export interface SLODefinition {
  name: string;
  sloTarget: number; // e.g. 0.999 for 99.9%
  description: string;
  windowDays: number; // rolling window in days
}

export interface SLIRecord {
  timestamp: number;
  success: boolean;
  durationMs?: number;
  route?: string;
  statusCode?: number;
}

export interface ErrorBudget {
  sloTarget: number;
  totalRequests: number;
  failedRequests: number;
  allowedFailures: number;
  remainingFailures: number;
  budgetPercent: number; // 0-100
  burnRate: number; // current failure rate / allowed failure rate
  status: 'healthy' | 'warning' | 'exhausted';
}

export interface SLOReport {
  slo: SLODefinition;
  errorBudget: ErrorBudget;
  currentSLI: number; // actual availability/latency percentile
  compliant: boolean;
  windowStart: number;
  windowEnd: number;
}

// ─── SLO Definitions (from SRE guide doc 12) ──────────────────────────

export const SLO_DEFINITIONS: SLODefinition[] = [
  {
    name: 'api_availability',
    sloTarget: 0.999,
    description: 'API Availability — Successful requests / Total requests',
    windowDays: 30,
  },
  {
    name: 'api_latency_p95',
    sloTarget: 0.99,
    description: 'API Latency p95 — Requests < 2s / Total requests',
    windowDays: 30,
  },
  {
    name: 'api_latency_p99',
    sloTarget: 0.95,
    description: 'API Latency p99 — Requests < 5s / Total requests',
    windowDays: 30,
  },
  {
    name: 'dashboard_load',
    sloTarget: 0.95,
    description: 'Dashboard Load Time — Pages loading < 3s / Total',
    windowDays: 30,
  },
  {
    name: 'realtime_updates',
    sloTarget: 0.99,
    description: 'Real-Time Updates — Events delivered < 5s / Total',
    windowDays: 30,
  },
  {
    name: 'incident_submission',
    sloTarget: 0.9999,
    description: 'Incident Submission — Successful submissions / Total',
    windowDays: 30,
  },
  {
    name: 'data_integrity',
    sloTarget: 1.0,
    description: 'Data Integrity — Verified records / Total records (zero error budget)',
    windowDays: 30,
  },
];

// ─── Election Day stricter SLOs ────────────────────────────────────────

export const ELECTION_DAY_SLOS: Record<string, number> = {
  api_availability: 0.9999,   // 99.99% (max 8.6s downtime in 16h window)
  api_latency_p95: 0.99,      // 99% under 1s
  incident_submission: 0.99999, // 99.999%
  realtime_updates: 0.99,      // 99% under 2s
};

// ─── SLI Tracker Class ─────────────────────────────────────────────────

const PERSIST_PATH = path.join(process.cwd(), 'data', 'sli-records.json');
const MAX_RECORDS_IN_MEMORY = 100_000; // prevent unbounded memory growth

class SLOTracker {
  private records: SLIRecord[] = [];
  private initialized = false;
  private persistTimer: ReturnType<typeof setInterval> | null = null;
  private persistIntervalMs = 60_000; // persist every 60s

  /**
   * Initialize the tracker — loads persisted records from disk.
     */
  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const data = await fs.readFile(PERSIST_PATH, 'utf-8');
      const parsed = JSON.parse(data) as SLIRecord[];
      this.records = Array.isArray(parsed) ? parsed : [];
    } catch {
      // File doesn't exist yet — that's fine
      this.records = [];
    }
    this.trimRecords();
    this.initialized = true;

    // Periodic persistence
    this.persistTimer = setInterval(() => this.persist(), this.persistIntervalMs);
    // Don't prevent process exit
    if (this.persistTimer.unref) this.persistTimer.unref();
  }

  /**
   * Record a single request outcome.
   */
  record(entry: SLIRecord): void {
    if (!this.initialized) return;
    this.records.push(entry);
    if (this.records.length > MAX_RECORDS_IN_MEMORY * 1.2) {
      this.trimRecords();
    }
  }

  /**
   * Record a batch of outcomes (efficient for bulk imports).
   */
  recordBatch(entries: SLIRecord[]): void {
    if (!this.initialized) return;
    this.records.push(...entries);
    this.trimRecords();
  }

  /**
   * Get records within a time window.
   */
  getRecords(since: number, until?: number, route?: string): SLIRecord[] {
    return this.records.filter(r => {
      if (r.timestamp < since) return false;
      if (until && r.timestamp > until) return false;
      if (route && r.route !== route) return false;
      return true;
    });
  }

  /**
   * Calculate error budget for a given SLO.
   */
  calculateErrorBudget(slo: SLODefinition): ErrorBudget {
    const windowStart = Date.now() - slo.windowDays * 24 * 60 * 60 * 1000;
    const records = this.getRecords(windowStart);
    const total = records.length;

    let failed = 0;
    if (slo.name === 'data_integrity') {
      // Data integrity: 100% target, any failure exhausts budget
      failed = records.filter(r => !r.success).length;
    } else if (slo.name.includes('latency')) {
      // Latency SLOs: count requests exceeding threshold
      const thresholdMs = slo.name === 'api_latency_p95' ? 2000 : 5000;
      failed = records.filter(r => (r.durationMs ?? 0) > thresholdMs).length;
    } else {
      // Availability SLOs: count non-success responses
      failed = records.filter(r => !r.success).length;
    }

    const allowedFailures = Math.floor(total * (1 - slo.sloTarget));
    const remaining = Math.max(0, allowedFailures - failed);
    const budgetPercent = total > 0 ? (remaining / Math.max(allowedFailures, 1)) * 100 : 100;
    const actualFailureRate = total > 0 ? failed / total : 0;
    const allowedFailureRate = 1 - slo.sloTarget;
    const burnRate = allowedFailureRate > 0 ? actualFailureRate / allowedFailureRate : (failed > 0 ? Infinity : 0);

    let status: ErrorBudget['status'] = 'healthy';
    if (budgetPercent <= 0) {
      status = 'exhausted';
    } else if (budgetPercent <= 50) {
      status = 'warning';
    }

    return {
      sloTarget: slo.sloTarget,
      totalRequests: total,
      failedRequests: failed,
      allowedFailures,
      remainingFailures: remaining,
      budgetPercent: Math.min(100, Math.max(0, budgetPercent)),
      burnRate: Math.min(999, burnRate),
      status,
    };
  }

  /**
   * Get a full SLO report for a specific SLO.
   */
  getSLOReport(slo: SLODefinition): SLOReport {
    const windowStart = Date.now() - slo.windowDays * 24 * 60 * 60 * 1000;
    const errorBudget = this.calculateErrorBudget(slo);
    const records = this.getRecords(windowStart);
    const total = records.length;

    let currentSLI = 1;
    if (total > 0) {
      if (slo.name === 'data_integrity') {
        currentSLI = records.filter(r => r.success).length / total;
      } else if (slo.name.includes('latency')) {
        const thresholdMs = slo.name === 'api_latency_p95' ? 2000 : 5000;
        currentSLI = records.filter(r => (r.durationMs ?? 0) <= thresholdMs).length / total;
      } else {
        currentSLI = records.filter(r => r.success).length / total;
      }
    }

    return {
      slo,
      errorBudget,
      currentSLI,
      compliant: currentSLI >= slo.sloTarget,
      windowStart,
      windowEnd: Date.now(),
    };
  }

  /**
   * Get all SLO reports.
   */
  getAllReports(): SLOReport[] {
    return SLO_DEFINITIONS.map(slo => this.getSLOReport(slo));
  }

  /**
   * Get aggregated metrics for a time window (for Prometheus export).
   */
  getAggregatedMetrics(since: number): {
    totalRequests: number;
    failedRequests: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    requestsByRoute: Record<string, number>;
    errorsByStatus: Record<string, number>;
  } {
    const records = this.getRecords(since);
    const total = records.length;
    const failed = records.filter(r => !r.success).length;
    const latencies = records
      .map(r => r.durationMs ?? 0)
      .filter(l => l > 0)
      .sort((a, b) => a - b);

    const percentile = (arr: number[], p: number) => {
      if (arr.length === 0) return 0;
      const idx = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, idx)];
    };

    const requestsByRoute: Record<string, number> = {};
    const errorsByStatus: Record<string, number> = {};

    for (const r of records) {
      if (r.route) requestsByRoute[r.route] = (requestsByRoute[r.route] || 0) + 1;
      if (!r.success && r.statusCode) {
        const key = String(r.statusCode);
        errorsByStatus[key] = (errorsByStatus[key] || 0) + 1;
      }
    }

    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    return {
      totalRequests: total,
      failedRequests: failed,
      avgLatencyMs: Math.round(avgLatency * 100) / 100,
      p50LatencyMs: percentile(latencies, 50),
      p95LatencyMs: percentile(latencies, 95),
      p99LatencyMs: percentile(latencies, 99),
      requestsByRoute,
      errorsByStatus,
    };
  }

  /**
   * Check if a deployment freeze should be in effect.
   * Returns true if any SLO has < 50% error budget remaining.
   */
  isDeploymentFrozen(): { frozen: boolean; reasons: string[] } {
    const reasons: string[] = [];
    for (const slo of SLO_DEFINITIONS) {
      if (slo.name === 'data_integrity') continue; // always frozen if data integrity fails, handled separately
      const budget = this.calculateErrorBudget(slo);
      if (budget.budgetPercent <= 50) {
        reasons.push(`${slo.name}: ${budget.budgetPercent.toFixed(1)}% budget remaining`);
      }
    }
    return { frozen: reasons.length > 0, reasons };
  }

  /**
   * Trim old records to prevent memory bloat.
   */
  private trimRecords(): void {
    // Keep max 100k records (newest first)
    if (this.records.length > MAX_RECORDS_IN_MEMORY) {
      this.records = this.records.slice(-MAX_RECORDS_IN_MEMORY);
    }
    // Also trim records older than 35 days (slightly more than max 30d window)
    const cutoff = Date.now() - 35 * 24 * 60 * 60 * 1000;
    const firstOld = this.records.findIndex(r => r.timestamp >= cutoff);
    if (firstOld > 0) {
      this.records = this.records.slice(firstOld);
    }
  }

  /**
   * Persist records to disk.
   */
  private async persist(): Promise<void> {
    try {
      const dir = path.dirname(PERSIST_PATH);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(PERSIST_PATH, JSON.stringify(this.records), 'utf-8');
    } catch (err) {
      console.error('[SLOTracker] Failed to persist records:', err);
    }
  }

  /**
   * Shutdown — persist and clear timer.
   */
  async shutdown(): Promise<void> {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
    await this.persist();
  }
}

// Singleton instance
export const sloTracker = new SLOTracker();
