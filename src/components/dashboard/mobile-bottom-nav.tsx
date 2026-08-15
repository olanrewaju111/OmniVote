'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDashboardStore, type ViewTab } from '@/store/dashboard';
import { Send, FileText, Radio } from 'lucide-react';
import { getQueueSize } from '@/lib/offline-queue';

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
      className="fixed bottom-0 left-0 right-0 z-30 h-14 bg-card border-t border-border flex items-center justify-around"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Mobile navigation"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative',
              isActive
                ? 'text-emerald'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label={tab.label}
            aria-current={isActive ? 'page' as const : undefined}
          >
            {tab.icon}
            <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            {tab.id === 'my-reports' && pendingCount > 0 && (
              <span className="absolute top-1 right-1/2 translate-x-4 min-w-[14px] h-[14px] rounded-full bg-amber text-amber-950 text-[8px] font-bold flex items-center justify-center px-0.5">
                {pendingCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
