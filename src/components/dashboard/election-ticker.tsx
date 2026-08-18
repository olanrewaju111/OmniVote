'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useDashboardStore } from '@/store/dashboard';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';
import {
  Users,
  MapPin,
  AlertTriangle,
  FileText,
  Wifi,
  WifiOff,
  Clock,
  Radio,
  ChevronRight,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// PARTY COLORS
// ═══════════════════════════════════════════════════════════════════════════════

const PARTY_COLORS: Record<string, string> = {
  APC: '#008751',
  PDP: '#CE1126',
  LP: '#2196F3',
  NNPP: '#FF9800',
};

// ═══════════════════════════════════════════════════════════════════════════════
// TICKER ANIMATION — CSS keyframes defined as a constant string
// Injected via <style> tag for self-contained component usage.
// Also defined in globals.css as fallback.
// ═══════════════════════════════════════════════════════════════════════════════

const TickerAnimation = `
@keyframes ticker-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.animate-ticker-scroll {
  animation: ticker-scroll 30s linear infinite;
}
.animate-ticker-scroll:hover {
  animation-play-state: paused;
}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface TickerResult {
  state: string;
  party: string;
  percentage: number;
  margin: number;
}

interface DashboardQuickStats {
  onlineAgents?: number;
  totalAgents?: number;
  puCoverage?: number;
  incidents?: number;
  pvtReports?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function isElectionLive(status: string): boolean {
  const s = status.toUpperCase();
  return s === 'ACTIVE' || s === 'LIVE';
}

function isElectionCompleted(status: string): boolean {
  return status.toUpperCase() === 'COMPLETED' || status.toUpperCase() === 'ENDED';
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** WAT = UTC+1 */
function getWATTime(): string {
  const now = new Date();
  // Convert to WAT (UTC+1)
  const wat = new Date(now.getTime() + 60 * 60 * 1000);
  return `${pad(wat.getHours())}:${pad(wat.getMinutes())}:${pad(wat.getSeconds())}`;
}

function getDaysSince(dateStr: string): number {
  const election = new Date(dateStr);
  election.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now.getTime() - election.getTime()) / (1000 * 60 * 60 * 24)));
}

function getCountdown(dateStr: string): { days: number; hours: number; minutes: number } {
  const target = new Date(dateStr);
  const now = new Date();
  let diff = target.getTime() - now.getTime();
  if (diff < 0) diff = 0;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: string }) {
  const live = isElectionLive(status);
  const completed = isElectionCompleted(status);

  if (live) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-rose/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose">
        <span className="h-1.5 w-1.5 rounded-full bg-rose animate-pulse-dot" aria-hidden="true" />
        Live
      </span>
    );
  }

  if (completed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-cyan/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan">
        Completed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-amber/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber">
      <Clock className="h-2.5 w-2.5" aria-hidden="true" />
      Upcoming
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNTDOWN / ELAPSED TIMER
// ═══════════════════════════════════════════════════════════════════════════════

function ElectionTimer({ electionDate, status }: { electionDate: string | null; status: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!electionDate) return null;

  const isFuture = new Date(electionDate).getTime() > now;
  const isTodayDate = isToday(electionDate);

  // Future: show countdown
  if (isFuture && !isTodayDate) {
    const { days, hours, minutes } = getCountdown(electionDate);
    return (
      <span className="flex items-center gap-2" aria-live="polite" aria-label={`Election in ${days} days, ${hours} hours, ${minutes} minutes`}>
        <span className="text-[11px] font-medium text-muted-foreground">
          Election in:{' '}
          <span className="font-semibold text-foreground">
            {days > 0 ? `${days}d ` : ''}{pad(hours)}h {pad(minutes)}m
          </span>
        </span>
        <StatusBadge status={status} />
      </span>
    );
  }

  // Today or past: show elapsed
  const dayNum = getDaysSince(electionDate) + 1;
  const watTime = getWATTime();

  return (
    <span className="flex items-center gap-2" aria-live="polite" aria-label={`Day ${dayNum} of election, ${watTime} West Africa Time`}>
      <span className="text-[11px] font-medium text-muted-foreground">
        <span className="font-semibold text-foreground">DAY {dayNum}</span>
        {' — '}
        <span className="font-mono text-foreground tabular-nums">{watTime}</span>
        <span className="text-muted-foreground/70"> WAT</span>
      </span>
      <StatusBadge status={status} />
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCROLLING TICKER MARQUEE
// ═══════════════════════════════════════════════════════════════════════════════

function ResultsMarquee({ results }: { results: TickerResult[] }) {
  if (results.length === 0) return null;

  const tickerContent = results.map((r, i) => (
    <span key={i} className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-[11px] font-semibold text-foreground/90">
        {r.state}:
      </span>
      <span
        className="text-[11px] font-bold"
        style={{ color: PARTY_COLORS[r.party] ?? 'var(--color-foreground)' }}
      >
        {r.party}
      </span>
      <span className="text-[11px] text-muted-foreground">
        leads with {r.percentage}% (margin: {r.margin.toLocaleString()})
      </span>
      {i < results.length - 1 && (
        <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40" aria-hidden="true" />
      )}
    </span>
  ));

  return (
    <div
      className="flex-1 overflow-hidden relative"
      aria-label="Live election results ticker"
      role="marquee"
    >
      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-card/80 to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-card/80 to-transparent" aria-hidden="true" />

      <div className="animate-ticker-scroll flex w-max items-center">
        {/* Original content */}
        <div className="flex items-center gap-4 px-4">{tickerContent}</div>
        {/* Duplicate for seamless loop */}
        <div className="flex items-center gap-4 px-4" aria-hidden="true">{tickerContent}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION STATUS INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <span
      className="flex items-center gap-1.5 shrink-0"
      role="status"
      aria-label={connected ? 'Connected to live feed' : 'Reconnecting to live feed'}
    >
      <span className="relative flex h-2 w-2">
        {connected ? (
          <>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-60" aria-hidden="true" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" aria-hidden="true" />
          </>
        ) : (
          <span
            className="relative inline-flex h-2 w-2 rounded-full bg-amber animate-pulse-dot"
            aria-hidden="true"
          />
        )}
      </span>
      <span
        className={cn(
          'text-[10px] font-semibold uppercase tracking-wider',
          connected ? 'text-emerald' : 'text-amber',
        )}
      >
        {connected ? 'LIVE' : 'RECONNECTING...'}
      </span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK STATS STRIP
// ═══════════════════════════════════════════════════════════════════════════════

function DotSeparator() {
  return <span className="text-muted-foreground/30 mx-1" aria-hidden="true">·</span>;
}

function QuickStatsStrip({ stats }: { stats: DashboardQuickStats }) {
  const items = [
    {
      icon: <Users className="h-2.5 w-2.5 text-emerald" aria-hidden="true" />,
      label: `Agents: ${stats.onlineAgents ?? '—'}/${stats.totalAgents ?? '—'}`,
    },
    {
      icon: <MapPin className="h-2.5 w-2.5 text-cyan" aria-hidden="true" />,
      label: `PU Coverage: ${stats.puCoverage ?? '—'}%`,
    },
    {
      icon: <AlertTriangle className="h-2.5 w-2.5 text-amber" aria-hidden="true" />,
      label: `Incidents: ${stats.incidents ?? '—'}`,
    },
    {
      icon: <FileText className="h-2.5 w-2.5 text-violet" aria-hidden="true" />,
      label: `PVT Reports: ${stats.pvtReports?.toLocaleString() ?? '—'}`,
    },
  ];

  return (
    <span className="hidden sm:flex items-center gap-0 shrink-0" aria-label="Quick statistics">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <DotSeparator />}
          {item.icon}
          <span className="text-[10px] text-muted-foreground font-medium">{item.label}</span>
        </span>
      ))}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const ElectionTicker = React.memo(function ElectionTicker() {
  const { electionInfo, tenantId, sseConnected } = useDashboardStore();
  const status = electionInfo?.status ?? '';
  const showTicker = isElectionLive(status);

  // ── Fetch live results for ticker ──
  const { data: resultsData } = useQuery<TickerResult[]>({
    queryKey: ['election-ticker-results', tenantId],
    queryFn: () =>
      fetchJson<TickerResult[]>(`/api/results?tenantId=${tenantId}&limit=10`),
    enabled: showTicker && !!tenantId,
    refetchInterval: 30_000, // Refresh every 30s
  });

  // ── Fetch dashboard stats ──
  const { data: dashData } = useQuery<DashboardQuickStats>({
    queryKey: ['election-ticker-stats', tenantId],
    queryFn: () =>
      fetchJson<DashboardQuickStats>(`/api/dashboard?tenantId=${tenantId}`),
    enabled: !!tenantId,
    refetchInterval: 60_000, // Refresh every 60s
  });

  // Don't render if no election info
  if (!electionInfo) return null;

  const results = resultsData ?? [];
  const stats = dashData ?? {};

  return (
    <>
      {/* Inject ticker animation */}
      <style dangerouslySetInnerHTML={{ __html: TickerAnimation }} />

      <m.aside
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={cn(
          'relative z-30 flex w-full items-center h-7',
          'border-t border-border/50',
          'bg-card/60 backdrop-blur-md',
          'px-3 gap-3',
          'select-none',
        )}
        role="banner"
        aria-label="Election status ticker"
      >
        {/* ── LEFT: Countdown / Elapsed Timer ── */}
        <div className="shrink-0 flex items-center">
          <ElectionTimer
            electionDate={electionInfo.date}
            status={electionInfo.status}
          />
        </div>

        {/* ── CENTER: Scrolling Results Ticker (hidden on mobile) ── */}
        <AnimatePresence mode="wait">
          {showTicker && results.length > 0 && (
            <m.div
              key="ticker"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.3 }}
              className="hidden md:flex items-center overflow-hidden"
            >
              <ResultsMarquee results={results} />
            </m.div>
          )}
        </AnimatePresence>

        {/* ── RIGHT: Connection Status + Quick Stats ── */}
        <div className="shrink-0 flex items-center gap-3 ml-auto">
          <QuickStatsStrip stats={stats} />
          <ConnectionStatus connected={sseConnected} />
        </div>
      </m.aside>
    </>
  );
});
