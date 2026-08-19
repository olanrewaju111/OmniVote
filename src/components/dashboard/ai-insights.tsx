'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Brain, ShieldCheck, ShieldAlert, Scan, Eye, Zap,
  FileWarning, Fingerprint, Network, Layers, Loader2,
} from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDashboardStore } from '@/store/dashboard';
import { fetchJson } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface AiInsightsProps {
  incidents: { type: string; severity: string; isQuarantined: boolean; aiFlags: string[] }[];
  stateAgg: Record<string, { units: number; votes: number; registered: number; turnout: number }>;
}

interface SecurityEvent {
  id: string;
  eventType: string;
  severity: string;
  description: string;
  resolved: boolean;
  createdAt: string;
  metadata: Record<string, unknown>;
}

const AI_MODULES = [
  { name: 'Transcription (Whisper)', status: 'active' as const, icon: <Scan className="h-4 w-4" />, key: 'transcription' },
  { name: 'Deepfake Detection (CV)', status: 'active' as const, icon: <Eye className="h-4 w-4" />, key: 'deepfake' },
  { name: 'CIB / NLP Analysis', status: 'active' as const, icon: <Network className="h-4 w-4" />, key: 'cib' },
  { name: 'Adversarial Input Sanitizer', status: 'active' as const, icon: <ShieldAlert className="h-4 w-4" />, key: 'sanitizer' },
  { name: 'Geofence Validator', status: 'active' as const, icon: <Fingerprint className="h-4 w-4" />, key: 'geofence' },
  { name: 'C2PA Provenance Engine', status: 'active' as const, icon: <ShieldCheck className="h-4 w-4" />, key: 'c2pa' },
  { name: 'Optimization Advisor', status: 'active' as const, icon: <Layers className="h-4 w-4" />, key: 'optimizer' },
  { name: 'Rate Limiter / DDoS Shield', status: 'active' as const, icon: <Zap className="h-4 w-4" />, key: 'ratelimit' },
];

