/**
 * OverviewTab — The main dashboard overview.
 * Shows KPIs, quick actions, election widgets, and a live feed.
 * Extracted from page.tsx.
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Map, BarChart3, ShieldAlert, Trophy, Megaphone, Loader2 } from 'lucide-react';

import { useDashboardStore, type ViewTab } from '@/store/dashboard';
import { KpiGrid } from '@/components/dashboard/kpi-grid';
import { IncidentDetailSlideover } from '@/components/dashboard/incident-detail-slideover';
import { SituationalKPIPanel, LiveFeed } from '@/components/dashboard/lazy-components';
import { cn } from '@/lib/utils';
import type { DashboardData, Incident, AlertsData } from '@/types/dashboard';

// Heavy sub-components are dynamically imported to code-split recharts and reduce chunk size.
const ElectionSummaryInfographic = dynamic(
  () => import('@/components/dashboard/election-summary-infographic').then(m => ({ default: m.ElectionSummaryInfographic })),
  { loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>, ssr: false },
);
const ElectionTracker = dynamic(
  () => import('@/components/dashboard/election-tracker').then(m => ({ default: m.ElectionTracker })),
  { loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>, ssr: false },
);
const WinProbabilityGauge = dynamic(
  () => import('@/components/dashboard/win-probability-gauge').then(m => ({ default: m.WinProbabilityGauge })),
  { loading: () => <div className="h-48 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>, ssr: false },
);

function OverviewTabInner({
  dashData, incidents, alertsData, liveIncidents,
}: {
  dashData: DashboardData;
  incidents: Incident[];
  alertsData: AlertsData | undefined;
  liveIncidents: Incident[];
}) {
  const { setSelectedTab, user } = useDashboardStore();

  // Incident detail slideover state
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [slideoverOpen, setSlideoverOpen] = useState(false);

  const handleIncidentClick = useCallback((inc: Incident) => {
    setSelectedIncident(inc);
    setSlideoverOpen(true);
  }, []);

  const handleSlideoverClose = useCallback(() => {
    setSlideoverOpen(false);
    setSelectedIncident(null);
  }, []);

  const criticalCount = useMemo(() => incidents.filter(i => i.severity === 'CRITICAL').length, [incidents]);

  // Quick actions based on role
  const isFieldAgent = user?.role === 'FIELD_AGENT';
  const visibleActions = useMemo(() => {
    const actions = [
      { label: 'View Map', tab: 'map' as ViewTab, icon: <Map className="h-4 w-4" />, color: 'text-cyan', bg: 'bg-cyan/10', desc: `${dashData.election.openUnits} units active` },
      { label: 'Situation Room', tab: 'situation' as ViewTab, icon: <BarChart3 className="h-4 w-4" />, color: 'text-emerald', bg: 'bg-emerald/10', desc: 'Hierarchical results' },
      { label: criticalCount > 0 ? `Critical Alerts (${criticalCount})` : 'Alert Triage', tab: 'alerts' as ViewTab, icon: <ShieldAlert className="h-4 w-4" />, color: criticalCount > 0 ? 'text-rose' : 'text-amber', bg: criticalCount > 0 ? 'bg-rose/10' : 'bg-amber/10', desc: `${dashData.kpis.unreadAlerts} unread` },
      { label: 'Election Tracker', tab: 'pvt' as ViewTab, icon: <BarChart3 className="h-4 w-4" />, color: 'text-violet', bg: 'bg-violet/10', desc: 'Party performance & projections', show: !isFieldAgent },
      { label: 'Victory Roadmap', tab: 'victory-roadmap' as ViewTab, icon: <Trophy className="h-4 w-4" />, color: 'text-amber', bg: 'bg-amber/10', desc: 'Path-to-victory & coalitions', show: !isFieldAgent },
      { label: 'Generate Social Card', tab: 'mobilization' as ViewTab, icon: <BarChart3 className="h-4 w-4" />, color: 'text-cyan', bg: 'bg-cyan/10', desc: 'Shareable election graphics', show: !isFieldAgent },
      { label: 'Narrative Builder', tab: 'narrative' as ViewTab, icon: <Megaphone className="h-4 w-4" />, color: 'text-emerald', bg: 'bg-emerald/10', desc: 'Key messages & talking points', show: !isFieldAgent },
    ];
    return actions.filter(a => a.show !== false);
  }, [dashData.election.openUnits, dashData.kpis.unreadAlerts, criticalCount, isFieldAgent]);

  const c2paCount = useMemo(() => incidents.filter(i => i.c2paVerified).length, [incidents]);
  const extraStats = useMemo(() => alertsData ? [
    { label: 'Threats Intercepted', value: dashData.kpis.quarantinedIncidents, color: 'rose' as const },
    { label: 'C2PA Verified Media', value: c2paCount, color: 'emerald' as const },
    { label: 'Active Polling Units', value: dashData.election.openUnits, color: 'cyan' as const },
    { label: 'Pending Review', value: dashData.kpis.pendingIncidents, color: 'amber' as const },
  ] : undefined, [alertsData, dashData.kpis.quarantinedIncidents, dashData.election.openUnits, dashData.kpis.pendingIncidents, c2paCount]);

  return (
    <div className="h-full flex flex-col p-4 gap-3 overflow-y-auto" aria-label="Dashboard Overview">
      {/* Top: KPI grid */}
      <div className="shrink-0">
        <KpiGrid
          data={dashData.kpis}
          election={dashData.election}
          trends={dashData.trends}
          extraStats={extraStats}
        />
      </div>

      {/* Situational Awareness KPI */}
      <div className="shrink-0">
        <SituationalKPIPanel />
      </div>

      {/* Quick action cards */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {visibleActions.map((action, idx) => (
          <button
            key={action.tab}
            onClick={() => setSelectedTab(action.tab)}
            style={{ animationDelay: `${idx * 60}ms` }}
            className="rounded-lg border border-border/60 bg-card/30 hover:bg-card/50 p-3 text-left transition-all duration-200 card-lift group animate-fade-in-up"
          >
            <div className={cn('p-1.5 rounded-md w-fit mb-2 transition-colors', action.bg)}>
              <span className={action.color}>{action.icon}</span>
            </div>
            <p className="text-xs font-medium leading-tight">{action.label}</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{action.desc}</p>
          </button>
        ))}
      </div>

      {/* Election Summary Infographic */}
      {!isFieldAgent && (
        <div className="shrink-0">
          <ElectionSummaryInfographic />
        </div>
      )}

      {/* Election Tracker */}
      {!isFieldAgent && (
        <div className="shrink-0 overflow-hidden">
          <ElectionTracker />
        </div>
      )}

      {/* Win Probability Gauge */}
      {!isFieldAgent && (
        <div className="shrink-0">
          <WinProbabilityGauge />
        </div>
      )}

      {/* Feed: takes remaining space */}
      <div className="flex-1 min-h-0">
        <div className="h-full rounded-xl border border-border bg-card/40 overflow-hidden">
          <LiveFeed incidents={incidents.slice(0, 25)} onIncidentClick={handleIncidentClick} liveIncidents={liveIncidents.slice(0, 25)} />
        </div>
      </div>

      {/* Incident Detail Slideover */}
      <IncidentDetailSlideover
        incident={selectedIncident}
        open={slideoverOpen}
        onClose={handleSlideoverClose}
      />
    </div>
  );
}

export const OverviewTab = React.memo(OverviewTabInner);
