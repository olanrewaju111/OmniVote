'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ZAxis, ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Grid3X3, Activity } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HeatmapCell {
  x: string;
  y: string;
  value: number;
  label?: string;
}

export interface ElectionHeatmapProps {
  /** 2D grid data */
  data: HeatmapCell[];
  /** Title shown in card header */
  title?: string;
  /** X-axis label (e.g., "Time of Day") */
  xAxisLabel?: string;
  /** Y-axis label (e.g., "Region") */
  yAxisLabel?: string;
  /** Height of chart area in px */
  height?: number;
  /** Color scale: array of color strings for interpolation */
  colorRange?: string[];
  /** Value formatter for tooltip */
  valueFormatter?: (v: number) => string;
  /** Called when a cell is clicked */
  onCellClick?: (cell: HeatmapCell) => void;
}

// ─── Color helpers ──────────────────────────────────────────────────────────

function interpolateColor(value: number, min: number, max: number, low: string, high: string): string {
  const t = max === min ? 0.5 : (value - min) / (max - min);
  const clamped = Math.max(0, Math.min(1, t));
  // Parse hex colors
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(low);
  const [r2, g2, b2] = parse(high);
  const r = Math.round(r1 + (r2 - r1) * clamped);
  const g = Math.round(g1 + (g2 - g1) * clamped);
  const b = Math.round(b1 + (b2 - b1) * clamped);
  return `rgb(${r},${g},${b})`;
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

function HeatmapTooltip({
  active, payload, xAxisLabel, yAxisLabel, valueFormatter,
}: {
  active?: boolean;
  payload?: Array<{ payload: HeatmapCell }>;
  xAxisLabel?: string;
  yAxisLabel?: string;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const cell = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-popover-foreground">{cell.label || `${cell.y} × ${cell.x}`}</p>
      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
        {xAxisLabel && <span>{xAxisLabel}: {cell.x}</span>}
        {yAxisLabel && <span>{yAxisLabel}: {cell.y}</span>}
      </div>
      <p className="text-sm font-bold tabular-nums mt-1 text-popover-foreground">
        {valueFormatter ? valueFormatter(cell.value) : cell.value.toLocaleString()}
      </p>
    </div>
  );
}

// ─── Custom Legend ──────────────────────────────────────────────────────────

function HeatmapLegend({ min, max, colorRange }: { min: number; max: number; colorRange: [string, string] }) {
  const steps = 5;
  return (
    <div className="flex items-center gap-2 mt-3">
      <span className="text-[10px] text-muted-foreground">{min.toLocaleString()}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden flex">
        {Array.from({ length: steps }, (_, i) => {
          const t = i / (steps - 1);
          const val = min + (max - min) * t;
          const color = interpolateColor(val, min, max, colorRange[0], colorRange[1]);
          return (
            <div
              key={i}
              className="flex-1"
              style={{ backgroundColor: color }}
            />
          );
        })}
      </div>
      <span className="text-[10px] text-muted-foreground">{max.toLocaleString()}</span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ElectionHeatmap({
  data,
  title = 'Incident Density Heatmap',
  xAxisLabel = 'Time Period',
  yAxisLabel = 'Region',
  height = 340,
  colorRange = ['#064e3b', '#fbbf24', '#ef4444'],
  valueFormatter,
  onCellClick,
}: ElectionHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [hoverX, setHoverX] = useState<string | null>(null);
  const [hoverY, setHoverY] = useState<string | null>(null);

  // Compute min/max for color scaling
  const { min, max, coloredData } = useMemo(() => {
    const values = data.map(d => d.value);
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 1);
    const lowColor = colorRange?.[0] || '#064e3b';
    const highColor = colorRange?.[colorRange.length - 1] || '#fbbf24';
    const colored = data.map(d => ({
      ...d,
      fill: interpolateColor(d.value, minVal, maxVal, lowColor, highColor),
      stroke: hoveredCell === `${d.x}-${d.y}` ? '#ffffff' : 'transparent',
      strokeWidth: hoveredCell === `${d.x}-${d.y}` ? 2 : 0,
    }));
    return { min: minVal, max: maxVal, coloredData: colored };
  }, [data, colorRange, hoveredCell]);

  const fmt = useCallback((v: number) => valueFormatter ? valueFormatter(v) : v.toLocaleString(), [valueFormatter]);

  // Get unique axis values for tick rendering
  const xValues = useMemo(() => [...new Set(data.map(d => d.x))], [data]);
  const yValues = useMemo(() => [...new Set(data.map(d => d.y))], [data]);

  return (
    <Card className="border bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Grid3X3 className="h-4 w-4 text-amber" />
            {title}
          </CardTitle>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {data.length} cells · {xValues.length}×{yValues.length}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Activity className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No heatmap data</p>
            <p className="text-xs mt-1 opacity-60">Region-time incident data will populate this view</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <XAxis
                dataKey="x"
                type="category"
                name={xAxisLabel}
                tick={{ fontSize: 10, fill: 'oklch(0.55 0 0)' }}
                axisLine={{ stroke: 'oklch(0.25 0 260)' }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                dataKey="y"
                type="category"
                name={yAxisLabel}
                tick={{ fontSize: 10, fill: 'oklch(0.55 0 0)' }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <ZAxis
                dataKey="value"
                range={[200, 500]}
                domain={[min, max]}
              />
              <Tooltip
                content={
                  <HeatmapTooltip
                    xAxisLabel={xAxisLabel}
                    yAxisLabel={yAxisLabel}
                    valueFormatter={valueFormatter}
                  />
                }
              />
              {/* Phase 13: Crosshair guides */}
              {hoverX && <ReferenceLine x={hoverX} stroke="oklch(0.5 0 0)" strokeDasharray="3 3" strokeOpacity={0.3} />}
              {hoverY && <ReferenceLine y={hoverY} stroke="oklch(0.5 0 0)" strokeDasharray="3 3" strokeOpacity={0.3} />}
              <Scatter
                data={coloredData}
                shape="square"
                onMouseEnter={(entry) => { setHoveredCell(`${entry.x}-${entry.y}`); setHoverX(String(entry.x)); setHoverY(String(entry.y)); }}
                onMouseLeave={() => { setHoveredCell(null); setHoverX(null); setHoverY(null); }}
                onClick={(entry) => onCellClick?.(entry)}
                style={{ cursor: onCellClick ? 'pointer' : 'default' }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}
        <HeatmapLegend min={min} max={max} colorRange={[colorRange?.[0] || '#064e3b', colorRange?.[colorRange.length - 1] || '#fbbf24'] as [string, string]} />
      </CardContent>
    </Card>
  );
}
