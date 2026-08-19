'use client';

import { useState, useEffect, useCallback } from 'react';

interface UsePushNotificationsReturn {
  permission: NotificationPermission;
  isSupported: boolean;
  requestPermission: () => Promise<NotificationPermission>;
  isSubscribed: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);

      // Check existing subscription
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) return 'denied';

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported) return;

    // Ensure permission is granted
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return;
    }
    if (Notification.permission !== 'granted') return;

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;

    const registration = await navigator.serviceWorker.ready;

    // Convert base64 VAPID key to Uint8Array
    const base64 = publicKey.replace(/-/g, '+').replace(/_/g, '/');
    const rawKey = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: rawKey,
    });

    // Send subscription to server
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    setIsSubscribed(true);
    setPermission('granted');
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;

    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();

    if (sub) {
      await sub.unsubscribe();

      // Remove from server
      await fetch(`/api/notifications/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, {
        method: 'DELETE',
      });
    }

    setIsSubscribed(false);
  }, [isSupported]);

  return {
    permission,
    isSupported,
    requestPermission,
    isSubscribed,
    subscribe,
    unsubscribe,
  };
}
