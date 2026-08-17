'use client';

import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { useDashboardStore } from '@/store/dashboard';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Activity,
  BarChart3,
  Loader2,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  Info,
  Route,
  Landmark,
  Handshake,
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PartyResult {
  party: string;
  votes: number;
  percentage: number;
  states: number;
  trend: 'up' | 'down' | 'stable';
}

interface SwingState {
  name: string;
  leadingParty: string;
  leadingPartyColor: string;
  margin: number;
  totalVotes: number;
  status: 'SAFE' | 'LEANING' | 'TIGHT RACE';
}

interface VictoryProjection {
  projectedWinner: string;
  confidence: number;
  secured: number;
  contested: number;
  leaningOpposition: number;
}

interface StateBreakdownEntry {
  name: string;
  leadingParty: string;
  leadingPartyColor: string;
  margin: number;
  totalVotes: number;
  status: 'SAFE' | 'LEANING' | 'TIGHT RACE' | 'LOST';
  partyVotes: Array<{ party: string; votes: number; percentage: number }>;
}

interface CoalitionScenario {
  parties: string[];
  combinedPercentage: number;
  wouldLead: boolean;
  leaderParty: string;
  leaderPercentage: number;
}

// Raw API shapes
interface RawResult {
  id: string;
  partyResults: Array<{ party: string; votes: number }>;
  pollingUnit: { state: string; lga: string; totalVotes: number };
  totalVotesCast: number;
}

interface RawPvtSubmission {
  id: string;
  partyResults: Array<{ party: string; votes: number }>;
  pollingUnit: { state: string; lga: string };
  isVerified: boolean;
  totalVotesCast: number;
}

