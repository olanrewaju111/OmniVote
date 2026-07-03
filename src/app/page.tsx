'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

import { LoginScreen } from '@/components/dashboard/login';
import { AppSidebar } from '@/components/dashboard/sidebar';
import { AppHeader } from '@/components/dashboard/header';
import { useDashboardStore, type ElectionInfo } from '@/store/dashboard';
import { KpiGrid } from '@/components/dashboard/kpi-grid';
import { PwaRegistration } from '@/components/pwa-registration';
import { fetchJson } from '@/lib/api';

// ---- Code-split heavy tab components ----
const createDynamic = <T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
) =>
  dynamic(loader, {
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  });

const GeoMapView = createDynamic(() => import('@/components/dashboard/geo-map').then(m => ({ default: m.GeoMapView })));
const LiveFeed = createDynamic(() => import('@/components/dashboard/live-feed').then(m => ({ default: m.LiveFeed })));
const AlertTriage = createDynamic(() => import('@/components/dashboard/alert-triage').then(m => ({ default: m.AlertTriage })));
const AiInsights = createDynamic(() => import('@/components/dashboard/ai-insights').then(m => ({ default: m.AiInsights })));
const MediaGallery = createDynamic(() => import('@/components/dashboard/media-gallery').then(m => ({ default: m.MediaGallery })));
const SubmitReport = createDynamic(() => import('@/components/dashboard/field-submit').then(m => ({ default: m.SubmitReport })));
const MyReports = createDynamic(() => import('@/components/dashboard/field-reports').then(m => ({ default: m.MyReports })));
const AgentRoster = createDynamic(() => import('@/components/dashboard/agent-roster').then(m => ({ default: m.AgentRoster })));
const SystemHealth = createDynamic(() => import('@/components/dashboard/system-health').then(m => ({ default: m.SystemHealth })));
const TenantManagement = createDynamic(() => import('@/components/dashboard/tenant-mgmt').then(m => ({ default: m.TenantManagement })));
const SituationRoom = createDynamic(() => import('@/components/dashboard/situation-room').then(m => ({ default: m.SituationRoom })));
const AgentEngagement = createDynamic(() => import('@/components/dashboard/agent-engagement').then(m => ({ default: m.AgentEngagement })));
const OsintMonitor = createDynamic(() => import('@/components/dashboard/osint-monitor').then(m => ({ default: m.OsintMonitor })));
const MobilizationEngine = createDynamic(() => import('@/components/dashboard/mobilization').then(m => ({ default: m.MobilizationEngine })));
const CampaignMonitor = createDynamic(() => import('@/components/dashboard/campaign-monitor').then(m => ({ default: m.CampaignMonitor })));
const SecurityCenter = createDynamic(() => import('@/components/dashboard/security-center').then(m => ({ default: m.SecurityCenter })));
const FieldSafety = createDynamic(() => import('@/components/dashboard/field-safety').then(m => ({ default: m.FieldSafety })));
const PvtQuickCount = createDynamic(() => import('@/components/dashboard/pvt-quick-count').then(m => ({ default: m.PvtQuickCount })));
const EvidenceDossier = createDynamic(() => import('@/components/dashboard/evidence-dossier').then(m => ({ default: m.EvidenceDossier })));
const FlashpointWargame = createDynamic(() => import('@/components/dashboard/flashpoint-wargame').then(m => ({ default: m.FlashpointWargame })));
const HoneypotBiometrics = createDynamic(() => import('@/components/dashboard/honeypot-biometrics').then(m => ({ default: m.HoneypotBiometrics })));

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
  const { isAuthenticated, user, activeTab, setElectionInfo, tenantId, setUnreadAlerts } = useDashboardStore();

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

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Show loading state after login
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald mx-auto" />
          <p className="text-sm text-muted-foreground">Loading {user?.role?.replace(/_/g, ' ')} dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader
          kpis={dashData?.kpis ? {
            onlineAgents: dashData.kpis.onlineAgents,
            totalAgents: dashData.kpis.totalAgents,
            unreadAlerts: dashData.kpis.unreadAlerts,
            securityAlerts: dashData.kpis.securityAlerts,
          } : undefined}
        />

        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'situation' && (
                <div className="h-full">
                  <SituationRoom />
                </div>
              )}
              {activeTab === 'overview' && (
                <OverviewTab
                  dashData={dashData!}
                  incidents={incidentsData?.incidents || []}
                  alertsData={alertsData}
                />
              )}
              {activeTab === 'map' && (
                <div className="h-full p-4">
                  <div className="h-full rounded-xl border border-border bg-card/40 overflow-hidden">
                    <GeoMapView points={dashData?.pollingUnits || []} bounds={dashData?.mapBounds || undefined} />
                  </div>
                </div>
              )}
              {activeTab === 'feed' && (
                <div className="h-full">
                  <LiveFeed incidents={incidentsData?.incidents || []} hasMore={incidentsData?.hasMore} />
                </div>
              )}
              {activeTab === 'alerts' && (
                <div className="h-full">
                  <AlertTriage
                    alerts={alertsData?.alerts || []}
                    operationalCount={alertsData?.operationalCount || 0}
                    securityCount={alertsData?.securityCount || 0}
                    criticalCount={alertsData?.criticalCount || 0}
                  />
                </div>
              )}
              {activeTab === 'osint' && (
                <div className="h-full">
                  <OsintMonitor />
                </div>
              )}
              {activeTab === 'ai' && (
                <AiInsights
                  incidents={incidentsData?.incidents || []}
                  stateAgg={dashData?.election.stateAgg || {}}
                />
              )}
              {activeTab === 'media' && (
                <MediaGallery />
              )}
              {activeTab === 'mobilization' && (
                <div className="h-full">
                  <MobilizationEngine />
                </div>
              )}
              {activeTab === 'campaigns' && (
                <div className="h-full">
                  <CampaignMonitor />
                </div>
              )}
              {activeTab === 'security' && (
                <div className="h-full">
                  <SecurityCenter />
                </div>
              )}
              {activeTab === 'field-safety' && (
                <div className="h-full">
                  <FieldSafety />
                </div>
              )}
              {activeTab === 'pvt' && (
                <div className="h-full">
                  <PvtQuickCount />
                </div>
              )}
              {activeTab === 'evidence' && (
                <div className="h-full">
                  <EvidenceDossier />
                </div>
              )}
              {activeTab === 'flashpoint' && (
                <div className="h-full">
                  <FlashpointWargame />
                </div>
              )}
              {activeTab === 'honeypot' && (
                <div className="h-full">
                  <HoneypotBiometrics />
                </div>
              )}
              {activeTab === 'submit' && (
                <SubmitReport />
              )}
              {activeTab === 'my-reports' && (
                <MyReports />
              )}
              {activeTab === 'agents' && (
                <AgentRoster />
              )}
              {activeTab === 'engagement' && (
                <AgentEngagement />
              )}
              {activeTab === 'system' && (
                <SystemHealth />
              )}
              {activeTab === 'tenants' && (
                <TenantManagement />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
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
  return (
    <div className="h-full flex flex-col p-4 gap-3 overflow-hidden">
      {/* Top: KPI grid (includes the 4 quick stats inline so nothing overflows) */}
      <div className="shrink-0">
        <KpiGrid
          data={dashData.kpis}
          election={dashData.election}
          extraStats={alertsData ? [
            { label: 'Threats Intercepted', value: dashData.kpis.quarantinedIncidents, color: 'rose' },
            { label: 'C2PA Verified Media', value: incidents.filter(i => i.c2paVerified).length, color: 'emerald' },
            { label: 'Active Polling Units', value: dashData.election.openUnits, color: 'cyan' },
            { label: 'Pending Review', value: dashData.kpis.pendingIncidents, color: 'amber' },
          ] : undefined}
        />
      </div>

      {/* Map + Feed: takes remaining space, no scroll overflow */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-xl border border-border bg-card/40 overflow-hidden">
          <GeoMapView points={dashData.pollingUnits} bounds={dashData.mapBounds || undefined} />
        </div>
        <div className="lg:col-span-2 rounded-xl border border-border bg-card/40 overflow-hidden">
          <LiveFeed incidents={incidents.slice(0, 25)} />
        </div>
      </div>
    </div>
  );
}

