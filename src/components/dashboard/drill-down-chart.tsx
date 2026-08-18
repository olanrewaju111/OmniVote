'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight, ArrowLeft, BarChart3 } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DrillDownLevel {
  id: string;
  name: string;
  value: number;
  children?: DrillDownLevel[];
  color?: string;
}

export interface DrillDownChartProps {
  data: DrillDownLevel[];
  title: string;
  height?: number;
  colorPalette?: string[];
  onDrillDown?: (level: DrillDownLevel, path: DrillDownLevel[]) => void;
  valueFormatter?: (v: number) => string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_PALETTE = [
  '#008751', '#E53935', '#1E88E5', '#FDD835', '#8E24AA',
  '#FF6F00', '#00ACC1', '#43A047',
];

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'oklch(0.18 0.006 260)',
    border: '1px solid oklch(0.28 0.01 260)',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: 'oklch(0.9 0 0)' },
};

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

function DrillDownTooltip({
  active,
  payload,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { name: string; value: number; pct: number; color: string };
  }>;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-popover-foreground">{d.name}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {formatter ? formatter(d.value) : d.value.toLocaleString()}
        <span className="ml-1.5 text-[10px] opacity-60">({d.pct.toFixed(1)}%)</span>
      </p>
    </div>
  );
}

// ─── Custom Bar Label ────────────────────────────────────────────────────────

function PctLabel({
  x,
  y,
  width,
  value,
  index,
}: {
  x?: number;
  y?: number;
  width?: number;
  value?: number;
  index?: number;
}) {
  if (typeof x !== 'number' || typeof y !== 'number' || typeof value !== 'number') return null;
  return (
    <text
      x={x + (width || 0) / 2}
      y={y - 6}
      textAnchor="middle"
      fill="oklch(0.7 0 0)"
      fontSize={10}
      fontWeight={600}
    >
      {value.toFixed(1)}%
    </text>
  );
}

// ─── Breadcrumb ─────────────────────────────────────────────────────────────

function BreadcrumbTrail({
  path,
  onNavigate,
}: {
  path: DrillDownLevel[];
  onNavigate: (index: number) => void;
}) {
  if (path.length <= 1) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap mb-3">
      {path.map((item, idx) => {
        const isLast = idx === path.length - 1;
        return (
          <React.Fragment key={item.id}>
            {idx > 0 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            )}
            {isLast ? (
              <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
                {item.name}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(idx)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[140px] cursor-pointer"
              >
                {item.name}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function DrillEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
      <p className="text-sm font-medium">No data available</p>
      <p className="text-xs mt-1 opacity-60">Add hierarchical data to enable drill-down</p>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function DrillDownChart({
  data,
  title,
  height = 350,
  colorPalette = DEFAULT_PALETTE,
  onDrillDown,
  valueFormatter,
}: DrillDownChartProps) {
  const [drillPath, setDrillPath] = useState<DrillDownLevel[]>([]);

  // Current level data
  const currentData = useMemo<DrillDownLevel[]>(() => {
    if (drillPath.length === 0) return data;
    const last = drillPath[drillPath.length - 1];
    return last.children || [];
  }, [data, drillPath]);

  // Compute percentage for each item
  const chartData = useMemo(() => {
    if (!currentData || currentData.length === 0) return [];
    const total = currentData.reduce((s, d) => s + d.value, 0);
    return currentData.map((d, i) => ({
      name: d.name,
      value: d.value,
      pct: total > 0 ? (d.value / total) * 100 : 0,
      color: d.color || colorPalette[i % colorPalette.length],
      _ref: d,
    }));
  }, [currentData, colorPalette]);

  const totalValue = useMemo(
    () => chartData.reduce((s, d) => s + d.value, 0),
    [chartData],
  );

  const hasDrillableItems = chartData.some(
    (d) => d._ref.children && d._ref.children.length > 0,
  );

  const handleBarClick = useCallback(
    (entry: { _ref: DrillDownLevel }) => {
      const item = entry._ref;
      if (!item.children || item.children.length === 0) return;
      const newPath = [...drillPath, item];
      setDrillPath(newPath);
      onDrillDown?.(item, newPath);
    },
    [drillPath, onDrillDown],
  );

  const handleBreadcrumb = useCallback((index: number) => {
    setDrillPath((prev) => prev.slice(0, index + 1));
  }, []);

  const handleBackToTop = useCallback(() => {
    setDrillPath([]);
  }, []);

  const format = useCallback(
    (v: number) => (valueFormatter ? valueFormatter(v) : v.toLocaleString()),
    [valueFormatter],
  );

  // Determine animation direction
  const [direction, setDirection] = useState<1 | -1>(1);
  const prevPathLengthRef = React.useRef(0);
  React.useEffect(() => {
    const diff = drillPath.length - prevPathLengthRef.current;
    if (diff > 0) setDirection(1);
    else if (diff < 0) setDirection(-1);
    prevPathLengthRef.current = drillPath.length;
  }, [drillPath.length]);

  return (
    <Card className="border bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {drillPath.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToTop}
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to top
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <BreadcrumbTrail path={drillPath} onNavigate={handleBreadcrumb} />

        {!currentData || currentData.length === 0 ? (
          <DrillEmptyState />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={drillPath.length}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              style={{ height }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 28, right: 10, left: 10, bottom: 5 }}
                  onClick={(data) => {
                    if (data?.activePayload?.[0]) {
                      handleBarClick(data.activePayload[0].payload);
                    }
                  }}
                  style={{ cursor: hasDrillableItems ? 'pointer' : 'default' }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }}
                    axisLine={{ stroke: 'oklch(0.25 0 260)' }}
                    tickLine={false}
                    interval={0}
                    angle={chartData.length > 6 ? -35 : 0}
                    textAnchor={chartData.length > 6 ? 'end' : 'middle'}
                    height={chartData.length > 6 ? 60 : 30}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => format(v)}
                  />
                  <Tooltip
                    content={<DrillDownTooltip formatter={valueFormatter} />}
                    cursor={{ fill: 'oklch(0.3 0.01 260)', opacity: 0.5 }}
                    {...TOOLTIP_STYLE}
                  />
                  <Bar
                    dataKey="value"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={56}
                    label={<PctLabel />}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        opacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Legend showing total */}
        {chartData.length > 0 && (
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {drillPath.length === 0
                ? 'Click a bar to drill down'
                : `${chartData.length} sub-items`}
            </span>
            <span className="font-medium tabular-nums">
              Total: {format(totalValue)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
