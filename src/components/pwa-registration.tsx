'use client';

import { useEffect, useState, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, Bell, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PUSH_BANNER_DISMISSED_KEY = 'omnivote-push-banner-dismissed';
const BANNER_DELAY_MS = 30_000;

export function PwaRegistration() {
  const [isOffline, setIsOffline] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [pushState, setPushState] = useState<'idle' | 'requesting' | 'subscribing' | 'done' | 'error'>('idle');

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          setRegistration(reg);
          // Check for updates every 5 minutes
          setInterval(() => {
            reg.update().catch(() => {});
          }, 300000);
          // Listen for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                }
              });
            }
          });
        })
        .catch(() => {
          // Service worker registration failed — non-critical
        });
    }

    // Online/offline detection
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Push banner: show after delay if permission is default (not yet asked)
  useEffect(() => {
    const isPushSupported =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;

    if (!isPushSupported) return;
    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(PUSH_BANNER_DISMISSED_KEY)) return;

    // Don't show on login page
    if (window.location.pathname === '/login') return;

    const timer = setTimeout(() => {
      setShowPushBanner(true);
    }, BANNER_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  const dismissBanner = useCallback(() => {
    setShowPushBanner(false);
    localStorage.setItem(PUSH_BANNER_DISMISSED_KEY, '1');
  }, []);

  const handleEnableAlerts = useCallback(async () => {
    setPushState('requesting');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setPushState('error');
        return;
      }

      setPushState('subscribing');
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setPushState('error');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const base64 = publicKey.replace(/-/g, '+').replace(/_/g, '/');
      const rawKey = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: rawKey,
      });

      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      setPushState('done');
      // Auto-dismiss after success
      setTimeout(dismissBanner, 2000);
    } catch {
      setPushState('error');
    }
  }, [dismissBanner]);

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setUpdateAvailable(false);
      window.location.reload();
    }
  };

  return (
    <>
      {/* Push notification permission banner */}
      {showPushBanner && (
        <div
          role="alert"
          aria-label="Enable critical push notifications for real-time election alerts"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 flex items-start gap-3 p-4 rounded-xl bg-background border border-border shadow-lg animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 text-destructive shrink-0 mt-0.5">
            <Bell className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Enable Critical Alerts</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get instant push notifications for security incidents and critical election events.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleEnableAlerts}
                disabled={pushState === 'requesting' || pushState === 'subscribing' || pushState === 'done'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {pushState === 'requesting' || pushState === 'subscribing' ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Setting up…
                  </>
                ) : pushState === 'done' ? (
                  'Enabled ✓'
                ) : pushState === 'error' ? (
                  'Failed — retry'
                ) : (
                  'Enable'
                )}
              </button>
              <button
                onClick={dismissBanner}
                className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Dismiss notification banner"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing offline/update indicators */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {isOffline && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber/15 border border-amber/30 text-amber text-xs shadow-lg">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            <span>Offline — data queued for sync</span>
          </div>
        )}
        {updateAvailable && (
          <button
            onClick={handleUpdate}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald/15 border border-emerald/30 text-emerald text-xs shadow-lg hover:bg-emerald/25 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
            <span>Update available — tap to refresh</span>
          </button>
        )}
      </div>
    </>
  );
}

// Offline indicator bar shown at top
export function OfflineBar() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 h-8 bg-amber/20 border-b border-amber/30 text-amber text-xs font-medium">
      <WifiOff className="h-3 w-3" />
      <span>You are offline. Reports will be queued and synced when connection is restored.</span>
    </div>
  );
}