/**
 * Alerting Rules Engine — Phase 13
 *
 * Evaluates conditions against metric data and generates alerts.
 * Supports cooldown periods, acknowledgement, and resolution.
 */

import { randomUUID } from 'crypto';

// ─── Types ─────────────────────────────────────────────────────────────

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: (data: Record<string, unknown>) => boolean;
  severity: 'info' | 'warning' | 'critical';
  cooldownMs: number;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  data: Record<string, unknown>;
  acknowledged: boolean;
  resolved: boolean;
  resolvedAt?: number;
}

// ─── Alert Manager ──────────────────────────────────────────────────────

export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private lastTriggered: Map<string, number> = new Map();

  /**
   * Register an alert rule.
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Evaluate all enabled rules against the provided data.
   * Returns newly triggered alerts (respects cooldown).
   */
  evaluate(data: Record<string, unknown>): Alert[] {
    const triggered: Alert[] = [];
    const now = Date.now();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const shouldFire = rule.condition(data);
      if (!shouldFire) continue;

      // Check cooldown
      const lastTime = this.lastTriggered.get(rule.id) ?? 0;
      if (now - lastTime < rule.cooldownMs) continue;

      this.lastTriggered.set(rule.id, now);

      const alert: Alert = {
        id: randomUUID(),
        ruleId: rule.id,
        severity: rule.severity,
        message: rule.description,
        timestamp: now,
        data: { ...data },
        acknowledged: false,
        resolved: false,
      };

      this.activeAlerts.set(alert.id, alert);
      this.alertHistory.push(alert);
      triggered.push(alert);
    }

    return triggered;
  }

  /**
   * Get all currently active (non-resolved) alerts.
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(a => !a.resolved);
  }

  /**
   * Acknowledge an active alert.
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Resolve an active alert.
   */
  resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
    }
  }

  /**
   * Get alert history (all alerts, newest first).
   */
  getAlertHistory(limit = 50): Alert[] {
    return this.alertHistory.slice(-limit).reverse();
  }
}

// ─── Built-in Rules ────────────────────────────────────────────────────

const FIVE_MINUTES = 300_000;

const builtinRules: AlertRule[] = [
  {
    id: 'high-5xx-rate',
    name: 'High 5xx Error Rate',
    description: 'Error rate exceeds 5% in the last 100 requests',
    severity: 'warning',
    cooldownMs: FIVE_MINUTES,
    enabled: true,
    condition: (data) => {
      const errorRate = data.errorRate as number | undefined;
      const totalRequests = data.totalRequests as number | undefined;
      return (
        typeof errorRate === 'number' &&
        errorRate > 5 &&
        typeof totalRequests === 'number' &&
        totalRequests >= 100
      );
    },
  },
  {
    id: 'high-p95-latency',
    name: 'High p95 Latency',
    description: 'p95 latency exceeds 3000ms',
    severity: 'warning',
    cooldownMs: FIVE_MINUTES,
    enabled: true,
    condition: (data) => {
      const p95 = data.p95LatencyMs as number | undefined;
      return typeof p95 === 'number' && p95 > 3000;
    },
  },
  {
    id: 'slo-budget-warning',
    name: 'SLO Budget Warning',
    description: 'An SLO has less than 30% error budget remaining',
    severity: 'critical',
    cooldownMs: FIVE_MINUTES,
    enabled: true,
    condition: (data) => {
      const budgetPercent = data.minBudgetPercent as number | undefined;
      return typeof budgetPercent === 'number' && budgetPercent < 30;
    },
  },
  {
    id: 'db-connection-issues',
    name: 'Database Connection Issues',
    description: 'Database health check failed or connection pool exhausted',
    severity: 'critical',
    cooldownMs: FIVE_MINUTES,
    enabled: true,
    condition: (data) => {
      const dbHealthy = data.dbHealthy as boolean | undefined;
      return dbHealthy === false;
    },
  },
  {
    id: 'ws-disconnect-spike',
    name: 'WebSocket Disconnection Spike',
    description: 'WebSocket active connections dropped significantly',
    severity: 'warning',
    cooldownMs: FIVE_MINUTES,
    enabled: true,
    condition: (data) => {
      const wsDropRate = data.wsDropRate as number | undefined;
      return typeof wsDropRate === 'number' && wsDropRate > 50;
    },
  },
];

// ─── Singleton with built-in rules registered ──────────────────────────

export const alertManager = new AlertManager();
for (const rule of builtinRules) {
  alertManager.addRule(rule);
}
