'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
  Tooltip, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Target, Eye, EyeOff } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RadarSeries {
  id: string;
  name: string;
  color: string;
  values: Record<string, number>;
}

export interface RadarOverviewProps {
  /** Multiple series to overlay on the radar */
  series: RadarSeries[];
  /** Title shown in card header */
  title?: string;
  /** Height of chart area in px */
  height?: number;
  /** Max value for the radar scale (0–1 for normalized) */
  maxScale?: number;
  /** Whether axes should show percentage (0–100) */
  normalized?: boolean;
  /** Value formatter for tooltip */
  valueFormatter?: (v: number, axis: string) => string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_PALETTE = ['#008751', '#E53935', '#1E88E5', '#FDD835', '#8E24AA'];

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

function RadarTooltip({
  active, payload, series, valueFormatter, normalized,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  series: RadarSeries[];
  valueFormatter?: (v: number, axis: string) => string;
  normalized?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg min-w-[160px]">
      <p className="text-[10px] text-muted-foreground mb-1.5">{payload[0]?.name || ''}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-popover-foreground flex-1">{entry.dataKey}</span>
          <span className="text-xs font-medium tabular-nums text-popover-foreground">
            {valueFormatter
              ? valueFormatter(entry.value, entry.name)
              : normalized
                ? `${Math.round(entry.value * 100)}%`
                : entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function RadarOverview({
  series,
  title = 'Election Metrics Radar',
  height = 360,
  maxScale,
  normalized = false,
  valueFormatter,
}: RadarOverviewProps) {
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(
    () => new Set(series.map(s => s.id)),
  );

  // Collect all axis keys from all series
  const axes = useMemo(() => {
    const axisSet = new Set<string>();
    series.forEach(s => Object.keys(s.values).forEach(k => axisSet.add(k)));
    return Array.from(axisSet);
  }, [series]);

  // Compute max scale from data if not provided
  const computedMax = useMemo(() => {
    if (maxScale !== undefined) return maxScale;
    let max = 0;
    series.forEach(s => {
      Object.values(s.values).forEach(v => { if (v > max) max = v; });
    });
    return normalized ? 1 : Math.ceil(max * 1.15) || 100;
  }, [series, maxScale, normalized]);

  // Build chart data — one record per axis
  const chartData = useMemo(() => {
    return axes.map(axis => {
      const record: Record<string, string | number> = { axis };
      series.forEach(s => {
        if (visibleSeries.has(s.id)) {
          record[s.id] = s.values[axis] ?? 0;
        }
      });
      return record;
    });
  }, [axes, series, visibleSeries]);

  const toggleVisibility = useCallback((id: string) => {
    setVisibleSeries(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  if (series.length === 0) {
    return (
      <Card className="border bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Target className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">No radar data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-cyan" />
            {title}
          </CardTitle>
          {/* Legend toggles */}
          <div className="flex items-center gap-3 flex-wrap">
            {series.map(s => {
              const isVisible = visibleSeries.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleVisibility(s.id)}
                  className="flex items-center gap-1.5 text-xs group cursor-pointer"
                >
                  <div
                    className={cn('h-2.5 w-2.5 rounded-full transition-opacity', isVisible ? 'opacity-100' : 'opacity-30')}
                    style={{ backgroundColor: s.color }}
                  />
                  <span className={cn('transition-colors', isVisible ? 'text-foreground' : 'text-muted-foreground line-through')}>
                    {s.name}
                  </span>
                  {isVisible
                    ? <Eye className="h-3 w-3 text-muted-foreground/40" />
                    : <EyeOff className="h-3 w-3 text-muted-foreground/40" />}
                </button>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="oklch(0.25 0 260)" strokeOpacity={0.5} />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, computedMax]}
              tick={{ fontSize: 9, fill: 'oklch(0.45 0 0)' }}
              tickFormatter={normalized ? (v: number) => `${Math.round(v * 100)}%` : (v: number) => v.toLocaleString()}
              axisLine={false}
            />
            <Tooltip
              content={
                <RadarTooltip
                  series={series}
                  valueFormatter={valueFormatter}
                  normalized={normalized}
                />
              }
            />
            {series.map(s => (
              <Radar
                key={s.id}
                name={s.name}
                dataKey={s.id}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.15}
                strokeWidth={2}
                dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                isAnimationActive={true}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
