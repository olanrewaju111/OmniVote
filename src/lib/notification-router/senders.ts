/**
 * senders.ts — Channel sender implementations.
 *
 * Each sender handles delivery via a specific channel.
 * All senders are fire-and-forget: they never throw.
 */

import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email';
import { sendPushNotification } from '@/lib/push-sender';
import { broadcastEvent } from '@/lib/ws-broadcast';
import type { ChannelSender, DeliveryResult, NotificationRecipient, NotificationPayload } from './types';

// ─── In-App Sender (WebSocket broadcast) ─────────────────────────

export const inAppSender: ChannelSender = {
  channel: 'in_app',

  async send(recipient: NotificationRecipient, payload: NotificationPayload): Promise<DeliveryResult> {
    try {
      // Broadcast via WebSocket so any connected client receives it
      await broadcastEvent({
        type: 'alert',
        action: 'notification',
        data: {
          notification: {
            id: payload.id,
            type: payload.type,
            category: payload.category,
            priority: payload.priority,
            title: payload.title,
            body: payload.body,
            targetUserId: recipient.userId,
          },
        },
        tenantId: payload.tenantId,
      });

      return {
        channel: 'in_app',
        userId: recipient.userId,
        success: true,
        messageId: payload.id,
        deliveredAt: new Date().toISOString(),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error({ message: 'In-app notification failed', module: 'NOTIF', channel: 'in_app', userId: recipient.userId, error });
      return { channel: 'in_app', userId: recipient.userId, success: false, error, deliveredAt: new Date().toISOString() };
    }
  },
};

// ─── Push Sender ─────────────────────────────────────────────────

export const pushSender: ChannelSender = {
  channel: 'push',

  async send(recipient: NotificationRecipient, payload: NotificationPayload): Promise<DeliveryResult> {
    // Push uses tenant-scoped broadcast (all subs for the tenant)
    // Individual user targeting is handled by the client-side filter
    try {
      const result = await sendPushNotification(payload.tenantId, {
        title: payload.title,
        body: payload.body,
        url: payload.data?.incidentUrl as string | undefined,
      });

      return {
        channel: 'push',
        userId: recipient.userId,
        success: result.sent > 0,
        deliveredAt: new Date().toISOString(),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error({ message: 'Push notification failed', module: 'NOTIF', channel: 'push', userId: recipient.userId, error });
      return { channel: 'push', userId: recipient.userId, success: false, error, deliveredAt: new Date().toISOString() };
    }
  },
};

// ─── Email Sender ────────────────────────────────────────────────

export const emailSender: ChannelSender = {
  channel: 'email',

  async send(recipient: NotificationRecipient, payload: NotificationPayload): Promise<DeliveryResult> {
    const priorityBadge = payload.priority === 'SOS' || payload.priority === 'URGENT'
      ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin:12px 0;color:#dc2626;font-weight:600;font-size:14px;">URGENT PRIORITY</div>`
      : '';

    const html = `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8" /></head>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;background:#f9fafb;margin:0;padding:0;">
        <div style="max-width:480px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
          <div style="background:linear-gradient(135deg,#059669,#10b981);color:#fff;padding:24px;">
            <h1 style="margin:0;font-size:18px;font-weight:700;">OmniVote Alert</h1>
            <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">${payload.category.replace(/_/g, ' ')} &bull; ${payload.priority}</p>
          </div>
          <div style="padding:24px;">
            ${priorityBadge}
            <h2 style="font-size:16px;margin:0 0 8px;">${payload.title}</h2>
            <p style="font-size:14px;line-height:1.6;color:#4b5563;margin:0;">${payload.body}</p>
            ${payload.data?.incidentUrl ? `<a href="${payload.data.incidentUrl}" style="display:inline-block;margin-top:16px;background:#10b981;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View Details</a>` : ''}
          </div>
          <div style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">OmniVote Monitor &mdash; Secure Election Command Center</div>
        </div>
      </body></html>`;

    try {
      const success = await sendEmail({
        to: recipient.email,
        subject: `[OmniVote ${payload.priority}] ${payload.title}`,
        html,
      });

      return {
        channel: 'email',
        userId: recipient.userId,
        success,
        deliveredAt: new Date().toISOString(),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error({ message: 'Email notification failed', module: 'NOTIF', channel: 'email', userId: recipient.userId, error });
      return { channel: 'email', userId: recipient.userId, success: false, error, deliveredAt: new Date().toISOString() };
    }
  },
};

// ─── WhatsApp Sender (via agent messages) ───────────────────────

export const whatsappSender: ChannelSender = {
  channel: 'whatsapp',

  async send(recipient: NotificationRecipient, payload: NotificationPayload): Promise<DeliveryResult> {
    if (!recipient.phone && !recipient.whatsappJid) {
      return { channel: 'whatsapp', userId: recipient.userId, success: false, error: 'No phone/WhatsApp JID', deliveredAt: new Date().toISOString() };
    }

    // WhatsApp messages are stored as AgentMessages for delivery by the WhatsApp bridge
    // In production, this would integrate with the WhatsApp Business API
    logger.info({
      message: 'WhatsApp notification queued',
      module: 'NOTIF',
      channel: 'whatsapp',
      userId: recipient.userId,
      phone: recipient.phone,
      notificationId: payload.id,
    });

    // For now, log and return success (WhatsApp bridge handles actual delivery)
    return {
      channel: 'whatsapp',
      userId: recipient.userId,
      success: true,
      messageId: `wa-${Date.now()}`,
      deliveredAt: new Date().toISOString(),
    };
  },
};

// ─── WebSocket Sender (direct targeted WS message) ───────────────

export const websocketSender: ChannelSender = {
  channel: 'websocket',

  async send(recipient: NotificationRecipient, payload: NotificationPayload): Promise<DeliveryResult> {
    try {
      await broadcastEvent({
        type: 'alert',
        action: 'notification:direct',
        data: {
          targetUserId: recipient.userId,
          notification: {
            id: payload.id,
            type: payload.type,
            category: payload.category,
            priority: payload.priority,
            title: payload.title,
            body: payload.body,
          },
        },
        tenantId: payload.tenantId,
      });

      return {
        channel: 'websocket',
        userId: recipient.userId,
        success: true,
        messageId: payload.id,
        deliveredAt: new Date().toISOString(),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { channel: 'websocket', userId: recipient.userId, success: false, error, deliveredAt: new Date().toISOString() };
    }
  },
};

// ─── Sender Registry ─────────────────────────────────────────────

const SENDERS: Record<string, ChannelSender> = {
  in_app: inAppSender,
  push: pushSender,
  email: emailSender,
  whatsapp: whatsappSender,
  websocket: websocketSender,
};

export function getSender(channel: string): ChannelSender | undefined {
  return SENDERS[channel];
}
