'use client';

import { useEffect, useState } from 'react';
import { useDashboardStore, ROLE_TABS, type ViewTab } from '@/store/dashboard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const SHORTCUTS = [
  { keys: '⌘/Ctrl + K', description: 'Command Palette' },
  { keys: '⌘/Ctrl + 1-9', description: 'Switch to tab 1-9' },
  { keys: '⌘/Ctrl + 0', description: 'Switch to last tab' },
  { keys: '?', description: 'Show this help' },
] as const;

// Global keyboard shortcuts:
// Cmd/Ctrl + 1-9: Switch to tab by position
// Cmd/Ctrl + K: Open command palette (handled by CommandPalette component)
// Escape: Clear search
// ?: Toggle shortcuts help dialog
export function KeyboardShortcuts() {
  const { user, setSelectedTab, setGlobalSearch, globalSearch } = useDashboardStore();
  const [helpOpen, setHelpOpen] = useState(false);

  // Handle ? without modifier keys to toggle help dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Don't trigger if typing in an input/textarea/contentEditable
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        setHelpOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>Quick navigation and actions</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.keys}
              className="flex items-center justify-between gap-4"
            >
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {shortcut.keys.split(' + ').map((part, i, arr) => (
                  <span key={i} className="flex items-center gap-1">
                    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/60 bg-muted px-1.5 text-[11px] font-mono text-muted-foreground">
                      {part}
                    </kbd>
                    {i < arr.length - 1 && (
                      <span className="text-[10px] text-muted-foreground/50">+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Tooltip helper for showing keyboard shortcuts
export function kbd(label: string) {
  return (
    <kbd className="hidden md:inline-flex h-4 items-center gap-0.5 rounded border border-border/50 bg-muted/60 px-1 text-[9px] font-mono text-muted-foreground/50">
      {label}
    </kbd>
  );
}
