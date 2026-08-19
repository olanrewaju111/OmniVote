/**
 * WebVitalsPanel — Phase 20
 *
 * Dashboard panel showing real-time Core Web Vitals aggregation:
 *   - Health score gauge (0-100)
 *   - Per-metric cards (LCP, INP, CLS, FCP, TTFB) with P75 and budget status
 *   - Anomaly feed (recent threshold violations)
 *   - Route breakdown
 */

'use client';

import React, { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Gauge, AlertTriangle, CheckCircle2, XCircle, Clock,
  TrendingUp, TrendingDown, Minus, RefreshCw, Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────

interface MetricStats {
  name: string;
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p75: number;
  p95: number;
  p99: number;
  stdDev: number;
}

interface VitalAnomaly {
  id: string;
  metric: string;
  route: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: string;
  message: string;
}

interface BudgetComplianceEntry {
  compliant: boolean;
  currentP75: number;
  target: number;
  unit: string;
}

interface WebVitalsData {
  stats: Record<string, MetricStats>;
  anomalies: VitalAnomaly[];
  healthScore: number;
  routes: string[];
  budgetCompliance: Record<string, BudgetComplianceEntry>;
  anomalyCounts: { total: number; warning: number; critical: number };
  totalEvents: number;
  bufferUtilization: number;
}

// ─── Metric config ────────────────────────────────────────────────────

const METRIC_CONFIG: Record<string, { label: string; goodThreshold: number; unit: string; description: string }> = {
  LCP:  { label: 'Largest Contentful Paint', goodThreshold: 2500, unit: 'ms', description: 'Loading performance' },
  INP:  { label: 'Interaction to Next Paint', goodThreshold: 200,  unit: 'ms', description: 'Interactivity' },
  CLS:  { label: 'Cumulative Layout Shift', goodThreshold: 0.1,  unit: '',   description: 'Visual stability' },
  FCP:  { label: 'First Contentful Paint',  goodThreshold: 1800, unit: 'ms', description: 'Initial load' },
  TTFB: { label: 'Time to First Byte',     goodThreshold: 800,  unit: 'ms', description: 'Server responsiveness' },
};

// ─── Helpers ──────────────────────────────────────────────────────────

function formatValue(value: number, unit: string): string {
  if (unit === 'ms') {
    return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(2)}s`;
  }
  return value.toFixed(3);
}

function healthScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald';
  if (score >= 70) return 'text-amber';
  return 'text-rose';
}

function healthScoreBg(score: number): string {
  if (score >= 90) return 'bg-emerald/10 border-emerald/20';
  if (score >= 70) return 'bg-amber/10 border-amber/20';
  return 'bg-rose/10 border-rose/20';
}

function trendIcon(current: number, target: number) {
  if (current <= target) return <TrendingDown className="h-3 w-3 text-emerald" />;
  if (current <= target * 1.2) return <Minus className="h-3 w-3 text-amber" />;
  return <TrendingUp className="h-3 w-3 text-rose" />;
}

// ─── Component ────────────────────────────────────────────────────────

export function WebVitalsPanel() {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<WebVitalsData>({
    queryKey: ['web-vitals', selectedRoute],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedRoute) params.set('route', selectedRoute);
      const res = await fetch(`/api/metrics/web-vitals?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch web vitals');
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/metrics/web-vitals', { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['web-vitals'] });
      toast.success('Web vitals data cleared');
    },
  });

  const stats = data?.stats || {};
  const anomalies = data?.anomalies || [];
  const healthScore = data?.healthScore ?? 100;
  const routes = data?.routes || [];
  const budgetCompliance = data?.budgetCompliance || {};
  const anomalyCounts = data?.anomalyCounts || { total: 0, warning: 0, critical: 0 };
  const totalEvents = data?.totalEvents || 0;

  const metricNames = Object.keys(METRIC_CONFIG);

  return (
    <div className="space-y-4 p-4" role="region" aria-label="Web Vitals Performance">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Core Web Vitals</h3>
          <Badge variant="outline" className="text-[10px]">{totalEvents} events</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost" size="sm" className="h-7 text-xs gap-1"
            onClick={() => refetch()}
            aria-label="Refresh web vitals"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost" size="sm" className="h-7 text-xs gap-1 text-rose hover:text-rose"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending || totalEvents === 0}
            aria-label="Clear web vitals data"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* ── Health Score + Anomaly Summary ── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Health Score */}
        <Card className={cn('col-span-1 border', healthScoreBg(healthScore))}>
          <CardContent className="p-3 flex flex-col items-center justify-center">
            <span className={cn('text-2xl font-bold tabular-nums', healthScoreColor(healthScore))}>
              {healthScore}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5">Health Score</span>
          </CardContent>
        </Card>

        {/* Warning Anomalies */}
        <Card className="border">
          <CardContent className="p-3 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-amber tabular-nums">{anomalyCounts.warning}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">Warnings</span>
          </CardContent>
        </Card>

        {/* Critical Anomalies */}
        <Card className="border">
          <CardContent className="p-3 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-rose tabular-nums">{anomalyCounts.critical}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">Critical</span>
          </CardContent>
        </Card>
      </div>

      {/* ── Route Filter ── */}
      {routes.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground">Route:</span>
          <button
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border',
              !selectedRoute
                ? 'bg-emerald/15 text-emerald border-emerald/30'
                : 'text-muted-foreground hover:text-foreground border-transparent hover:border-border'
            )}
            onClick={() => setSelectedRoute(null)}
          >
            All
          </button>
          {routes.slice(0, 8).map((route) => (
            <button
              key={route}
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border',
                selectedRoute === route
                  ? 'bg-emerald/15 text-emerald border-emerald/30'
                  : 'text-muted-foreground hover:text-foreground border-transparent hover:border-border'
              )}
              onClick={() => setSelectedRoute(selectedRoute === route ? null : route)}
            >
              {route === '/dashboard' ? '/dashboard' : route}
            </button>
          ))}
          {routes.length > 8 && (
            <span className="text-[10px] text-muted-foreground">+{routes.length - 8} more</span>
          )}
        </div>
      )}

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-5 gap-3">
        {metricNames.map((metric) => {
          const config = METRIC_CONFIG[metric];
          const budget = budgetCompliance[metric];
          const metricStats = stats[metric];

          if (!metricStats || !budget) {
            return (
              <Card key={metric} className="border border-border/50">
                <CardContent className="p-2.5">
                  <div className="text-[10px] font-medium text-muted-foreground truncate">{config.label}</div>
                  <div className="text-xs text-muted-foreground/60 mt-1">No data</div>
                </CardContent>
              </Card>
            );
          }

          return (
            <Card
              key={metric}
              className={cn(
                'border transition-colors',
                budget.compliant
                  ? 'border-emerald/20'
                  : 'border-rose/20'
              )}
            >
              <CardContent className="p-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-medium text-muted-foreground truncate">{config.label}</div>
                  {trendIcon(budget.currentP75, budget.target)}
                </div>
                <div className="text-lg font-bold tabular-nums mt-0.5">
                  {formatValue(budget.currentP75, config.unit)}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[8px] h-3.5 px-1',
                      budget.compliant
                        ? 'text-emerald border-emerald/30'
                        : 'text-rose border-rose/30'
                    )}
                  >
                    P75
                  </Badge>
                  <span className="text-[9px] text-muted-foreground">
                    Target: {formatValue(budget.target, config.unit)}
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (budget.target / budget.currentP75) * 100)}
                  className="h-1 mt-1.5"
                />
                <div className="text-[9px] text-muted-foreground/60 mt-1">
                  n={metricStats.count}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Anomaly Feed ── */}
      {anomalies.length > 0 && (
        <Card className="border">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-amber" aria-hidden="true" />
              Recent Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-1.5 max-h-40 overflow-y-auto" role="log" aria-label="Anomaly feed">
              <AnimatePresence>
                {anomalies.slice(0, 20).map((anomaly) => (
                  <m.div
                    key={anomaly.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-2 text-[11px]"
                  >
                    {anomaly.severity === 'critical' ? (
                      <XCircle className="h-3 w-3 text-rose shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">
                        {anomaly.metric}
                      </span>
                      <span className="text-muted-foreground">
                        {' '}{formatValue(anomaly.value, METRIC_CONFIG[anomaly.metric]?.unit || '')}
                        {' '}on {anomaly.route}
                      </span>
                    </div>
                    <span className="text-[9px] text-muted-foreground/60 shrink-0">
                      {new Date(anomaly.timestamp).toLocaleTimeString()}
                    </span>
                  </m.div>
                ))}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ── */}
      {!isLoading && totalEvents === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Gauge className="h-8 w-8 text-muted-foreground/20 mb-2" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">No web vitals data yet</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            Client metrics will appear here once users visit the dashboard
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}
