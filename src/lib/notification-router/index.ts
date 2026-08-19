/**
 * notification-router/index.ts — Barrel export for the notification routing engine.
 */

export { notificationRouter, NotificationRouter, DEFAULT_ROUTING_RULES, routeNotification } from './router';
export { getSender, inAppSender, pushSender, emailSender, whatsappSender, websocketSender } from './senders';
export type {
  NotificationChannel,
  NotificationPriority,
  NotificationPayload,
  NotificationRecipient,
  DeliveryResult,
  RoutingRule,
  ChannelSender,
  NotificationRouterStats,
} from './types';
