'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

import { AppSidebar } from '@/components/dashboard/sidebar';
import { AppHeader } from '@/components/dashboard/header';
import { KpiGrid } from '@/components/dashboard/kpi-grid';
import { GeoMapView } from '@/components/dashboard/geo-map';
import { LiveFeed } from '@/components/dashboard/live-feed';
import { AlertTriage } from '@/components/dashboard/alert-triage';
import { AiInsights } from '@/components/dashboard/ai-insights';
import { MediaGallery } from '@/components/dashboard/media-gallery';
import { useDashboardStore } from '@/store/dashboard';

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
  const { activeTab, sidebarCollapsed } = useDashboardStore();

  // Fetch dashboard data
  const { data: dashData, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then(r => r.json()),
    refetchInterval: 15000,
  });

  // Fetch incidents
  const { data: incidentsData, isLoading: incLoading } = useQuery<{ incidents: Incident[]; total: number; hasMore: boolean }>({
    queryKey: ['incidents', 'all'],
    queryFn: () => fetch('/api/incidents?limit=50').then(r => r.json()),
    refetchInterval: 10000,
  });

  // Fetch alerts
  const { data: alertsData, isLoading: alertsLoading } = useQuery<AlertsData>({
    queryKey: ['alerts', 'all'],
    queryFn: () => fetch('/api/alerts').then(r => r.json()),
    refetchInterval: 10000,
  });

  const isLoading = dashLoading || incLoading || alertsLoading;

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
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald mx-auto" />
                <p className="text-sm text-muted-foreground">Initializing election monitoring systems...</p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {activeTab === 'overview' && (
                  <OverviewTab
                    dashData={dashData!}
                    incidents={incidentsData?.incidents || []}
                    alertsData={alertsData}
                    incLoading={incLoading}
                  />
                )}
                {activeTab === 'map' && (
                  <FullMapView pollingUnits={dashData?.pollingUnits || []} />
                )}
                {activeTab === 'feed' && (
                  <div className="h-full">
                    <LiveFeed incidents={incidentsData?.incidents || []} loading={incLoading} hasMore={incidentsData?.hasMore} />
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
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
}

// ---- Overview Tab: KPIs + Map + Feed ----
function OverviewTab({
  dashData, incidents, alertsData, incLoading,
}: {
  dashData: DashboardData;
  incidents: Incident[];
  alertsData: AlertsData | undefined;
  incLoading: boolean;
}) {
  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-y-auto">
      {/* KPI Row */}
      <KpiGrid data={dashData.kpis} election={dashData.election} />

      {/* Main content: Map + Feed */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Map (3/5) */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card/40 overflow-hidden min-h-[400px]">
          <GeoMapView points={dashData.pollingUnits} />
        </div>

        {/* Live Feed (2/5) */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card/40 overflow-hidden min-h-[400px]">
          <LiveFeed incidents={incidents.slice(0, 25)} loading={incLoading} />
        </div>
      </div>

      {/* Bottom: Quick stats bar */}
      {alertsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          <QuickStat label="Security Threats Intercepted" value={dashData.kpis.quarantinedIncidents} color="rose" />
          <QuickStat label="C2PA Verified Media" value={incidents.filter(i => i.c2paVerified).length} color="emerald" />
          <QuickStat label="Active Polling Units" value={dashData.election.openUnits} color="cyan" />
          <QuickStat label="Pending Review" value={dashData.kpis.pendingIncidents} color="amber" />
        </div>
      )}
    </div>
  );
}

function FullMapView({ pollingUnits }: { pollingUnits: DashboardData['pollingUnits'] }) {
  return (
    <div className="h-full p-4">
      <div className="h-full rounded-xl border border-border bg-card/40 overflow-hidden">
        <GeoMapView points={pollingUnits} />
      </div>
    </div>
  );
}

function QuickStat({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    rose: 'text-rose', emerald: 'text-emerald', cyan: 'text-cyan', amber: 'text-amber',
  };
  return (
    <div className="rounded-lg border border-border bg-card/40 px-4 py-3 flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${colorMap[color] || 'text-foreground'}`}>{value}</span>
    </div>
  );
}