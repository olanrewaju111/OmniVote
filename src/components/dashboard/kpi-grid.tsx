'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Users, AlertTriangle, Vote, Shield, ShieldCheck, Radio, ShieldAlert, Timer, BarChart3,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet';
  trend?: { value: number; up: boolean };
  glow?: boolean;
  className?: string;
}

const COLOR_MAP = {
  emerald: { bg: 'bg-emerald/10', text: 'text-emerald', border: 'border-emerald/20', glow: 'glow-emerald' },
  amber: { bg: 'bg-amber/10', text: 'text-amber', border: 'border-amber/20', glow: 'glow-amber' },
  rose: { bg: 'bg-rose/10', text: 'text-rose', border: 'border-rose/20', glow: 'glow-rose' },
  cyan: { bg: 'bg-cyan/10', text: 'text-cyan', border: 'border-cyan/20', glow: '' },
  violet: { bg: 'bg-violet/10', text: 'text-violet', border: 'border-violet/20', glow: '' },
};

function KpiCard({ label, value, sub, icon, color, trend, glow, className }: KpiCardProps) {
  const c = COLOR_MAP[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <Card className={cn(
        'border bg-card/60 backdrop-blur-sm transition-colors hover:bg-card/80',
        c.border, glow && c.glow
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className={cn('text-2xl font-bold tabular-nums', c.text)}>{value}</p>
              {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
              {trend && (
                <div className="flex items-center gap-1">
                  <span className={cn('text-[11px] font-medium', trend.up ? 'text-emerald' : 'text-rose')}>
                    {trend.up ? '+' : ''}{trend.value}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">vs last hr</span>
                </div>
              )}
            </div>
            <div className={cn('p-2.5 rounded-lg', c.bg)}>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

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
  extraStats?: { label: string; value: number; color: 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet' }[];
}

const EXTRA_ICONS: Record<string, React.ReactNode> = {
  rose: <ShieldAlert className="h-4 w-4 text-rose" />,
  emerald: <ShieldCheck className="h-4 w-4 text-emerald" />,
  cyan: <BarChart3 className="h-4 w-4 text-cyan" />,
  amber: <AlertTriangle className="h-4 w-4 text-amber" />,
};

export function KpiGrid({ data, election, trends, extraStats }: KpiGridProps) {
  const agentPct = data.totalAgents ? Math.round((data.onlineAgents / data.totalAgents) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-3">
      <KpiCard
        label="Agents Online"
        value={data.onlineAgents}
        sub={`${data.totalAgents} total (${agentPct}%)`}
        icon={<Users className="h-5 w-5 text-emerald" />}
        color="emerald"
        trend={trends?.onlineAgents}
        className="md:col-span-1 xl:col-span-2"
      />
      <KpiCard
        label="Polling Units"
        value={election.totalPollingUnits}
        sub={`${election.openUnits} open / ${election.totalPollingUnits - election.openUnits} closed`}
        icon={<BarChart3 className="h-5 w-5 text-cyan" />}
        color="cyan"
        className="md:col-span-1 xl:col-span-2"
      />
      <KpiCard
        label="Avg Turnout"
        value={`${election.avgTurnout}%`}
        sub={`${(election.totalVotes / 1000).toFixed(1)}K of ${(election.totalRegistered / 1000).toFixed(1)}K voters`}
        icon={<Vote className="h-5 w-5 text-emerald" />}
        color="emerald"
        trend={trends?.turnout}
        className="md:col-span-1 xl:col-span-2"
      />
      <KpiCard
        label="Total Incidents"
        value={data.totalIncidents}
        sub={`${data.pendingIncidents} pending review`}
        icon={<AlertTriangle className="h-5 w-5 text-amber" />}
        color="amber"
        className="md:col-span-1 xl:col-span-2"
      />
      <KpiCard
        label="Critical / SOS"
        value={data.criticalIncidents}
        sub={`${data.sosCount} SOS pings active`}
        icon={<Radio className="h-5 w-5 text-rose" />}
        color="rose"
        glow
        className="md:col-span-1 xl:col-span-2"
      />
      <KpiCard
        label="Quarantined"
        value={data.quarantinedIncidents}
        sub="AI-flagged, pending T&S review"
        icon={<Shield className="h-5 w-5 text-violet" />}
        color="violet"
        className="md:col-span-1 xl:col-span-2"
      />

      {/* Extra stats row — compact, single-line cards */}
      {extraStats?.map((s) => (
        <div
          key={s.label}
          className={cn(
            'md:col-span-1 xl:col-span-3 rounded-lg border bg-card/60 px-3 py-2 flex items-center justify-between gap-2 transition-colors hover:bg-card/80',
            COLOR_MAP[s.color]?.border
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn('p-1.5 rounded-md shrink-0', COLOR_MAP[s.color]?.bg)}>
              {EXTRA_ICONS[s.color]}
            </div>
            <span className="text-[11px] text-muted-foreground truncate">{s.label}</span>
          </div>
          <span className={cn('text-base font-bold tabular-nums shrink-0', COLOR_MAP[s.color]?.text)}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}