'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { useDashboardStore } from '@/store/dashboard';
import {
  BarChart3, TrendingUp, Activity, Loader2,
  Grid3X3, Target, Radio, GitBranch,
} from 'lucide-react';
import { DrillDownChart, type DrillDownLevel } from '@/components/dashboard/drill-down-chart';
import { TimeSeriesComparison, type TimeSeries } from '@/components/dashboard/time-series-comparison';
import { ComparisonGauge, MiniBarChart, StatusIndicator } from '@/components/dashboard/advanced-kpi-widgets';
import { ElectionHeatmap, type HeatmapCell } from '@/components/dashboard/election-heatmap';
import { RadarOverview, type RadarSeries } from '@/components/dashboard/radar-overview';
import { RealtimeStreamChart, type StreamDataPoint } from '@/components/dashboard/realtime-stream-chart';
import { SankeyFlow } from '@/components/dashboard/sankey-flow';
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
// Synthetic data generators (deterministic)
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
    const dayOfWeek = d.getDay();
    const weekendDip = (dayOfWeek === 0 || dayOfWeek === 6) ? -baseValue * 0.1 : 0;
    result.push({
      date: d.toISOString().slice(0, 10),
      value: Math.round(val + weekendDip),
    });
  }
  return result;
}

/** Generate deterministic heatmap cells from region data */
function generateHeatmapCells(regions: SituationSummary['items']): HeatmapCell[] {
  const timeSlots = ['6AM', '8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM'];
  const cells: HeatmapCell[] = [];
  const seed = regions.length * 137;
  const rand = (i: number, j: number) => {
    const x = Math.sin(seed + i * 73 + j * 37 + 42) * 49297;
    return x - Math.floor(x);
  };

  regions.forEach((region, ri) => {
    const baseIncidents = region.incidents;
    timeSlots.forEach((slot, si) => {
      const variation = (rand(ri, si) - 0.3) * baseIncidents * 0.8;
      const peak = (si >= 2 && si <= 5) ? baseIncidents * 0.3 : 0; // midday peak
      cells.push({
        x: slot,
        y: region.name,
        value: Math.max(0, Math.round(baseIncidents / timeSlots.length + variation + peak)),
        label: `${region.name}, ${slot}: ${Math.max(0, Math.round(baseIncidents / timeSlots.length + variation + peak))} incidents`,
      });
    });
  });
  return cells;
}

/** Generate radar series from region data */
function generateRadarSeries(regions: SituationSummary['items']): RadarSeries[] {
  if (regions.length === 0) return [];
  const axes = ['Turnout', 'Incidents', 'Critical', 'Reports', 'C2PA Verified'];
  const seed = regions.length * 53;

  return regions.slice(0, 4).map((region, i) => {
    const rand = (axisIdx: number) => {
      const x = Math.sin(seed + i * 97 + axisIdx * 43 + 17) * 49297;
      return x - Math.floor(x);
    };
    const values: Record<string, number> = {};
    values['Turnout'] = Math.min(1, region.turnout / 100);
    values['Incidents'] = Math.min(1, region.incidents / 50);
    values['Critical'] = Math.min(1, region.criticalIncidents / 10);
    values['Reports'] = Math.min(1, (region.totalVotes / region.registeredVoters) * 1.2);
    values['C2PA Verified'] = rand(4) * 0.8;
    return {
      id: region.name.replace(/\s+/g, '-').toLowerCase(),
      name: region.name,
      color: ['#008751', '#E53935', '#1E88E5', '#FDD835'][i % 4],
      values,
    };
  });
}

