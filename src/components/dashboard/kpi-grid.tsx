'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Users, AlertTriangle, Vote, Shield, ShieldCheck, Radio, ShieldAlert,
  BarChart3, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { m, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';

// ── Mini Sparkline SVG ──
function MiniSparkline({ data, color, width = 60, height = 24 }: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 1;
  const w = width;
  const h = height;
  const stepX = (w - pad * 2) / (data.length - 1);

  // Map data points to SVG coordinates
  const points = data.map((v, i) => ({
    x: pad + i * stepX,
    y: pad + (1 - (v - min) / range) * (h - pad * 2),
  }));

  // Build smooth path using catmull-rom style: use quadratic bezier through midpoints
  let linePath = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const cp1x = (points[i].x + points[i + 1].x) / 2;
    const cp1y = points[i].y;
    const cp2x = cp1x;
    const cp2y = points[i + 1].y;
    linePath += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${points[i + 1].x},${points[i + 1].y}`;
  }

  // Area fill path (same line + close to bottom)
  const areaPath = `${linePath} L ${points[points.length - 1].x},${h} L ${points[0].x},${h} Z`;

  // Color for gradient stops — use the raw CSS variable name
  const gradId = `spark-${color}-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className="shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`var(--color-${color})`} stopOpacity="0.3" />
          <stop offset="100%" stopColor={`var(--color-${color})`} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Gradient fill under line */}
      <path d={areaPath} fill={`url(#${gradId})`} />
      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={`var(--color-${color})`}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
      {/* End dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={2}
        fill={`var(--color-${color})`}
        opacity={0.9}
      />
    </svg>
  );
}

// ── Synthetic trend data generators (12 data points) ──
function generateSparkData(current: number, mode: 'stable' | 'walk' | 'rising' | 'volatile'): number[] {
  const points = 12;
  const result: number[] = [];

  // Deterministic seed based on current value for consistency across renders
  const seed = current * 17 + 3;
  const pseudoRandom = (i: number) => {
    const x = Math.sin(seed + i * 9301 + 49297) * 49297;
    return x - Math.floor(x);
  };

  switch (mode) {
    case 'stable': {
      // Small fluctuations around the current value
      for (let i = 0; i < points; i++) {
        const noise = (pseudoRandom(i) - 0.5) * current * 0.06;
        result.push(Math.max(0, Math.round(current + noise)));
      }
      result[points - 1] = current; // Last point matches actual
      break;
    }
    case 'walk': {
      // Random walk trending up to current
      let val = current * 0.7;
      for (let i = 0; i < points; i++) {
        val += (pseudoRandom(i) - 0.4) * current * 0.05;
        val = Math.max(0, val);
        result.push(Math.round(val));
      }
      result[points - 1] = current;
      break;
    }
    case 'rising': {
      // Generally increasing trend ending at current
      for (let i = 0; i < points; i++) {
        const base = (current * 0.4) + (current * 0.6) * (i / (points - 1));
        const noise = (pseudoRandom(i) - 0.5) * current * 0.03;
        result.push(Math.max(0, Math.round(base + noise)));
      }
      result[points - 1] = current;
      break;
    }
    case 'volatile': {
      // Bigger swings, spiky
      let val = current * 0.8;
      for (let i = 0; i < points; i++) {
        val += (pseudoRandom(i) - 0.45) * current * 0.12;
        val = Math.max(0, val);
        result.push(Math.round(val));
      }
      result[points - 1] = current;
      break;
    }
  }

  return result;
}

// ── Animated Number Counter ──
function AnimatedNumber({ value, duration = 0.8 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const spring = useSpring(0, { duration: duration * 1000 });
  const rounded = useTransform(spring, (v) => Math.round(v));

  useEffect(() => {
    spring.set(value);
    const unsubscribe = rounded.on('change', (v) => setDisplay(v));
    return () => unsubscribe();
  }, [value, spring, rounded]);

  return <>{display.toLocaleString()}</>;
}

// ── Progress Ring ──
function ProgressRing({ value, max, size = 40, strokeWidth = 3, color = 'emerald' }: {
  value: number; max: number; size?: number; strokeWidth?: number; color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference - pct * circumference;

  const colorMap: Record<string, string> = {
    emerald: 'stroke-emerald', amber: 'stroke-amber', rose: 'stroke-rose', cyan: 'stroke-cyan',
  };
  const trackColor = 'stroke-secondary';

  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" className={trackColor} strokeWidth={strokeWidth} />
      <m.circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        className={colorMap[color] || 'stroke-emerald'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  );
}

// ── Trend Indicator ──
function TrendIndicator({ trend }: { trend?: { value: number; up: boolean } }) {
  if (!trend) return null;
  return (
    <div className="flex items-center gap-0.5 mt-0.5">
      {trend.up ? (
        <TrendingUp className="h-3 w-3 text-emerald" />
      ) : trend.value < 0 ? (
        <TrendingDown className="h-3 w-3 text-rose" />
      ) : (
        <Minus className="h-3 w-3 text-muted-foreground" />
      )}
      <span className={cn(
        'text-[11px] font-medium tabular-nums',
        trend.up ? 'text-emerald' : trend.value < 0 ? 'text-rose' : 'text-muted-foreground'
      )}>
        {trend.up ? '+' : ''}{trend.value}%
      </span>
    </div>
  );
}

// ── Main KPI Card ──
interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet';
  trend?: { value: number; up: boolean };
  glow?: boolean;
  ring?: { value: number; max: number };
  sparkline?: 'stable' | 'walk' | 'rising' | 'volatile';
  className?: string;
  onClick?: () => void;
}

const COLOR_MAP = {
  emerald: { bg: 'bg-emerald/10', text: 'text-emerald', border: 'border-emerald/20', glow: 'glow-emerald', ring: 'ring-emerald/20' },
  amber: { bg: 'bg-amber/10', text: 'text-amber', border: 'border-amber/20', glow: 'glow-amber', ring: 'ring-amber/20' },
  rose: { bg: 'bg-rose/10', text: 'text-rose', border: 'border-rose/20', glow: 'glow-rose', ring: 'ring-rose/20' },
  cyan: { bg: 'bg-cyan/10', text: 'text-cyan', border: 'border-cyan/20', glow: 'glow-cyan', ring: 'ring-cyan/20' },
  violet: { bg: 'bg-violet/10', text: 'text-violet', border: 'border-violet/20', glow: 'glow-violet', ring: 'ring-violet/20' },
};

const KpiCard = React.memo(function KpiCard({ label, value, sub, icon, color, trend, glow, ring, sparkline, className, onClick }: KpiCardProps) {
  const c = COLOR_MAP[color];
  const isNumeric = typeof value === 'number';

  const sparkData = useMemo(() => {
    if (!sparkline || !isNumeric) return undefined;
    return generateSparkData(value as number, sparkline);
  }, [sparkline, isNumeric, value]);

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <Card className={cn(
        'border bg-card/50 backdrop-blur-sm transition-all duration-200 card-lift',
        c.border, glow && c.glow,
        onClick && 'cursor-pointer hover:border-foreground/20'
      )} onClick={onClick}>
        <CardContent className="p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{label}</p>
              <p className={cn('text-xl sm:text-2xl font-bold tabular-nums leading-tight', c.text)}>
                {isNumeric ? <AnimatedNumber value={value} /> : value}
              </p>
              {sub && <p className="text-[10px] text-muted-foreground/50 leading-tight">{sub}</p>}
              <TrendIndicator trend={trend} />
            </div>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              {ring && (
                <div className="relative">
                  <ProgressRing value={ring.value} max={ring.max} color={color} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn('text-[9px] font-bold tabular-nums', c.text)}>
                      {ring.max > 0 ? Math.round((ring.value / ring.max) * 100) : 0}%
                    </span>
                  </div>
                </div>
              )}
              <div className={cn('p-2 rounded-lg', c.bg)}>
                {icon && <span aria-hidden="true">{icon}</span>}
              </div>
            </div>
          </div>
          {/* Sparkline below the main content */}
          {sparkData && (
            <div className="mt-2 flex justify-end">
              <MiniSparkline data={sparkData} color={color} />
            </div>
          )}
        </CardContent>
      </Card>
    </m.div>
  );
});

