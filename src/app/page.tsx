'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const AnimatedTabTransition = dynamic(
  () => import('@/components/dashboard/animated-tab-transition').then(m => ({ default: m.AnimatedTabTransition })),
  { ssr: false }
);

import { LoginScreen } from '@/components/dashboard/login';
import { AppSidebar } from '@/components/dashboard/sidebar';
import { AppHeader } from '@/components/dashboard/header';
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { CommandPalette } from '@/components/dashboard/command-palette';
import { KeyboardShortcuts } from '@/components/dashboard/keyboard-shortcuts';
import { QuickActionsFab } from '@/components/dashboard/quick-actions-fab';
import { ElectionTicker } from '@/components/dashboard/election-ticker';
import { ChatToggleButton, TeamChatDrawer } from '@/components/dashboard/team-chat';
import { ToastSoundEnhancer } from '@/components/dashboard/toast-sound-enhancer';
import { PwaRegistration } from '@/components/pwa-registration';
import { TabContent } from '@/components/dashboard/tab-renderer';
import { useDashboardWebSocket } from '@/hooks/use-dashboard-websocket';
import { useTabPrefetch } from '@/hooks/use-tab-prefetch';
import { useDashboardStore, ROLE_TABS, type ViewTab } from '@/store/dashboard';
import { fetchJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useMemoizedCallback } from '@/hooks/use-memoized-callback';
import type { DashboardData, Incident, AlertsData } from '@/types/dashboard';

// Re-export types for backward compatibility
export type { Incident, DashboardData, AlertsData } from '@/types/dashboard';

// Tab display labels for breadcrumbs & toasts
const TAB_LABELS: Record<string, string> = {
  'overview': 'Overview', 'situation': 'Situation Room', 'map': 'Geo Map',
  'feed': 'Live Feed', 'alerts': 'Alert Triage', 'osint': 'OSINT Monitor',
  'ai': 'AI Insights', 'media': 'Media Gallery', 'mobilization': 'Mobilization',
  'campaigns': 'Campaign Monitor', 'campaign-analytics': 'Campaign Analytics', 'social-cards': 'Social Cards', 'security': 'Security Center',
  'field-safety': 'Field Safety', 'pvt': 'PVT Quick Count',
  'victory-roadmap': 'Victory Roadmap',
  'evidence': 'Evidence Dossier', 'flashpoint': 'Flashpoint & Wargame',
  'honeypot': 'Honeypot Biometrics', 'audit-logs': 'Audit Logs',
  'submit': 'Submit Report', 'my-reports': 'My Reports',
  'agents': 'Agent Roster', 'engagement': 'Agent Engagement',
  'system': 'System Health', 'tenants': 'Tenant Management',
  'narrative': 'Narrative Builder',
  'reports': 'Reports Center', 'activity-stream': 'Activity Stream',
  'data-explorer': 'Data Explorer',
};

// Section grouping for breadcrumbs
const TAB_SECTION: Record<string, string> = {
  'overview': 'Command', 'situation': 'Command', 'map': 'Command', 'feed': 'Command',
  'alerts': 'Intelligence', 'osint': 'Intelligence', 'ai': 'Intelligence', 'media': 'Intelligence',
  'mobilization': 'Operations', 'narrative': 'Operations', 'campaigns': 'Operations', 'campaign-analytics': 'Operations', 'social-cards': 'Operations', 'security': 'Operations', 'field-safety': 'Operations',
  'pvt': 'Analysis', 'victory-roadmap': 'Analysis', 'data-explorer': 'Analysis', 'evidence': 'Analysis', 'flashpoint': 'Analysis', 'honeypot': 'Analysis',
  'agents': 'Team', 'engagement': 'Team', 'audit-logs': 'Team', 'reports': 'Team',
  'submit': 'Field Ops', 'my-reports': 'Field Ops',
  'system': 'Admin', 'tenants': 'Admin', 'activity-stream': 'Command',
};

