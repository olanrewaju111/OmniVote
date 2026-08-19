/**
 * router.ts — Intelligent Notification Router
 *
 * Matches incoming events against configured routing rules,
 * resolves recipients by role/ID, enforces per-user cooldowns,
 * and dispatches via the appropriate channel senders.
 */

import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { getSender } from './senders';
import type {
  NotificationPayload,
  NotificationRecipient,
  RoutingRule,
  DeliveryResult,
  NotificationRouterStats,
  NotificationChannel,
  NotificationPriority,
} from './types';

// ─── Cooldown Tracker ──────────────────────────────────────────

interface CooldownEntry {
  lastSentAt: number;
}

const cooldowns = new Map<string, CooldownEntry>();
const COOLDOWN_CLEANUP_MS = 10 * 60 * 1000; // 10 minutes

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cooldowns) {
    if (now - entry.lastSentAt > COOLDOWN_CLEANUP_MS) {
      cooldowns.delete(key);
    }
  }
}, COOLDOWN_CLEANUP_MS);

function isOnCooldown(userId: string, notificationType: string, cooldownSeconds: number): boolean {
  const key = `${userId}:${notificationType}`;
  const entry = cooldowns.get(key);
  if (!entry) return false;
  return (Date.now() - entry.lastSentAt) < (cooldownSeconds * 1000);
}

function markCooldown(userId: string, notificationType: string): void {
  const key = `${userId}:${notificationType}`;
  cooldowns.set(key, { lastSentAt: Date.now() });
}

// ─── Rule Matching ─────────────────────────────────────────────

function ruleMatches(rule: RoutingRule, payload: NotificationPayload): boolean {
  if (!rule.isActive) return false;

  const { match } = rule;

  // Check event type
  if (match.eventTypes && match.eventTypes.length > 0) {
    if (!match.eventTypes.includes(payload.type)) return false;
  }

  // Check category
  if (match.categories && match.categories.length > 0) {
    if (!match.categories.includes(payload.category)) return false;
  }

  // Check priority
  if (match.priorities && match.priorities.length > 0) {
    if (!match.priorities.includes(payload.priority)) return false;
  }

  // Check data.severity (if present in payload)
  if (match.severities && match.severities.length > 0) {
    const severity = (payload.data?.severity as string) || '';
    if (!match.severities.includes(severity)) return false;
  }

  return true;
}

// ─── Recipient Resolution ──────────────────────────────────────

async function resolveRecipients(rule: RoutingRule, payload: NotificationPayload): Promise<NotificationRecipient[]> {
  const { target } = rule;
  const recipients: NotificationRecipient[] = [];

  // Build the user query
  const where: Record<string, unknown> = { tenantId: payload.tenantId };
  if (target.roles && target.roles.length > 0) {
    where.role = { in: target.roles };
  }
  if (target.userIds && target.userIds.length > 0) {
    where.id = { in: target.userIds };
  }

  const users = await db.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      whatsappJid: true,
      isOnline: true,
    },
  });

  for (const user of users) {
    // Exclude source user unless explicitly included
    if (payload.sourceUserId && user.id === payload.sourceUserId && !target.includeSourceUser) {
      continue;
    }
    // Exclude specific users
    if (target.excludeUserIds?.includes(user.id)) {
      continue;
    }
    recipients.push({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || undefined,
      whatsappJid: user.whatsappJid || undefined,
      isOnline: user.isOnline,
    });
  }

  return recipients;
}

// ─── Stats Tracker ─────────────────────────────────────────────

const stats: NotificationRouterStats = {
  totalProcessed: 0,
  totalDelivered: 0,
  totalFailed: 0,
  byChannel: {},
  byPriority: {},
  lastActivityAt: '',
};

function recordDelivery(result: DeliveryResult, priority: NotificationPriority): void {
  stats.totalProcessed++;
  if (result.success) {
    stats.totalDelivered++;
  } else {
    stats.totalFailed++;
  }

  // By channel
  if (!stats.byChannel[result.channel]) {
    stats.byChannel[result.channel] = { sent: 0, delivered: 0, failed: 0 };
  }
  stats.byChannel[result.channel].sent++;
  if (result.success) stats.byChannel[result.channel].delivered++;
  else stats.byChannel[result.channel].failed++;

  // By priority
  stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
  stats.lastActivityAt = new Date().toISOString();
}

// ─── Default Rules ─────────────────────────────────────────────

