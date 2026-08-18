'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { m, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CircleDot,
  AlertTriangle,
  XCircle,
  Wifi,
  WifiOff,
  Info,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. TREND SPARKLINE
// ═══════════════════════════════════════════════════════════════════════════════

export interface TrendSparklineProps {
  data: number[];
  label: string;
  value: number;
  trend?: { value: number; up: boolean };
  color: string;
}

export function TrendSparkline({
  data,
  label,
  value,
  trend,
  color,
}: TrendSparklineProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 200;
  const H = 60;
  const PAD = 2;

  const points = useMemo(() => {
    if (!data || data.length < 2) return [];
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = (W - PAD * 2) / (data.length - 1);
    return data.map((v, i) => ({
      x: PAD + i * stepX,
      y: PAD + (1 - (v - min) / range) * (H - PAD * 2),
      value: v,
    }));
  }, [data, W, H, PAD]);

  const linePath = useMemo(() => {
    if (points.length < 2) return '';
    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const cp1x = (points[i].x + points[i + 1].x) / 2;
      const cp1y = points[i].y;
      const cp2x = cp1x;
      const cp2y = points[i + 1].y;
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${points[i + 1].x},${points[i + 1].y}`;
    }
    return path;
  }, [points]);

  const areaPath = useMemo(
    () =>
      points.length >= 2
        ? `${linePath} L ${points[points.length - 1].x},${H} L ${points[0].x},${H} Z`
        : '',
    [points, linePath, H],
  );

  const gradId = `trend-spark-${color.replace('#', '')}-${Math.random().toString(36).slice(2, 6)}`;

  return (
    <Card className="border bg-card/50 backdrop-blur-sm transition-all duration-200 card-lift">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
            {label}
          </span>
          {trend && (
            <div className="flex items-center gap-0.5">
              {trend.up ? (
                <TrendingUp className="h-3 w-3 text-emerald" />
              ) : trend.value < 0 ? (
                <TrendingDown className="h-3 w-3 text-rose" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )}
              <span
                className={cn(
                  'text-[11px] font-medium tabular-nums',
                  trend.up
                    ? 'text-emerald'
                    : trend.value < 0
                      ? 'text-rose'
                      : 'text-muted-foreground',
                )}
              >
                {trend.up ? '+' : ''}
                {trend.value}%
              </span>
            </div>
          )}
        </div>
        <p className="text-xl font-bold tabular-nums leading-tight" style={{ color }}>
          {value.toLocaleString()}
        </p>
        <div className="relative mt-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            className="overflow-visible"
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
              />
            )}
            {/* Interactive hover zones */}
            {points.map((p, i) => (
              <g key={i}>
                {/* Invisible wider rect for hover */}
                <rect
                  x={p.x - (W / data.length) / 2}
                  y={0}
                  width={W / data.length}
                  height={H}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                  className="cursor-crosshair"
                />
                {hoverIdx === i && (
                  <g>
                    <line
                      x1={p.x}
                      y1={0}
                      x2={p.x}
                      y2={H}
                      stroke={color}
                      strokeWidth={0.5}
                      strokeDasharray="2 2"
                      opacity={0.6}
                    />
                    <circle cx={p.x} cy={p.y} r={3} fill={color} />
                    <rect
                      x={p.x - 24}
                      y={p.y - 22}
                      width={48}
                      height={16}
                      rx={4}
                      fill="oklch(0.18 0.006 260)"
                      stroke={color}
                      strokeWidth={0.5}
                    />
                    <text
                      x={p.x}
                      y={p.y - 12}
                      textAnchor="middle"
                      fill={color}
                      fontSize={9}
                      fontWeight={600}
                    >
                      {p.value.toLocaleString()}
                    </text>
                  </g>
                )}
              </g>
            ))}
            {/* End dot */}
            {points.length > 0 && hoverIdx === null && (
              <circle
                cx={points[points.length - 1].x}
                cy={points[points.length - 1].y}
                r={2.5}
                fill={color}
                opacity={0.9}
              />
            )}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. COMPARISON GAUGE
// ═══════════════════════════════════════════════════════════════════════════════

export interface ComparisonGaugeProps {
  current: number;
  target: number;
  label: string;
  unit?: string;
}

function getGaugeColor(pct: number): string {
  if (pct >= 75) return '#10b981'; // green/emerald
  if (pct >= 50) return '#f59e0b'; // amber
  return '#ef4444'; // red/rose
}

export function ComparisonGauge({ current, target, label, unit = '' }: ComparisonGaugeProps) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const color = getGaugeColor(pct);

  // Animated percentage using spring
  const spring = useSpring(0, { duration: 1000 });
  const displayPct = useTransform(spring, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    spring.set(pct);
    const unsub = displayPct.on('change', (v) => setDisplay(v));
    return unsub;
  }, [pct, spring, displayPct]);

  // SVG arc params
  const R = 60;
  const STROKE_W = 10;
  const CENTER = 70;
  // Semi-circle: from 180deg to 0deg (left to right)
  const startAngle = Math.PI; // 180°
  const endAngle = 0; // 0°
  const totalAngle = startAngle - endAngle; // PI
  const filledAngle = totalAngle * (pct / 100);

  const arcPath = (angle: number) => {
    const r = R - STROKE_W / 2;
    const x1 = CENTER + r * Math.cos(startAngle);
    const y1 = CENTER + r * Math.sin(startAngle);
    const x2 = CENTER + r * Math.cos(startAngle - angle);
    const y2 = CENTER + r * Math.sin(startAngle - angle);
    const largeArc = angle > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  return (
    <Card className="border bg-card/50 backdrop-blur-sm transition-all duration-200 card-lift">
      <CardContent className="p-3 flex flex-col items-center">
        <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">
          {label}
        </span>

        <svg width={CENTER * 2} height={CENTER + 10} viewBox={`0 0 ${CENTER * 2} ${CENTER + 10}`}>
          {/* Background track */}
          <path
            d={arcPath(totalAngle)}
            fill="none"
            stroke="oklch(0.22 0.005 260)"
            strokeWidth={STROKE_W}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <m.path
            d={arcPath(filledAngle)}
            fill="none"
            stroke={color}
            strokeWidth={STROKE_W}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
          />
          {/* Center text */}
          <text
            x={CENTER}
            y={CENTER - 8}
            textAnchor="middle"
            fill={color}
            fontSize={22}
            fontWeight={700}
            fontFamily="system-ui, sans-serif"
          >
            {display}%
          </text>
          <text
            x={CENTER}
            y={CENTER + 10}
            textAnchor="middle"
            fill="oklch(0.55 0 0)"
            fontSize={9}
          >
            {current.toLocaleString()} / {target.toLocaleString()}
            {unit && <tspan> {unit}</tspan>}
          </text>
        </svg>

        {/* Labels below gauge */}
        <div className="flex items-center justify-between w-full mt-1 px-2">
          <span className="text-[9px] text-muted-foreground">0%</span>
          <span className="text-[9px] text-muted-foreground">Target: {target.toLocaleString()}{unit && ` ${unit}`}</span>
          <span className="text-[9px] text-muted-foreground">100%</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. MINI BAR CHART
// ═══════════════════════════════════════════════════════════════════════════════

const MINI_BAR_COLORS = ['#008751', '#E53935', '#1E88E5', '#FDD835', '#8E24AA', '#FF6F00', '#00ACC1', '#43A047'];

export interface MiniBarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  maxItems?: number;
}

export function MiniBarChart({ data, maxItems = 5 }: MiniBarChartProps) {
  const items = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.value - a.value);
    return sorted.slice(0, maxItems);
  }, [data, maxItems]);

  const maxVal = useMemo(
    () => Math.max(...items.map((d) => d.value), 1),
    [items],
  );

  if (items.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">No data</div>
    );
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => {
        const pct = (item.value / maxVal) * 100;
        const barColor = item.color || MINI_BAR_COLORS[i % MINI_BAR_COLORS.length];
        return (
          <div key={item.label} className="group">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] text-foreground truncate max-w-[60%]">
                {item.label}
              </span>
              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                {item.value.toLocaleString()}
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
              <m.div
                className="h-full rounded-full"
                style={{ backgroundColor: barColor }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. STATUS INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

export interface StatusIndicatorProps {
  status: 'online' | 'warning' | 'critical' | 'offline';
  label: string;
  count?: number;
}

const STATUS_CONFIG = {
  online: {
    dotColor: 'bg-emerald',
    textColor: 'text-emerald',
    glowColor: 'shadow-emerald/40',
    label: 'Active',
  },
  warning: {
    dotColor: 'bg-amber',
    textColor: 'text-amber',
    glowColor: 'shadow-amber/40',
    label: 'Warning',
  },
  critical: {
    dotColor: 'bg-rose',
    textColor: 'text-rose',
    glowColor: 'shadow-rose/40',
    label: 'Critical',
  },
  offline: {
    dotColor: 'bg-muted-foreground',
    textColor: 'text-muted-foreground',
    glowColor: '',
    label: 'Offline',
  },
};

export function StatusIndicator({ status, label, count }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const isAnimated = status === 'online' || status === 'critical';

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        {/* Pulse ring for animated states */}
        {isAnimated && (
          <m.span
            className={cn(
              'absolute inset-0 rounded-full shadow-lg',
              config.dotColor,
              config.glowColor,
            )}
            animate={{
              scale: [1, 2.2, 1],
              opacity: [0.6, 0, 0.6],
            }}
            transition={{
              duration: status === 'critical' ? 1.2 : 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
        {/* Main dot */}
        <m.span
          className={cn(
            'relative block h-2.5 w-2.5 rounded-full',
            config.dotColor,
          )}
          animate={
            isAnimated
              ? { scale: [1, 1.15, 1] }
              : {}
          }
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
      <span className={cn('text-xs font-medium', config.textColor)}>{label}</span>
      {count !== undefined && (
        <span className="text-[11px] tabular-nums text-muted-foreground font-medium">
          {count.toLocaleString()}
        </span>
      )}
    </div>
  );
}
