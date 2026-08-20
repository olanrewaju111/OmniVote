'use client';

import React from 'react';

import { useState, useCallback, useRef, useEffect, useMemo, type RefObject } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Activity, Bell, Search, Shield, User, Vote, Calendar, Check, CheckCheck, AlertTriangle, Info, Radio, Clock, X, Mail, Building2, WifiOff, Wifi, Command, Signal, Settings, Lock, Eye, EyeOff, ChevronRight, Zap, Megaphone, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useDashboardStore, TIER_SHORT, ROLE_TABS, type ViewTab } from '@/store/dashboard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MobileMenuTrigger } from '@/components/dashboard/sidebar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NotificationBell } from '@/components/dashboard/notification-center';
import { BroadcastBriefing } from '@/components/dashboard/broadcast-briefing';
import { WinProbabilityHeader } from '@/components/dashboard/win-probability-header';
import { SoundToggle } from '@/components/dashboard/sound-toggle';
import { ProfileSettingsDialog } from '@/components/dashboard/profile-settings';
import { DashboardExport } from '@/components/dashboard/dashboard-export';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface BreadcrumbData {
  section: string;
  current: string;
}

interface HeaderProps {
  breadcrumb?: BreadcrumbData;
  kpis?: {
    onlineAgents: number;
    totalAgents: number;
    unreadAlerts: number;
    securityAlerts: number;
  };
  containerRef?: RefObject<HTMLDivElement | null>;
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

// Live clock component
function LiveClock() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      setDate(now.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" aria-hidden="true" />
      <span className="tabular-nums font-medium text-foreground/70">{time}</span>
      <span className="text-muted-foreground/40">{date}</span>
    </div>
  );
}

