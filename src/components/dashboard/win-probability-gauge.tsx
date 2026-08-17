'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useDashboardStore } from '@/store/dashboard';
import { fetchJson } from '@/lib/api';
import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Trophy,
  Loader2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Constants ──────────────────────────────────────────────────────────────

const PARTY_COLORS: Record<string, string> = {
  APC: '#00A651',
  PDP: '#E21A2B',
  LP: '#008751',
  NNPP: '#FF6B00',
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface PartyProbability {
  party: string;
  probability: number;
  trend: 'up' | 'down' | 'stable';
}

interface KeyFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

interface WinProbabilityData {
  winProbability: number;
  confidence: number;
  projectedWinner: string;
  partyProbabilities: PartyProbability[];
  keyFactors: KeyFactor[];
  lastUpdated: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function gaugeColor(prob: number): string {
  if (prob > 50) return '#10b981'; // emerald
  if (prob >= 30) return '#f59e0b'; // amber
  return '#f43f5e'; // rose
}

function gaugeColorClass(prob: number): string {
  if (prob > 50) return 'text-emerald';
  if (prob >= 30) return 'text-amber';
  return 'text-rose';
}

function impactStyle(impact: string) {
  switch (impact) {
    case 'positive': return 'bg-emerald/10 text-emerald border-emerald/20';
    case 'negative': return 'bg-rose/10 text-rose border-rose/20';
    default: return 'bg-cyan/10 text-cyan border-cyan/20';
  }
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-emerald" aria-label="Trending up" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-rose" aria-label="Trending down" />;
  return <Minus className="h-3 w-3 text-muted-foreground" aria-label="Stable" />;
}

function relativeTime(date: string | Date) {
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

// ─── Animated Number ───────────────────────────────────────────────────────

function AnimatedNumber({ value, decimals = 1, duration = 0.8 }: { value: number; decimals?: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const spring = useSpring(0, { duration: duration * 1000 });
  const rounded = useTransform(spring, (v) => parseFloat(v.toFixed(decimals)));

  useEffect(() => {
    spring.set(value);
    const unsubscribe = rounded.on('change', (v) => setDisplay(v));
    return () => unsubscribe();
  }, [value, spring, rounded]);

  return <>{display}</>;
}

// ─── SVG Ring Gauge ─────────────────────────────────────────────────────────

function RingGauge({ probability }: { probability: number }) {
  const size = 100;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const pct = Math.min(Math.max(probability, 0) / 100, 1);
  const offset = circumference - pct * circumference;
  const color = gaugeColor(probability);

  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" aria-hidden="true">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-muted/30"
        strokeWidth={strokeWidth}
      />
      {/* Progress */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </svg>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function WinProbabilityGauge() {
  const tenantId = useDashboardStore((s) => s.tenantId);

  const { data, isLoading, error } = useQuery<WinProbabilityData>({
    queryKey: ['win-probability', tenantId],
    queryFn: () => fetchJson<WinProbabilityData>(`/api/win-probability?tenantId=${tenantId}`),
    refetchInterval: 30000,
    enabled: !!tenantId,
  });

  const winProb = data?.winProbability ?? 0;
  const confidence = data?.confidence ?? 0;
  const projectedWinner = data?.projectedWinner ?? '';
  const parties = data?.partyProbabilities ?? [];
  const factors = data?.keyFactors ?? [];
  const lastUpdated = data?.lastUpdated ?? '';

  const winnerTrend = useMemo(
    () => parties.find((p) => p.party === projectedWinner)?.trend ?? 'stable',
    [parties, projectedWinner],
  );

  // ── Loading state
  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border border-border">
        <CardContent className="p-4 h-[180px] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // ── Error state
  if (error || !data) {
    return null;
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border border-border overflow-hidden">
      <CardContent className="p-4">
        {/* Top row: Ring + Info */}
        <div className="flex gap-4">
          {/* Left — Ring Gauge */}
          <div className="relative shrink-0">
            <RingGauge probability={winProb} />
            <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
              <span
                className={cn(
                  'text-xl font-bold tabular-nums leading-none',
                  gaugeColorClass(winProb),
                )}
              >
                <AnimatedNumber value={winProb} />
                <span className="text-[10px] font-semibold">%</span>
              </span>
              <span className="text-[9px] font-semibold text-muted-foreground tracking-wider mt-0.5">
                WIN
              </span>
            </div>
          </div>

          {/* Right — Stacked Info */}
          <div className="flex flex-col justify-between min-w-0 flex-1 py-0.5">
            {/* Projected Winner */}
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber shrink-0" aria-hidden="true" />
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: PARTY_COLORS[projectedWinner] || '#888' }}
              />
              <span className="text-sm font-semibold truncate">
                {projectedWinner}
              </span>
              <TrendIcon trend={winnerTrend} />
            </div>

            {/* Confidence meter */}
            <div className="flex items-center gap-2 mt-1.5">
              <Shield className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
              <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-cyan"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(confidence, 100)}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums font-medium">
                {Math.round(confidence)}%
              </span>
            </div>

            {/* Mini party bars */}
            <div className="flex flex-col gap-1 mt-1.5">
              {parties.map((p) => (
                <div key={p.party} className="flex items-center gap-1.5">
                  <span className="text-[9px] font-medium text-muted-foreground w-7 text-right shrink-0">
                    {p.party}
                  </span>
                  <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: PARTY_COLORS[p.party] || '#888' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(p.probability, 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                    />
                  </div>
                  <span className="text-[9px] tabular-nums text-muted-foreground w-7 shrink-0">
                    {p.probability.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Last updated */}
        {lastUpdated && (
          <div className="flex items-center gap-1 mt-2.5 text-[10px] text-muted-foreground/50">
            <Clock className="h-2.5 w-2.5" aria-hidden="true" />
            <span>Updated {relativeTime(lastUpdated)}</span>
          </div>
        )}

        {/* Key factor pills — scrollable row */}
        {factors.length > 0 && (
          <ScrollArea className="mt-2.5 w-full" type="scroll">
            <div className="flex gap-1.5 pb-1">
              {factors.map((f, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className={cn(
                    'text-[9px] font-medium whitespace-nowrap border shrink-0 py-0 px-1.5',
                    impactStyle(f.impact),
                  )}
                  title={f.description}
                >
                  {f.factor}
                </Badge>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
