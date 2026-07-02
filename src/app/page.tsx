'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

import { LoginScreen } from '@/components/dashboard/login';
import { AppSidebar } from '@/components/dashboard/sidebar';
import { AppHeader } from '@/components/dashboard/header';
import { useDashboardStore, type ElectionInfo } from '@/store/dashboard';
import { KpiGrid } from '@/components/dashboard/kpi-grid';
import { GeoMapView } from '@/components/dashboard/geo-map';
import { LiveFeed } from '@/components/dashboard/live-feed';
import { AlertTriage } from '@/components/dashboard/alert-triage';
import { AiInsights } from '@/components/dashboard/ai-insights';
import { MediaGallery } from '@/components/dashboard/media-gallery';
import { SubmitReport } from '@/components/dashboard/field-submit';
import { MyReports } from '@/components/dashboard/field-reports';
import { AgentRoster } from '@/components/dashboard/agent-roster';
import { SystemHealth } from '@/components/dashboard/system-health';
import { TenantManagement } from '@/components/dashboard/tenant-mgmt';
import { SituationRoom } from '@/components/dashboard/situation-room';
import { AgentEngagement } from '@/components/dashboard/agent-engagement';

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

interface DashboardData {
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
  const { isAuthenticated, user, activeTab, setElectionInfo, tenantId } = useDashboardStore();

  // Build URL with tenantId for all API calls
  const tenantParam = tenantId ? `?tenantId=${tenantId}` : '';

  // Fetch dashboard data (only when authenticated)
  const { data: dashData, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard', tenantId],
    queryFn: () => fetch(`/api/dashboard${tenantParam}`).then(r => r.json()),
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
    queryFn: () => fetch(`/api/incidents?limit=50&tenantId=${tenantId}`).then(r => r.json()),
    refetchInterval: 10000,
    enabled: isAuthenticated,
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery<AlertsData>({
    queryKey: ['alerts', 'all', tenantId],
    queryFn: () => fetch(`/api/alerts?tenantId=${tenantId}`).then(r => r.json()),
    refetchInterval: 10000,
    enabled: isAuthenticated,
  });

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
                    <GeoMapView points={dashData?.pollingUnits || []} />
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
              {activeTab === 'ai' && (
                <AiInsights
                  incidents={incidentsData?.incidents || []}
                  stateAgg={dashData?.election.stateAgg || {}}
                />
              )}
              {activeTab === 'media' && (
                <MediaGallery />
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
          <GeoMapView points={dashData.pollingUnits} />
        </div>
        <div className="lg:col-span-2 rounded-xl border border-border bg-card/40 overflow-hidden">
          <LiveFeed incidents={incidents.slice(0, 25)} />
        </div>
      </div>
    </div>
  );
}

