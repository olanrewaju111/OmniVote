'use client';

import React from 'react';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { useDashboardStore } from '@/store/dashboard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { m, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Flame,
  Activity,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  TrendingUp,
  Loader2,
  Plus,
  MapPin,
  CalendarDays,
  Crosshair,
  Play,
  CheckCircle2,
  Clock,
  Eye,
  Users,
  Trophy,
  BarChart3,
  ChevronRight,
  Zap,
  Target,
  Swords,
  FileText,
  X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface FlashpointData {
  forecasts: Array<{
    id: string;
    state: string;
    lga: string | null;
    riskScores: {
      violence: number;
      intimidation: number;
      logistics: number;
      overall: number;
    };
    riskLevel: string;
    confidence: number;
    generatedAt: string;
    expiresAt: string;
    forecast: Array<{
      date: string;
      overall: number;
      violence: number;
      intimidation: number;
      logistics: number;
    }>;
    contributingFactors: string[];
  }>;
  scenarios: Array<{
    id: string;
    title: string;
    description: string;
    parameters: Record<string, unknown>;
    steps: Array<{
      step: number;
      description: string;
      action: string;
      outcome: string;
    }>;
    status: string;
    currentPlayerRole: string | null;
    results: Record<string, unknown> | null;
    score: number | null;
    startedAt: string | null;
    completedAt: string | null;
  }>;
  stats: {
    totalForecasts: number;
    byRiskLevel: Record<string, number>;
    highRiskStates: string[];
    totalScenarios: number;
    byScenarioStatus: Record<string, number>;
    avgConfidence: number;
  };
  heatmapData: Array<{
    state: string;
    lga: string | null;
    date: string;
    overall: number;
    violence: number;
    intimidation: number;
    logistics: number;
    riskLevel: string;
  }>;
  topContributingFactors: Array<{ factor: string; count: number }>;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const RISK_CELL_COLORS: Record<string, { bg: string; text: string }> = {
  LOW: { bg: 'rgba(16,185,129,0.20)', text: '#10b981' },
  MEDIUM: { bg: 'rgba(245,158,11,0.30)', text: '#f59e0b' },
  HIGH: { bg: 'rgba(239,68,68,0.30)', text: '#ef4444' },
  CRITICAL: { bg: 'rgba(220,38,38,0.50)', text: '#dc2626' },
};

function riskCellColor(level: string) {
  return RISK_CELL_COLORS[level] ?? RISK_CELL_COLORS.LOW;
}

function riskBarColor(score: number): string {
  if (score >= 0.8) return '#ef4444';
  if (score >= 0.6) return '#f97316';
  if (score >= 0.3) return '#f59e0b';
  return '#10b981';
}

function riskBadgeVariant(level: string): string {
  switch (level) {
    case 'CRITICAL':
      return 'bg-rose-600/20 text-rose-400 border-rose-600/30';
    case 'HIGH':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'MEDIUM':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    default:
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  }
}

function statusBadgeVariant(status: string): string {
  switch (status) {
    case 'RUNNING':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'COMPLETED':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'PENDING':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'FAILED':
      return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/* ------------------------------------------------------------------ */
/* Animation variants                                                  */
/* ------------------------------------------------------------------ */

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
};

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export const FlashpointWargame = React.memo(function FlashpointWargame() {
  const { tenantId } = useDashboardStore();
  const queryClient = useQueryClient();

  // Wargame state
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRole, setNewRole] = useState('RED_TEAM');
  const [newParams, setNewParams] = useState('{\n  \n}');
  const [completeScore, setCompleteScore] = useState('');

  /* ---- Data fetching ---- */
  const { data, isLoading, isError, refetch } = useQuery<FlashpointData>({
    queryKey: ['flashpoint', tenantId],
    queryFn: () =>
      fetchJson(`/api/flashpoint?tenantId=${tenantId}`),
    refetchInterval: 30000,
  });

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchJson('/api/flashpoint?tenantId=' + tenantId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashpoint', tenantId] });
    },
    onError: () => {
      toast.error('Flashpoint operation failed. Please try again.');
    },
  });

  /* ---- Derived data ---- */
  const stats = data?.stats;
  const forecasts = data?.forecasts ?? [];
  const scenarios = data?.scenarios ?? [];
  const heatmapData = data?.heatmapData ?? [];
  const topFactors = data?.topContributingFactors ?? [];

  // Unique states sorted alphabetically
  const uniqueStates = useMemo(() => {
    const set = new Set(heatmapData.map((d) => d.state));
    return Array.from(set).sort();
  }, [heatmapData]);

  // Unique dates sorted
  const uniqueDates = useMemo(() => {
    const set = new Set(heatmapData.map((d) => d.date));
    return Array.from(set).sort();
  }, [heatmapData]);

  // Build lookup map for heatmap cells
  const heatmapMap = useMemo(() => {
    const map = new Map<string, (typeof heatmapData)[number]>();
    for (const d of heatmapData) {
      map.set(`${d.state}|${d.date}`, d);
    }
    return map;
  }, [heatmapData]);

  // State risk averages for bar chart
  const stateRisks = useMemo(() => {
    const map = new Map<string, { overall: number; level: string; count: number }>();
    for (const f of forecasts) {
      const existing = map.get(f.state);
      if (existing) {
        existing.overall = (existing.overall * existing.count + f.riskScores.overall) / (existing.count + 1);
        existing.count += 1;
        // Upgrade risk level if higher
        const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
        if (order.indexOf(f.riskLevel) > order.indexOf(existing.level)) {
          existing.level = f.riskLevel;
        }
      } else {
        map.set(f.state, { overall: f.riskScores.overall, level: f.riskLevel, count: 1 });
      }
    }
    return Array.from(map.entries())
      .map(([state, v]) => ({ state, ...v }))
      .sort((a, b) => b.overall - a.overall);
  }, [forecasts]);

  // Top factor
  const topFactor = topFactors.length > 0 ? topFactors[0].factor : '—';

  // Selected scenario
  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId) ?? null;

  // Max factor count for bar scaling
  const maxFactorCount = Math.max(...topFactors.map((f) => f.count), 1);

  /* ---- Handlers ---- */
  const handleCreateScenario = () => {
    if (!newTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    let parsedParams: Record<string, unknown> = {};
    try {
      parsedParams = newParams.trim() ? JSON.parse(newParams) : {};
    } catch {
      toast.error('Invalid JSON in parameters');
      return;
    }
    mutation.mutate(
      { action: 'RUN_WARGAME', title: newTitle, description: newDescription, playerRole: newRole, parameters: parsedParams },
      {
        onSuccess: () => {
          toast.success('Scenario created successfully');
          setCreateDialogOpen(false);
          setNewTitle('');
          setNewDescription('');
          setNewRole('RED_TEAM');
          setNewParams('{\n  \n}');
        },
        onError: () => toast.error('Failed to create scenario'),
      },
    );
  };

  const handleCompleteScenario = () => {
    if (!selectedScenarioId || !completeScore) {
      toast.error('Score is required');
      return;
    }
    const score = parseFloat(completeScore);
    if (isNaN(score) || score < 0 || score > 100) {
      toast.error('Score must be between 0 and 100');
      return;
    }
    mutation.mutate(
      { action: 'COMPLETE_WARGAME', scenarioId: selectedScenarioId, score },
      {
        onSuccess: () => {
          toast.success('Scenario completed');
          setCompleteScore('');
          setSelectedScenarioId(null);
        },
        onError: () => toast.error('Failed to complete scenario'),
      },
    );
  };

  /* ---- Loading ---- */
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 text-emerald-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading flashpoint data…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center p-6">
        <AlertCircle className="h-10 w-10 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground">Failed to load data. Please try again.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <Tabs defaultValue="forecast" className="h-full flex flex-col gap-3">
        <TabsList>
          <TabsTrigger value="forecast" className="gap-1.5">
            <Flame className="size-4" />
            Risk Forecast
          </TabsTrigger>
          <TabsTrigger value="wargame" className="gap-1.5">
            <Swords className="size-4" />
            Wargame Simulator
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* TAB 1 — Risk Forecast                                           */}
        {/* ================================================================ */}
        <TabsContent value="forecast" className="flex-1 min-h-0 flex flex-col">
          <m.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="flex flex-col gap-4 flex-1 min-h-0"
          >
            {/* --- Stats Row --- */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <m.div variants={fadeIn}>
                <Card className="h-full">
                  <CardContent className="p-4 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Activity className="size-4" />
                      <span className="text-xs font-medium">Total Forecasts</span>
                    </div>
                    <p className="text-2xl font-bold">{stats?.totalForecasts ?? 0}</p>
                  </CardContent>
                </Card>
              </m.div>

              <m.div variants={fadeIn}>
                <Card className="h-full border-red-500/20">
                  <CardContent className="p-4 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="size-4" />
                      <span className="text-xs font-medium">High Risk States</span>
                    </div>
                    <p className="text-2xl font-bold text-red-400">{stats?.highRiskStates?.length ?? 0}</p>
                  </CardContent>
                </Card>
              </m.div>

              <m.div variants={fadeIn}>
                <Card className="h-full border-rose-500/20">
                  <CardContent className="p-4 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-rose-400">
                      <ShieldAlert className="size-4" />
                      <span className="text-xs font-medium">Critical</span>
                    </div>
                    <p className="text-2xl font-bold text-rose-400">{stats?.byRiskLevel?.CRITICAL ?? 0}</p>
                  </CardContent>
                </Card>
              </m.div>

              <m.div variants={fadeIn}>
                <Card className="h-full">
                  <CardContent className="p-4 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <TrendingUp className="size-4" />
                      <span className="text-xs font-medium">Avg Confidence</span>
                    </div>
                    <p className="text-2xl font-bold text-cyan-400">
                      {stats?.avgConfidence != null ? `${(stats.avgConfidence * 100).toFixed(0)}%` : '—'}
                    </p>
                  </CardContent>
                </Card>
              </m.div>

              <m.div variants={fadeIn}>
                <Card className="h-full">
                  <CardContent className="p-4 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-amber-400">
                      <Zap className="size-4" />
                      <span className="text-xs font-medium">Top Factor</span>
                    </div>
                    <p className="text-sm font-semibold truncate">{topFactor}</p>
                  </CardContent>
                </Card>
              </m.div>
            </div>

            {/* --- Main Two Column Layout --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
              {/* LEFT: 7-Day Heatmap */}
              <m.div variants={fadeIn}>
                <Card className="h-full flex flex-col">
                  <CardContent className="p-4 flex flex-col gap-3 flex-1 min-h-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <CalendarDays className="size-4 text-emerald-400" />
                        7-Day Risk Heatmap
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 px-2 text-xs">
                        <Crosshair className="size-3 mr-1" />
                        Refresh
                      </Button>
                    </div>

                    {uniqueStates.length === 0 || uniqueDates.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                        No forecast data available
                      </div>
                    ) : (
                      <ScrollArea className="flex-1">
                        <div className="min-w-fit">
                          {/* Header row: empty + dates */}
                          <div
                            className="grid gap-[2px] mb-[2px]"
                            style={{
                              gridTemplateColumns: `140px repeat(${uniqueDates.length}, minmax(52px, 1fr))`,
                            }}
                          >
                            <div className="text-[10px] text-muted-foreground font-medium px-1" />
                            {uniqueDates.map((date) => (
                              <div
                                key={date}
                                className="text-[10px] text-muted-foreground font-medium text-center truncate px-1"
                              >
                                {formatDay(date)}
                              </div>
                            ))}
                          </div>

                          {/* Data rows: state + cells */}
                          {uniqueStates.map((state) => (
                            <div
                              key={state}
                              className="grid gap-[2px] mb-[2px]"
                              style={{
                                gridTemplateColumns: `140px repeat(${uniqueDates.length}, minmax(52px, 1fr))`,
                              }}
                            >
                              <div className="flex items-center text-xs font-medium truncate px-1 text-foreground/80">
                                {state}
                              </div>
                              {uniqueDates.map((date) => {
                                const cell = heatmapMap.get(`${state}|${date}`);
                                const colors = cell ? riskCellColor(cell.riskLevel) : { bg: 'rgba(255,255,255,0.05)', text: '#666' };
                                return (
                                  <TooltipProvider key={`${state}|${date}`}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div
                                          className="flex items-center justify-center rounded-sm text-[11px] font-semibold cursor-default transition-transform hover:scale-110 h-8"
                                          style={{
                                            backgroundColor: colors.bg,
                                            color: colors.text,
                                          }}
                                        >
                                          {cell ? cell.overall.toFixed(1) : '—'}
                                        </div>
                                      </TooltipTrigger>
                                      {cell && (
                                        <TooltipContent side="top" className="bg-popover text-popover-foreground border">
                                          <div className="text-xs space-y-1 min-w-[140px]">
                                            <div className="font-semibold">{state} — {formatDate(date)}</div>
                                            <Separator className="my-1" />
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Violence</span>
                                              <span className="font-mono">{cell.violence.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Intimidation</span>
                                              <span className="font-mono">{cell.intimidation.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Logistics</span>
                                              <span className="font-mono">{cell.logistics.toFixed(2)}</span>
                                            </div>
                                            <Separator className="my-1" />
                                            <div className="flex justify-between font-semibold">
                                              <span>Overall</span>
                                              <span style={{ color: colors.text }}>{cell.overall.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>Level</span>
                                              <Badge className={cn('text-[10px] h-4', riskBadgeVariant(cell.riskLevel))}>
                                                {cell.riskLevel}
                                              </Badge>
                                            </div>
                                          </div>
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}

                    {/* Legend */}
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1 border-t border-border/50 flex-shrink-0">
                      {Object.entries(RISK_CELL_COLORS).map(([level, colors]) => (
                        <div key={level} className="flex items-center gap-1.5">
                          <div
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: colors.bg, border: `1px solid ${colors.text}` }}
                          />
                          <span>{level}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </m.div>

              {/* RIGHT: Stacked sections */}
              <div className="flex flex-col gap-4 min-h-0">
                {/* Risk by State - Horizontal Bar Chart */}
                <m.div variants={fadeIn} className="flex-1 min-h-0">
                  <Card className="h-full flex flex-col">
                    <CardContent className="p-4 flex flex-col gap-3 flex-1 min-h-0">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <BarChart3 className="size-4 text-amber-400" />
                        Risk by State
                      </h3>

                      {stateRisks.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                          No forecast data
                        </div>
                      ) : (
                        <ScrollArea className="flex-1">
                          <div className="space-y-2 pr-2">
                            {stateRisks.map(({ state, overall, level }) => (
                              <div key={state} className="flex items-center gap-3">
                                <div className="w-28 text-xs font-medium truncate text-foreground/80 flex-shrink-0">
                                  {state}
                                </div>
                                <div className="flex-1 h-5 bg-muted/50 rounded-sm overflow-hidden relative">
                                  <m.div
                                    className="h-full rounded-sm"
                                    style={{ backgroundColor: riskBarColor(overall) }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.max(overall * 100, 2)}%` }}
                                    transition={{ duration: 0.6, ease: 'easeOut' }}
                                  />
                                </div>
                                <span className="text-xs font-mono w-10 text-right text-foreground/70 flex-shrink-0">
                                  {overall.toFixed(2)}
                                </span>
                                <Badge className={cn('text-[10px] h-4 flex-shrink-0', riskBadgeVariant(level))}>
                                  {level}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </m.div>

                {/* Top Contributing Factors */}
                <m.div variants={fadeIn} className="flex-1 min-h-0">
                  <Card className="h-full flex flex-col">
                    <CardContent className="p-4 flex flex-col gap-3 flex-1 min-h-0">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Target className="size-4 text-cyan-400" />
                        Top Contributing Factors
                      </h3>

                      {topFactors.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                          No factor data
                        </div>
                      ) : (
                        <ScrollArea className="flex-1">
                          <div className="space-y-2.5 pr-2">
                            {topFactors.map((item, idx) => (
                              <div key={item.factor} className="flex items-center gap-3">
                                <span className="text-xs font-bold text-muted-foreground w-5 text-right flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <div className="w-36 text-xs font-medium truncate text-foreground/80 flex-shrink-0">
                                  {item.factor}
                                </div>
                                <div className="flex-1 h-4 bg-muted/50 rounded-sm overflow-hidden relative">
                                  <m.div
                                    className="h-full rounded-sm bg-cyan-500/60"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(item.count / maxFactorCount) * 100}%` }}
                                    transition={{ duration: 0.5, delay: idx * 0.05, ease: 'easeOut' }}
                                  />
                                </div>
                                <span className="text-xs font-mono w-8 text-right text-cyan-400 flex-shrink-0">
                                  {item.count}
                                </span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </m.div>
              </div>
            </div>
          </m.div>
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB 2 — Wargame Simulator                                       */}
        {/* ================================================================ */}
        <TabsContent value="wargame" className="flex-1 min-h-0 flex flex-col">
          <m.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="flex flex-col gap-4 h-full"
          >
            {/* Top: Scenario list header + create button */}
            <div className="flex items-center justify-between flex-shrink-0">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Swords className="size-4 text-rose-400" />
                Wargame Scenarios
                <Badge variant="outline" className="text-xs ml-1">
                  {scenarios.length}
                </Badge>
              </h3>
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setCreateDialogOpen(true)}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                New Scenario
              </Button>
            </div>

            <div className="flex gap-4 flex-1 min-h-0">
              {/* Main content area */}
              <div className="flex-1 min-h-0 flex flex-col gap-4">
                {/* Scenario list (when no scenario selected) */}
                {!selectedScenario && (
                  <m.div variants={fadeIn} className="flex-1 min-h-0">
                    <Card className="h-full flex flex-col">
                      <CardContent className="p-4 flex-1 min-h-0">
                        {scenarios.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                            <Swords className="size-10 opacity-30" />
                            <p className="text-sm">Select a scenario from the list or create a new one</p>
                          </div>
                        ) : (
                          <ScrollArea className="h-full">
                            <div className="space-y-2 pr-2">
                              {scenarios.map((sc) => (
                                <button
                                  key={sc.id}
                                  onClick={() => setSelectedScenarioId(sc.id)}
                                  className="w-full text-left rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 p-3 transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="flex items-center justify-center size-8 rounded-md bg-background border flex-shrink-0">
                                        {sc.status === 'RUNNING' ? (
                                          <Play className="size-3.5 text-cyan-400" />
                                        ) : sc.status === 'COMPLETED' ? (
                                          <CheckCircle2 className="size-3.5 text-emerald-400" />
                                        ) : (
                                          <Clock className="size-3.5 text-amber-400" />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{sc.title}</p>
                                        <p className="text-xs text-muted-foreground truncate">{sc.description}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {sc.score != null && (
                                        <Badge variant="outline" className="text-[10px]">
                                          <Trophy className="size-3 mr-1 text-amber-400" />
                                          {sc.score}
                                        </Badge>
                                      )}
                                      <Badge className={cn('text-[10px] h-5', statusBadgeVariant(sc.status))}>
                                        {sc.status}
                                      </Badge>
                                      <ChevronRight className="size-4 text-muted-foreground" />
                                    </div>
                                  </div>
                                  {sc.currentPlayerRole && (
                                    <div className="mt-2 ml-11">
                                      <Badge variant="outline" className="text-[10px]">
                                        <Users className="size-3 mr-1" />
                                        {sc.currentPlayerRole.replace('_', ' ')}
                                      </Badge>
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </CardContent>
                    </Card>
                  </m.div>
                )}

                {/* Scenario Detail View */}
                {selectedScenario && (
                  <m.div variants={fadeIn} className="flex-1 min-h-0 flex flex-col gap-4">
                    {/* Header */}
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-base font-semibold truncate">{selectedScenario.title}</h3>
                              <Badge className={cn('text-[10px] h-5', statusBadgeVariant(selectedScenario.status))}>
                                {selectedScenario.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{selectedScenario.description}</p>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              {selectedScenario.currentPlayerRole && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Eye className="size-3" />
                                  {selectedScenario.currentPlayerRole.replace('_', ' ')}
                                </Badge>
                              )}
                              {selectedScenario.startedAt && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="size-3" />
                                  Started {formatDate(selectedScenario.startedAt)}
                                </span>
                              )}
                              {selectedScenario.completedAt && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <CheckCircle2 className="size-3" />
                                  Completed {formatDate(selectedScenario.completedAt)}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-shrink-0 h-8 px-2"
                            onClick={() => setSelectedScenarioId(null)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Steps Timeline */}
                    <Card className="flex-1 min-h-0 flex flex-col">
                      <CardContent className="p-4 flex flex-col gap-3 flex-1 min-h-0">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="size-4 text-muted-foreground" />
                          Scenario Steps
                        </h4>

                        {selectedScenario.steps.length === 0 ? (
                          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                            No steps defined for this scenario
                          </div>
                        ) : (
                          <ScrollArea className="flex-1">
                            <div className="relative pl-6 space-y-4">
                              {/* Vertical timeline line */}
                              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border/60" />

                              {selectedScenario.steps.map((step, idx) => (
                                <div key={step.step} className="relative">
                                  {/* Timeline dot */}
                                  <div className="absolute -left-6 top-1.5 size-[22px] rounded-full border-2 border-background bg-muted flex items-center justify-center z-10">
                                    <div
                                      className="size-2 rounded-full"
                                      style={{
                                        backgroundColor:
                                          idx < selectedScenario.steps.length - 1
                                            ? '#10b981'
                                            : selectedScenario.status === 'RUNNING'
                                              ? '#06b6d4'
                                              : selectedScenario.status === 'COMPLETED'
                                                ? '#10b981'
                                                : '#f59e0b',
                                      }}
                                    />
                                  </div>

                                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <Badge variant="outline" className="text-[10px] h-5 font-mono">
                                        Step {step.step}
                                      </Badge>
                                    </div>
                                    <p className="text-sm font-medium">{step.description}</p>

                                    {step.action && (
                                      <div className="mt-2 rounded-md bg-background/60 p-2">
                                        <span className="text-[10px] font-semibold uppercase text-cyan-400 tracking-wide">Action</span>
                                        <p className="text-xs text-muted-foreground mt-0.5">{step.action}</p>
                                      </div>
                                    )}

                                    {step.outcome && (
                                      <div className="mt-1.5 rounded-md bg-background/60 p-2">
                                        <span className="text-[10px] font-semibold uppercase text-amber-400 tracking-wide">Outcome</span>
                                        <p className="text-xs text-muted-foreground mt-0.5">{step.outcome}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}

                        {/* Complete Scenario / Score Display */}
                        {selectedScenario.status === 'RUNNING' && (
                          <div className="flex-shrink-0 border-t border-border/50 pt-3">
                            <div className="flex items-center gap-3">
                              <Label htmlFor="score-input" className="text-sm font-medium whitespace-nowrap">
                                Final Score (0–100)
                              </Label>
                              <Input
                                id="score-input"
                                type="number"
                                min={0}
                                max={100}
                                placeholder="Enter score"
                                value={completeScore}
                                onChange={(e) => setCompleteScore(e.target.value)}
                                className="w-32 h-8 text-sm"
                              />
                              <Button
                                size="sm"
                                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={handleCompleteScenario}
                                disabled={mutation.isPending}
                              >
                                {mutation.isPending ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="size-3.5" />
                                )}
                                Complete Scenario
                              </Button>
                            </div>
                          </div>
                        )}

                        {selectedScenario.status === 'COMPLETED' && (
                          <div className="flex-shrink-0 border-t border-border/50 pt-3">
                            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                              <div className="flex items-center gap-3">
                                <Trophy className="size-5 text-amber-400" />
                                <div>
                                  <p className="text-sm font-semibold text-emerald-400">Scenario Completed</p>
                                  <p className="text-xs text-muted-foreground">
                                    Final Score:{' '}
                                    <span className="text-base font-bold text-foreground">
                                      {selectedScenario.score ?? '—'}
                                    </span>{' '}
                                    / 100
                                  </p>
                                </div>
                              </div>
                              {selectedScenario.results && typeof selectedScenario.results === 'object' && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  <pre className="bg-background/60 rounded-md p-2 overflow-auto max-h-32 text-[11px] font-mono">
                                    {JSON.stringify(selectedScenario.results, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </m.div>
                )}
              </div>

              {/* Right Stats Sidebar */}
              <m.div variants={fadeIn} className="hidden lg:flex w-56 flex-col gap-3 flex-shrink-0">
                <Card>
                  <CardContent className="p-4 flex flex-col gap-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scenario Stats</h4>

                    <div className="space-y-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Total</span>
                          <span className="text-sm font-bold">{stats?.totalScenarios ?? 0}</span>
                        </div>
                        <Progress value={100} className="h-1" />
                      </div>

                      <Separator />

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-cyan-400 flex items-center gap-1">
                            <Play className="size-3" />
                            Running
                          </span>
                          <span className="text-sm font-bold text-cyan-400">
                            {stats?.byScenarioStatus?.RUNNING ?? 0}
                          </span>
                        </div>
                        <Progress
                          value={
                            stats?.totalScenarios
                              ? ((stats?.byScenarioStatus?.RUNNING ?? 0) / stats.totalScenarios) * 100
                              : 0
                          }
                          className="h-1"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="size-3" />
                            Completed
                          </span>
                          <span className="text-sm font-bold text-emerald-400">
                            {stats?.byScenarioStatus?.COMPLETED ?? 0}
                          </span>
                        </div>
                        <Progress
                          value={
                            stats?.totalScenarios
                              ? ((stats?.byScenarioStatus?.COMPLETED ?? 0) / stats.totalScenarios) * 100
                              : 0
                          }
                          className="h-1"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <Clock className="size-3" />
                            Pending
                          </span>
                          <span className="text-sm font-bold text-amber-400">
                            {stats?.byScenarioStatus?.PENDING ?? 0}
                          </span>
                        </div>
                        <Progress
                          value={
                            stats?.totalScenarios
                              ? ((stats?.byScenarioStatus?.PENDING ?? 0) / stats.totalScenarios) * 100
                              : 0
                          }
                          className="h-1"
                        />
                      </div>

                      <Separator />

                      {/* Average Score */}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Avg Score</span>
                        {(() => {
                          const completedScenarios = scenarios.filter((s) => s.score != null);
                          const avg =
                            completedScenarios.length > 0
                              ? completedScenarios.reduce((sum, s) => sum + (s.score ?? 0), 0) / completedScenarios.length
                              : null;
                          return (
                            <span className={cn('text-lg font-bold', avg != null ? 'text-foreground' : 'text-muted-foreground')}>
                              {avg != null ? avg.toFixed(1) : '—'}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick role legend */}
                <Card>
                  <CardContent className="p-4 flex flex-col gap-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Roles</h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-muted-foreground">RED TEAM</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-500" />
                        <span className="text-muted-foreground">BLUE TEAM</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-muted-foreground">OBSERVER</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </m.div>
            </div>
          </m.div>
        </TabsContent>
      </Tabs>

      {/* ================================================================ */}
      {/* Create Scenario Dialog                                           */}
      {/* ================================================================ */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Wargame Scenario</DialogTitle>
            <DialogDescription>
              Define a new wargame scenario to simulate election threat responses.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="scenario-title">Title</Label>
              <Input
                id="scenario-title"
                placeholder="e.g. Post-Election Violence Simulation"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="scenario-desc">Description</Label>
              <Textarea
                id="scenario-desc"
                placeholder="Describe the scenario objectives..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Player Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RED_TEAM">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rose-500" />
                      Red Team
                    </div>
                  </SelectItem>
                  <SelectItem value="BLUE_TEAM">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-500" />
                      Blue Team
                    </div>
                  </SelectItem>
                  <SelectItem value="OBSERVER">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      Observer
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="scenario-params">Parameters (JSON)</Label>
              <Textarea
                id="scenario-params"
                value={newParams}
                onChange={(e) => setNewParams(e.target.value)}
                rows={5}
                className="font-mono text-xs"
                placeholder='{"key": "value"}'
              />
              <p className="text-[11px] text-muted-foreground">Enter valid JSON for scenario parameters.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateScenario}
              disabled={mutation.isPending}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Play className="size-3.5" />
                  Create & Run
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});