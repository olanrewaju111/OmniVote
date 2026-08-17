'use client';

import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, useSpring, useTransform } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { useDashboardStore } from '@/store/dashboard';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Vote, MapPin, TrendingUp, AlertTriangle, Users, ShieldAlert,
  Share2, Clock, Loader2,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const PARTY_COLORS: Record<string, string> = {
  APC: '#008751',
  PDP: '#CE1126',
  LP: '#2196F3',
  NNPP: '#FF9800',
};

const GRADIENT = {
  start: '#064e3b',
  mid: '#065f46',
  end: '#022c22',
  accent: '#34d399',
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardData {
  electionInfo: {
    tier: string;
    title: string;
    status: string;
    date: string | null;
  };
  kpis: {
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
    closedUnits: number;
    flaggedUnits: number;
    totalRegistered: number;
    totalVotes: number;
    avgTurnout: number;
  };
}

interface ResultEntry {
  partyResults?: Array<{ party: string; votes: number }>;
  totalValidVotes?: number;
}

interface ResultsData {
  results: ResultEntry[];
}

interface PartyShare {
  party: string;
  votes: number;
  percentage: number;
}

// ─── Animated Number ──────────────────────────────────────────────────────────

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

// ─── WAT Timestamp ────────────────────────────────────────────────────────────

function formatWatTimestamp(): string {
  const now = new Date();
  const watFormatter = new Intl.DateTimeFormat('en-NG', {
    timeZone: 'Africa/Lagos',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${watFormatter.format(now)} \u2022 ${timeFormatter.format(now)} WAT`;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: 'LIVE', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    LIVE: { label: 'LIVE', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    UPCOMING: { label: 'UPCOMING', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    COMPLETED: { label: 'COMPLETED', className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    CLOSED: { label: 'COMPLETED', className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    NONE: { label: 'NO ELECTION', className: 'bg-white/10 text-white/40 border-white/20' },
  };
  const c = config[status] || config.NONE;
  return (
    <Badge variant="outline" className={cn('text-[10px] font-bold px-2 py-0.5 tracking-wider', c.className)}>
      {status === 'ACTIVE' || status === 'LIVE' ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
        </span>
      ) : null}
      {c.label}
    </Badge>
  );
}

// ─── Stat Item ────────────────────────────────────────────────────────────────

function StatItem({
  icon,
  label,
  value,
  suffix,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-1 rounded-lg bg-white/5 p-3 border border-white/10"
    >
      <div className="flex items-center gap-1.5">
        <span className={color}>{icon}</span>
        <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{label}</span>
      </div>
      <span className={cn('text-lg font-bold tabular-nums leading-tight', color)}>
        <AnimatedNumber value={value} />
        {suffix && <span className="text-sm ml-0.5">{suffix}</span>}
      </span>
    </motion.div>
  );
}

// ─── Party Stacked Bar ────────────────────────────────────────────────────────

function PartyBar({ parties }: { parties: PartyShare[] }) {
  const total = parties.reduce((s, p) => s + p.votes, 0);

  if (total === 0) {
    return (
      <div className="space-y-2">
        <div className="h-3 rounded-full bg-white/10" />
        <p className="text-[11px] text-white/30 text-center">No results reported yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Stacked bar */}
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-white/10">
        {parties.map((p) => {
          const pct = total > 0 ? (p.votes / total) * 100 : 0;
          return (
            <motion.div
              key={p.party}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ backgroundColor: PARTY_COLORS[p.party] || '#6b7280' }}
              title={`${p.party}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>
      {/* Party labels */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {parties.map((p) => (
          <div key={p.party} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: PARTY_COLORS[p.party] || '#6b7280' }}
            />\n            <span className="text-[11px] font-semibold text-white/80">{p.party}</span>
            <span className="text-[11px] tabular-nums text-white/50">{p.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ElectionSummaryInfographic() {
  const tenantId = useDashboardStore((s) => s.tenantId);
  const [watTime, setWatTime] = useState(formatWatTimestamp());

  // Update WAT timestamp every minute
  useEffect(() => {
    const interval = setInterval(() => setWatTime(formatWatTimestamp()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Fetch dashboard data
  const { data: dashboard, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard-infographic', tenantId],
    queryFn: () => fetchJson<DashboardData>(`/api/dashboard?tenantId=${tenantId}`),
    refetchInterval: 30_000,
    enabled: !!tenantId,
  });

  // Fetch results for party breakdown
  const { data: resultsData } = useQuery<ResultsData>({
    queryKey: ['results-infographic', tenantId],
    queryFn: () => fetchJson<ResultsData>(`/api/results?tenantId=${tenantId}`),
    refetchInterval: 30_000,
    enabled: !!tenantId,
  });

  // Aggregate party votes
  const partyShares = useMemo<PartyShare[]>(() => {
    const totals: Record<string, number> = {};
    const results = resultsData?.results ?? [];
    for (const r of results) {
      const pr = r.partyResults ?? [];
      for (const entry of pr) {
        const party = (entry.party || '').toUpperCase();
        if (PARTY_COLORS[party]) {
          totals[party] = (totals[party] || 0) + (entry.votes || 0);
        }
      }
    }
    const allVotes = Object.values(totals).reduce((s, v) => s + v, 0);
    return Object.entries(totals)
      .map(([party, votes]) => ({
        party,
        votes,
        percentage: allVotes > 0 ? (votes / allVotes) * 100 : 0,
      }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 4);
  }, [resultsData]);

  // Compute stats
  const kpis = dashboard?.kpis;
  const election = dashboard?.election;
  const status = dashboard?.electionInfo?.status || 'NONE';
  const puCoverage = election && election.totalPollingUnits > 0
    ? Math.round((election.openUnits / election.totalPollingUnits) * 100)
    : 0;

  // Share handler
  const handleShare = async () => {
    if (!dashboard || !election) return;
    const statusLabel = status === 'ACTIVE' ? 'LIVE' : status;
    const partyLines = partyShares
      .map((p) => `${p.party} (${p.percentage.toFixed(1)}%)`)
      .join(' | ');

    const text = `‣\ufe0f\ufe0f\ufe0f Election Summary \u2014 OmniVote Monitor
Status: ${statusLabel}
Total Votes: ${election.totalVotes.toLocaleString()} | Turnout: ${election.avgTurnout}%
PU Coverage: ${puCoverage}% | Incidents: ${kpis?.totalIncidents ?? 0}
Leading: ${partyLines || 'No results yet'}
Generated: ${watTime}`;

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Summary copied to clipboard', {
        description: 'Share it with stakeholders via WhatsApp, email, or social media.',
      });
    } catch {
      toast.error('Failed to copy', { description: 'Please try again or copy manually.' });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="rounded-2xl border-white/10 overflow-hidden">
        <CardContent className="p-6 flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <Card className="rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
        {/* Dark gradient background */}
        <div
          className="relative p-6 space-y-5"
          style={{
            background: `linear-gradient(135deg, ${GRADIENT.start} 0%, ${GRADIENT.mid} 40%, ${GRADIENT.end} 100%)`,
          }}
        >
          {/* Subtle grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* ── Header ── */}
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-white/90 tracking-[0.15em] uppercase">
                  Election Summary
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={status} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-white/30">
              <Clock className="h-3 w-3" />
              <span className="text-[10px] font-medium tabular-nums">{watTime}</span>
            </div>
          </div>

          {/* ── OmniVote Watermark ── */}
          <div className="relative">
            <span className="absolute -top-1 right-0 text-[11px] font-extrabold text-white/[0.07] tracking-[0.3em] select-none uppercase pointer-events-none">
              OmniVote
            </span>
          </div>

          {/* ── Key Stats Grid (2x3) ── */}
          <div className="relative grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <StatItem
              icon={<Vote className="h-3.5 w-3.5" />}
              label="Total Votes"
              value={election?.totalVotes ?? 0}
              color="text-emerald-300"
            />
            <StatItem
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="PU Coverage"
              value={puCoverage}
              suffix="%"
              color={puCoverage >= 50 ? 'text-emerald-300' : 'text-amber-300'}
            />
            <StatItem
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Avg Turnout"
              value={election?.avgTurnout ?? 0}
              suffix="%"
              color="text-emerald-300"
            />
            <StatItem
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              label="Total Incidents"
              value={kpis?.totalIncidents ?? 0}
              color={kpis && kpis.totalIncidents > 20 ? 'text-rose-300' : 'text-amber-300'}
            />
            <StatItem
              icon={<Users className="h-3.5 w-3.5" />}
              label="Agents Online"
              value={kpis?.onlineAgents ?? 0}
              suffix={` / ${kpis?.totalAgents ?? 0}`}
              color="text-emerald-300"
            />
            <StatItem
              icon={<ShieldAlert className="h-3.5 w-3.5" />}
              label="Critical"
              value={kpis?.criticalIncidents ?? 0}
              color={kpis && kpis.criticalIncidents > 0 ? 'text-rose-300' : 'text-emerald-300'}
            />
          </div>

          {/* ── Divider ── */}
          <div className="relative h-px bg-white/10" />

          {/* ── Mini Party Breakdown ── */}
          <div className="relative space-y-1">
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Vote Share</p>
            <PartyBar parties={partyShares} />
          </div>

          {/* ── Bottom Bar ── */}
          <div className="relative flex items-center justify-between pt-1">
            <span className="text-[9px] text-white/20 tracking-widest uppercase select-none">
              OmniVote Monitor
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="h-8 px-3 text-[11px] font-semibold text-white/70 hover:text-white hover:bg-white/10 gap-1.5 rounded-lg"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share Summary
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}