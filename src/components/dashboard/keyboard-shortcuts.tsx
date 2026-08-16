'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDashboardStore, ROLE_TABS, type ViewTab } from '@/store/dashboard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ShortcutItem {
  keys: string;
  description: string;
  category?: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: '⌘/Ctrl + K', description: 'Command Palette', category: 'Navigation' },
  { keys: '⌘/Ctrl + 1-9', description: 'Switch to tab 1-9', category: 'Navigation' },
  { keys: '⌘/Ctrl + 0', description: 'Switch to last tab', category: 'Navigation' },
  { keys: '⌘/Ctrl + B', description: 'Toggle sidebar', category: 'Layout' },
  { keys: '⌘/Ctrl + T', description: 'Cycle light/dark theme', category: 'Layout' },
  { keys: '⌘/Ctrl + .', description: 'Toggle live feed pause', category: 'Actions' },
  { keys: 'Escape', description: 'Clear search / Close dialog', category: 'General' },
  { keys: '?', description: 'Show this help', category: 'General' },
];

// Global keyboard shortcuts:
// Cmd/Ctrl + K: Open command palette (handled by CommandPalette component)
// Cmd/Ctrl + 1-9: Switch to tab by position
// Cmd/Ctrl + 0: Go to last tab
// Cmd/Ctrl + B: Toggle sidebar
// Cmd/Ctrl + T: Cycle theme
// Cmd/Ctrl + .: Toggle live feed pause
// ?: Toggle shortcuts help dialog
export function KeyboardShortcuts() {
  const { user, setSelectedTab, setGlobalSearch, toggleSidebar, toggleLiveFeed } = useDashboardStore();
  const [helpOpen, setHelpOpen] = useState(false);

  const cycleTheme = useCallback(() => {
    const root = document.documentElement;
    const isDark = root.classList.contains('dark');
    const isLight = root.classList.contains('light');
    if (isDark) {
      root.classList.remove('dark');
      root.classList.add('light');
      try { localStorage.setItem('theme', 'light'); } catch { /* */ }
    } else if (isLight) {
      root.classList.remove('light');
      try { localStorage.removeItem('theme'); } catch { /* */ }
    } else {
      root.classList.add('dark');
      try { localStorage.setItem('theme', 'dark'); } catch { /* */ }
    }
  }, []);

  // Handle ? without modifier keys to toggle help dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
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

      // Skip if typing in an input/textarea
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isMod) {
        // Cmd/Ctrl + 1-9: switch tab by position
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
          e.preventDefault();
          const tabIdx = num - 1;
          if (tabIdx < allowedTabs.length) {
            setSelectedTab(allowedTabs[tabIdx] as ViewTab);
          }
          return;
        }

        // Cmd/Ctrl + 0: go to last tab
        if (e.key === '0') {
          e.preventDefault();
          if (allowedTabs.length > 0) {
            setSelectedTab(allowedTabs[allowedTabs.length - 1] as ViewTab);
          }
          return;
        }

        // Cmd/Ctrl + B: toggle sidebar
        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          toggleSidebar();
          return;
        }

        // Cmd/Ctrl + T: cycle theme (dark → light → system)
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          cycleTheme();
          return;
        }

        // Cmd/Ctrl + .: toggle live feed pause
        if (e.key === '.') {
          e.preventDefault();
          toggleLiveFeed();
          return;
        }
      }

      // Escape: clear search when not in a dialog
      if (e.key === 'Escape' && !inInput) {
        setGlobalSearch('');
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [user, setSelectedTab, setGlobalSearch, toggleSidebar, toggleLiveFeed, cycleTheme]);

  // Group shortcuts by category
  const categories = SHORTCUTS.reduce<Record<string, ShortcutItem[]>>((acc, s) => {
    const cat = s.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>Quick navigation and actions for power users</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {Object.entries(categories).map(([category, items]) => (
            <div key={category}>
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2">{category}</p>
              <div className="space-y-2">
                {items.map((shortcut) => (
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
