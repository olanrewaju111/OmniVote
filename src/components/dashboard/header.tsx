'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Activity, Bell, Search, Shield, User, Vote, Calendar, Check, CheckCheck, AlertTriangle, Info, Radio, Clock, X, Mail, Building2, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useDashboardStore, TIER_SHORT, ROLE_TABS, type ViewTab } from '@/store/dashboard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MobileMenuTrigger } from '@/components/dashboard/sidebar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface HeaderProps {
  kpis?: {
    onlineAgents: number;
    totalAgents: number;
    unreadAlerts: number;
    securityAlerts: number;
  };
}

const TIER_STYLES: Record<string, string> = {
  PRESIDENTIAL: 'border-violet/30 text-violet bg-violet/10',
  STATE: 'border-amber/30 text-amber bg-amber/10',
  LOCAL: 'border-cyan/30 text-cyan bg-cyan/10',
};

interface AlertItem {
  id: string;
  type: 'OPERATIONAL' | 'SECURITY';
  category: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  isRead: boolean;
  createdAt: string;
}

function categoryIcon(cat: string) {
  switch (cat) {
    case 'CRITICAL': return <Radio className="h-3.5 w-3.5 text-rose shrink-0" aria-hidden="true" />;
    case 'WARNING': return <AlertTriangle className="h-3.5 w-3.5 text-amber shrink-0" aria-hidden="true" />;
    default: return <Info className="h-3.5 w-3.5 text-cyan shrink-0" aria-hidden="true" />;
  }
}

function relativeTime(date: string | Date) {
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

// Map search keywords to the most relevant tab
function inferSearchTab(query: string, userRole: string): ViewTab | null {
  const q = query.toLowerCase();
  const incidentKeywords = ['incident', 'violence', 'intimidation', 'ballot', 'deepfake', 'cib', 'anomaly', 'report'];
  const agentKeywords = ['agent', 'field', 'observer', 'monitor'];
  const alertKeywords = ['alert', 'warning', 'critical', 'defense'];

  if (incidentKeywords.some(k => q.includes(k))) {
    const allowed = ROLE_TABS[userRole as keyof typeof ROLE_TABS] || [];
    return allowed.includes('feed') ? 'feed' : allowed.includes('situation') ? 'situation' : null;
  }
  if (agentKeywords.some(k => q.includes(k))) {
    const allowed = ROLE_TABS[userRole as keyof typeof ROLE_TABS] || [];
    return allowed.includes('agents') ? 'agents' : null;
  }
  if (alertKeywords.some(k => q.includes(k))) {
    const allowed = ROLE_TABS[userRole as keyof typeof ROLE_TABS] || [];
    return allowed.includes('alerts') ? 'alerts' : null;
  }
  return null;
}

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
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

  if (!isOffline) return null;

  return (
    <div className="bg-amber text-amber-950 text-center text-xs font-medium py-1.5 px-4 flex items-center justify-center gap-2">
      <WifiOff className="h-3.5 w-3.5" />
      You are offline. Some features may be unavailable. Data will sync when connection is restored.
    </div>
  );
}