/** Generate sankey flow from situation data */
function generateSankeyFlow(regions: SituationSummary['items']) {
  const seed = regions.length * 79;
  const rand = (i: number) => {
    const x = Math.sin(seed + i * 61 + 23) * 49297;
    return x - Math.floor(x);
  };

  // Create 3 source nodes (voter categories) and sink nodes (top regions)
  const sources = [
    { id: 'first-time', label: 'First-Time Voters', color: '#008751' },
    { id: 'returning', label: 'Returning Voters', color: '#1E88E5' },
    { id: 'youth', label: 'Youth (18-25)', color: '#FDD835' },
  ];

  const topRegions = regions
    .sort((a, b) => (b.registeredVoters ?? 0) - (a.registeredVoters ?? 0))
    .slice(0, 4);

  const topRegionsData = topRegions.map((r, i) => ({ id: r.name.replace(/\s+/g, '-').toLowerCase(), label: r.name, color: FLOW_PALETTE[i % FLOW_PALETTE.length] }));

  const links: Array<{ source: string; target: string; value: number }> = [];
  sources.forEach((src, si) => {
    topRegionsData.forEach((tgt, ti) => {
      const val = Math.round((src.label === 'First-Time Voters' ? 50000 : src.label === 'Returning Voters' ? 80000 : 30000) * rand(si * 10 + ti) * 0.4);
      links.push({ source: src.id, target: tgt.id, value: val });
    });
  });

  return { nodes: [...sources, ...topRegionsData], links };
}

const FLOW_PALETTE = ['#008751', '#1E88E5', '#E53935', '#FDD835', '#8E24AA', '#FF6F00', '#00ACC1', '#43A047'];

// ═══════════════════════════════════════════════════════════════════════════════
// Data Explorer Tab
// ═══════════════════════════════════════════════════════════════════════════════

