'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PwaRegistration() {
  const [isOffline, setIsOffline] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

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

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setUpdateAvailable(false);
      window.location.reload();
    }
  };

  if (!isOffline && !updateAvailable) return null;

  return (
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