interface OsintData {
  posts: Array<{ sentiment: string }>;
  counts: {
    total: number;
    bySentiment: Record<string, number>;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const PARTY_COLORS: Record<string, string> = {
  APC: '#008751',
  PDP: '#CE1126',
  LP: '#2196F3',
  NNPP: '#FF9800',
};

const PARTY_COLOR_MAPPINGS: Record<string, string> = {
  APC: '#008751',
  PDP: '#CE1126',
  LP: '#2196F3',
  NNPP: '#FF9800',
  SDP: '#9C27B0',
  ADC: '#FF5722',
  YPP: '#4CAF50',
  APP: '#00BCD4',
};

const DEFAULT_PARTY_COLOR = '#607D8B';

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'oklch(0.18 0.006 260)',
    border: '1px solid oklch(0.28 0.01 260)',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: 'oklch(0.9 0 0)' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TREND ARROW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') {
    return <TrendingUp className="h-3.5 w-3.5 text-emerald shrink-0" />;
  }
  if (trend === 'down') {
    return <TrendingDown className="h-3.5 w-3.5 text-rose shrink-0" />;
  }
  return <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// A. ANIMATED VICTORY GAUGE (SVG semicircle)
// ═══════════════════════════════════════════════════════════════════════════════

function VictoryGauge({ confidence, color }: { confidence: number; color: string }) {
  const radius = 54;
  const strokeWidth = 8;
  const center = 60;
  // Semicircle: from -180° to 0° (bottom half), or 0° to 180° (top half)
  // We'll use top half semicircle
  const circumference = Math.PI * radius; // half circle
  const offset = circumference * (1 - confidence / 100);

  return (
    <div className="relative w-[120px] h-[70px] shrink-0">
      {/* Glow effect behind the gauge */}
      <div
        className="absolute inset-0 blur-xl opacity-25 rounded-full"
        style={{ backgroundColor: color }}
      />
      <svg
        viewBox="0 0 120 70"
        className="relative w-full h-full overflow-visible"
      >
        {/* Background arc */}
        <path
          d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
          fill="none"
          stroke="oklch(0.25 0.005 260)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Animated foreground arc */}
        <motion.path
          d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      {/* Center percentage */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
        style={{ top: '55%' }}
      >
        <motion.span
          className="text-2xl font-black tabular-nums leading-none"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          {confidence}
          <span className="text-xs font-semibold opacity-70">%</span>
        </motion.span>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. VICTORY PROJECTION PANEL (Enhanced with gauge)
// ═══════════════════════════════════════════════════════════════════════════════

function VictoryProjectionCard({ projection, partyResults }: {
  projection: VictoryProjection;
  partyResults: PartyResult[];
}) {
  const winnerColor = PARTY_COLOR_MAPPINGS[projection.projectedWinner] || DEFAULT_PARTY_COLOR;
  const runnerUp = partyResults.length > 1 ? partyResults[1] : null;
  const gap = runnerUp ? (projection.confidence - (100 - projection.confidence)) : projection.confidence;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-emerald/10">
                <Trophy className="h-4 w-4 text-emerald" />
              </div>
              <CardTitle className="text-sm font-semibold">Victory Projection</CardTitle>
            </div>
            <Badge className="bg-emerald/15 text-emerald border-emerald/30 text-[10px] font-semibold">
              <Sparkles className="h-3 w-3 mr-1" />
              PVT-BASED
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Winner display */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ backgroundColor: winnerColor, boxShadow: `0 0 20px ${winnerColor}30` }}
              >
                {projection.projectedWinner.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Projected Winner</p>
                <p className="text-xl font-bold tabular-nums" style={{ color: winnerColor }}>
                  {projection.projectedWinner}
                </p>
                {runnerUp && (
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                    +{gap.toFixed(1)}pts ahead of {runnerUp.party}
                  </p>
                )}
              </div>
            </div>

            {/* Animated Victory Gauge (replaces linear bar) */}
            <div className="flex flex-col items-center gap-0.5">
              <VictoryGauge confidence={projection.confidence} color={winnerColor} />
              <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-semibold mt-0.5">Win Confidence</span>
            </div>

            {/* State counts */}
            <div className="flex gap-3 sm:gap-4 shrink-0">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald" />
                  <span className="text-lg font-bold tabular-nums text-emerald">{projection.secured}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/50">Secured</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Activity className="h-3 w-3 text-amber" />
                  <span className="text-lg font-bold tabular-nums text-amber">{projection.contested}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/50">Contested</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <ShieldAlert className="h-3 w-3 text-rose" />
                  <span className="text-lg font-bold tabular-nums text-rose">{projection.leaningOpposition}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/50">Leaning Opp.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// B. PATH TO VICTORY PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function PathToVictory({ states, projectedWinner }: {
  states: StateBreakdownEntry[];
  projectedWinner: string;
}) {
  const securedCount = states.filter(s => s.status === 'SAFE' && s.leadingParty === projectedWinner).length;
  const totalCount = states.length;
  const safeStates = states.filter(s => s.status === 'SAFE' && s.leadingParty === projectedWinner);
  const leaningStates = states.filter(s => s.status === 'LEANING' && s.leadingParty === projectedWinner);
  const tightRaceStates = states.filter(s => s.status === 'TIGHT RACE');
  const lostStates = states.filter(s => s.leadingParty !== projectedWinner && s.status === 'SAFE');

  const statusColorMap: Record<string, { bg: string; border: string; text: string }> = {
    'SAFE': { bg: 'bg-emerald/15', border: 'border-emerald/30', text: 'text-emerald' },
    'LEANING': { bg: 'bg-amber/15', border: 'border-amber/30', text: 'text-amber' },
    'TIGHT RACE': { bg: 'bg-rose/15', border: 'border-rose/30', text: 'text-rose' },
    'LOST': { bg: 'bg-rose/10', border: 'border-rose/20', text: 'text-rose/60' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <Card className="border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-amber/10">
                <Route className="h-4 w-4 text-amber" />
              </div>
              <CardTitle className="text-sm font-semibold">Path to Victory</CardTitle>
            </div>
            <Badge className="bg-amber/15 text-amber border-amber/30 text-[10px] font-semibold tabular-nums">
              {securedCount}/{totalCount} secured
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {/* Secured states strip */}
          {(safeStates.length > 0 || leaningStates.length > 0 || tightRaceStates.length > 0 || lostStates.length > 0) && (
            <div className="overflow-x-auto pb-1">
              <div className="flex gap-1.5 min-w-max">
                {/* Safe states */}
                {safeStates.map((s) => {
                  const sc = statusColorMap['SAFE'];
                  return (
                    <motion.div
                      key={s.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold whitespace-nowrap',
                        sc.bg, sc.border, sc.text
                      )}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald shrink-0" />
                      {s.name}
                    </motion.div>
                  );
                })}
                {/* Leaning states */}
                {leaningStates.map((s) => {
                  const sc = statusColorMap['LEANING'];
                  return (
                    <motion.div
                      key={s.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2, delay: 0.05 }}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold whitespace-nowrap',
                        sc.bg, sc.border, sc.text
                      )}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-amber shrink-0" />
                      {s.name}
                    </motion.div>
                  );
                })}
                {/* Tight race states */}
                {tightRaceStates.map((s) => {
                  const sc = statusColorMap['TIGHT RACE'];
                  return (
                    <motion.div
                      key={s.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2, delay: 0.1 }}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold whitespace-nowrap',
                        sc.bg, sc.border, sc.text
                      )}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-rose shrink-0" />
                      {s.name}
                    </motion.div>
                  );
                })}
                {/* Lost states */}
                {lostStates.map((s) => {
                  const sc = statusColorMap['LOST'];
                  return (
                    <motion.div
                      key={s.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2, delay: 0.15 }}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold whitespace-nowrap',
                        sc.bg, sc.border, sc.text
                      )}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-rose/50 shrink-0" />
                      {s.name}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Legend row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald" />
              <span className="text-[9px] text-muted-foreground/50">Safe</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber" />
              <span className="text-[9px] text-muted-foreground/50">Leaning</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-rose" />
              <span className="text-[9px] text-muted-foreground/50">Tight Race</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-rose/50" />
              <span className="text-[9px] text-muted-foreground/50">Lost</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PARTY PERFORMANCE LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function PartyLeaderboard({ parties }: { parties: PartyResult[] }) {
  return (
    <Card className="border border-border/60 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-cyan/10">
            <BarChart3 className="h-4 w-4 text-cyan" />
          </div>
          <CardTitle className="text-sm font-semibold">Party Leaderboard</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-1.5">
          <AnimatePresence mode="popLayout">
            {parties.map((party, idx) => {
              const isLeading = idx === 0;
              const partyColor = PARTY_COLOR_MAPPINGS[party.party] || DEFAULT_PARTY_COLOR;
              return (
                <motion.div
                  key={party.party}
                  layoutId={`party-${party.party}`}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.35, delay: idx * 0.06 }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-200',
                    isLeading
                      ? 'bg-emerald/5 border border-emerald/20'
                      : 'hover:bg-secondary/40',
                  )}
                >
                  {/* Rank */}
                  <span className={cn(
                    'w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0',
                    isLeading
                      ? 'bg-emerald/15 text-emerald'
                      : idx === 1
                        ? 'bg-amber/15 text-amber'
                        : idx === 2
                          ? 'bg-rose/15 text-rose'
                          : 'bg-secondary text-muted-foreground',
                  )}>
                    {idx + 1}
                  </span>

                  {/* Party color dot + code */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: partyColor }}
                    />
                    <span className="text-xs font-semibold truncate">{party.party}</span>
                    {isLeading && (
                      <Badge className="bg-emerald/15 text-emerald border-emerald/30 text-[9px] px-1.5 py-0 h-4 font-bold">
                        LEADING
                      </Badge>
                    )}
                  </div>

                  {/* Trend */}
                  <TrendArrow trend={party.trend} />

                  {/* States */}
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0 hidden sm:block">
                    {party.states} states
                  </span>

                  {/* Percentage */}
                  <span
                    className="text-xs font-bold tabular-nums shrink-0 w-10 text-right"
                    style={{ color: isLeading ? partyColor : undefined }}
                  >
                    {party.percentage.toFixed(1)}%
                  </span>

                  {/* Votes */}
                  <span className="text-[11px] text-muted-foreground/60 tabular-nums shrink-0 w-16 text-right hidden md:block">
                    {party.votes.toLocaleString()}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// D. COALITION MATH INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

function CoalitionMath({ parties }: { parties: PartyResult[] }) {
  const scenarios = useMemo(() => {
    if (parties.length < 3) return [];

    const leader = parties[0];
    const coalitionCombos: CoalitionScenario[] = [];

    // Check 2nd + 3rd
    if (parties.length >= 3) {
      const combined = parties[1].percentage + parties[2].percentage;
      coalitionCombos.push({
        parties: [parties[1].party, parties[2].party],
        combinedPercentage: combined,
        wouldLead: combined > leader.percentage,
        leaderParty: leader.party,
        leaderPercentage: leader.percentage,
      });
    }

    // Check 2nd + 4th
    if (parties.length >= 4) {
      const combined = parties[1].percentage + parties[3].percentage;
      if (combined > leader.percentage) {
        coalitionCombos.push({
          parties: [parties[1].party, parties[3].party],
          combinedPercentage: combined,
          wouldLead: true,
          leaderParty: leader.party,
          leaderPercentage: leader.percentage,
        });
      }
    }

    // Check 3rd + 4th
    if (parties.length >= 4 && coalitionCombos.length < 2) {
      const combined = parties[2].percentage + parties[3].percentage;
      if (combined > leader.percentage) {
        coalitionCombos.push({
          parties: [parties[2].party, parties[3].party],
          combinedPercentage: combined,
          wouldLead: true,
          leaderParty: leader.party,
          leaderPercentage: leader.percentage,
        });
      }
    }

    return coalitionCombos.slice(0, 2);
  }, [parties]);

  if (scenarios.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-lg border border-cyan/20 bg-cyan/5 px-3 py-2.5"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Handshake className="h-3.5 w-3.5 text-cyan" />
        <span className="text-[11px] font-semibold text-cyan">Coalition Scenarios</span>
      </div>
      <div className="space-y-1">
        {scenarios.map((sc, idx) => (
          <div key={idx} className="flex items-start gap-1.5">
            <Info className="h-3 w-3 text-cyan/60 shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              <span className="font-semibold text-cyan/90">
                {sc.parties.join(' + ')} coalition
              </span>
              {' would have '}
              <span className="font-bold tabular-nums text-cyan">
                {sc.combinedPercentage.toFixed(1)}%
              </span>
              {sc.wouldLead ? (
                <span className="text-emerald font-semibold">
                  {' '}— beating {sc.leaderParty} ({sc.leaderPercentage.toFixed(1)}%)
                </span>
              ) : (
                <span className="text-muted-foreground/50">
                  {' '}— short of {sc.leaderParty} ({sc.leaderPercentage.toFixed(1)}%)
                </span>
              )}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. MINI RESULTS CHART (Horizontal Bar)
// ═══════════════════════════════════════════════════════════════════════════════

function MiniResultsChart({ data }: { data: Array<{ name: string; value: number; fill: string }> }) {
  return (
    <Card className="border border-border/60 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-amber/10">
            <BarChart3 className="h-4 w-4 text-amber" />
          </div>
          <CardTitle className="text-sm font-semibold">Vote Distribution</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
              barCategoryGap="20%"
            >
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fontWeight: 600, fill: 'oklch(0.85 0 0)' }}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                cursor={{ fill: 'oklch(0.22 0.008 260 / 0.4)' }}
              />
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                animationDuration={1200}
                animationEasing="ease-out"
              >
                {data.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-3 mt-2">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
              <span className="text-[10px] text-muted-foreground/60">{d.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. KEY SWING STATE INDICATORS
// ═══════════════════════════════════════════════════════════════════════════════

function SwingStateCard({ state }: { state: SwingState }) {
  const statusConfig: Record<string, { color: string; bg: string; border: string }> = {
    'SAFE': { color: 'text-emerald', bg: 'bg-emerald/15', border: 'border-emerald/30' },
    'LEANING': { color: 'text-amber', bg: 'bg-amber/15', border: 'border-amber/30' },
    'TIGHT RACE': { color: 'text-rose', bg: 'bg-rose/15', border: 'border-rose/30' },
  };
  const sc = statusConfig[state.status] || statusConfig['LEANING'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border/60 bg-card/40 backdrop-blur-sm p-3 card-lift"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-muted-foreground/40" />
          <span className="text-xs font-semibold truncate">{state.name}</span>
        </div>
        <Badge className={cn('text-[9px] px-1.5 py-0 h-4 font-bold', sc.bg, sc.color, sc.border)}>
          {state.status}
        </Badge>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: state.leadingPartyColor }}
          />
          <span className="text-[11px] font-semibold" style={{ color: state.leadingPartyColor }}>
            {state.leadingParty}
          </span>
        </div>
        <span className={cn('text-[11px] font-bold tabular-nums', sc.color)}>
          +{state.margin.toFixed(1)}%
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground/40 mt-1 tabular-nums">
        {state.totalVotes.toLocaleString()} votes counted
      </p>
    </motion.div>
  );
}

function SwingStatesGrid({ states }: { states: SwingState[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-md bg-violet/10">
          <MapPin className="h-4 w-4 text-violet" />
        </div>
        <h3 className="text-sm font-semibold">Key Swing States</h3>
        <Badge className="bg-violet/15 text-violet border-violet/30 text-[10px] font-semibold ml-1">
          {states.length} critical
        </Badge>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {states.map((s) => (
          <SwingStateCard key={s.name} state={s} />
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// C. STATE-BY-STATE WINNER BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════════════

function StateBreakdown({ states }: { states: StateBreakdownEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  const filteredStates = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return states;
    return states.filter(s =>
      s.name.toLowerCase().includes(q) || s.leadingParty.toLowerCase().includes(q)
    );
  }, [states, search]);

  const statusColorMap: Record<string, { color: string; bg: string }> = {
    'SAFE': { color: 'text-emerald', bg: 'bg-emerald' },
    'LEANING': { color: 'text-amber', bg: 'bg-amber' },
    'TIGHT RACE': { color: 'text-rose', bg: 'bg-rose' },
    'LOST': { color: 'text-rose/60', bg: 'bg-rose/40' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
    >
      {/* Header — clickable */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center gap-2 w-full group cursor-pointer"
      >
        <div className="p-1.5 rounded-md bg-emerald/10">
          <Landmark className="h-4 w-4 text-emerald" />
        </div>
        <span className="text-sm font-semibold">State Breakdown</span>
        <Badge className="bg-emerald/15 text-emerald border-emerald/30 text-[10px] font-semibold ml-1">
          {states.length} states
        </Badge>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-auto"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground/50" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
          )}
        </motion.div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* Search */}
            <div className="relative mt-3 mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              <input
                type="text"
                placeholder="Search states or parties..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 rounded-md border border-border/60 bg-secondary/30 pl-8 pr-3 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald/40 focus:ring-1 focus:ring-emerald/20 transition-all"
              />
            </div>

            {/* State rows */}
            <div className="max-h-80 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {filteredStates.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 text-center py-6">No matching states</p>
              ) : (
                filteredStates.map((s) => {
                  const sc = statusColorMap[s.status] || statusColorMap['LEANING'];
                  const totalPct = s.partyVotes.reduce((sum, pv) => sum + pv.percentage, 0);
                  return (
                    <motion.div
                      key={s.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/30 px-3 py-2 hover:bg-secondary/30 transition-colors"
                    >
                      {/* State name */}
                      <span className="text-xs font-semibold min-w-[80px] sm:min-w-[100px] truncate">{s.name}</span>

                      {/* Leading party with color dot */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.leadingPartyColor }} />
                        <span className="text-[11px] font-bold" style={{ color: s.leadingPartyColor }}>{s.leadingParty}</span>
                      </div>

                      {/* Inline vote split bar */}
                      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden min-w-[60px] hidden sm:block">
                        <div className="flex h-full">
                          {s.partyVotes.slice(0, 3).map((pv) => (
                            <div
                              key={pv.party}
                              className="h-full"
                              style={{
                                width: `${totalPct > 0 ? (pv.percentage / totalPct) * 100 : 0}%`,
                                backgroundColor: PARTY_COLOR_MAPPINGS[pv.party] || DEFAULT_PARTY_COLOR,
                                opacity: 0.7,
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Margin */}
                      <span className={cn('text-[10px] font-bold tabular-nums shrink-0', sc.color)}>
                        +{s.margin.toFixed(1)}%
                      </span>

                      {/* Status */}
                      <Badge className={cn(
                        'text-[8px] px-1.5 py-0 h-3.5 font-bold shrink-0 hidden md:inline-flex',
                        sc.color,
                        s.status === 'SAFE' ? 'bg-emerald/15' :
                        s.status === 'LEANING' ? 'bg-amber/15' :
                        s.status === 'TIGHT RACE' ? 'bg-rose/15' : 'bg-rose/10'
                      )}>
                        {s.status}
                      </Badge>

                      {/* Total votes */}
                      <span className="text-[10px] text-muted-foreground/40 tabular-nums shrink-0 hidden lg:block">
                        {s.totalVotes.toLocaleString()}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </div>

            {filteredStates.length !== states.length && (
              <p className="text-[10px] text-muted-foreground/40 mt-1.5 text-center">
                Showing {filteredStates.length} of {states.length} states
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SENTIMENT PULSE
// ═══════════════════════════════════════════════════════════════════════════════

function SentimentPulse({ sentiment }: {
  sentiment: { positive: number; negative: number; neutral: number };
}) {
  const chips = [
    {
      label: 'Positive Sentiment',
      value: sentiment.positive,
      color: 'text-emerald',
      bg: 'bg-emerald/10',
      border: 'border-emerald/20',
      trend: 'up' as const,
    },
    {
      label: 'Negative Sentiment',
      value: sentiment.negative,
      color: 'text-rose',
      bg: 'bg-rose/10',
      border: 'border-rose/20',
      trend: 'down' as const,
    },
    {
      label: 'Neutral',
      value: sentiment.neutral,
      color: 'text-muted-foreground',
      bg: 'bg-secondary',
      border: 'border-border/60',
      trend: 'stable' as const,
    },
  ];

  return (
    <div className="space-y-2">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="flex items-center gap-2"
      >
        <div className="p-1.5 rounded-md bg-cyan/10">
          <Activity className="h-4 w-4 text-cyan" />
        </div>
        <span className="text-sm font-semibold">Sentiment Pulse</span>
      </motion.div>
      <div className="grid grid-cols-3 gap-2">
      {chips.map((chip) => (
        <motion.div
          key={chip.label}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className={cn(
            'flex items-center gap-2 rounded-lg border bg-card/40 px-3 py-2.5 transition-all duration-200 card-lift',
            chip.border,
          )}
        >
          <div className={cn('p-1.5 rounded-md shrink-0', chip.bg)}>
            <TrendArrow trend={chip.trend} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-muted-foreground/50 block leading-tight truncate">
              {chip.label}
            </span>
            <span className={cn('text-sm font-bold tabular-nums block leading-tight', chip.color)}>
              {chip.value}%
            </span>
          </div>
        </motion.div>
      ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

function TrackerSkeleton() {
  return (
    <div className="space-y-4">
      {/* Victory projection skeleton */}
      <div className="rounded-xl border border-border/60 bg-card/50 p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl skeleton" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 skeleton" />
            <div className="h-5 w-16 skeleton" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 skeleton" />
            <div className="h-16 w-32 skeleton rounded-full" />
          </div>
        </div>
      </div>
      {/* Path to victory skeleton */}
      <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-2">
        <div className="h-3 w-28 skeleton" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-6 w-16 skeleton rounded-md shrink-0" />
          ))}
        </div>
      </div>
      {/* Middle grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3 rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
          <div className="h-3 w-32 skeleton" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 skeleton rounded-lg" />
          ))}
        </div>
        <div className="lg:col-span-2 rounded-xl border border-border/60 bg-card/50 p-4">
          <div className="h-3 w-32 skeleton mb-3" />
          <div className="h-40 skeleton rounded-lg" />
        </div>
      </div>
      {/* Coalition math skeleton */}
      <div className="h-16 rounded-lg border skeleton" />
      {/* Swing states skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg skeleton" />
        ))}
      </div>
      {/* State breakdown skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-32 skeleton" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg skeleton" />
        ))}
      </div>
      {/* Sentiment skeleton */}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg skeleton" />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function ElectionTracker() {
  const { tenantId, setSelectedTab } = useDashboardStore();

  // ── Data Fetches ──────────────────────────────────────────────────────────

  const resultsQuery = useQuery({
    queryKey: ['election-tracker-results', tenantId],
    queryFn: () => fetchJson<{ results: RawResult[] }>(`/api/results?tenantId=${tenantId}`),
    refetchInterval: 30_000,
    enabled: !!tenantId,
  });

  const pvtQuery = useQuery({
    queryKey: ['election-tracker-pvt', tenantId],
    queryFn: () => fetchJson<{
      pvtSubmissions: RawPvtSubmission[];
      partyTotals: Array<{ party: string; votes: number }>;
      coverage: { totalPollingUnits: number; pvtCoveredUnits: number; coveragePct: number };
    }>(`/api/pvt?tenantId=${tenantId}`),
    refetchInterval: 45_000,
    enabled: !!tenantId,
  });

  const osintQuery = useQuery({
    queryKey: ['election-tracker-osint', tenantId],
    queryFn: () => fetchJson<OsintData>(`/api/osint?tenantId=${tenantId}&limit=5`),
    refetchInterval: 60_000,
    enabled: !!tenantId,
  });

  // ── Data Processing ──────────────────────────────────────────────────────

  const { partyResults, swingStates, chartData, victoryProjection, sentiment, stateBreakdown, coalitionScenarios } = useMemo(() => {
    const results = resultsQuery.data?.results || [];
    const pvtSubmissions = pvtQuery.data?.pvtSubmissions || [];
    const pvtPartyTotals = pvtQuery.data?.partyTotals || [];
    const osintCounts = osintQuery.data?.counts?.bySentiment || {};
    const osintTotal = osintQuery.data?.counts?.total || 0;

    // ── Aggregate results by party ──────────────────────────────────────
    const partyVotesMap: Record<string, number> = {};
    const partyStatesMap: Record<string, Set<string>> = {};
    const stateTotalsMap: Record<string, { partyVotes: Record<string, number>; total: number }> = {};

    // From official results
    for (const r of results) {
      const state = r.pollingUnit?.state || 'Unknown';
      if (!stateTotalsMap[state]) {
        stateTotalsMap[state] = { partyVotes: {}, total: 0 };
      }
      for (const p of r.partyResults || []) {
        partyVotesMap[p.party] = (partyVotesMap[p.party] || 0) + p.votes;
        stateTotalsMap[state].partyVotes[p.party] = (stateTotalsMap[state].partyVotes[p.party] || 0) + p.votes;
        stateTotalsMap[state].total += p.votes;
        if (!partyStatesMap[p.party]) partyStatesMap[p.party] = new Set();
        if (p.votes > 0) partyStatesMap[p.party].add(state);
      }
    }

    // Merge PVT party totals (supplementary data)
    for (const pt of pvtPartyTotals) {
      partyVotesMap[pt.party] = (partyVotesMap[pt.party] || 0) + pt.votes;
    }

    // Also aggregate from PVT submissions by state
    for (const s of pvtSubmissions) {
      const state = s.pollingUnit?.state || 'Unknown';
      if (!stateTotalsMap[state]) {
        stateTotalsMap[state] = { partyVotes: {}, total: 0 };
      }
      for (const p of s.partyResults || []) {
        stateTotalsMap[state].partyVotes[p.party] = (stateTotalsMap[state].partyVotes[p.party] || 0) + p.votes;
        stateTotalsMap[state].total += p.votes;
        if (!partyStatesMap[p.party]) partyStatesMap[p.party] = new Set();
        if (p.votes > 0) partyStatesMap[p.party].add(state);
      }
    }

    // Build party results
    const totalVotes = Object.values(partyVotesMap).reduce((s, v) => s + v, 0);
    const sortedParties = Object.entries(partyVotesMap)
      .map(([party, votes]) => ({
        party,
        votes,
        percentage: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
        states: partyStatesMap[party]?.size || 0,
        trend: 'stable' as 'up' | 'down' | 'stable',
      }))
      .sort((a, b) => b.votes - a.votes);

    // Assign trends (simulate based on position — in production, compare with previous snapshot)
    if (sortedParties.length > 1) {
      const topPct = sortedParties[0].percentage;
      const secondPct = sortedParties[1].percentage;
      const diff = topPct - secondPct;
      sortedParties[0].trend = diff > 10 ? 'up' : diff > 3 ? 'stable' : 'stable';
      sortedParties[1].trend = diff > 10 ? 'down' : diff > 3 ? 'stable' : 'up';
      for (let i = 2; i < sortedParties.length; i++) {
        sortedParties[i].trend = i < sortedParties.length - 1 ? 'stable' : 'down';
      }
    }

    // ── Victory projection (from PVT data) ──────────────────────────────
    const pvtTotal = pvtPartyTotals.reduce((s, p) => s + p.votes, 0);
    let projectedWinner = 'N/A';
    let confidence = 0;
    if (pvtPartyTotals.length > 0) {
      projectedWinner = pvtPartyTotals[0].party;
      const topVotes = pvtPartyTotals[0].votes;
      const secondVotes = pvtPartyTotals.length > 1 ? pvtPartyTotals[1].votes : 0;
      confidence = pvtTotal > 0 ? Math.min(Math.round((topVotes / pvtTotal) * 100), 99) : 0;
      // Boost confidence if gap is significant
      if (secondVotes > 0) {
        const gap = ((topVotes - secondVotes) / pvtTotal) * 100;
        confidence = Math.min(Math.round(confidence + gap * 0.5), 99);
      }
    } else if (sortedParties.length > 0) {
      projectedWinner = sortedParties[0].party;
      confidence = Math.round(sortedParties[0].percentage);
    }

    // ── Build all states breakdown ──────────────────────────────────────
    const stateBreakdown: StateBreakdownEntry[] = [];
    for (const [state, data] of Object.entries(stateTotalsMap)) {
      if (data.total === 0) continue;
      const sorted = Object.entries(data.partyVotes).sort((a, b) => b[1] - a[1]);
      if (sorted.length < 1) continue;
      const firstParty = sorted[0][0];
      const firstVotes = sorted[0][1];
      const secondVotes = sorted.length > 1 ? sorted[1][1] : 0;
      const margin = data.total > 0 ? ((firstVotes - secondVotes) / data.total) * 100 : 100;

      let status: StateBreakdownEntry['status'] = 'SAFE';
      if (margin < 5) {
        status = 'TIGHT RACE';
      } else if (margin < 15) {
        status = 'LEANING';
      } else {
        status = firstParty === projectedWinner ? 'SAFE' : 'LOST';
      }

      const partyVotes = sorted.map(([party, votes]) => ({
        party,
        votes,
        percentage: data.total > 0 ? (votes / data.total) * 100 : 0,
      }));

      stateBreakdown.push({
        name: state,
        leadingParty: firstParty,
        leadingPartyColor: PARTY_COLOR_MAPPINGS[firstParty] || DEFAULT_PARTY_COLOR,
        margin,
        totalVotes: data.total,
        status,
        partyVotes,
      });
    }
    // Sort states alphabetically for the breakdown
    stateBreakdown.sort((a, b) => a.name.localeCompare(b.name));

    // ── Swing states (top 8 closest races) ───────────────────────────────
    const swingCandidates = [...stateBreakdown]
      .filter(s => s.status !== 'LOST')
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 8)
      .map((s): SwingState => ({
        name: s.name,
        leadingParty: s.leadingParty,
        leadingPartyColor: s.leadingPartyColor,
        margin: s.margin,
        totalVotes: s.totalVotes,
        status: s.status === 'LOST' ? 'TIGHT RACE' : s.status,
      }));

    // ── Chart data (top 4 parties) ──────────────────────────────────────
    const chartData = sortedParties.slice(0, 4).map((p) => ({
      name: p.party,
      value: p.percentage,
      fill: PARTY_COLORS[p.party] || PARTY_COLOR_MAPPINGS[p.party] || DEFAULT_PARTY_COLOR,
    }));

    // Count states by status
    const allStatesStatus = stateBreakdown.map(s => ({
      status: s.status,
      leader: s.leadingParty,
    }));
    const secured = allStatesStatus.filter(s => s.status === 'SAFE' && s.leader === projectedWinner).length;
    const contested = allStatesStatus.filter(s => s.status === 'LEANING').length;
    const leaningOpposition = allStatesStatus.filter(s => s.status === 'TIGHT RACE' || (s.status === 'LEANING' && s.leader !== projectedWinner)).length;

    const victoryProjection: VictoryProjection = {
      projectedWinner,
      confidence,
      secured,
      contested,
      leaningOpposition,
    };

    // ── Coalition scenarios ──────────────────────────────────────────────
    const coalitionScenarios: CoalitionScenario[] = [];
    if (sortedParties.length >= 3) {
      const leader = sortedParties[0];
      // 2nd + 3rd
      const combo1 = sortedParties[1].percentage + sortedParties[2].percentage;
      coalitionScenarios.push({
        parties: [sortedParties[1].party, sortedParties[2].party],
        combinedPercentage: combo1,
        wouldLead: combo1 > leader.percentage,
        leaderParty: leader.party,
        leaderPercentage: leader.percentage,
      });
      // 2nd + 4th
      if (sortedParties.length >= 4) {
        const combo2 = sortedParties[1].percentage + sortedParties[3].percentage;
        if (combo2 > leader.percentage && coalitionScenarios.length < 2) {
          coalitionScenarios.push({
            parties: [sortedParties[1].party, sortedParties[3].party],
            combinedPercentage: combo2,
            wouldLead: true,
            leaderParty: leader.party,
            leaderPercentage: leader.percentage,
          });
        }
      }
      // 3rd + 4th
      if (sortedParties.length >= 4 && coalitionScenarios.length < 2) {
        const combo3 = sortedParties[2].percentage + sortedParties[3].percentage;
        if (combo3 > leader.percentage) {
          coalitionScenarios.push({
            parties: [sortedParties[2].party, sortedParties[3].party],
            combinedPercentage: combo3,
            wouldLead: true,
            leaderParty: leader.party,
            leaderPercentage: leader.percentage,
          });
        }
      }
    }

    // ── Sentiment from OSINT ────────────────────────────────────────────
    const pos = osintCounts['POSITIVE'] || 0;
    const neg = osintCounts['NEGATIVE'] || 0;
    const neu = osintCounts['NEUTRAL'] || 0;
    const sentimentTotal = pos + neg + neu;
    const sentiment = {
      positive: sentimentTotal > 0 ? Math.round((pos / sentimentTotal) * 100) : 0,
      negative: sentimentTotal > 0 ? Math.round((neg / sentimentTotal) * 100) : 0,
      neutral: sentimentTotal > 0 ? Math.round((neu / sentimentTotal) * 100) : 0,
    };

    return {
      partyResults: sortedParties,
      swingStates: swingCandidates,
      chartData,
      victoryProjection,
      sentiment,
      stateBreakdown,
      coalitionScenarios,
    };
  }, [
    resultsQuery.data,
    pvtQuery.data,
    osintQuery.data,
  ]);

  // ── Loading state ──────────────────────────────────────────────────────
  const isLoading = resultsQuery.isLoading || pvtQuery.isLoading || osintQuery.isLoading;
  if (isLoading) return <TrackerSkeleton />;

  // ── Empty state ────────────────────────────────────────────────────────
  const hasNoData = partyResults.length === 0 && pvtQuery.data?.partyTotals.length === 0;
  if (hasNoData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="p-3 rounded-xl bg-secondary mb-3">
          <BarChart3 className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground/60">No election data yet</p>
        <p className="text-xs text-muted-foreground/40 mt-1">Results and PVT submissions will appear here once data is available.</p>
      </motion.div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* 1. Victory Projection — full width (with circular gauge) */}
      <VictoryProjectionCard projection={victoryProjection} partyResults={partyResults} />

      {/* 1b. Path to Victory — full width */}
      {stateBreakdown.length > 0 && (
        <div>
          <PathToVictory states={stateBreakdown} projectedWinner={victoryProjection.projectedWinner} />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex justify-center mt-3"
          >
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs border-amber/30 text-amber hover:bg-amber/5 hover:text-amber"
              onClick={() => setSelectedTab('victory-roadmap')}
            >
              <Trophy className="h-3.5 w-3.5" />
              Open Full Victory Roadmap
              <ChevronRight className="h-3 w-3" />
            </Button>
          </motion.div>
        </div>
      )}

      {/* 2. Party Leaderboard (60%) + Mini Chart (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3 space-y-3">
          <PartyLeaderboard parties={partyResults} />
          {/* 2b. Coalition Math — below leaderboard */}
          <CoalitionMath parties={partyResults} />
        </div>
        <div className="lg:col-span-2">
          <MiniResultsChart data={chartData} />
        </div>
      </div>

      {/* 3. Key Swing States */}
      {swingStates.length > 0 && <SwingStatesGrid states={swingStates} />}

      {/* 3b. State-by-State Breakdown — expandable */}
      {stateBreakdown.length > 0 && (
        <StateBreakdown states={stateBreakdown} />
      )}

      {/* 4. Sentiment Pulse */}
      <SentimentPulse sentiment={sentiment} />
    </div>
  );
}
