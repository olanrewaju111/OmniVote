'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

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
import { useDashboardStore, ROLE_TABS, type ViewTab } from '@/store/dashboard';
import { fetchJson } from '@/lib/api';
import { cn } from '@/lib/utils';
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
};

// Section grouping for breadcrumbs
const TAB_SECTION: Record<string, string> = {
  'overview': 'Command', 'situation': 'Command', 'map': 'Command', 'feed': 'Command',
  'alerts': 'Intelligence', 'osint': 'Intelligence', 'ai': 'Intelligence', 'media': 'Intelligence',
  'mobilization': 'Operations', 'narrative': 'Operations', 'campaigns': 'Operations', 'campaign-analytics': 'Operations', 'social-cards': 'Operations', 'security': 'Operations', 'field-safety': 'Operations',
  'pvt': 'Analysis', 'victory-roadmap': 'Analysis', 'evidence': 'Analysis', 'flashpoint': 'Analysis', 'honeypot': 'Analysis',
  'agents': 'Team', 'engagement': 'Team', 'audit-logs': 'Team', 'reports': 'Team',
  'submit': 'Field Ops', 'my-reports': 'Field Ops',
  'system': 'Admin', 'tenants': 'Admin', 'activity-stream': 'Command',
};

// ---- Main Page ----
export default function Home() {
  const {
    isAuthenticated, user, activeTab, setElectionInfo, tenantId,
    setUnreadAlerts, login, setTenantId, setSelectedTab,
  } = useDashboardStore();
  const queryClient = useQueryClient();

  // ── Dashboard WebSocket + SSE ──
  const { liveIncidents, wsTransport } = useDashboardWebSocket({
    tenantId: tenantId || '',
    enabled: isAuthenticated && !!tenantId,
    userId: user?.id,
  });

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
    }
  }, [sessionRestore.data, isAuthenticated, login, setTenantId]);

  const tenantParam = tenantId ? `?tenantId=${tenantId}` : '';

  // Fetch dashboard data
  const { data: dashData, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard', tenantId],
    queryFn: () => fetchJson(`/api/dashboard${tenantParam}`),
    refetchInterval: 30_000,
    enabled: isAuthenticated,
  });

  // Sync election info from server
  useEffect(() => {
    if (dashData?.electionInfo) {
      setElectionInfo(dashData.electionInfo);
    }
  }, [dashData?.electionInfo, setElectionInfo]);

  // Fetch incidents
  const { data: incidentsData, isLoading: incLoading } = useQuery<{ incidents: Incident[]; total: number; hasMore: boolean }>({
    queryKey: ['incidents', 'all', tenantId],
    queryFn: () => fetchJson(`/api/incidents?limit=50&tenantId=${tenantId}`),
    refetchInterval: 30_000,
    enabled: isAuthenticated,
  });

  // Fetch alerts
  const { data: alertsData, isLoading: alertsLoading } = useQuery<AlertsData>({
    queryKey: ['alerts', 'all', tenantId],
    queryFn: () => fetchJson(`/api/alerts?tenantId=${tenantId}`),
    refetchInterval: 30_000,
    enabled: isAuthenticated,
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
            breadcrumb={{ section: TAB_SECTION[activeTab] || '', current: TAB_LABELS[activeTab] || activeTab }}
            kpis={dashData?.kpis ? {
              onlineAgents: dashData.kpis.onlineAgents,
              totalAgents: dashData.kpis.totalAgents,
              unreadAlerts: dashData.kpis.unreadAlerts,
              securityAlerts: dashData.kpis.securityAlerts,
            } : undefined}
          />
        </div>

        <main id="main-content" className={cn('flex-1 overflow-hidden', user?.role === 'FIELD_AGENT' && 'pb-14 md:pb-0')} role="main">
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            Switched to {activeTab.replace(/-/g, ' ')} view
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.995 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              className="h-full"
              role="tabpanel"
              aria-label={`${activeTab.replace(/-/g, ' ')} panel`}
            >
              <TabContent
                activeTab={activeTab}
                dashData={dashData!}
                incidents={incidentsData?.incidents || []}
                alertsData={alertsData}
                liveIncidents={liveIncidents}
              />
            </motion.div>
          </AnimatePresence>
        </main>
        <ElectionTicker />
        <MobileBottomNav />
      </div>
      <ToastSoundEnhancer />
      <TeamChatDrawer />
      <ChatToggleButton />
      <QuickActionsFab />
      <PwaRegistration />
    </div>
  );
}
