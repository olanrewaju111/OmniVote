/**
 * types.ts — Type definitions for the notification routing engine.
 */

// ─── Channel Types ──────────────────────────────────────────────

export type NotificationChannel = 'in_app' | 'push' | 'email' | 'whatsapp' | 'websocket';

// ─── Priority Levels ────────────────────────────────────────────

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'SOS';

// ─── Core Notification ──────────────────────────────────────────

export interface NotificationPayload {
  id: string;
  tenantId: string;
  type: string;           // e.g. 'incident:new', 'alert:escalated', 'pvt:anomaly'
  category: string;       // e.g. 'INCIDENT', 'ALERT', 'SYSTEM', 'FIELD_SAFETY'
  priority: NotificationPriority;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sourceUserId?: string;  // who triggered the notification
  targetEntityId?: string;
  targetEntityType?: string;
}

// ─── Recipient ──────────────────────────────────────────────────

export interface NotificationRecipient {
  userId: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  whatsappJid?: string;
  isOnline: boolean;
  pushSubscription?: string; // push subscription endpoint
}

// ─── Delivery Result ────────────────────────────────────────────

export interface DeliveryResult {
  channel: NotificationChannel;
  userId: string;
  success: boolean;
  error?: string;
  messageId?: string;
  deliveredAt: string;
}

// ─── Routing Rule ───────────────────────────────────────────────

export interface RoutingRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;

  // When does this rule match?
  match: {
    eventTypes?: string[];      // e.g. ['incident:new', 'incident:escalated']
    categories?: string[];      // e.g. ['INCIDENT', 'ALERT']
    priorities?: NotificationPriority[];
    severities?: string[];      // from data.severity
  };

  // Who receives?
  target: {
    roles?: string[];           // e.g. ['TENANT_ADMIN', 'ANALYST']
    userIds?: string[];         // specific user IDs
    excludeUserIds?: string[];  // exclude specific users
    includeSourceUser?: boolean; // include the user who triggered it
  };

  // Which channels?
  channels: NotificationChannel[];

  // Rate limiting per user
  cooldownSeconds?: number;     // min seconds between similar notifications to same user
}

// ─── Channel Sender Interface ───────────────────────────────────

export interface ChannelSender {
  channel: NotificationChannel;
  send(recipient: NotificationRecipient, payload: NotificationPayload): Promise<DeliveryResult>;
}

// ─── Router Stats ───────────────────────────────────────────────

export interface NotificationRouterStats {
  totalProcessed: number;
  totalDelivered: number;
  totalFailed: number;
  byChannel: Record<string, { sent: number; delivered: number; failed: number }>;
  byPriority: Record<string, number>;
  lastActivityAt: string;
}
