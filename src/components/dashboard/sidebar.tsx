'use client';

import { cn } from '@/lib/utils';
import { useDashboardStore, type ViewTab } from '@/store/dashboard';
import {
  LayoutDashboard, Map, Radio, ShieldAlert, Brain, Image as ImageIcon,
  ChevronLeft, ChevronRight, Activity, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const NAV_ITEMS: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: 'map', label: 'Geo Map', icon: <Map className="h-5 w-5" /> },
  { id: 'feed', label: 'Live Feed', icon: <Radio className="h-5 w-5" /> },
  { id: 'alerts', label: 'Alert Triage', icon: <ShieldAlert className="h-5 w-5" /> },
  { id: 'ai', label: 'AI Engine', icon: <Brain className="h-5 w-5" /> },
  { id: 'media', label: 'Media Vault', icon: <ImageIcon className="h-5 w-5" /> },
];

export function AppSidebar() {
  const { activeTab, setSelectedTab, sidebarCollapsed, toggleSidebar, unreadAlerts } = useDashboardStore();

  return (
    <aside className={cn(
      'flex flex-col h-screen border-r border-border bg-sidebar transition-all duration-300 relative z-20',
      sidebarCollapsed ? 'w-16' : 'w-56'
    )}>
      {/* Logo area */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-emerald flex items-center justify-center shrink-0">
          <Zap className="h-5 w-5 text-emerald-950" />
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-sidebar-foreground tracking-wide">OmniVote</h1>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Monitor</p>
          </div>
        )}
      </div>

      {/* Live indicator */}
      <div className="px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-dot" />
          {!sidebarCollapsed && <span className="text-xs text-emerald font-medium">ELECTION LIVE</span>}
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        <TooltipProvider delayDuration={0}>
          {NAV_ITEMS.map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedTab(item.id)}
                  className={cn(
                    'w-full justify-start gap-3 h-10 text-sm font-medium transition-colors',
                    activeTab === item.id
                      ? 'bg-emerald/15 text-emerald hover:bg-emerald/20 hover:text-emerald'
                      : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                    sidebarCollapsed && 'justify-center px-0'
                  )}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!sidebarCollapsed && item.label}
                  {item.id === 'alerts' && !sidebarCollapsed && unreadAlerts > 0 && (
                    <Badge variant="destructive" className="ml-auto text-[10px] h-5 min-w-5 px-1.5">
                      {unreadAlerts > 99 ? '99+' : unreadAlerts}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              {sidebarCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
            </Tooltip>
          ))}
        </TooltipProvider>
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Collapse button */}
      <div className="p-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="w-full justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}

// Hook-compatible sidebar with unread alerts
export function useUnreadAlerts() {
  return useDashboardStore((s) => s.unreadAlerts ?? 0);
}