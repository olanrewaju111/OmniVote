'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Brain, ShieldCheck, ShieldAlert, Scan, Eye, Zap,
  FileWarning, Fingerprint, Network, Layers,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface AiInsightsProps {
  incidents: { type: string; severity: string; isQuarantined: boolean; aiFlags: string[] }[];
  stateAgg: Record<string, { units: number; votes: number; registered: number; turnout: number }>;
}

const THREAT_FEED = [
  { time: '2m ago', event: 'Deepfake batch scan: 3 images flagged (94% confidence)', severity: 'HIGH', type: 'CV' },
  { time: '8m ago', event: 'CIB pattern detected: 12 identical reports from IP 102.89.x.x range', severity: 'CRITICAL', type: 'NLP' },
  { time: '15m ago', event: 'Prompt injection attempt blocked in WhatsApp bot input', severity: 'MEDIUM', type: 'SEC' },
  { time: '22m ago', event: 'Geofence violation: Agent "Blessing Bello" 8.2km outside unit', severity: 'HIGH', type: 'GEO' },
  { time: '31m ago', event: 'C2PA provenance chain verified for 47 media submissions', severity: 'LOW', type: 'C2PA' },
  { time: '45m ago', event: 'Hourly regional summary generated: South-West region', severity: 'LOW', type: 'NLP' },
  { time: '52m ago', event: 'Agent device fingerprint collision detected — 2 agents, same device ID', severity: 'HIGH', type: 'AUTH' },
  { time: '1h ago', event: 'Audio-visual desync detected in video submission (0.8s offset)', severity: 'MEDIUM', type: 'CV' },
];

const AI_MODULES = [
  { name: 'Transcription (Whisper)', status: 'active', icon: <Scan className="h-4 w-4" /> },
  { name: 'Deepfake Detection (CV)', status: 'active', icon: <Eye className="h-4 w-4" /> },
  { name: 'CIB / NLP Analysis', status: 'active', icon: <Network className="h-4 w-4" /> },
  { name: 'Adversarial Input Sanitizer', status: 'active', icon: <ShieldAlert className="h-4 w-4" /> },
  { name: 'Geofence Validator', status: 'active', icon: <Fingerprint className="h-4 w-4" /> },
  { name: 'C2PA Provenance Engine', status: 'active', icon: <ShieldCheck className="h-4 w-4" /> },
  { name: 'Optimization Advisor', status: 'degraded', icon: <Layers className="h-4 w-4" /> },
  { name: 'Rate Limiter / DDoS Shield', status: 'active', icon: <Zap className="h-4 w-4" /> },
];

export function AiInsights({ incidents, stateAgg }: AiInsightsProps) {
  // Threat type breakdown
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
    c2paVerified: incidents.filter(i => true).length, // placeholder
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
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
              <div key={m.label} className="text-center">
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
            {AI_MODULES.map(mod => (
              <div
                key={mod.name}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-card/40"
              >
                <span className={mod.status === 'active' ? 'text-emerald' : 'text-amber'}>{mod.icon}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium truncate">{mod.name}</p>
                  <div className="flex items-center gap-1">
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      mod.status === 'active' ? 'bg-emerald' : 'bg-amber'
                    )} />
                    <span className="text-[10px] text-muted-foreground">{mod.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Threat type breakdown chart */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Threat Type Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
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
        </CardContent>
      </Card>

      {/* State turnout chart */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">State Turnout Comparison</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stateData} margin={{ left: 0, right: 10, top: 0, bottom: 20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'oklch(0.65 0 0)', angle: -35, textAnchor: 'end' }} interval={0} height={50} />
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
        </CardContent>
      </Card>

      {/* Threat intelligence feed */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileWarning className="h-4 w-4 text-amber" />
            Threat Intelligence Feed
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ScrollArea className="max-h-64">
            <div className="space-y-1.5">
              {THREAT_FEED.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.2 }}
                  className="flex items-start gap-2.5 p-2 rounded-md border border-border/50 bg-card/30"
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] h-5 shrink-0 mt-0.5 font-mono',
                      item.severity === 'CRITICAL' ? 'text-rose border-rose/30' :
                      item.severity === 'HIGH' ? 'text-amber border-amber/30' :
                      'text-muted-foreground'
                    )}
                  >
                    {item.type}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground/80">{item.event}</p>
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
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}