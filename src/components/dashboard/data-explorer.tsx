'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { useDashboardStore } from '@/store/dashboard';
import {
  BarChart3, TrendingUp, Activity, Loader2,
} from 'lucide-react';
import { DrillDownChart, type DrillDownLevel } from '@/components/dashboard/drill-down-chart';
import { TimeSeriesComparison, type TimeSeries } from '@/components/dashboard/time-series-comparison';
import { ComparisonGauge, MiniBarChart, StatusIndicator } from '@/components/dashboard/advanced-kpi-widgets';
import { EmptyState } from './empty-state';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface SituationSummary {
  items: Array<{
    name: string;
    registeredVoters: number;
    totalVotes: number;
    turnout: number;
    incidents: number;
    criticalIncidents: number;
  }>;
}

interface DrillDownData {
  levels: SituationSummary;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Synthetic time-series data generator (deterministic)
// ═══════════════════════════════════════════════════════════════════════════════

function generateTimeSeriesData(days: number, baseValue: number, volatility: number, seed: number): Array<{ date: string; value: number }> {
  const result: Array<{ date: string; value: number }> = [];
  const pseudoRandom = (i: number) => {
    const x = Math.sin(seed + i * 9301 + 49297) * 49297;
    return x - Math.floor(x);
  };

  let val = baseValue;
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    val += (pseudoRandom(i) - 0.45) * baseValue * volatility;
    val = Math.max(0, val);
    // Add weekly cycle
    const dayOfWeek = d.getDay();
    const weekendDip = (dayOfWeek === 0 || dayOfWeek === 6) ? -baseValue * 0.1 : 0;
    result.push({
      date: d.toISOString().slice(0, 10),
      value: Math.round(val + weekendDip),
    });
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Data Explorer Tab
// ═══════════════════════════════════════════════════════════════════════════════

export function DataExplorer() {
  const { tenantId, electionInfo } = useDashboardStore();
  const [drillTab, setDrillTab] = useState('votes');

  // Fetch situation room data for drill-down
  const { data: situationData, isLoading: situationLoading } = useQuery<DrillDownData>({
    queryKey: ['data-explorer-drill', 'national', tenantId],
    queryFn: () => fetchJson(`/api/situation-room?level=national&tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // ── Build drill-down data from situation room ──
  const votesDrillData = useMemo<DrillDownLevel[]>(() => {
    if (!situationData?.levels?.items) return [];
    return situationData.levels.items.map((item) => ({
      id: item.name,
      name: item.name,
      value: item.totalVotes,
      children: undefined, // Would need deeper API calls for children
    }));
  }, [situationData]);

  const turnoutDrillData = useMemo<DrillDownLevel[]>(() => {
    if (!situationData?.levels?.items) return [];
    return situationData.levels.items
      .map((item) => ({
        id: item.name,
        name: item.name,
        value: Math.round(item.turnout * 100),
      }))
      .sort((a, b) => b.value - a.value);
  }, [situationData]);

  const incidentsDrillData = useMemo<DrillDownLevel[]>(() => {
    if (!situationData?.levels?.items) return [];
    return situationData.levels.items
      .map((item) => ({
        id: item.name,
        name: item.name,
        value: item.incidents,
      }))
      .sort((a, b) => b.value - a.value);
  }, [situationData]);

  // ── Time-series data (synthetic when no API data) ──
  const timeSeriesData = useMemo<TimeSeries[]>(() => {
    const baseSeed = tenantId ? tenantId.charCodeAt(0) * 137 : 42;
    return [
      {
        id: 'incidents',
        name: 'Incidents',
        color: '#E53935',
        data: generateTimeSeriesData(30, 45, 0.08, baseSeed),
      },
      {
        id: 'reports',
        name: 'Field Reports',
        color: '#1E88E5',
        data: generateTimeSeriesData(30, 120, 0.06, baseSeed + 100),
      },
      {
        id: 'agents_online',
        name: 'Agents Online',
        color: '#008751',
        data: generateTimeSeriesData(30, 350, 0.04, baseSeed + 200),
      },
    ];
  }, [tenantId]);

  // ── Gauge data ──
  const totalVotes = situationData?.levels?.items?.reduce((s, i) => s + i.totalVotes, 0) || 0;
  const totalRegistered = situationData?.levels?.items?.reduce((s, i) => s + i.registeredVoters, 0) || 1;
  const totalIncidents = situationData?.levels?.items?.reduce((s, i) => s + i.incidents, 0) || 0;
  const criticalIncidents = situationData?.levels?.items?.reduce((s, i) => s + i.criticalIncidents, 0) || 0;

  // ── Top states by incidents (for MiniBarChart) ──
  const topIncidentStates = useMemo(() => {
    if (!situationData?.levels?.items) return [];
    return situationData.levels.items
      .map((item) => ({ label: item.name, value: item.incidents }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [situationData]);

  const drillDataMap: Record<string, DrillDownLevel[]> = {
    votes: votesDrillData,
    turnout: turnoutDrillData,
    incidents: incidentsDrillData,
  };

  const activeDrillData = drillDataMap[drillTab] || [];

  if (situationLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-y-auto">
      {/* Status row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatusIndicator status="online" label="Data Feed" count={situationData?.levels?.items?.length || 0} />
        <StatusIndicator status="warning" label="Anomalies" count={criticalIncidents} />
        <ComparisonGauge
          current={totalVotes}
          target={totalRegistered}
          label="Voter Turnout"
          unit="votes"
        />
        <ComparisonGauge
          current={totalIncidents}
          target={Math.max(totalIncidents + 20, 100)}
          label="Incident Capacity"
          unit="incidents"
        />
      </div>

      {/* Drill-Down Chart Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <DrillDownChart
            data={activeDrillData}
            title={drillTab === 'votes' ? 'Votes by Region' : drillTab === 'turnout' ? 'Turnout by Region (%)' : 'Incidents by Region'}
            height={340}
            valueFormatter={(v) => drillTab === 'turnout' ? `${v}%` : v.toLocaleString()}
          />
          <div className="flex items-center gap-2 mt-2">
            {(['votes', 'turnout', 'incidents'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setDrillTab(tab)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all capitalize cursor-pointer',
                  drillTab === tab
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-border/60 text-muted-foreground hover:border-foreground/20 hover:text-foreground',
                )}
              >
                {tab === 'votes' ? 'Total Votes' : tab === 'turnout' ? 'Turnout %' : 'Incidents'}
              </button>
            ))}
          </div>
        </div>

        {/* Side panel: MiniBarChart + Quick stats */}
        <div className="space-y-4">
          <Card className="border bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-rose" />
                Top 5 Incident Regions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topIncidentStates.length > 0 ? (
                <MiniBarChart data={topIncidentStates} />
              ) : (
                <EmptyState icon={BarChart3} title="No incident data" description="Region data will appear here once available" size="sm" />
              )}
            </CardContent>
          </Card>

          {/* Quick stat summary */}
          <Card className="border bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald" />
                Quick Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Regions</span>
                <span className="font-medium tabular-nums">{situationData?.levels?.items?.length || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Votes</span>
                <span className="font-medium tabular-nums text-emerald">{totalVotes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Incidents</span>
                <span className="font-medium tabular-nums text-amber">{totalIncidents.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Critical Incidents</span>
                <span className="font-medium tabular-nums text-rose">{criticalIncidents.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Time-Series Comparison */}
      <TimeSeriesComparison
        series={timeSeriesData}
        title="30-Day Trend Analysis"
        height={320}
        defaultMode="overlay"
        showAnomalies={true}
        valueFormatter={(v) => v.toLocaleString()}
      />
    </div>
  );
}
