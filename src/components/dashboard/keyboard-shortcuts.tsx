'use client';

import { useEffect } from 'react';
import { useDashboardStore, ROLE_TABS, type ViewTab } from '@/store/dashboard';

// Global keyboard shortcuts:
// Cmd/Ctrl + 1-9: Switch to tab by position
// Cmd/Ctrl + K: Open command palette (handled by CommandPalette component)
// Escape: Clear search
export function KeyboardShortcuts() {
  const { user, setSelectedTab, setGlobalSearch, globalSearch } = useDashboardStore();

  useEffect(() => {
    if (!user) return;

    const allowedTabs = ROLE_TABS[user.role] || [];

    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      // Cmd/Ctrl + 1-9: switch tab by position
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        const tabIdx = num - 1;
        if (tabIdx < allowedTabs.length) {
          setSelectedTab(allowedTabs[tabIdx] as ViewTab);
        }
      }

      // Cmd/Ctrl + 0: go to last tab
      if (e.key === '0') {
        e.preventDefault();
        if (allowedTabs.length > 0) {
          setSelectedTab(allowedTabs[allowedTabs.length - 1] as ViewTab);
        }
      }

      // Cmd/Ctrl + [: Go back (if we had history)
      // Cmd/Ctrl + ]: Go forward
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [user, setSelectedTab]);

  return null;
}

// Tooltip helper for showing keyboard shortcuts
export function kbd(label: string) {
  return (
    <kbd className="hidden md:inline-flex h-4 items-center gap-0.5 rounded border border-border/50 bg-muted/60 px-1 text-[9px] font-mono text-muted-foreground/50">
      {label}
    </kbd>
  );
}
