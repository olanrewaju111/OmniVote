'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Map, BarChart3, ShieldAlert, Lock } from 'lucide-react';
import dynamic from 'next/dynamic';

import { LoginScreen } from '@/components/dashboard/login';
import { AppSidebar } from '@/components/dashboard/sidebar';
import { AppHeader } from '@/components/dashboard/header';
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav';
import { DashboardSkeleton, TableSkeleton, FeedSkeleton, CardGridSkeleton, MapSkeleton, FormSkeleton, ChartSkeleton, ListDetailSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { CommandPalette } from '@/components/dashboard/command-palette';
import { KeyboardShortcuts } from '@/components/dashboard/keyboard-shortcuts';
import { useDashboardStore, ROLE_TABS, type ViewTab, type ElectionInfo } from '@/store/dashboard';
import { KpiGrid } from '@/components/dashboard/kpi-grid';
import { PwaRegistration } from '@/components/pwa-registration';
import { ErrorBoundary } from '@/components/error-boundary';
import { fetchJson } from '@/lib/api';
import { cn } from '@/lib/utils';

// ---- Code-split heavy tab components ----

// Tab-specific loading skeletons for code-split components
const TAB_SKELETONS: Record<string, React.ComponentType> = {
  'situation': () => <div className="h-full p-4"><TableSkeleton rows={6} cols={5} /></div>,
  'map': MapSkeleton,
  'feed': () => <div className="h-full rounded-xl border border-border bg-card/40 overflow-hidden"><FeedSkeleton /></div>,
  'alerts': () => <div className="h-full p-4"><TableSkeleton rows={5} cols={4} /></div>,
  'osint': () => <CardGridSkeleton cols={2} rows={3} />,
  'ai': ChartSkeleton,
  'media': () => <CardGridSkeleton cols={3} rows={2} />,
  'mobilization': () => <CardGridSkeleton cols={2} rows={3} />,
  'campaigns': () => <CardGridSkeleton cols={2} rows={3} />,
  'security': ChartSkeleton,
  'field-safety': () => <CardGridSkeleton cols={2} rows={3} />,
  'pvt': ChartSkeleton,
  'evidence': ListDetailSkeleton,
  'flashpoint': () => <CardGridSkeleton cols={2} rows={3} />,
  'honeypot': () => <CardGridSkeleton cols={2} rows={3} />,
  'audit-logs': () => <div className="h-full p-4"><TableSkeleton rows={8} cols={5} /></div>,
  'submit': FormSkeleton,
  'my-reports': () => <div className="h-full p-4"><TableSkeleton rows={5} cols={4} /></div>,
  'agents': () => <div className="h-full p-4"><TableSkeleton rows={6} cols={5} /></div>,
  'engagement': ListDetailSkeleton,
  'system': () => <CardGridSkeleton cols={3} rows={2} />,
  'tenants': () => <div className="h-full p-4"><TableSkeleton rows={4} cols={4} /></div>,
};

const createDynamic = <T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  tabKey?: string,
) =>
  dynamic(loader, {
    loading: () => {
      const Skeleton = tabKey ? TAB_SKELETONS[tabKey] : null;
      if (Skeleton) return <div className="h-full p-4"><Skeleton /></div>;
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    },
  });

