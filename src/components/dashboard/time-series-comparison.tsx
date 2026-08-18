'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  CalendarDays,
  Eye,
  EyeOff,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}

export interface TimeSeries {
  id: string;
  name: string;
  color: string;
  data: TimeSeriesDataPoint[];
}

export interface TimeSeriesComparisonProps {
  series: TimeSeries[];
  title: string;
  height?: number;
  defaultMode?: 'overlay' | 'side-by-side';
  showAnomalies?: boolean;
  valueFormatter?: (v: number) => string;
  dateFormatter?: (d: string) => string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'oklch(0.18 0.006 260)',
    border: '1px solid oklch(0.28 0.01 260)',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: 'oklch(0.9 0 0)' },
};

const PERIOD_OPTIONS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Custom range', days: -1 },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeStats(values: number[]) {
  if (values.length === 0) return { total: 0, avg: 0, peak: 0, trend: 'stable' as const };
  const total = values.reduce((a, b) => a + b, 0);
  const avg = total / values.length;
  const peak = Math.max(...values);
  // Simple linear trend: compare first half avg vs second half avg
  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);
  const diff = avgSecond - avgFirst;
  const threshold = avg * 0.02; // 2% threshold
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (diff > threshold) trend = 'up';
  else if (diff < -threshold) trend = 'down';
  return { total, avg, peak, trend };
}

function detectAnomalies(values: number[]): Set<number> {
  const anomalies = new Set<number>();
  if (values.length < 3) return anomalies;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return anomalies;
  const threshold = mean + 2 * stdDev;
  values.forEach((v, i) => {
    if (Math.abs(v - mean) > 2 * stdDev) anomalies.add(i);
  });
  return anomalies;
}

function filterByPeriod(data: TimeSeriesDataPoint[], days: number): TimeSeriesDataPoint[] {
  if (days < 0) return data; // custom = show all
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return data.filter((d) => new Date(d.date) >= cutoff);
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

interface MultiTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
 }>;
  label?: string;
  series: TimeSeries[];
  valueFormatter?: (v: number) => string;
  dateFormatter?: (d: string) => string;
}