export function AppHeader({ kpis }: HeaderProps) {
  const { electionTier, electionInfo, setSelectedTab, tenantId, user, logout, globalSearch, setGlobalSearch } = useDashboardStore();
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd+K shortcut to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const { data: alertsRes } = useQuery<{ alerts: AlertItem[] }>({
    queryKey: ['alerts-header', tenantId],
    queryFn: () => fetchJson(`/api/alerts?tenantId=${tenantId}`),
    refetchInterval: 30_000,
  });

  const unreadAlerts = (alertsRes?.alerts || []).filter(a => !a.isRead);
  const recentUnread = unreadAlerts.slice(0, 5);

  const markRead = useMutation({
    mutationFn: (alertId: string) =>
      fetchJson(`/api/alerts?tenantId=${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ alertId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    onError: () => { /* non-critical — badge updates on next refetch */ },
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      fetchJson(`/api/alerts?tenantId=${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ markAllRead: true }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    onError: () => { /* non-critical */ },
  });

  const handleSearchSubmit = useCallback(() => {
    const q = globalSearch.trim();
    if (!q) return;
    const tab = inferSearchTab(q, user?.role || '');
    if (tab) setSelectedTab(tab);
  }, [globalSearch, user?.role, setSelectedTab]);

  const handleSearchClear = useCallback(() => {
    setGlobalSearch('');
    searchRef.current?.focus();
  }, [setGlobalSearch]);

  return (
    <>
      <OfflineBanner />
      <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-4 gap-4 shrink-0 z-10">
        <MobileMenuTrigger />

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <label htmlFor="global-search" className="sr-only">Search polling units, incidents, agents</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="global-search"
            ref={searchRef}
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchSubmit();
              if (e.key === 'Escape') handleSearchClear();
            }}
            placeholder="Search polling units, incidents, agents..."
            className="pl-9 pr-8 h-9 bg-background border-border text-sm"
          />
          {globalSearch && (
            <button
              onClick={handleSearchClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="absolute right-8 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground pointer-events-none">
            {globalSearch ? '' : <><span className="text-xs">&#8984;</span>K</>}
          </kbd>
        </div>

        {/* Election Type Badge */}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'text-[11px] h-9 px-3 font-medium gap-1.5 cursor-default',
              TIER_STYLES[electionTier] || 'border-border text-muted-foreground'
            )}
          >
            <Vote className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{TIER_SHORT[electionTier]}</span>
            <span className="sm:hidden">{electionTier === 'LOCAL' ? 'Local' : electionTier === 'STATE' ? 'Gov' : 'Pres'}</span>
          </Badge>

          {electionInfo?.date && (
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {new Date(electionInfo.date).toLocaleDateString('en-NG', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* System health — only for admin roles */}
          {user && (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') && (
            <div className="hidden md:flex items-center gap-2 px-3 h-9 rounded-md bg-background border border-border">
              <Activity className="h-3.5 w-3.5 text-emerald" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">All Systems</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
            </div>
          )}

          {/* AI Defense — hide for field agents */}
          {user && user.role !== 'FIELD_AGENT' && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 bg-background border-border text-sm"
              onClick={() => setSelectedTab('alerts')}
            >
              <Shield className="h-4 w-4 text-cyan" aria-hidden="true" />
              <span className="hidden sm:inline">Defense</span>
              {kpis?.securityAlerts ? (
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                  {kpis.securityAlerts}
                </Badge>
              ) : null}
            </Button>
          )}

          {/* Notifications Bell */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="relative h-9 w-9 p-0 bg-background border-border"
                aria-label={recentUnread.length > 0 ? `Notifications, ${recentUnread.length} unread` : 'Notifications'}
              >
                <Bell className="h-4 w-4" />
                {recentUnread.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-[9px] font-bold flex items-center justify-center text-white">
                    {recentUnread.length > 9 ? '9+' : recentUnread.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0" role="region" aria-label="Notifications">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                <DropdownMenuLabel className="p-0 text-xs font-semibold">
                  Notifications
                  {recentUnread.length > 0 && (
                    <Badge variant="destructive" className="ml-2 text-[9px] h-4 min-w-4 px-1">
                      {recentUnread.length}
                    </Badge>
                  )}
                </DropdownMenuLabel>
                {unreadAlerts.length > 0 && (
                  <button
                    onClick={(e) => { e.preventDefault(); markAllRead.mutate(); }}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-accent"
                  >
                    <CheckCheck className="h-3 w-3" aria-hidden="true" />
                    Mark all read
                  </button>
                )}
              </div>
              <ScrollArea className="max-h-72">
                {recentUnread.length > 0 ? (
                  <div className="py-1">
                    {recentUnread.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-start gap-2.5 px-3 py-2 hover:bg-accent/50 transition-colors group"
                      >
                        <div className="mt-0.5 shrink-0">{categoryIcon(alert.category)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[9px] h-4 border px-1',
                                alert.type === 'SECURITY'
                                  ? 'text-rose border-rose/30 bg-rose/10'
                                  : 'text-cyan border-cyan/30 bg-cyan/10'
                              )}
                            >
                              {alert.category}
                            </Badge>
                            <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                              {relativeTime(alert.createdAt)}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium mt-0.5 truncate">{alert.title}</p>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">{alert.description}</p>
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); markRead.mutate(alert.id); }}
                          className="shrink-0 mt-1 p-1 rounded text-muted-foreground hover:text-emerald opacity-0 group-hover:opacity-100 transition-all"
                          title="Mark as read"
                          aria-label="Mark notification as read"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    <Bell className="h-5 w-5 mx-auto mb-1.5 opacity-30" aria-hidden="true" />
                    No new notifications
                  </div>
                )}
              </ScrollArea>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="justify-center text-[11px] text-muted-foreground py-2 cursor-pointer"
                onClick={() => setSelectedTab('alerts')}
              >
                View all alerts
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-8 bg-border" />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 px-2 gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-emerald/20 text-emerald text-xs font-bold">
                    {user?.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || '??'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-medium leading-tight">{user?.name || 'User'}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{user?.role?.replace(/_/g, ' ') || ''}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                <User className="mr-2 h-4 w-4" />Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={logout}>Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
            <DialogDescription>Your account information and role details.</DialogDescription>
          </DialogHeader>
          {user && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-emerald/20 text-emerald text-lg font-bold">
                    {user.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">{user.name}</p>
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    {user.role.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
              <Separator />
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">{user.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-medium">{user.tenantName}</p>
                    <p className="text-[11px] text-muted-foreground">Tenant ID: {user.tenantId}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}