const GeoMapView = createDynamic(() => import('@/components/dashboard/geo-map').then(m => ({ default: m.GeoMapView })), 'map');
const LiveFeed = createDynamic(() => import('@/components/dashboard/live-feed').then(m => ({ default: m.LiveFeed })), 'feed');
const AlertTriage = createDynamic(() => import('@/components/dashboard/alert-triage').then(m => ({ default: m.AlertTriage })), 'alerts');
const AiInsights = createDynamic(() => import('@/components/dashboard/ai-insights').then(m => ({ default: m.AiInsights })), 'ai');
const MediaGallery = createDynamic(() => import('@/components/dashboard/media-gallery').then(m => ({ default: m.MediaGallery })), 'media');
const SubmitReport = createDynamic(() => import('@/components/dashboard/field-submit').then(m => ({ default: m.SubmitReport })), 'submit');
const MyReports = createDynamic(() => import('@/components/dashboard/field-reports').then(m => ({ default: m.MyReports })), 'my-reports');
const AgentRoster = createDynamic(() => import('@/components/dashboard/agent-roster').then(m => ({ default: m.AgentRoster })), 'agents');
const SystemHealth = createDynamic(() => import('@/components/dashboard/system-health').then(m => ({ default: m.SystemHealth })), 'system');
const TenantManagement = createDynamic(() => import('@/components/dashboard/tenant-mgmt').then(m => ({ default: m.TenantManagement })), 'tenants');
const SituationRoom = createDynamic(() => import('@/components/dashboard/situation-room').then(m => ({ default: m.SituationRoom })), 'situation');
const AgentEngagement = createDynamic(() => import('@/components/dashboard/agent-engagement').then(m => ({ default: m.AgentEngagement })), 'engagement');
const OsintMonitor = createDynamic(() => import('@/components/dashboard/osint-monitor').then(m => ({ default: m.OsintMonitor })), 'osint');
const MobilizationEngine = createDynamic(() => import('@/components/dashboard/mobilization').then(m => ({ default: m.MobilizationEngine })), 'mobilization');
const CampaignMonitor = createDynamic(() => import('@/components/dashboard/campaign-monitor').then(m => ({ default: m.CampaignMonitor })), 'campaigns');
const SecurityCenter = createDynamic(() => import('@/components/dashboard/security-center').then(m => ({ default: m.SecurityCenter })), 'security');
const FieldSafety = createDynamic(() => import('@/components/dashboard/field-safety').then(m => ({ default: m.FieldSafety })), 'field-safety');
const PvtQuickCount = createDynamic(() => import('@/components/dashboard/pvt-quick-count').then(m => ({ default: m.PvtQuickCount })), 'pvt');
const EvidenceDossier = createDynamic(() => import('@/components/dashboard/evidence-dossier').then(m => ({ default: m.EvidenceDossier })), 'evidence');
const FlashpointWargame = createDynamic(() => import('@/components/dashboard/flashpoint-wargame').then(m => ({ default: m.FlashpointWargame })), 'flashpoint');
const HoneypotBiometrics = createDynamic(() => import('@/components/dashboard/honeypot-biometrics').then(m => ({ default: m.HoneypotBiometrics })), 'honeypot');
const AuditLogViewer = createDynamic(() => import('@/components/dashboard/audit-log-viewer').then(m => ({ default: m.AuditLogViewer })), 'audit-logs');

// ---- Types ----
export interface Incident {
  id: string;
  type: string;
  severity: string;
  status: string;
  description: string;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAnomaly: boolean;
  aiSummary: string | null;
  aiFlags: string[];
  isQuarantined: boolean;
  c2paVerified: boolean;
  submittedAt: string;
  reviewedAt: string | null;
  reporter: { id: string; name: string; role: string } | null;
  pollingUnit: { id: string; name: string; code: string; state: string; lga: string } | null;
}

interface MapBoundsData {
  minLat: number; maxLat: number; minLng: number; maxLng: number; label: string;
}

interface DashboardData {
  mapBounds?: MapBoundsData | null;
  electionInfo: ElectionInfo;
  kpis: {
    totalAgents: number; onlineAgents: number; totalIncidents: number;
    pendingIncidents: number; criticalIncidents: number; quarantinedIncidents: number;
    securityAlerts: number; operationalAlerts: number; unreadAlerts: number; sosCount: number;
  };
  election: {
    totalPollingUnits: number; openUnits: number; closedUnits: number; flaggedUnits: number;
    totalRegistered: number; totalVotes: number; avgTurnout: number;
    stateAgg: Record<string, { units: number; votes: number; registered: number; turnout: number }>;
  };
  trends?: {
    onlineAgents?: { value: number; up: boolean };
    incidents?: { value: number; up: boolean };
    turnout?: { value: number; up: boolean };
  };
  pollingUnits: {
    id: string; name: string; code: string; state: string; lga: string;
    lat: number; lng: number; registered: number; votes: number;
    turnout: number; status: string;
  }[];
}