// ── Extra stat chip ──
interface ExtraStat {
  label: string;
  value: number;
  color: 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet';
  icon?: React.ReactNode;
}

const EXTRA_ICONS: Record<string, React.ReactNode> = {
  rose: <ShieldAlert className="h-3.5 w-3.5 text-rose" />,
  emerald: <ShieldCheck className="h-3.5 w-3.5 text-emerald" />,
  cyan: <BarChart3 className="h-3.5 w-3.5 text-cyan" />,
  amber: <AlertTriangle className="h-3.5 w-3.5 text-amber" />,
  violet: <Shield className="h-3.5 w-3.5 text-violet" />,
};

const StatChip = React.memo(function StatChip({ s }: { s: ExtraStat }) {
  const c = COLOR_MAP[s.color];
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg border bg-card/40 px-3 py-2 transition-all duration-200 hover:bg-card/60 card-lift',
      c.border
    )}>
      <div className={cn('p-1.5 rounded-md shrink-0', c.bg)}>
        {s.icon || EXTRA_ICONS[s.color]}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[10px] text-muted-foreground/60 block leading-tight">{s.label}</span>
        <span className={cn('text-sm font-bold tabular-nums block leading-tight', c.text)}>
          <AnimatedNumber value={s.value} duration={0.6} />
        </span>
      </div>
    </div>
  );
});