// Last data sync indicator
function LastSync() {
  const [lastSync, setLastSync] = useState<string>('');

  useEffect(() => {
    const update = () => {
      setLastSync(new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    update();
    const id = setInterval(update, 15000); // matches dashboard poll interval
    return () => clearInterval(id);
  }, []);

  if (!lastSync) return null;

  return (
    <div className="hidden xl:flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
      <span>Updated</span>
      <span className="tabular-nums font-medium text-muted-foreground/60">{lastSync}</span>
    </div>
  );
}

// Connection quality + real-time transport indicator
function ConnectionIndicator() {
  const { wsConnected, wsTransport, wsOnlineCount, sseConnected } = useDashboardStore();
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const check = async () => {
      if (!navigator.onLine) {
        setLatency(null);
        return;
      }
      try {
        const start = performance.now();
        await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
        const ms = Math.round(performance.now() - start);
        setLatency(ms);
      } catch {
        setLatency(null);
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  const isConnected = wsConnected || sseConnected;
  const isWs = wsConnected && wsTransport === 'ws';

  if (!isConnected && !sseConnected) {
    return (
      <div className="hidden md:flex items-center gap-1.5 px-2 h-7 rounded-md bg-amber/10 border border-amber/20 text-amber text-[10px] font-medium">
        <WifiOff className="h-3 w-3" />
        <span className="hidden xl:inline">Connecting...</span>
      </div>
    );
  }

  return (
    <div className={cn(
      'hidden md:flex items-center gap-1.5 px-2 h-7 rounded-md border text-[10px] font-medium transition-colors',
      isWs
        ? 'bg-emerald/10 border-emerald/20 text-emerald/80'
        : 'bg-amber/5 border-amber/15 text-amber/70'
    )}>
      {isWs ? <Zap className="h-3 w-3" /> : <Radio className="h-3 w-3" />}
      <span className="hidden xl:inline">{isWs ? 'Live' : 'SSE'}</span>
      {latency !== null && <span className="tabular-nums text-[9px] opacity-60">{latency}ms</span>}
      {wsOnlineCount > 1 && (
        <span className="hidden lg:inline flex items-center gap-0.5 opacity-70">
          <Users className="h-2.5 w-2.5" />{wsOnlineCount}
        </span>
      )}
      <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot bg-current" />
    </div>
  );
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

function getPasswordStrength(pw: string) {
  if (!pw) return { score: 0, label: '', color: '' };
  const checks = [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)];
  const score = checks.filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'text-rose', 'text-amber', 'text-cyan', 'text-emerald'];
  return { score, label: labels[score], color: colors[score] };
}

// Tenant switcher for platform SUPER_ADMIN
// Uses /api/auth/switch-tenant with existing JWT — no password re-submission.
function TenantSwitcher() {
  const { user, login, setTenantId, setElectionInfo, setSelectedTab, setAvailableTenants, availableTenants } = useDashboardStore();
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState(false);

  const currentId = user?.tenantId || '';

  const handleSwitch = useCallback(async (targetTenantId: string) => {
    if (targetTenantId === currentId || switching) return;
    setSwitching(true);
    try {
      const res = await fetch('/api/auth/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantId: targetTenantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Switch failed');

      login(data.user);
      setTenantId(data.user.tenantId);
      if (data.electionInfo) setElectionInfo(data.electionInfo);
      if (data.availableTenants) setAvailableTenants(data.availableTenants);
      setSelectedTab('overview');
      queryClient.invalidateQueries();
    } catch {
      // Non-critical: tenant switch failed silently
    } finally {
      setSwitching(false);
    }
  }, [currentId, switching, user, login, setTenantId, setElectionInfo, setSelectedTab, setAvailableTenants, queryClient]);

  if (availableTenants.length <= 1) return null;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={switching}>
        <Building2 className="mr-2 h-4 w-4" />
        {switching ? 'Switching...' : 'Switch Tenant'}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {availableTenants.map(t => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => handleSwitch(t.id)}
            className={cn(t.id === currentId && 'bg-accent')}
          >
            {t.id === currentId && <Check className="mr-2 h-4 w-4 text-emerald" />}
            {t.id !== currentId && <span className="mr-2 w-4" />}
            {t.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export const AppHeader = React.memo(function AppHeader({ breadcrumb, kpis, containerRef }: HeaderProps) {
  const { electionTier, electionInfo, setSelectedTab, tenantId, user, logout, globalSearch, setGlobalSearch, sseConnected } = useDashboardStore();
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Password change states
  const [showPwChange, setShowPwChange] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwChanging, setPwChanging] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Cmd/Ctrl+K shortcut opens command palette (handled by CommandPalette component)
  // This search is for inline header search
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

  // Reduced to 60s — SSE handles real-time alert updates
  const { data: alertsRes } = useQuery<{ alerts: AlertItem[] }>({
    queryKey: ['alerts-header', tenantId],
    queryFn: () => fetchJson(`/api/alerts?tenantId=${tenantId}`),
    refetchInterval: 60_000,
  });

  const unreadAlerts = useMemo(
    () => (alertsRes?.alerts || []).filter(a => !a.isRead),
    [alertsRes?.alerts],
  );
  const recentUnread = useMemo(() => unreadAlerts.slice(0, 5), [unreadAlerts]);

  const markRead = useMutation({
    mutationFn: (alertId: string) =>
      fetchJson(`/api/alerts?tenantId=${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ alertId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    onError: () => { /* non-critical */ },
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

  return (
    <>
      <OfflineBanner />
      <header className="h-14 border-b border-border bg-card/70 backdrop-blur-md flex items-center px-3 sm:px-4 gap-3 shrink-0 z-10">
        <MobileMenuTrigger />

        {/* Breadcrumb — visible on lg+ screens */}
        {breadcrumb?.section && (
          <nav className="hidden lg:flex items-center gap-1.5 text-[11px] min-w-0" aria-label="Breadcrumb">
            <span className="text-muted-foreground/50 font-medium">{breadcrumb.section}</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" aria-hidden="true" />
            <span className="font-medium text-foreground/80 truncate max-w-[140px]">{breadcrumb.current}</span>
          </nav>
        )}

        {/* Search — shows on sm+ or hidden on mobile (command palette used instead) */}
        <div className="relative flex-1 max-w-xs hidden sm:block">
          <label htmlFor="global-search" className="sr-only">Search</label>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />
          <Input
            id="global-search"
            ref={searchRef}
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchSubmit();
              if (e.key === 'Escape') handleSearchClear();
            }}
            placeholder="Search..."
            className="pl-8 pr-16 h-8 bg-background/60 border-border/60 text-xs"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {globalSearch && (
              <button
                onClick={handleSearchClear}
                className="p-0.5 rounded text-muted-foreground/50 hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <kbd className="h-4.5 px-1 rounded bg-muted/80 text-[9px] text-muted-foreground/40 font-mono border border-border/50">
              &#8984;K
            </kbd>
          </div>
        </div>

        {/* Mobile search trigger */}
        <Button
          variant="ghost"
          size="sm"
          className="sm:hidden h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={() => {
            // Trigger command palette on mobile
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          }}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search</span>
        </Button>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          {/* Live Clock */}
          <LiveClock />
          <LastSync />

          {/* Connection quality */}
          <ConnectionIndicator />

          {/* SSE live indicator */}
          <div
            className={cn(
              'hidden md:flex items-center gap-1.5 px-2 h-7 rounded-md border transition-colors duration-500',
              sseConnected
                ? 'bg-emerald/5 border-emerald/20 text-emerald'
                : 'bg-muted/30 border-border/40 text-muted-foreground/50'
            )}
            title={sseConnected ? 'Live connected via SSE' : 'Reconnecting...'}
          >
            <Zap className={cn('h-3 w-3', sseConnected && 'animate-pulse')} aria-hidden="true" />
            <span className="text-[10px] font-medium">{sseConnected ? 'LIVE' : '...'}</span>
          </div>

          {/* Election Type Badge */}
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] h-7 px-2 font-medium gap-1 cursor-default hidden sm:flex',
              TIER_STYLES[electionTier] || 'border-border text-muted-foreground'
            )}
          >
            <Vote className="h-3 w-3" aria-hidden="true" />
            <span className="hidden md:inline">{TIER_SHORT[electionTier]}</span>
            <span className="md:hidden">{electionTier === 'LOCAL' ? 'Local' : electionTier === 'STATE' ? 'Gov' : 'Pres'}</span>
          </Badge>

          {/* Election date — only for larger screens */}
          {electionInfo?.date && (
            <div className="hidden xl:flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {new Date(electionInfo.date).toLocaleDateString('en-NG', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </div>
          )}

          {/* System health indicator — admin roles only */}
          {user && (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') && (
            <div className="hidden lg:flex items-center gap-1.5 px-2 h-7 rounded-md bg-background/60 border border-border/60">
              <Activity className="h-3 w-3 text-emerald" aria-hidden="true" />
              <span className="text-[10px] text-muted-foreground">Systems</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
            </div>
          )}

          {/* Defense button — hide for field agents */}
          {user && user.role !== 'FIELD_AGENT' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 bg-background/60 border-border/60 text-xs hidden sm:flex"
              onClick={() => setSelectedTab('alerts')}
            >
              <Shield className="h-3.5 w-3.5 text-cyan" aria-hidden="true" />
              <span className="hidden md:inline">Defense</span>
              {kpis?.securityAlerts ? (
                <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[9px]">{kpis.securityAlerts}</Badge>
              ) : null}
            </Button>
          )}

          {/* Broadcast button — admin/analyst roles */}
          {user && user.role !== 'FIELD_AGENT' && user.role !== 'TRUST_SAFETY' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 bg-amber/5 border-amber/20 text-amber hover:bg-amber/10 hover:text-amber text-xs hidden sm:flex"
              onClick={() => setBroadcastOpen(true)}
            >
              <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden md:inline">Broadcast</span>
            </Button>
          )}

          {/* Notifications Bell */}
          <NotificationBell />

          {/* Win Probability — compact badge for non-field roles */}
          {user && user.role !== 'FIELD_AGENT' && (
            <WinProbabilityHeader />
          )}

          {/* Sound toggle */}
          <SoundToggle />

          {/* Dashboard export */}
          {containerRef && <DashboardExport containerRef={containerRef} size="sm" />}

          <Separator orientation="vertical" className="h-6 bg-border/60" />

          {/* Theme toggle */}
          <ThemeToggle />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 px-1.5 gap-2">
                <Avatar className="h-6 w-6 ring-1 ring-border/50">
                  <AvatarFallback className="bg-emerald/15 text-emerald text-[10px] font-bold">
                    {user?.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || '??'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:block text-left">
                  <p className="text-[11px] font-medium leading-tight">{user?.name || 'User'}</p>
                  <p className="text-[9px] text-muted-foreground/50 leading-tight">{user?.role?.replace(/_/g, ' ') || ''}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                <User className="mr-2 h-4 w-4" />Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />Settings
              </DropdownMenuItem>
              {user?.role === 'SUPER_ADMIN' ? (
                <TenantSwitcher />
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={logout}>Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={(open) => {
        setProfileOpen(open);
        if (!open) {
          setShowPwChange(false);
          setCurrentPw('');
          setNewPw('');
          setConfirmPw('');
          setPwError('');
          setPwSuccess('');
        }
      }}>
        <DialogContent className="sm:max-w-lg glass-strong">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
            <DialogDescription>Your account information and role details.</DialogDescription>
          </DialogHeader>
          {user && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 ring-2 ring-emerald/20">
                  <AvatarFallback className="bg-emerald/15 text-emerald text-lg font-bold">
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

              <Separator />

              {/* Change Password Toggle */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={() => { setShowPwChange(!showPwChange); setPwError(''); setPwSuccess(''); }}
              >
                <Lock className="h-3.5 w-3.5" />
                {showPwChange ? 'Hide Password Form' : 'Change Password'}
              </Button>

              {/* Password Change Form */}
              <AnimatePresence>
                {showPwChange && (
                  <m.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 pt-1">
                      {/* Success message */}
                      {pwSuccess && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald/10 border border-emerald/20 text-xs text-emerald">
                          <Check className="h-3.5 w-3.5 shrink-0" />
                          {pwSuccess}
                        </div>
                      )}

                      {/* Error message */}
                      {pwError && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose/10 border border-rose/20 text-xs text-rose">
                          <X className="h-3.5 w-3.5 shrink-0" />
                          {pwError}
                        </div>
                      )}

                      {/* Current Password */}
                      <div className="space-y-1.5">
                        <label htmlFor="profile-current-pw" className="text-xs font-medium text-muted-foreground/60">
                          Current Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                          <Input
                            id="profile-current-pw"
                            type={showCurrentPw ? 'text' : 'password'}
                            placeholder="Enter current password"
                            value={currentPw}
                            onChange={(e) => { setCurrentPw(e.target.value); setPwError(''); }}
                            className="pl-9 pr-10 h-10 bg-card/40 border-border/60 text-sm focus-visible:border-emerald/40"
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPw(!showCurrentPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors p-0.5"
                            aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
                          >
                            {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* New Password */}
                      <div className="space-y-1.5">
                        <label htmlFor="profile-new-pw" className="text-xs font-medium text-muted-foreground/60">
                          New Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                          <Input
                            id="profile-new-pw"
                            type={showNewPw ? 'text' : 'password'}
                            placeholder="Enter new password"
                            value={newPw}
                            onChange={(e) => { setNewPw(e.target.value); setPwError(''); }}
                            className="pl-9 pr-10 h-10 bg-card/40 border-border/60 text-sm focus-visible:border-emerald/40"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPw(!showNewPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors p-0.5"
                            aria-label={showNewPw ? 'Hide password' : 'Show password'}
                          >
                            {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>

                        {/* Password strength indicator */}
                        <AnimatePresence>
                          {newPw.length > 0 && (
                            <m.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-1.5 overflow-hidden"
                            >
                              <div className="flex gap-1">
                                {[1, 2, 3, 4].map(i => (
                                  <div key={i} className={cn(
                                    'h-1 flex-1 rounded-full transition-colors duration-300',
                                    i <= getPasswordStrength(newPw).score
                                      ? getPasswordStrength(newPw).score >= 3 ? 'bg-emerald' : getPasswordStrength(newPw).score >= 2 ? 'bg-amber' : 'bg-rose'
                                      : 'bg-secondary'
                                  )} />
                                ))}
                              </div>
                              <p className={cn('text-[10px] font-medium', getPasswordStrength(newPw).color)}>
                                {getPasswordStrength(newPw).label}
                              </p>
                            </m.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-1.5">
                        <label htmlFor="profile-confirm-pw" className="text-xs font-medium text-muted-foreground/60">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                          <Input
                            id="profile-confirm-pw"
                            type={showConfirmPw ? 'text' : 'password'}
                            placeholder="Confirm new password"
                            value={confirmPw}
                            onChange={(e) => { setConfirmPw(e.target.value); setPwError(''); }}
                            className="pl-9 pr-10 h-10 bg-card/40 border-border/60 text-sm focus-visible:border-emerald/40"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPw(!showConfirmPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors p-0.5"
                            aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                          >
                            {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {confirmPw && newPw && confirmPw !== newPw && (
                          <p className="text-[10px] text-rose">Passwords do not match</p>
                        )}
                      </div>

                      {/* Submit */}
                      <Button
                        className="w-full bg-emerald hover:bg-emerald/90 text-emerald-950 h-10"
                        disabled={pwChanging || !currentPw || !newPw || !confirmPw}
                        onClick={async () => {
                          if (newPw !== confirmPw) {
                            setPwError('Passwords do not match');
                            return;
                          }
                          setPwError('');
                          setPwSuccess('');
                          setPwChanging(true);
                          try {
                            await fetchJson('/api/auth/password', {
                              method: 'PUT',
                              body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
                            });
                            setPwSuccess('Password updated successfully');
                            setCurrentPw('');
                            setNewPw('');
                            setConfirmPw('');
                            setTimeout(() => {
                              setShowPwChange(false);
                              setPwSuccess('');
                            }, 1500);
                          } catch (err: unknown) {
                            setPwError(err instanceof Error ? err.message : 'Failed to update password');
                          } finally {
                            setPwChanging(false);
                          }
                        }}
                      >
                        {pwChanging ? 'Updating...' : 'Update Password'}
                      </Button>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Broadcast Briefing Dialog */}
      <BroadcastBriefing open={broadcastOpen} onOpenChange={setBroadcastOpen} />

      {/* Profile Settings Dialog */}
      <ProfileSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
})