interface AlertsData {
  alerts: {
    id: string; type: 'OPERATIONAL' | 'SECURITY'; category: 'INFO' | 'WARNING' | 'CRITICAL';
    title: string; description: string; isRead: boolean; createdAt: string;
    incident: { severity: string; status: string; type: string } | null;
  }[];
  unreadCount: number; operationalCount: number; securityCount: number; criticalCount: number;
}

// ---- Main Page ----
export default function Home() {
  const { isAuthenticated, user, activeTab, setElectionInfo, tenantId, setUnreadAlerts, login, setTenantId, setSelectedTab } = useDashboardStore();

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

  // ── Session restoration: check if a valid cookie session exists on mount ──
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

  // Auto-restore session from cookie if server confirms authentication
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

  // Build URL with tenantId for all API calls
  const tenantParam = tenantId ? `?tenantId=${tenantId}` : '';

  // Fetch dashboard data (only when authenticated)
  const { data: dashData, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard', tenantId],
    queryFn: () => fetchJson(`/api/dashboard${tenantParam}`),
    refetchInterval: 15000,
    enabled: isAuthenticated,
  });

  // Sync election info from server (one type per tenant — not user-switchable)
  useEffect(() => {
    if (dashData?.electionInfo) {
      setElectionInfo(dashData.electionInfo);
    }
  }, [dashData?.electionInfo, setElectionInfo]);

  const { data: incidentsData, isLoading: incLoading } = useQuery<{ incidents: Incident[]; total: number; hasMore: boolean }>({
    queryKey: ['incidents', 'all', tenantId],
    queryFn: () => fetchJson(`/api/incidents?limit=50&tenantId=${tenantId}`),
    refetchInterval: 10000,
    enabled: isAuthenticated,
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery<AlertsData>({
    queryKey: ['alerts', 'all', tenantId],
    queryFn: () => fetchJson(`/api/alerts?tenantId=${tenantId}`),
    refetchInterval: 10000,
    enabled: isAuthenticated,
  });

  // Sync unread alerts count to store (sidebar badge)
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

  // Show login screen if not authenticated and session check is complete
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Show loading state after login
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
            kpis={dashData?.kpis ? {
              onlineAgents: dashData.kpis.onlineAgents,
              totalAgents: dashData.kpis.totalAgents,
              unreadAlerts: dashData.kpis.unreadAlerts,
              securityAlerts: dashData.kpis.securityAlerts,
            } : undefined}
          />
        </div>

        <main id="main-content" className={cn('flex-1 overflow-hidden', user?.role === 'FIELD_AGENT' && 'pb-14 md:pb-0')} role="main">
          {/* Screen reader announcement for tab changes */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            Switched to {activeTab.replace(/-/g, ' ')} view
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="h-full"
              role="tabpanel"
              aria-label={`${activeTab.replace(/-/g, ' ')} panel`}
            >
              {activeTab === 'situation' && (
                <ErrorBoundary title="Situation Room">
                  <div className="h-full">
                    <SituationRoom />
                  </div>
                </ErrorBoundary>
              )}
              {activeTab === 'overview' && (
                <ErrorBoundary title="Overview">
                  <OverviewTab
                    dashData={dashData!}
                    incidents={incidentsData?.incidents || []}
                    alertsData={alertsData}
                  />
                </ErrorBoundary>
              )}
              {activeTab === 'map' && (
                <ErrorBoundary title="Geo Map">
                  <div className="h-full p-4">
                    <div className="h-full rounded-xl border border-border bg-card/40 overflow-hidden">
                      <GeoMapView points={dashData?.pollingUnits || []} bounds={dashData?.mapBounds || undefined} />
                    </div>
                  </div>
                </ErrorBoundary>
              )}
              {activeTab === 'feed' && (
                <ErrorBoundary title="Live Feed">
                  <div className="h-full">
                    <LiveFeed incidents={incidentsData?.incidents || []} hasMore={incidentsData?.hasMore} />
                  </div>
                </ErrorBoundary>
              )}
              {activeTab === 'alerts' && (
                <ErrorBoundary title="Alert Triage">
                  <div className="h-full">
                    <AlertTriage
                      alerts={alertsData?.alerts || []}
                      operationalCount={alertsData?.operationalCount || 0}
                      securityCount={alertsData?.securityCount || 0}
                      criticalCount={alertsData?.criticalCount || 0}
                    />
                  </div>
                </ErrorBoundary>
              )}
              {activeTab === 'osint' && (
                <ErrorBoundary title="OSINT Monitor">
                  <div className="h-full">
                    <OsintMonitor />
                  </div>
                </ErrorBoundary>
              )}
              {activeTab === 'ai' && (
                <ErrorBoundary title="AI Insights">
                  <AiInsights
                    incidents={incidentsData?.incidents || []}
                    stateAgg={dashData?.election.stateAgg || {}}
                  />
                </ErrorBoundary>
              )}
              {activeTab === 'media' && (
                <ErrorBoundary title="Media Gallery">
                  <MediaGallery />
                </ErrorBoundary>
              )}
              {activeTab === 'mobilization' && (
                <ErrorBoundary title="Mobilization Engine">
                  <div className="h-full">
                    <MobilizationEngine />
                  </div>
                </ErrorBoundary>
              )}
              {activeTab === 'campaigns' && (
                <ErrorBoundary title="Campaign Monitor">
                  <div className="h-full">
                    <CampaignMonitor />
                  </div>
                </ErrorBoundary>
              )}
              {activeTab === 'security' && (
                <ErrorBoundary title="Security Center">
                  <div className="h-full">
                    <SecurityCenter />
                  </div>
                </ErrorBoundary>
              )}
              {activeTab === 'field-safety' && (
                <ErrorBoundary title="Field Safety">
                  <div className="h-full">
                    <FieldSafety />
                  </div>
                </ErrorBoundary>
              )}
              {activeTab === 'pvt' && (
                <ErrorBoundary title="PVT Quick Count">
                  <div className="h-full">
                    <PvtQuickCount />
                  </div>
                </ErrorBoundary>
              )}
              {activeTab === 'evidence' && (
                <ErrorBoundary title="Evidence Dossier">
                  <div className="h-full">
                    <EvidenceDossier />
                  </div>
                </ErrorBoundary>
              )}
              {activeTab === 'flashpoint' && (
                <ErrorBoundary title="Flashpoint Wargame">
                  <div className="h-full">
                    <FlashpointWargame />
                  </div>
                </ErrorBoundary>
              )}
              {activeTab === 'honeypot' && (
                <ErrorBoundary title="Honeypot Biometrics">
                  <div className="h-full">
                    <HoneypotBiometrics />
                  </div>
                </ErrorBoundary>
              )}
              {activeTab === 'audit-logs' && (
                <ErrorBoundary title="Audit Logs">
                  <div className="h-full">
                    <AuditLogViewer />
                  </div>
                </ErrorBoundary>
              )}
              {activeTab === 'submit' && (
                <ErrorBoundary title="Submit Report">
                  <SubmitReport />
                </ErrorBoundary>
              )}
              {activeTab === 'my-reports' && (
                <ErrorBoundary title="My Reports">
                  <MyReports />
                </ErrorBoundary>
              )}
              {activeTab === 'agents' && (
                <ErrorBoundary title="Agent Roster">
                  <AgentRoster />
                </ErrorBoundary>
              )}
              {activeTab === 'engagement' && (
                <ErrorBoundary title="Agent Engagement">
                  <AgentEngagement />
                </ErrorBoundary>
              )}
              {activeTab === 'system' && (
                <ErrorBoundary title="System Health">
                  <SystemHealth />
                </ErrorBoundary>
              )}
              {activeTab === 'tenants' && (
                <ErrorBoundary title="Tenant Management">
                  <TenantManagement />
                </ErrorBoundary>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="h-8 border-t border-border/40 flex items-center justify-between px-4 text-[10px] text-muted-foreground/30 shrink-0">
          <span>OmniVote Monitor v2.1</span>
          <span className="flex items-center gap-1">AES-256 Encrypted<Lock className="h-2.5 w-2.5" /></span>
        </footer>
        <MobileBottomNav />
      </div>
      <PwaRegistration />
    </div>
  );
}

// ---- Overview Tab ----
function OverviewTab({
  dashData, incidents, alertsData,
}: {
  dashData: DashboardData;
  incidents: Incident[];
  alertsData: AlertsData | undefined;
}) {
  const { setSelectedTab, user } = useDashboardStore();

  const criticalCount = incidents.filter(i => i.severity === 'CRITICAL').length;
  const recentIncidents = incidents.slice(0, 5);

  // Quick actions based on role
  const quickActions = [
    { label: 'View Map', tab: 'map' as ViewTab, icon: <Map className="h-4 w-4" />, color: 'text-cyan', bg: 'bg-cyan/10', desc: `${dashData.election.openUnits} units active` },
    { label: 'Situation Room', tab: 'situation' as ViewTab, icon: <BarChart3 className="h-4 w-4" />, color: 'text-emerald', bg: 'bg-emerald/10', desc: 'Hierarchical results' },
    { label: criticalCount > 0 ? `Critical Alerts (${criticalCount})` : 'Alert Triage', tab: 'alerts' as ViewTab, icon: <ShieldAlert className="h-4 w-4" />, color: criticalCount > 0 ? 'text-rose' : 'text-amber', bg: criticalCount > 0 ? 'bg-rose/10' : 'bg-amber/10', desc: `${dashData.kpis.unreadAlerts} unread` },
  ];

  return (
    <div className="h-full flex flex-col p-4 gap-3 overflow-hidden">
      {/* Top: KPI grid */}
      <div className="shrink-0">
        <KpiGrid
          data={dashData.kpis}
          election={dashData.election}
          trends={dashData.trends}
          extraStats={alertsData ? [
            { label: 'Threats Intercepted', value: dashData.kpis.quarantinedIncidents, color: 'rose' },
            { label: 'C2PA Verified Media', value: incidents.filter(i => i.c2paVerified).length, color: 'emerald' },
            { label: 'Active Polling Units', value: dashData.election.openUnits, color: 'cyan' },
            { label: 'Pending Review', value: dashData.kpis.pendingIncidents, color: 'amber' },
          ] : undefined}
        />
      </div>

      {/* Quick action cards */}
      <div className="shrink-0 grid grid-cols-3 gap-2">
        {quickActions.map((action) => (
          <button
            key={action.tab}
            onClick={() => setSelectedTab(action.tab)}
            className="rounded-lg border border-border/60 bg-card/30 hover:bg-card/50 p-3 text-left transition-all duration-200 card-lift group"
          >
            <div className={cn('p-1.5 rounded-md w-fit mb-2 transition-colors', action.bg)}>
              <span className={action.color}>{action.icon}</span>
            </div>
            <p className="text-xs font-medium leading-tight">{action.label}</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{action.desc}</p>
          </button>
        ))}
      </div>

      {/* Feed: takes remaining space */}
      <div className="flex-1 min-h-0">
        <div className="h-full rounded-xl border border-border bg-card/40 overflow-hidden">
          <LiveFeed incidents={incidents.slice(0, 25)} />
        </div>
      </div>
    </div>
  );
}

