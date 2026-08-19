'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA Install Prompt — shows a native install banner for eligible users.
 * Only renders when the browser fires the `beforeinstallprompt` event.
 * Dismissed state persists in localStorage.
 */
export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check if previously dismissed
    if (localStorage.getItem('pwa-install-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after a short delay so it doesn't interrupt onboarding
      setTimeout(() => setShowBanner(true), 5000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
    } catch {
      // User cancelled or error
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', '1');
  };

  if (!showBanner) return null;

  return (
    <div
      role="banner"
      aria-label="Install OmniVote as a mobile app"
      className="fixed bottom-16 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80 rounded-xl bg-card border border-border shadow-2xl p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald/15 flex items-center justify-center shrink-0">
          <Download className="h-5 w-5 text-emerald" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Install OmniVote</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add to home screen for faster access and offline support.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              aria-label="Install app"
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald text-emerald-950 hover:bg-emerald/90 transition-colors disabled:opacity-50"
            >
              {isInstalling ? 'Installing...' : 'Install'}
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
              className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Close"
          className="p-0.5 rounded hover:bg-accent transition-colors"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
