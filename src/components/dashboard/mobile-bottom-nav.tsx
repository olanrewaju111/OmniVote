'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDashboardStore, type ViewTab } from '@/store/dashboard';
import { Send, FileText, Radio } from 'lucide-react';
import { getQueueSize } from '@/lib/offline-queue';
import { m, AnimatePresence } from 'framer-motion';

const TABS: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
  { id: 'submit', label: 'Submit', icon: <Send className="h-5 w-5" /> },
  { id: 'my-reports', label: 'Reports', icon: <FileText className="h-5 w-5" /> },
  { id: 'feed', label: 'Live Feed', icon: <Radio className="h-5 w-5" /> },
];

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  const { user, activeTab, setSelectedTab } = useDashboardStore();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const check = async () => {
      try { setPendingCount(await getQueueSize()); } catch { /* IndexedDB unavailable */ }
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  if (!isMobile || user?.role !== 'FIELD_AGENT') return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 glass-strong border-t border-border/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-14">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-200 relative',
                isActive ? 'text-emerald' : 'text-muted-foreground/50'
              )}
              aria-label={tab.label}
              aria-current={isActive ? 'page' as const : undefined}
            >
              {/* Active indicator pill */}
              {isActive && (
                <m.div
                  layoutId="mobile-nav-active"
                  className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-emerald"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <m.div
                animate={isActive ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={{ duration: 0.25 }}
              >
                {tab.icon}
              </m.div>
              <span className={cn(
                'text-[10px] leading-none transition-colors',
                isActive ? 'font-semibold' : 'font-medium'
              )}>
                {tab.label}
              </span>
              {/* Pending queue badge */}
              {tab.id === 'my-reports' && pendingCount > 0 && (
                <m.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-0.5 right-1/2 translate-x-5 min-w-[16px] h-4 rounded-full bg-amber text-amber-950 text-[8px] font-bold flex items-center justify-center px-1 border border-background"
                >
                  {pendingCount}
                </m.span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
