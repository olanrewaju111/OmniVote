'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart3, ChevronRight, ArrowLeft, MapPin, Users, Vote,
  AlertTriangle, ShieldAlert, Radio, TrendingUp, Layers, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardStore, TIER_SHORT } from '@/store/dashboard';
import type { ElectionTier } from '@/store/dashboard';

interface SummaryItem {
  id: string; name: string; registeredVoters: number; totalVotes: number;
  turnout: number; units: number; openUnits: number; closedUnits: number;
  flaggedUnits: number; incidents: number; criticalIncidents: number;
}

interface SituationData {
  tier: string;
  levels: string[];
  currentLevel: string;
  filter: string;
  summary: {
    registeredVoters: number; totalVotes: number; turnout: number;
    units: number; openUnits: number; closedUnits: number; flaggedUnits: number;
    incidents: number; criticalIncidents: number; childCount: number;
  };
  items: SummaryItem[];
}

const LEVEL_LABELS: Record<string, string> = {
  national: 'National', region: 'Geo-Political Zone', state: 'State',
  lga: 'Local Government', ward: 'Ward',
};

const LEVEL_ICONS: Record<string, React.ReactNode> = {
  national: <Layers className="h-4 w-4" />,
  region: <MapPin className="h-4 w-4" />,
  state: <MapPin className="h-4 w-4" />,
  lga: <MapPin className="h-4 w-4" />,
  ward: <Radio className="h-4 w-4" />,
};

// Breadcrumb trail for the hierarchy
interface Breadcrumb {
  level: string;
  label: string;
  filter: string;
}

