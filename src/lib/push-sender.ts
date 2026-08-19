/**
 * Push notification sender utility.
 *
 * Uses web-push with VAPID keys to send notifications to all
 * subscribers for a given tenant. Never throws — errors are
 * swallowed and failed/expired subscriptions are cleaned up.
 */

import webPush from 'web-push';
import { getSubscriptions, removeSubscription } from './push-store';
import { logger } from './logger';

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  actions?: Array<{ action: string; title: string }>;
}

interface SendResult {
  sent: number;
  failed: number;
}

let configured = false;

function ensureConfigured() {
  if (configured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    logger.warn({
      message: 'VAPID keys not configured — push notifications disabled',
      module: 'push-sender',
    });
    return;
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export async function sendPushNotification(
  tenantId: string,
  payload: PushPayload,
): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0 };

  try {
    ensureConfigured();
    if (!configured) return result;

    const subs = getSubscriptions(tenantId);
    if (subs.length === 0) return result;

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
      actions: payload.actions,
    });

    const results = await Promise.allSettled(
      subs.map(async (sub) => {
        await webPush.sendNotification(sub, pushPayload, {
          TTL: 60, // seconds before the push service drops the message
        });
      }),
    );

    const failedEndpoints: string[] = [];

    for (let i = 0; i < results.length; i++) {
 if (results[i].status === 'fulfilled') {
        result.sent++;
      } else {
        result.failed++;
        const reason = results[i];
        // Extract endpoint for cleanup
        failedEndpoints.push(subs[i].endpoint);
        logger.warn({
          message: 'Push notification failed',
          module: 'push-sender',
          endpoint: subs[i].endpoint,
          error: reason.status === 'rejected' ? (reason.reason as Error).message : 'unknown',
        });
      }
    }

    // Clean up failed/expired subscriptions (410 Gone or 404 Not Found)
    for (const endpoint of failedEndpoints) {
      removeSubscription(endpoint);
    }
  } catch {
    // Never throw — push is best-effort
    logger.warn({
      message: 'sendPushNotification encountered an unexpected error',
      module: 'push-sender',
    });
  }

  return result;
}
