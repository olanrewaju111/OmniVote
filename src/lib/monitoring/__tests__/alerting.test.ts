import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlertManager } from '../alerting';
import type { AlertRule } from '../alerting';

describe('AlertManager', () => {
  let manager: AlertManager;

  beforeEach(() => {
    manager = new AlertManager();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  const testRule: AlertRule = {
    id: 'test-rule',
    name: 'Test Rule',
    description: 'Test alert triggered',
    condition: (data) => (data.value as number) > 10,
    severity: 'warning',
    cooldownMs: 60_000,
    enabled: true,
  };

  it('does not trigger when condition is false', () => {
    manager.addRule(testRule);
    const alerts = manager.evaluate({ value: 5 });
    expect(alerts).toHaveLength(0);
  });

  it('triggers when condition is true', () => {
    manager.addRule(testRule);
    const alerts = manager.evaluate({ value: 20 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].ruleId).toBe('test-rule');
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].acknowledged).toBe(false);
    expect(alerts[0].resolved).toBe(false);
  });

  it('respects cooldown — does not re-trigger within cooldown', () => {
    manager.addRule(testRule);
    const first = manager.evaluate({ value: 20 });
    expect(first).toHaveLength(1);

    const second = manager.evaluate({ value: 30 });
    expect(second).toHaveLength(0); // still in cooldown
  });

  it('re-triggers after cooldown expires', () => {
    manager.addRule(testRule);
    manager.evaluate({ value: 20 });

    vi.advanceTimersByTime(61_000); // past cooldown
    const alerts = manager.evaluate({ value: 25 });
    expect(alerts).toHaveLength(1);
  });

  it('does not trigger disabled rules', () => {
    const disabledRule = { ...testRule, enabled: false };
    manager.addRule(disabledRule);
    const alerts = manager.evaluate({ value: 100 });
    expect(alerts).toHaveLength(0);
  });

  it('getActiveAlerts returns non-resolved alerts', () => {
    manager.addRule(testRule);
    manager.evaluate({ value: 20 });
    const active = manager.getActiveAlerts();
    expect(active).toHaveLength(1);
  });

  it('acknowledgeAlert marks alert as acknowledged', () => {
    manager.addRule(testRule);
    const [alert] = manager.evaluate({ value: 20 });
    manager.acknowledgeAlert(alert.id);
    const active = manager.getActiveAlerts();
    expect(active[0].acknowledged).toBe(true);
  });

  it('resolveAlert removes from active alerts', () => {
    manager.addRule(testRule);
    const [alert] = manager.evaluate({ value: 20 });
    manager.resolveAlert(alert.id);
    const active = manager.getActiveAlerts();
    expect(active).toHaveLength(0);
  });

  it('resolved alerts still appear in history', () => {
    manager.addRule(testRule);
    const [alert] = manager.evaluate({ value: 20 });
    manager.resolveAlert(alert.id);
    const history = manager.getAlertHistory();
    expect(history).toHaveLength(1);
    expect(history[0].resolved).toBe(true);
    expect(history[0].resolvedAt).toBeTruthy();
  });

  it('getAlertHistory returns newest first with limit', () => {
    manager.addRule(testRule);
    manager.evaluate({ value: 20 });

    vi.advanceTimersByTime(61_000);
    manager.evaluate({ value: 20 });

    vi.advanceTimersByTime(61_000);
    manager.evaluate({ value: 20 });

    const history = manager.getAlertHistory(2);
    expect(history).toHaveLength(2);
    // newest first — last triggered should be first in result
    expect(history[0].timestamp).toBeGreaterThanOrEqual(history[1].timestamp);
  });

  it('evaluate with multiple rules triggers independently', () => {
    const rule2: AlertRule = {
      id: 'rule-2',
      name: 'Rule 2',
      description: 'Another rule',
      condition: (data) => (data.otherValue as number) < 0,
      severity: 'critical',
      cooldownMs: 60_000,
      enabled: true,
    };
    manager.addRule(testRule);
    manager.addRule(rule2);

    const alerts = manager.evaluate({ value: 20, otherValue: -5 });
    expect(alerts).toHaveLength(2);
  });
});