// ── KPI Grid Props ──
interface KpiGridProps {
  data: {
    totalAgents: number;
    onlineAgents: number;
    totalIncidents: number;
    pendingIncidents: number;
    criticalIncidents: number;
    quarantinedIncidents: number;
    securityAlerts: number;
    operationalAlerts: number;
    unreadAlerts: number;
    sosCount: number;
  };
  election: {
    totalPollingUnits: number;
    openUnits: number;
    avgTurnout: number;
    totalRegistered: number;
    totalVotes: number;
  };
  trends?: {
    onlineAgents?: { value: number; up: boolean };
    incidents?: { value: number; up: boolean };
    turnout?: { value: number; up: boolean };
  };
  extraStats?: ExtraStat[];
}

export function KpiGrid({ data, election, trends, extraStats }: KpiGridProps) {
  return (
    <div className="space-y-3">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <KpiCard
          label="Agents Online"
          value={data.onlineAgents}
          sub={`${data.totalAgents.toLocaleString()} total`}
          icon={<Users className="h-4.5 w-4.5 text-emerald" />}
          color="emerald"
          trend={trends?.onlineAgents}
          ring={{ value: data.onlineAgents, max: data.totalAgents }}
          sparkline="stable"
          className="xl:col-span-1"
        />
        <KpiCard
          label="Polling Units"
          value={election.totalPollingUnits}
          sub={`${election.openUnits} open`}
          icon={<BarChart3 className="h-4.5 w-4.5 text-cyan" />}
          color="cyan"
          ring={{ value: election.openUnits, max: election.totalPollingUnits }}
          sparkline="rising"
          className="xl:col-span-1"
        />
        <KpiCard
          label="Avg Turnout"
          value={`${election.avgTurnout}%`}
          sub={`${(election.totalVotes / 1000).toFixed(1)}K of ${(election.totalRegistered / 1000).toFixed(1)}K`}
          icon={<Vote className="h-4.5 w-4.5 text-emerald" />}
          color="emerald"
          trend={trends?.turnout}
          sparkline="rising"
          className="xl:col-span-1"
        />
        <KpiCard
          label="Total Incidents"
          value={data.totalIncidents}
          sub={`${data.pendingIncidents} pending review`}
          icon={<AlertTriangle className="h-4.5 w-4.5 text-amber" />}
          color="amber"
          trend={trends?.incidents}
          sparkline="walk"
          className="xl:col-span-1"
        />
        <KpiCard
          label="Critical / SOS"
          value={data.criticalIncidents}
          sub={`${data.sosCount} SOS pings active`}
          icon={<Radio className="h-4.5 w-4.5 text-rose" />}
          color="rose"
          glow
          sparkline="volatile"
          className="xl:col-span-1"
        />
        <KpiCard
          label="Quarantined"
          value={data.quarantinedIncidents}
          sub="AI-flagged, pending T&S review"
          icon={<Shield className="h-4.5 w-4.5 text-violet" />}
          color="violet"
          sparkline="walk"
          className="xl:col-span-1"
        />
      </div>

      {/* Extra stats row */}
      {extraStats && extraStats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {extraStats.map((s) => (
            <StatChip key={s.label} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