// ---- Main Page ----
export default function Home() {
  const mainContentRef = useRef<HTMLDivElement>(null);
  const {
    isAuthenticated, user, activeTab, setElectionInfo, tenantId,
    setUnreadAlerts, login, setTenantId, setSelectedTab, setAvailableTenants,
  } = useDashboardStore();
  const queryClient = useQueryClient();

  // ── Dashboard WebSocket + SSE ── (operational roles only — platform admin doesn't need real-time election data)
  const isPlatformAdmin = user?.role === 'SUPER_ADMIN';
  const { liveIncidents, wsTransport } = useDashboardWebSocket({
    tenantId: tenantId || '',
    enabled: isAuthenticated && !!tenantId && !isPlatformAdmin,
    userId: user?.id,
  });

  // Phase 10: Prefetch adjacent tab chunks after dwell delay
  useTabPrefetch(activeTab, isAuthenticated);

  // Sync URL hash with active tab on mount
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && hash !== activeTab) {
      const validTabs = user ? (ROLE_TABS[user.role] || []) : [];
      if (validTabs.includes(hash as ViewTab)) {
        setSelectedTab(hash as ViewTab);
      }
    }
  }, []);

  // Update hash when tab changes
  useEffect(() => {
    if (activeTab) {
      window.location.hash = activeTab;
      document.title = `OmniVote — ${activeTab.replace(/-/g, ' ')}`;
    }
  }, [activeTab]);

  // ── Session restoration ──
  const sessionRestore = useQuery<{
    authenticated: boolean;
    user?: { id: string; email: string; name: string; role: string; tenantId: string; tenantName: string; tenantSlug: string };
    availableTenants?: Array<{ id: string; name: string; slug: string; primaryColor: string | null }>;
  }>({
    queryKey: ['session-check'],
    queryFn: () => fetchJson('/api/auth'),
    staleTime: 0,
    retry: false,
    enabled: !isAuthenticated,
  });

  useEffect(() => {
    if (sessionRestore.data?.authenticated && sessionRestore.data.user && !isAuthenticated) {
      const u = sessionRestore.data.user;
      login({
        id: u.id, email: u.email, name: u.name,
        role: u.role as 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'ANALYST' | 'TRUST_SAFETY' | 'FIELD_AGENT',
        tenantId: u.tenantId, tenantName: u.tenantName, tenantSlug: u.tenantSlug,
      });
      setTenantId(u.tenantId);
      if (sessionRestore.data.availableTenants) {
        setAvailableTenants(sessionRestore.data.availableTenants);
      }
    }
  }, [sessionRestore.data, isAuthenticated, login, setTenantId, setAvailableTenants]);

  const tenantParam = tenantId ? `?tenantId=${tenantId}` : '';

  // Phase 10: Smart polling — when WebSocket is connected, rely on push updates
  // instead of polling. Fall back to 30s polling when WS is disconnected.
  const wsConnected = wsTransport === 'ws' || wsTransport === 'sse';

  // Fetch dashboard data — operational roles only
  const { data: dashData, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard', tenantId],
    queryFn: () => fetchJson(`/api/dashboard${tenantParam}`),
    refetchInterval: wsConnected ? false : 30_000,
    enabled: isAuthenticated && !isPlatformAdmin,
  });

  // Sync election info from server
  useEffect(() => {
    if (dashData?.electionInfo) {
      setElectionInfo(dashData.electionInfo);
    }
  }, [dashData?.electionInfo, setElectionInfo]);

  // Fetch incidents — operational roles only
  const { data: incidentsData, isLoading: incLoading } = useQuery<{ incidents: Incident[]; total: number; hasMore: boolean }>({
    queryKey: ['incidents', 'all', tenantId],
    queryFn: () => fetchJson(`/api/incidents?limit=50&tenantId=${tenantId}`),
    refetchInterval: wsConnected ? false : 30_000,
    enabled: isAuthenticated && !isPlatformAdmin,
  });

  // Fetch alerts — operational roles only
  const { data: alertsData, isLoading: alertsLoading } = useQuery<AlertsData>({
    queryKey: ['alerts', 'all', tenantId],
    queryFn: () => fetchJson(`/api/alerts?tenantId=${tenantId}`),
    refetchInterval: wsConnected ? false : 30_000,
    enabled: isAuthenticated && !isPlatformAdmin,
  });

  // Sync unread alerts count to store
  useEffect(() => {
    if (alertsData) {
      setUnreadAlerts(alertsData.unreadCount);
    }
  }, [alertsData, setUnreadAlerts]);

  const isLoading = dashLoading || incLoading || alertsLoading;

  // Show loading while checking session restoration
  if (!isAuthenticated && sessionRestore.isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 animate-scale-in">
          <div className="relative inline-block">
            <Loader2 className="h-8 w-8 animate-spin text-emerald" />
            <div className="absolute inset-0 rounded-full animate-ping bg-emerald/10" />
          </div>
          <p className="text-sm text-muted-foreground">Restoring session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className={user?.role === 'FIELD_AGENT' ? 'md:block hidden' : ''}>
          <AppHeader />
        </div>
        <main className="flex-1 overflow-hidden">
          <DashboardSkeleton />
        </main>
        {user?.role === 'FIELD_AGENT' && <MobileBottomNav />}
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <KeyboardShortcuts />
      <CommandPalette />
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className={user?.role === 'FIELD_AGENT' ? 'md:block hidden' : ''}>
          <AppHeader
            containerRef={mainContentRef}
            breadcrumb={{ section: TAB_SECTION[activeTab] || '', current: TAB_LABELS[activeTab] || activeTab }}
            kpis={dashData?.kpis ? {
              onlineAgents: dashData.kpis.onlineAgents,
              totalAgents: dashData.kpis.totalAgents,
              unreadAlerts: dashData.kpis.unreadAlerts,
              securityAlerts: dashData.kpis.securityAlerts,
            } : undefined}
          />
        </div>

        <main ref={mainContentRef} id="main-content" className={cn('flex-1 overflow-hidden', user?.role === 'FIELD_AGENT' && 'pb-14 md:pb-0')} role="main">
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            Switched to {activeTab.replace(/-/g, ' ')} view
          </div>
          <AnimatedTabTransition activeKey={activeTab}>
              <TabContent
                activeTab={activeTab}
                dashData={dashData!}
                incidents={incidentsData?.incidents || []}
                alertsData={alertsData}
                liveIncidents={liveIncidents}
              />
          </AnimatedTabTransition>
        </main>
        {/* Election ticker — election-specific, hide for platform admin */}
        {user?.role !== 'SUPER_ADMIN' && <ElectionTicker />}
        <MobileBottomNav />
      </div>
      {/* Operational overlays — hide for platform admin */}
      {user?.role !== 'SUPER_ADMIN' && <ToastSoundEnhancer />}
      {user?.role !== 'SUPER_ADMIN' && <TeamChatDrawer />}
      {user?.role !== 'SUPER_ADMIN' && <ChatToggleButton />}
      {user?.role !== 'SUPER_ADMIN' && <QuickActionsFab />}
      <PwaRegistration />
    </div>
  );
}