function relativeTime(date: string | Date) {
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

function eventTypeToModule(eventType: string): string {
  if (eventType.includes('DEEPFAKE') || eventType.includes('MANIPULATION')) return 'CV';
  if (eventType.includes('CIB') || eventType.includes('NLP') || eventType.includes('PROMPT')) return 'NLP';
  if (eventType.includes('GEO') || eventType.includes('GEOFENCE')) return 'GEO';
  if (eventType.includes('AUTH') || eventType.includes('LOGIN') || eventType.includes('DEVICE')) return 'AUTH';
  if (eventType.includes('C2PA') || eventType.includes('PROVENANCE')) return 'C2PA';
  if (eventType.includes('RATE') || eventType.includes('DDOS')) return 'SEC';
  return 'SYS';
}

function AiInsightsInner({ incidents, stateAgg }: AiInsightsProps) {
  const { tenantId } = useDashboardStore();

  // Derive real module statuses from incident data
  const moduleStatuses = useMemo(() => {
    const statuses: Record<string, 'active' | 'degraded' | 'error'> = {};
    const hasDeepfake = incidents.some(i => i.type === 'DEEPFAKE_SUSPECT' && i.isQuarantined);
    const hasCib = incidents.some(i => i.type === 'CIB_DETECTED');
    const hasGpsAnomaly = incidents.some(i => 'gpsAnomaly' in i && (i.gpsAnomaly || i.isQuarantined));
    const highQuarantineCount = incidents.filter(i => i.isQuarantined).length;

    if (hasDeepfake) statuses['deepfake'] = 'degraded';
    if (hasCib) statuses['cib'] = 'degraded';
    if (hasGpsAnomaly) statuses['geofence'] = 'degraded';
    if (highQuarantineCount > 10) statuses['optimizer'] = 'degraded';

    return statuses;
  }, [incidents]);

  const { data: secData, isLoading: secLoading } = useQuery<{
    events: SecurityEvent[];
    counts: { total: number; unresolved: number; criticalUnresolved: number; bySeverity: Record<string, number>; byType: Record<string, number> };
  }>({
    queryKey: ['security-ai', tenantId],
    queryFn: () => fetchJson(`/api/security?tenantId=${tenantId}&limit=20`),
    refetchInterval: 30_000,
  });

  // Threat type breakdown from real incidents
  const threatTypes = [
    { name: 'Deepfake', count: incidents.filter(i => i.type === 'DEEPFAKE_SUSPECT').length, color: '#8b5cf6' },
    { name: 'CIB', count: incidents.filter(i => i.type === 'CIB_DETECTED').length, color: '#f43f5e' },
    { name: 'Geo Anomaly', count: incidents.filter(i => i.type === 'GEO_ANOMALY').length, color: '#f59e0b' },
    { name: 'Violence', count: incidents.filter(i => i.type === 'VIOLENCE').length, color: '#ef4444' },
    { name: 'Intimidation', count: incidents.filter(i => i.type === 'INTIMIDATION').length, color: '#f97316' },
    { name: 'Ballot Fraud', count: incidents.filter(i => i.type === 'BALLOT_STUFFING').length, color: '#dc2626' },
    { name: 'Logistics', count: incidents.filter(i => i.type === 'LOGISTICS').length, color: '#06b6d4' },
    { name: 'Other', count: incidents.filter(i => i.type === 'OBSERVATION').length, color: '#737373' },
  ].filter(t => t.count > 0);

  // State turnout chart
  const stateData = Object.entries(stateAgg)
    .map(([state, data]) => ({ name: state.length > 8 ? state.substring(0, 8) + '.' : state, turnout: Math.round(data.turnout * 100), units: data.units }))
    .sort((a, b) => b.turnout - a.turnout)
    .slice(0, 10);

  const defenseMetrics = {
    deepfakeIntercepted: incidents.filter(i => i.type === 'DEEPFAKE_SUSPECT').length,
    cibBlocked: incidents.filter(i => i.type === 'CIB_DETECTED').length,
    geoAnomalies: incidents.filter(i => i.type === 'GEO_ANOMALY').length,
    totalQuarantined: incidents.filter(i => i.isQuarantined).length,
  };

  // Derive threat feed from security events
  const threatFeed = (secData?.events || []).slice(0, 10).map(e => ({
    id: e.id,
    time: relativeTime(e.createdAt),
    event: e.description,
    severity: e.severity,
    type: eventTypeToModule(e.eventType),
    resolved: e.resolved,
  }));

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4" aria-label="AI Insights panel">
      {/* Defense metrics summary */}
      <Card className="border-emerald/20 bg-emerald/5">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-emerald" />
            AI Defense Engine Status
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Deepfakes Intercepted', value: defenseMetrics.deepfakeIntercepted, color: 'text-violet' },
              { label: 'CIB Campaigns Blocked', value: defenseMetrics.cibBlocked, color: 'text-rose' },
              { label: 'Geo Anomalies Flagged', value: defenseMetrics.geoAnomalies, color: 'text-amber' },
              { label: 'Total Quarantined', value: defenseMetrics.totalQuarantined, color: 'text-cyan' },
            ].map(m => (
              <div key={m.label} className="text-center" aria-label={`${m.label}: ${m.value}`}>
                <p className={`text-xl font-bold tabular-nums ${m.color}`}>{m.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI modules grid */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Module Status</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {AI_MODULES.map(mod => {
              const effectiveStatus = moduleStatuses[mod.key] || mod.status;
              return (
              <div
                key={mod.name}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-card/40"
              >
                <span className={effectiveStatus === 'active' ? 'text-emerald' : 'text-amber'}>{mod.icon}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium truncate">{mod.name}</p>
                  <div className="flex items-center gap-1">
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      effectiveStatus === 'active' ? 'bg-emerald' : 'bg-amber'
                    )} />
                    <span className="text-[10px] text-muted-foreground">{effectiveStatus}</span>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Threat type breakdown chart */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Threat Type Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {threatTypes.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={threatTypes} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10, fill: 'oklch(0.65 0 0)' }} />
                <Tooltip
                  contentStyle={{ background: 'oklch(0.18 0.006 260)', border: '1px solid oklch(0.28 0.01 260)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'oklch(0.9 0 0)' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                  {threatTypes.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-xs">
              No threat data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* State turnout chart */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">State Turnout Comparison</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {stateData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stateData} margin={{ left: 0, right: 10, top: 0, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'oklch(0.65 0 0)', textAnchor: 'end' }} angle={-35} interval={0} height={50} />
                <YAxis tick={{ fontSize: 10, fill: 'oklch(0.65 0 0)' }} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: 'oklch(0.18 0.006 260)', border: '1px solid oklch(0.28 0.01 260)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'oklch(0.9 0 0)' }}
                  formatter={(v: number) => [`${v}%`, 'Turnout']}
                />
                <Bar dataKey="turnout" radius={[4, 4, 0, 0]} barSize={20}>
                  {stateData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.turnout >= 50 ? '#10b981' : entry.turnout >= 35 ? '#f59e0b' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">
              No turnout data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Threat intelligence feed — from real security events */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileWarning className="h-4 w-4 text-amber" />
            Threat Intelligence Feed
            {secData?.counts && (
              <Badge variant="outline" className="text-[10px] h-5 ml-auto">
                {secData.counts.unresolved} unresolved
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ScrollArea className="max-h-64">
            {secLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : threatFeed.length > 0 ? (
              <div className="space-y-1.5">
                {threatFeed.map((item) => (
                  <m.div
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-start gap-2.5 p-2 rounded-md border border-border/50 bg-card/30"
                  >
                    <Badge
                      variant="outline"
                      className="text-[9px] h-5 shrink-0 mt-0.5 font-mono text-muted-foreground"
                    >
                      {item.type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-[11px]', item.resolved ? 'text-foreground/50 line-through' : 'text-foreground/80')}>
                        {item.event}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.time}</p>
                    </div>
                    <Badge
                      className={cn(
                        'text-[9px] h-4 shrink-0',
                        item.severity === 'CRITICAL' ? 'bg-rose/15 text-rose' :
                        item.severity === 'HIGH' ? 'bg-amber/15 text-amber' :
                        'bg-muted text-muted-foreground'
                      )}
                    >
                      {item.severity}
                    </Badge>
                  </m.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <ShieldAlert className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
                No security events recorded yet
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export const AiInsights = React.memo(AiInsightsInner);