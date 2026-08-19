/**
 * Unit tests for the notification router (pure logic, no DB or external deps).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'admin1', name: 'Admin One', email: 'admin@test.com',
          role: 'TENANT_ADMIN', phone: '+234801', whatsappJid: 'jid1', isOnline: true,
        },
        {
          id: 'analyst1', name: 'Analyst One', email: 'analyst@test.com',
          role: 'ANALYST', phone: null, whatsappJid: null, isOnline: false,
        },
        {
          id: 'field1', name: 'Field Agent', email: 'field@test.com',
          role: 'FIELD_AGENT', phone: '+234802', whatsappJid: 'jid2', isOnline: true,
        },
      ]),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock all senders
vi.mock('@/lib/push-sender', () => ({
  sendPushNotification: vi.fn().mockResolvedValue({ sent: 1, failed: 0 }),
}));

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/ws-broadcast', () => ({
  broadcastEvent: vi.fn().mockResolvedValue(undefined),
}));

import { NotificationRouter, DEFAULT_ROUTING_RULES } from '../router';
import type { RoutingRule, NotificationPayload, NotificationPriority } from '../types';
import { db } from '@/lib/db';

const mockFindMany = vi.mocked(db.user.findMany);

function makePayload(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
  return {
    id: 'notif-test-1',
    tenantId: 'tenant1',
    type: 'incident:new',
    category: 'INCIDENT',
    priority: 'HIGH',
    title: 'Test Incident',
    body: 'A test incident occurred',
    ...overrides,
  };
}

describe('NotificationRouter', () => {
  let router: NotificationRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new NotificationRouter(DEFAULT_ROUTING_RULES);
  });

  it('matches CRITICAL incident rule and routes to admins+analysts', async () => {
    const results = await router.route(makePayload({
      priority: 'URGENT',
      data: { severity: 'CRITICAL' },
    }));

    // Should have results (in_app, push, email, websocket for each matched recipient)
    expect(results.length).toBeGreaterThan(0);
    const successes = results.filter(r => r.success);
    expect(successes.length).toBeGreaterThan(0);
  });

  it('does not route to excluded source user', async () => {
    const results = await router.route(makePayload({
      sourceUserId: 'admin1',
      data: { severity: 'HIGH' },
    }));

    // admin1 should NOT be a recipient
    const admin1Results = results.filter(r => r.userId === 'admin1');
    expect(admin1Results.length).toBe(0);
  });

  it('enforces cooldown for duplicate notifications', async () => {
    // First call
    await router.route(makePayload({ data: { severity: 'HIGH' } }));

    // Second call immediately — should be cooldown'd
    const results2 = await router.route(makePayload({ data: { severity: 'HIGH' } }));
    // Cooldown is 60s for HIGH incidents, so second call should produce 0 results
    expect(results2.length).toBe(0);
  });

  it('matches by event type only', async () => {
    const customRule: RoutingRule = {
      id: 'rule-custom',
      name: 'Custom',
      description: '',
      isActive: true,
      match: { eventTypes: ['custom:event'] },
      target: { roles: ['TENANT_ADMIN'] },
      channels: ['in_app'],
    };
    router.addRule(customRule);

    // Custom event matches
    const results = await router.route(makePayload({ type: 'custom:event' }));
    expect(results.length).toBeGreaterThan(0);
  });

  it('ignores inactive rules', async () => {
    const inactiveRule: RoutingRule = {
      id: 'rule-inactive',
      name: 'Inactive',
      description: '',
      isActive: false,
      match: { eventTypes: ['incident:new'] },
      target: { roles: ['FIELD_AGENT'] },
      channels: ['in_app'],
    };
    router.addRule(inactiveRule);

    const results = await router.route(makePayload({ data: { severity: 'LOW' } }));
    // Field agent should NOT receive (rule inactive, and LOW only goes to admins+analysts)
    const fieldResults = results.filter(r => r.userId === 'field1');
    expect(fieldResults.length).toBe(0);
  });

  it('targets specific user IDs', async () => {
    // Override mock to filter by userIds
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'analyst1', name: 'Analyst One', email: 'analyst@test.com',
        role: 'ANALYST', phone: null, whatsappJid: null, isOnline: false,
      },
    ]);

    const userRule: RoutingRule = {
      id: 'rule-user',
      name: 'Target User',
      description: '',
      isActive: true,
      match: { eventTypes: ['test:direct'] },
      target: { userIds: ['analyst1'] },
      channels: ['in_app'],
    };
    router.addRule(userRule);

    const results = await router.route(makePayload({ type: 'test:direct' }));
    expect(results.length).toBe(1);
    expect(results[0].userId).toBe('analyst1');
  });

  it('addRule and removeRule work', () => {
    const initialCount = router.getRules().length;

    const newRule: RoutingRule = {
      id: 'rule-test', name: 'Test', description: '', isActive: true,
      match: {}, target: {}, channels: [],
    };
    router.addRule(newRule);
    expect(router.getRules().length).toBe(initialCount + 1);

    router.removeRule('rule-test');
    expect(router.getRules().length).toBe(initialCount);
  });

  it('addRule replaces existing rule with same ID', () => {
    const updatedRule: RoutingRule = {
      id: 'rule-critical-incident',
      name: 'Updated Critical Rule',
      description: 'Updated',
      isActive: true,
      match: { eventTypes: ['incident:new'], severities: ['CRITICAL'], priorities: ['URGENT', 'SOS'] },
      target: { roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'] },
      channels: ['in_app'],
    };
    router.addRule(updatedRule);
    const rules = router.getRules();
    const found = rules.find(r => r.id === 'rule-critical-incident');
    expect(found?.name).toBe('Updated Critical Rule');
    // Restore the original so DEFAULT_ROUTING_RULES is not mutated for later tests
    const original = DEFAULT_ROUTING_RULES.find(r => r.id === 'rule-critical-incident');
    if (original) router.addRule({ ...original });
  });

  it('getStats returns accumulated stats', async () => {
    await router.route(makePayload({ priority: 'URGENT', data: { severity: 'CRITICAL' } }));
    const stats = router.getStats();
    expect(stats.totalProcessed).toBeGreaterThan(0);
    expect(stats.byChannel).toBeDefined();
    expect(stats.byPriority).toBeDefined();
  });

  it('handles no matching rules gracefully', async () => {
    const results = await router.route(makePayload({
      type: 'nonexistent:event',
      category: 'NONEXISTENT',
    }));
    expect(results.length).toBe(0);
  });
});

describe('DEFAULT_ROUTING_RULES', () => {
  // Use a fresh copy to avoid mutations from earlier tests
  const rulesCopy = DEFAULT_ROUTING_RULES.map(r => ({ ...r }));

  it('has at least 7 default rules', () => {
    expect(rulesCopy.length).toBeGreaterThanOrEqual(7);
  });

  it('all rules have required fields', () => {
    for (const rule of rulesCopy) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.isActive).toBe(true);
      expect(rule.match).toBeDefined();
      expect(rule.target).toBeDefined();
      expect(rule.channels.length).toBeGreaterThan(0);
    }
  });

  it('SOS rule targets all roles including FIELD_AGENT', () => {
    const sosRule = rulesCopy.find(r => r.id === 'rule-sos');
    expect(sosRule).toBeDefined();
    expect(sosRule!.target.roles).toContain('FIELD_AGENT');
    expect(sosRule!.channels).toContain('whatsapp');
    expect(sosRule!.channels).toContain('email');
  });
});
