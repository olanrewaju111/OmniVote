'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Radio, Wifi, WifiOff, ZoomIn, ZoomOut, RotateCcw,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StreamDataPoint {
  timestamp: number; // epoch ms
  value: number;
}

export interface RealtimeStreamChartProps {
  /** Unique ID for this stream instance */
  streamId?: string;
  /** Title shown in card header */
  title?: string;
  /** Maximum number of visible data points */
  maxPoints?: number;
  /** Color for the area stroke/fill */
  color?: string;
  /** Height of chart in px */
  height?: number;
  /** Y-axis domain [min, max]. Auto-computed if undefined */
  yDomain?: [number, number];
  /** Value label for tooltip */
  valueLabel?: string;
  /** Value formatter */
  valueFormatter?: (v: number) => string;
  /** External data source: push new points via callback */
  onDataChange?: (handler: (point: StreamDataPoint) => void) => () => void;
}

// ─── Synthetic data generator for demo ────────────────────────────────────────

function generateSyntheticPoint(prev: StreamDataPoint): StreamDataPoint {
  const change = (Math.sin(Date.now() / 3000) + Math.cos(Date.now() / 7000)) * 5;
  return {
    timestamp: Date.now(),
    value: Math.max(0, prev.value + change + (Math.random() - 0.48) * 8),
  };
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

function StreamTooltip({
  active, payload, valueLabel, valueFormatter,
}: {
  active?: boolean;
  payload?: Array<{ value: number; color: string; dataKey: string }>;
  valueLabel?: string;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[10px] text-muted-foreground mb-1">{valueLabel || 'Value'}</p>
      <p className="text-sm font-bold tabular-nums text-popover-foreground">
        {valueFormatter ? valueFormatter(v) : v.toLocaleString(undefined, { maximumFractionDigits: 1 })}
      </p>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function RealtimeStreamChart({
  streamId,
  title = 'Live Stream',
  maxPoints = 80,
  color = '#008751',
  height = 240,
  yDomain,
  valueLabel,
  valueFormatter,
  onDataChange,
}: RealtimeStreamChartProps) {
  const [data, setData] = useState<StreamDataPoint[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef<((point: StreamDataPoint) => void) | null>(null);

  // Compute visible window based on zoom
  const visibleData = useMemo(() => {
    const windowSize = Math.min(maxPoints, Math.max(10, Math.round(maxPoints / zoomLevel)));
    return data.slice(-windowSize);
  }, [data, maxPoints, zoomLevel]);

  // Auto y-domain
  const computedYDomain = useMemo((): [number, number] => {
    if (yDomain) return yDomain;
    if (visibleData.length === 0) return [0, 100];
    const values = visibleData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.15, 5);
    return [Math.max(0, Math.floor(min - padding)), Math.ceil(max + padding)];
  }, [visibleData, yDomain]);

  // Mean reference
  const meanValue = useMemo(() => {
    if (visibleData.length === 0) return 0;
    return visibleData.reduce((s, d) => s + d.value, 0) / visibleData.length;
  }, [visibleData]);

  // Add a data point
  const addPoint = useCallback((point: StreamDataPoint) => {
    setData(prev => [...prev.slice(-(maxPoints * 2)), point]); // keep buffer
  }, [maxPoints]);

  // Expose addPoint for external consumers
  callbackRef.current = addPoint;

  // Synthetic data feed (when no external source)
  useEffect(() => {
    if (onChange) {
      // External data source
      const remove = onChange((point) => callbackRef.current?.(point));
      return remove;
    }

    // Synthetic demo data
    let last: StreamDataPoint = {
      timestamp: Date.now() - 5000,
      value: 50 + Math.random() * 20,
    };
    setData([last]);

    const interval = setInterval(() => {
      last = generateSyntheticPoint(last);
      callbackRef.current?.(last);
    }, 1500);

    return () => clearInterval(interval);
  }, [onChange]);

  const toggleLive = useCallback(() => setIsLive(p => !p), []);
  const zoomIn = useCallback(() => setZoomLevel(z => Math.min(8, z * 1.5)), []);
  const zoomOut = useCallback(() => setZoomLevel(z => Math.max(1, z / 1.5)), []);
  const resetZoom = useCallback(() => setZoomLevel(1), []);

  const fmt = useCallback((v: number) =>
    valueFormatter ? valueFormatter(v) : v.toLocaleString(undefined, { maximumFractionDigits: 1 }),
    [valueFormatter],
  );

  const fmtTime = useCallback((ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  // Compute stats
  const current = visibleData.length > 0 ? visibleData[visibleData.length - 1].value : 0;
  const trend = visibleData.length >= 10
    ? current - visibleData[visibleData.length - 10].value
    : 0;

  return (
    <Card className="border bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Radio className={cn('h-4 w-4', isLive ? 'text-emerald' : 'text-muted-foreground')} />
            {title}
            {isLive && (
              <span className="flex items-center gap-1 text-[10px] text-emerald">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
                LIVE
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={toggleLive} className="h-7 px-2 text-[10px] gap-1">
              {isLive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isLive ? 'Pause' : 'Resume'}
            </Button>
            <Button variant="ghost" size="sm" onClick={zoomIn} className="h-7 w-7 p-0">
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={zoomOut} className="h-7 w-7 p-0">
              <ZoomOut className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={resetZoom} className="h-7 w-7 p-0">
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats row */}
        <div className="flex items-center gap-4 mb-3 text-xs">
          <div>
            <span className="text-muted-foreground">Current: </span>
            <span className="font-bold tabular-nums" style={{ color }}>{fmt(current)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Mean: </span>
            <span className="font-medium tabular-nums">{fmt(meanValue)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Trend: </span>
            <span className={cn('font-medium tabular-nums', trend > 0 ? 'text-emerald' : trend < 0 ? 'text-rose' : '')}>
              {trend > 0 ? '+' : ''}{fmt(trend)}
            </span>
          </div>
          <div className="ml-auto text-[10px] text-muted-foreground">
            {visibleData.length} pts · {zoomLevel.toFixed(1)}x
          </div>
        </div>

        {visibleData.length < 2 ? (
          <div className="flex items-center justify-center text-muted-foreground" style={{ height: height - 40 }}>
            <p className="text-xs">Waiting for data...</p>
          </div>
        ) : (
          <div ref={containerRef}>
            <ResponsiveContainer width="100%" height={height - 40}>
              <AreaChart data={visibleData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id={`stream-${streamId || 'default'}-grad`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={fmtTime}
                  tick={{ fontSize: 10, fill: 'oklch(0.5 0 0)' }}
                  axisLine={{ stroke: 'oklch(0.25 0 260)' }}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  domain={computedYDomain}
                  tick={{ fontSize: 10, fill: 'oklch(0.5 0 0)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmt}
                  width={50}
                />
                <Tooltip
                  content={<StreamTooltip valueLabel={valueLabel} valueFormatter={valueFormatter} />}
                  labelFormatter={fmtTime}
                />
                <ReferenceLine
                  y={meanValue}
                  stroke="oklch(0.5 0 0)"
                  strokeDasharray="3 3"
                  strokeOpacity={0.4}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#stream-${streamId || 'default'}-grad)`}
                  dot={false}
                  isAnimationActive={false}
                  name={valueLabel || 'Value'}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