export function DataExplorer() {
  const { tenantId, electionInfo } = useDashboardStore();
  const [drillTab, setDrillTab] = useState('votes');
  const [activeViz, setActiveViz] = useState('drill');

  // Ref for realtime chart to push synthetic incident data
  const streamHandlersRef = useRef<Set<(point: StreamDataPoint) => void>>(new Set());

  // Fetch situation room data for drill-down and other visualizations
  const { data: situationData, isLoading: situationLoading } = useQuery<DrillDownData>({
    queryKey: ['data-explorer-drill', 'national', tenantId],
    queryFn: () => fetchJson(`/api/situation-room?level=national&tenantId=${tenantId}`),
    enabled: !!tenantId,
  });

  // ── Build drill-down data ──
  const votesDrillData = useMemo<DrillDownLevel[]>(() => {
    if (!situationData?.levels?.items) return [];
    return situationData.levels.items.map((item) => ({
      id: item.name,
      name: item.name,
      value: item.totalVotes,
      children: undefined,
    }));
  }, [situationData]);

  const turnoutDrillData = useMemo<DrillDownLevel[]>(() => {
    if (!situationData?.levels?.items) return [];
    return situationData.levels.items
      .map((item) => ({ id: item.name, name: item.name, value: Math.round(item.turnout * 100) }))
      .sort((a, b) => b.value - a.value);
  }, [situationData]);

  const incidentsDrillData = useMemo<DrillDownLevel[]>(() => {
    if (!situationData?.levels?.items) return [];
    return situationData.levels.items
      .map((item) => ({ id: item.name, name: item.name, value: item.incidents }))
      .sort((a, b) => b.value - a.value);
  }, [situationData]);

  // ── Time-series data ──
  const timeSeriesData = useMemo<TimeSeries[]>(() => {
    const baseSeed = tenantId ? tenantId.charCodeAt(0) * 137 : 42;
    return [
      { id: 'incidents', name: 'Incidents', color: '#E53935', data: generateTimeSeriesData(30, 45, 0.08, baseSeed) },
      { id: 'reports', name: 'Field Reports', color: '#1E88E5', data: generateTimeSeriesData(30, 120, 0.06, baseSeed + 100) },
      { id: 'agents_online', name: 'Agents Online', color: '#008751', data: generateTimeSeriesData(30, 350, 0.04, baseSeed + 200) },
    ];
  }, [tenantId]);

  // ── Phase 13: Heatmap data ──
  const heatmapData = useMemo<HeatmapCell[]>(() => {
    if (!situationData?.levels?.items) return [];
    return generateHeatmapCells(situationData.levels.items);
  }, [situationData]);

  // ── Phase 13: Radar data ──
  const radarSeries = useMemo<RadarSeries[]>(() => {
    if (!situationData?.levels?.items) return [];
    return generateRadarSeries(situationData.levels.items);
  }, [situationData]);

  // ── Phase 13: Sankey data ──
  const sankeyData = useMemo(() => {
    if (!situationData?.levels?.items) return { nodes: [], links: [] };
    return generateSankeyFlow(situationData.levels.items);
  }, [situationData]);

  // ── Aggregates ──
  const totalVotes = situationData?.levels?.items?.reduce((s, i) => s + i.totalVotes, 0) || 0;
  const totalRegistered = situationData?.levels?.items?.reduce((s, i) => s + i.registeredVoters, 0) || 1;
  const totalIncidents = situationData?.levels?.items?.reduce((s, i) => s + i.incidents, 0) || 0;
  const criticalIncidents = situationData?.levels?.items?.reduce((s, i) => s + i.criticalIncidents, 0) || 0;

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

  // ── Viz tab config ──
  const vizTabs = [
    { id: 'drill', label: 'Drill-Down', icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: 'heatmap', label: 'Heatmap', icon: <Grid3X3 className="h-3.5 w-3.5" /> },
    { id: 'radar', label: 'Radar', icon: <Target className="h-3.5 w-3.5" /> },
    { id: 'stream', label: 'Live Stream', icon: <Radio className="h-3.5 w-3.5" /> },
    { id: 'sankey', label: 'Voter Flow', icon: <GitBranch className="h-3.5 w-3.5" /> },
    { id: 'timeseries', label: 'Trends', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  ];

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
        <ComparisonGauge current={totalVotes} target={totalRegistered} label="Voter Turnout" unit="votes" />
        <ComparisonGauge current={totalIncidents} target={Math.max(totalIncidents + 20, 100)} label="Incident Capacity" unit="incidents" />
      </div>

      {/* Visualization type tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {vizTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveViz(tab.id)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer',
              activeViz === tab.id
                ? 'border-primary/50 bg-primary/10 text-foreground'
                : 'border-border/60 text-muted-foreground hover:border-foreground/20 hover:text-foreground',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Drill-Down View ── */}
      {activeViz === 'drill' && (
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
      )}

      {/* ── Heatmap View ── */}
      {activeViz === 'heatmap' && (
        <ElectionHeatmap
          data={heatmapData}
          title="Incident Density by Region and Time of Day"
          xAxisLabel="Time of Day"
          yAxisLabel="Region"
          height={420}
          valueFormatter={(v) => `${v} incidents`}
        />
      )}

      {/* ── Radar View ── */}
      {activeViz === 'radar' && (
        <RadarOverview
          series={radarSeries}
          title="Election Metrics Comparison by Region"
          height={400}
          normalized={true}
        />
      )}

      {/* ── Live Stream View ── */}
      {activeViz === 'stream' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RealtimeStreamChart
            streamId="incidents"
            title="Live Incident Stream"
            color="#E53935"
            valueLabel="Incidents/min"
            maxPoints={100}
            height={260}
          />
          <RealtimeStreamChart
            streamId="reports"
            title="Field Report Submissions"
            color="#1E88E5"
            valueLabel="Reports/min"
            maxPoints={100}
            height={260}
          />
        </div>
      )}

      {/* ── Sankey / Voter Flow View ── */}
      {activeViz === 'sankey' && (
        <SankeyFlow
          nodes={sankeyData.nodes}
          links={sankeyData.links}
          title="Voter Flow by Category to Top Regions"
          height={400}
          valueFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
        />
      )}

      {/* ── Time-Series View ── */}
      {activeViz === 'timeseries' && (
        <TimeSeriesComparison
          series={timeSeriesData}
          title="30-Day Trend Analysis"
          height={320}
          defaultMode="overlay"
          showAnomalies={true}
          valueFormatter={(v) => v.toLocaleString()}
        />
      )}
    </div>
  );
}