function MultiSeriesTooltip({
  active,
  payload,
  label,
  valueFormatter,
  dateFormatter,
}: MultiTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg min-w-[140px]">
      <p className="text-[10px] text-muted-foreground mb-1.5">
        {dateFormatter ? dateFormatter(label || '') : label}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <div
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-popover-foreground flex-1">{entry.name}</span>
          <span className="text-xs font-medium tabular-nums text-popover-foreground">
            {valueFormatter ? valueFormatter(entry.value) : entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Stat Summary Cards ─────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'stable';
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border/50 bg-card/40 px-3 py-2">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
      {trend && (
        <div className="flex items-center gap-0.5">
          {trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald" />}
          {trend === 'down' && <TrendingDown className="h-3 w-3 text-rose" />}
          {trend === 'stable' && <Minus className="h-3 w-3 text-muted-foreground" />}
        </div>
      )}
    </div>
  );
}

// ─── Legend Toggle ───────────────────────────────────────────────────────────

function LegendToggle({
  series,
  visible,
  onToggle,
}: {
  series: TimeSeries[];
  visible: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {series.map((s) => {
        const isVisible = visible.has(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onToggle(s.id)}
            className="flex items-center gap-1.5 text-xs group cursor-pointer"
          >
            <div
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-opacity',
                isVisible ? 'opacity-100' : 'opacity-30',
              )}
              style={{ backgroundColor: s.color }}
            />
            <span
              className={cn(
                'transition-colors',
                isVisible
                  ? 'text-foreground'
                  : 'text-muted-foreground line-through',
              )}
            >
              {s.name}
            </span>
            {isVisible ? (
              <Eye className="h-3 w-3 text-muted-foreground/40" />
            ) : (
              <EyeOff className="h-3 w-3 text-muted-foreground/40" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function TimeSeriesComparison({
  series,
  title,
  height = 350,
  defaultMode = 'overlay',
  showAnomalies = true,
  valueFormatter,
  dateFormatter,
}: TimeSeriesComparisonProps) {
  const [mode, setMode] = useState<'overlay' | 'side-by-side'>(defaultMode);
  const [period, setPeriod] = useState(30);
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(
    () => new Set(series.map((s) => s.id)),
  );

  // Filter data by period
  const filteredSeries = useMemo(
    () =>
      series.map((s) => ({
        ...s,
        data: filterByPeriod(s.data, period),
      })),
    [series, period],
  );

  // Build merged chart data for overlay mode
  const mergedData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>();
    filteredSeries.forEach((s) => {
      if (!visibleSeries.has(s.id)) return;
      s.data.forEach((pt) => {
        const existing = dateMap.get(pt.date) || {};
        existing[s.id] = pt.value;
        dateMap.set(pt.date, existing);
      });
    });
    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values }));
  }, [filteredSeries, visibleSeries]);

  // Compute stats for each visible series
  const statsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeStats>>();
    filteredSeries.forEach((s) => {
      if (!visibleSeries.has(s.id)) return;
      map.set(s.id, computeStats(s.data.map((d) => d.value)));
    });
    return map;
  }, [filteredSeries, visibleSeries]);

  // Aggregate stats across all visible series
  const allValues = useMemo(
    () =>
      filteredSeries
        .filter((s) => visibleSeries.has(s.id))
        .flatMap((s) => s.data.map((d) => d.value)),
    [filteredSeries, visibleSeries],
  );
  const aggregateStats = useMemo(() => computeStats(allValues), [allValues]);

  // Detect anomalies for overlay mode
  const anomalyIndices = useMemo(() => {
    if (!showAnomalies || mergedData.length < 3) return new Set<number>();
    // Use sum across all visible series at each point
    const sums = mergedData.map((row) => {
      let sum = 0;
      filteredSeries.forEach((s) => {
        if (visibleSeries.has(s.id) && row[s.id] !== undefined) {
          sum += row[s.id];
        }
      });
      return sum;
    });
    return detectAnomalies(sums);
  }, [mergedData, filteredSeries, visibleSeries, showAnomalies]);

  // Mean value for reference line
  const meanValue = useMemo(() => {
    if (mergedData.length === 0) return 0;
    let total = 0;
    let count = 0;
    mergedData.forEach((row) => {
      filteredSeries.forEach((s) => {
        if (visibleSeries.has(s.id) && row[s.id] !== undefined) {
          total += row[s.id];
          count++;
        }
      });
    });
    return count > 0 ? total / count : 0;
  }, [mergedData, filteredSeries, visibleSeries]);

  const toggleVisibility = useCallback((id: string) => {
    setVisibleSeries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // keep at least one visible
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const fmt = useCallback(
    (v: number) => (valueFormatter ? valueFormatter(v) : v.toLocaleString()),
    [valueFormatter],
  );

  const fmtDate = useCallback(
    (d: string) => {
      if (dateFormatter) return dateFormatter(d);
      try {
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch {
        return d;
      }
    },
    [dateFormatter],
  );

  const visibleList = filteredSeries.filter((s) => visibleSeries.has(s.id));

  // Shared axis props
  const xAxisProps = {
    dataKey: 'date',
    tick: { fontSize: 11, fill: 'oklch(0.55 0 0)' },
    axisLine: { stroke: 'oklch(0.25 0 260)' },
    tickLine: false,
    tickFormatter: (d: string) => fmtDate(d),
  };
  const yAxisProps = {
    tick: { fontSize: 11, fill: 'oklch(0.55 0 0)' },
    axisLine: false,
    tickLine: false,
    tickFormatter: (v: number) => fmt(v),
  };

  return (
    <Card className="border bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode toggle */}
            <div className="flex items-center rounded-lg border border-border/60 p-0.5">
              {(['overlay', 'side-by-side'] as const).map((m) => (
                <Button
                  key={m}
                  variant={mode === m ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setMode(m)}
                  className="h-6 px-2.5 text-[10px] capitalize"
                >
                  {m === 'side-by-side' ? 'Side by Side' : 'Overlay'}
                </Button>
              ))}
            </div>
            {/* Period selector */}
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-muted-foreground" />
              {PERIOD_OPTIONS.map((opt) => (
                <Button
                  key={opt.label}
                  variant={period === opt.days ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setPeriod(opt.days)}
                  className="h-6 px-2 text-[10px]"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stat summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <StatCard label="Total" value={fmt(aggregateStats.total)} trend={aggregateStats.trend} />
          <StatCard label="Average" value={fmt(Math.round(aggregateStats.avg))} />
          <StatCard label="Peak" value={fmt(aggregateStats.peak)} />
          <StatCard
            label="Trend"
            value={aggregateStats.trend === 'up' ? 'Rising' : aggregateStats.trend === 'down' ? 'Falling' : 'Stable'}
            trend={aggregateStats.trend}
          />
        </div>

        {/* Legend toggle */}
        <LegendToggle series={series} visible={visibleSeries} onToggle={toggleVisibility} />

        {/* Charts */}
        {mergedData.length === 0 || visibleList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Activity className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No data for the selected period</p>
          </div>
        ) : mode === 'overlay' ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{ height }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mergedData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <XAxis {...xAxisProps} />
                <YAxis {...yAxisProps} />
                <Tooltip
                  content={
                    <MultiSeriesTooltip
                      series={filteredSeries}
                      valueFormatter={valueFormatter}
                      dateFormatter={dateFormatter}
                    />
                  }
                  {...TOOLTIP_STYLE}
                />
                {/* Mean reference line */}
                <ReferenceLine
                  y={meanValue}
                  stroke="oklch(0.5 0 0)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.4}
                />
                {visibleList.map((s) => (
                  <defs key={`grad-${s.id}`}>
                    <linearGradient id={`area-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                ))}
                {visibleList.map((s) => (
                  <Area
                    key={s.id}
                    type="monotone"
                    dataKey={s.id}
                    stroke={s.color}
                    strokeWidth={2}
                    fill={`url(#area-${s.id})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
                    name={s.name}
                  />
                ))}
                {/* Anomaly dots */}
                {showAnomalies &&
                  Array.from(anomalyIndices).map((idx) => {
                    const row = mergedData[idx];
                    if (!row) return null;
                    return (
                      <ReferenceLine
                        key={`anomaly-${idx}`}
                        x={row.date}
                        stroke="oklch(0.7 0.2 60)"
                        strokeDasharray="2 3"
                        strokeOpacity={0.5}
                        label={{
                          value: '!',
                          position: 'top',
                          fill: 'oklch(0.7 0.2 60)',
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      />
                    );
                  })}
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        ) : (
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            style={{ height }}
          >
            {visibleList.map((s) => {
              const stats = statsMap.get(s.id);
              const chartData = s.data.map((d) => ({ date: d.date, value: d.value }));
              return (
                <div key={s.id} className="flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-xs font-medium">{s.name}</span>
                    {stats && (
                      <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                        Avg: {fmt(Math.round(stats.avg))} | Peak: {fmt(stats.peak)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                        <XAxis {...xAxisProps} />
                        <YAxis {...yAxisProps} />
                        <Tooltip
                          content={
                            <MultiSeriesTooltip
                              series={[s]}
                              valueFormatter={valueFormatter}
                              dateFormatter={dateFormatter}
                            />
                          }
                          {...TOOLTIP_STYLE}
                        />
                        <defs>
                          <linearGradient id={`side-area-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={s.color} stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={s.color}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 3, strokeWidth: 0, fill: s.color }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