export function SituationRoom() {
  const { electionTier, tenantId } = useDashboardStore();
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [initialLevel, setInitialLevel] = useState<string | null>(null);

  const currentCrumb = breadcrumbs[breadcrumbs.length - 1];
  // Use the API-returned levels[0] once known, otherwise derive from tier
  const TIER_START: Record<string, string> = { PRESIDENTIAL: 'national', STATE: 'state', LOCAL: 'lga' };
  const activeLevel = currentCrumb?.level || initialLevel || TIER_START[electionTier] || 'national';
  const activeFilter = currentCrumb?.filter || '';

  const { data, isLoading } = useQuery<SituationData>({
    queryKey: ['situation-room', activeLevel, activeFilter, tenantId],
    queryFn: () => {
      const params = new URLSearchParams({ level: activeLevel, filter: activeFilter, tenantId });
      return fetch(`/api/situation-room?${params}`).then(r => r.json());
    },
  });

  // Capture the correct starting level from the API response
  const apiLevels = data?.levels || [];
  if (apiLevels.length > 0 && !initialLevel) {
    setInitialLevel(apiLevels[0]);
  }

  const navigateTo = useCallback((level: string, filter: string, label: string) => {
    setBreadcrumbs(prev => {
      // If navigating back (clicking a breadcrumb), truncate
      const idx = prev.findIndex(b => b.level === level && b.filter === filter);
      if (idx >= 0) return prev.slice(0, idx + 1);
      return [...prev, { level, filter, label }];
    });
  }, []);

  const navigateBack = useCallback(() => {
    setBreadcrumbs(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
  }, []);

  const canDrillDown = (item: SummaryItem): string | null => {
    const lvl = activeLevel;
    if (lvl === 'national' || lvl === 'region') return 'state';
    if (lvl === 'state') return 'lga';
    if (lvl === 'lga') return 'ward';
    return null;
  };

  const items = data?.items || [];
  const summary = data?.summary;
  const levels = apiLevels;

  // Build the full breadcrumb trail for display
  const startLabel: Record<string, string> = { national: 'National', state: 'State Overview', lga: 'LGA Overview' };
  const trail: { label: string; level: string; filter: string }[] = [
    { label: startLabel[levels[0]] || `${activeLevel} Overview`, level: levels[0] || activeLevel, filter: '' },
    ...breadcrumbs,
  ];

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald" />
            Situation Room
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {TIER_SHORT[electionTier as ElectionTier]} — Hierarchical election results from{' '}
            {levels.map((l, i) => (
              <span key={l}>
                <span className="text-foreground/70 font-medium">{LEVEL_LABELS[l]}</span>
                {i < levels.length - 1 && <span className="text-muted-foreground"> → </span>}
              </span>
            ))}
          </p>
        </div>
        <Badge variant="outline" className="border-violet/30 text-violet bg-violet/10 text-xs h-7 px-3">
          <Layers className="h-3.5 w-3.5 mr-1.5" />
          {LEVEL_LABELS[activeLevel] || activeLevel}
        </Badge>
      </div>

      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-1.5 text-xs shrink-0 overflow-x-auto pb-1">
        {trail.map((crumb, idx) => (
          <div key={`${crumb.level}-${crumb.filter}-${idx}`} className="flex items-center gap-1.5 shrink-0">
            {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
            <button
              onClick={() => idx === 0 ? setBreadcrumbs([]) : navigateTo(crumb.level, crumb.filter, crumb.label)}
              className={cn(
                'px-2 py-1 rounded-md transition-colors border',
                idx === trail.length - 1
                  ? 'bg-foreground/10 text-foreground border-foreground/20 font-medium'
                  : 'text-muted-foreground border-transparent hover:bg-card hover:text-foreground'
              )}
            >
              {crumb.label}
            </button>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald" />
        </div>
      ) : (
        <>
          {/* Summary strip */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 shrink-0">
              <MiniStat icon={<Vote className="h-3.5 w-3.5" />} label="Total Votes" value={summary.totalVotes.toLocaleString()} color="emerald" />
              <MiniStat icon={<Users className="h-3.5 w-3.5" />} label="Registered" value={summary.registeredVoters.toLocaleString()} color="cyan" />
              <MiniStat icon={<TrendingUp className="h-3.5 w-3.5" />} label="Avg Turnout" value={`${summary.turnout}%`} color="amber" />
              <MiniStat icon={<Radio className="h-3.5 w-3.5" />} label="Polling Units" value={String(summary.units)} color="foreground" sub={`${summary.openUnits} open · ${summary.closedUnits} closed`} />
              <MiniStat icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Flagged" value={String(summary.flaggedUnits)} color="amber" />
              <MiniStat icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Critical Incidents" value={String(summary.criticalIncidents)} color="rose" sub={`${summary.incidents} total`} />
            </div>
          )}

          {/* Turnout progress bar */}
          {summary && (
            <div className="shrink-0">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                <span>Overall Turnout</span>
                <span className="font-medium text-foreground">{summary.turnout}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(summary.turnout, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={cn(
                    'h-full rounded-full',
                    summary.turnout >= 50 ? 'bg-emerald' :
                    summary.turnout >= 30 ? 'bg-amber' : 'bg-rose'
                  )}
                />
              </div>
            </div>
          )}

          {/* Items grid — the drill-down table */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeLevel}-${activeFilter}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-2"
              >
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <MapPin className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">No data at this level</p>
                  </div>
                ) : (
                  items.map((item, idx) => {
                    const nextLevel = canDrillDown(item);
                    const turnoutColor = item.turnout >= 50 ? 'text-emerald' : item.turnout >= 30 ? 'text-amber' : 'text-rose';
                    const barWidth = item.registeredVoters > 0
                      ? Math.min((item.totalVotes / item.registeredVoters) * 100, 100) : 0;
                    const barColor = barWidth >= 50 ? 'bg-emerald' : barWidth >= 30 ? 'bg-amber' : 'bg-rose';

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03, duration: 0.2 }}
                      >
                        <Card
                          className={cn(
                            'border transition-colors',
                            nextLevel
                              ? 'border-border bg-card/50 hover:bg-card/80 cursor-pointer hover:border-emerald/30'
                              : 'border-border/50 bg-card/30'
                          )}
                          onClick={() => nextLevel && navigateTo(nextLevel, item.name, item.name)}
                        >
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex items-start justify-between gap-3">
                              {/* Left: Name + bar */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium truncate">{item.name}</span>
                                  {item.flaggedUnits > 0 && (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber/30 text-amber shrink-0">
                                      {item.flaggedUnits} flagged
                                    </Badge>
                                  )}
                                  {item.criticalIncidents > 0 && (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1 border-rose/30 text-rose shrink-0">
                                      {item.criticalIncidents} critical
                                    </Badge>
                                  )}
                                </div>
                                {/* Turnout bar */}
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden max-w-xs">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${barWidth}%` }}
                                      transition={{ duration: 0.6, delay: idx * 0.03 }}
                                      className={cn('h-full rounded-full', barColor)}
                                    />
                                  </div>
                                  <span className={cn('text-xs font-semibold tabular-nums shrink-0', turnoutColor)}>
                                    {item.turnout}%
                                  </span>
                                </div>
                                {/* Meta line */}
                                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                                  <span>{item.units} PU{item.units !== 1 ? 's' : ''}</span>
                                  <span className="hidden sm:inline">·</span>
                                  <span className="hidden sm:inline">{item.totalVotes.toLocaleString()} votes</span>
                                  <span className="hidden sm:inline">·</span>
                                  <span className="hidden sm:inline">{item.registeredVoters.toLocaleString()} registered</span>
                                  <span className="hidden md:inline">·</span>
                                  <span className="hidden md:inline">{item.openUnits} open</span>
                                </div>
                              </div>

                              {/* Right: stats + drill arrow */}
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="hidden sm:flex flex-col items-end gap-0.5 text-right">
                                  <span className="text-lg font-bold tabular-nums">{item.totalVotes.toLocaleString()}</span>
                                  <span className="text-[10px] text-muted-foreground">of {item.registeredVoters.toLocaleString()}</span>
                                </div>
                                {nextLevel && (
                                  <div className="w-8 h-8 rounded-lg bg-emerald/10 flex items-center justify-center">
                                    <ChevronRight className="h-4 w-4 text-emerald" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Back button */}
      {breadcrumbs.length > 0 && (
        <div className="shrink-0 border-t border-border pt-3">
          <Button variant="outline" size="sm" onClick={navigateBack} className="gap-2 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {breadcrumbs.length >= 2 ? LEVEL_LABELS[breadcrumbs[breadcrumbs.length - 2]?.level || ''] : trail[0]?.label}
          </Button>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  icon, label, value, color, sub,
}: {
  icon: React.ReactNode; label: string; value: string; color: string;
  sub?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald', cyan: 'text-cyan', amber: 'text-amber',
    rose: 'text-rose', foreground: 'text-foreground',
  };
  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={colorMap[color] || 'text-muted-foreground'}>{icon}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <p className={cn('text-base font-bold tabular-nums', colorMap[color] || 'text-foreground')}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}