export const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  // CRITICAL / SOS incidents → all admins + analysts via all channels
  {
    id: 'rule-critical-incident',
    name: 'Critical Incident Alert',
    description: 'Escalate CRITICAL/SOS incidents to all admins and analysts',
    isActive: true,
    match: {
      eventTypes: ['incident:new', 'incident:escalated'],
      categories: ['INCIDENT'],
      severities: ['CRITICAL'],
      priorities: ['URGENT', 'SOS'],
    },
    target: {
      roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'],
    },
    channels: ['in_app', 'push', 'email', 'websocket'],
    cooldownSeconds: 30,
  },

  // HIGH incidents → admins + analysts via in-app + push
  {
    id: 'rule-high-incident',
    name: 'High Incident Notification',
    description: 'Notify admins and analysts of HIGH incidents',
    isActive: true,
    match: {
      eventTypes: ['incident:new'],
      severities: ['HIGH'],
    },
    target: {
      roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'],
    },
    channels: ['in_app', 'push', 'websocket'],
    cooldownSeconds: 60,
  },

  // LOW/MEDIUM incidents → analysts only via in-app
  {
    id: 'rule-low-incident',
    name: 'Standard Incident',
    description: 'Standard incidents for analysts',
    isActive: true,
    match: {
      eventTypes: ['incident:new'],
      severities: ['LOW', 'MEDIUM'],
    },
    target: {
      roles: ['TENANT_ADMIN', 'ANALYST'],
    },
    channels: ['in_app'],
    cooldownSeconds: 120,
  },

  // CRITICAL alerts → all admin roles
  {
    id: 'rule-critical-alert',
    name: 'Critical Alert',
    description: 'Critical category alerts to all admin roles',
    isActive: true,
    match: {
      eventTypes: ['alert:new', 'alert:escalated'],
      categories: ['ALERT'],
      priorities: ['URGENT', 'SOS'],
    },
    target: {
      roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'],
    },
    channels: ['in_app', 'push', 'email', 'websocket'],
    cooldownSeconds: 30,
  },

  // PVT anomaly → analysts
  {
    id: 'rule-pvt-anomaly',
    name: 'PVT Anomaly',
    description: 'PVT result anomalies to analysts and admins',
    isActive: true,
    match: {
      eventTypes: ['pvt:anomaly', 'pvt:new'],
      categories: ['ANALYSIS'],
    },
    target: {
      roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'],
    },
    channels: ['in_app', 'push'],
    cooldownSeconds: 300,
  },

  // Field safety SOS → all roles (field agents included)
  {
    id: 'rule-sos',
    name: 'Field Safety SOS',
    description: 'Dead man switch or SOS from field agents',
    isActive: true,
    match: {
      eventTypes: ['field_safety:sos', 'deadman:triggered'],
      categories: ['FIELD_SAFETY'],
      priorities: ['SOS'],
    },
    target: {
      roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY', 'FIELD_AGENT'],
    },
    channels: ['in_app', 'push', 'email', 'websocket', 'whatsapp'],
    cooldownSeconds: 15,
  },

  // System alerts → admins only
  {
    id: 'rule-system',
    name: 'System Alert',
    description: 'System health and security events to admins',
    isActive: true,
    match: {
      eventTypes: ['system:alert', 'system:degraded'],
      categories: ['SYSTEM'],
    },
    target: {
      roles: ['SUPER_ADMIN', 'TENANT_ADMIN'],
    },
    channels: ['in_app', 'email'],
    cooldownSeconds: 300,
  },
];

// ─── Router Class ──────────────────────────────────────────────

export class NotificationRouter {
  private rules: RoutingRule[];

  constructor(initialRules?: RoutingRule[]) {
    this.rules = initialRules || DEFAULT_ROUTING_RULES;
  }

  /**
   * Route a notification payload through all matching rules.
   * Returns all delivery results (one per recipient × channel).
   */
  async route(payload: NotificationPayload): Promise<DeliveryResult[]> {
    const allResults: DeliveryResult[] = [];

    for (const rule of this.rules) {
      if (!ruleMatches(rule, payload)) continue;

      const recipients = await resolveRecipients(rule, payload);
      if (recipients.length === 0) continue;

      const cooldownSec = rule.cooldownSeconds || 0;

      for (const recipient of recipients) {
        // Check cooldown
        if (cooldownSec > 0 && isOnCooldown(recipient.userId, payload.type, cooldownSec)) {
          continue;
        }

        for (const channel of rule.channels) {
          const sender = getSender(channel);
          if (!sender) {
            logger.warn({ message: 'No sender for channel', module: 'NOTIF', channel });
            continue;
          }

          try {
            const result = await sender.send(recipient, payload);
            allResults.push(result);
            recordDelivery(result, payload.priority);
          } catch (err) {
            // Senders should never throw, but just in case
            logger.error({
              message: 'Sender threw unexpectedly',
              module: 'NOTIF',
              channel,
              userId: recipient.userId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        // Mark cooldown after attempting all channels for this user
        if (cooldownSec > 0) {
          markCooldown(recipient.userId, payload.type);
        }
      }
    }

    logger.info({
      message: 'Notification routed',
      module: 'NOTIF',
      notificationId: payload.id,
      type: payload.type,
      priority: payload.priority,
      tenantId: payload.tenantId,
      resultsCount: allResults.length,
      delivered: allResults.filter(r => r.success).length,
    });

    return allResults;
  }

  /**
   * Add a custom routing rule.
   */
  addRule(rule: RoutingRule): void {
    const idx = this.rules.findIndex(r => r.id === rule.id);
    if (idx >= 0) {
      this.rules[idx] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  /**
   * Remove a rule by ID.
   */
  removeRule(ruleId: string): boolean {
    const idx = this.rules.findIndex(r => r.id === ruleId);
    if (idx < 0) return false;
    this.rules.splice(idx, 1);
    return true;
  }

  /**
   * Get all rules.
   */
  getRules(): RoutingRule[] {
    return [...this.rules];
  }

  /**
   * Get router stats.
   */
  getStats(): NotificationRouterStats {
    return { ...stats };
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const notificationRouter = new NotificationRouter();

// ─── Convenience: Route Helper ──────────────────────────────────

/**
 * Create and route a notification in one call.
 */
export async function routeNotification(opts: {
  tenantId: string;
  type: string;
  category: string;
  priority: NotificationPriority;
  title: string;
  body: string;
  sourceUserId?: string;
  data?: Record<string, unknown>;
}): Promise<DeliveryResult[]> {
  const payload: NotificationPayload = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    ...opts,
  };
  return notificationRouter.route(payload);
}
