'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Server, Database, HardDrive, Wifi, Shield, Clock,
  Activity, Cpu, Globe, Cloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SERVICES = [
  { name: 'Dashboard API', status: 'healthy', latency: '12ms', uptime: '99.99%' },
  { name: 'Incident API', status: 'healthy', latency: '18ms', uptime: '99.97%' },
  { name: 'WebSocket Server', status: 'healthy', latency: '5ms', uptime: '99.95%' },
  { name: 'AI Engine (Transcription)', status: 'healthy', latency: '340ms', uptime: '99.8%' },
  { name: 'AI Engine (Deepfake CV)', status: 'healthy', latency: '890ms', uptime: '99.7%' },
  { name: 'AI Engine (CIB/NLP)', status: 'degraded', latency: '1.2s', uptime: '98.5%' },
  { name: 'C2PA Provenance Engine', status: 'healthy', latency: '45ms', uptime: '99.9%' },
  { name: 'Rate Limiter / DDoS Shield', status: 'healthy', latency: '2ms', uptime: '99.99%' },
  { name: 'Cloudflare CDN', status: 'healthy', latency: '8ms', uptime: '100%' },
  { name: 'AWS S3 Multi-Tenant Storage', status: 'healthy', latency: '65ms', uptime: '99.95%' },
];

const REGIONS = [
  { name: 'Lagos (Primary)', status: 'active', requests: '12.4K/min', cpu: 42, memory: 61 },
  { name: 'Abuja (Secondary)', status: 'active', requests: '8.2K/min', cpu: 35, memory: 54 },
  { name: 'Port Harcourt', status: 'standby', requests: '0', cpu: 5, memory: 18 },
];

const AUDIT_STATS = [
  { label: 'Actions Logged (24h)', value: '14,230' },
  { label: 'Tamper Attempts Blocked', value: '3' },
  { label: 'Immutable Ledger Entries', value: '2.1M' },
  { label: 'Active Sessions', value: '28' },
];

export function SystemHealth() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Server className="h-5 w-5 text-emerald" />
          System Health & Infrastructure
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">Super Admin — Monitor global platform health and tenant infrastructure</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'System Uptime', value: '99.99%', icon: <Activity className="h-4 w-4 text-emerald" />, sub: 'Active-Active Multi-Region' },
          { label: 'Avg Response', value: '18ms', icon: <Clock className="h-4 w-4 text-cyan" />, sub: 'P99: 120ms' },
          { label: 'Throughput', value: '20.6K/min', icon: <Globe className="h-4 w-4 text-amber" />, sub: '100K+ concurrent capacity' },
          { label: 'AI Engine', value: '7/8 Healthy', icon: <Cpu className="h-4 w-4 text-violet" />, sub: '1 degraded (CIB/NLP)' },
        ].map(m => (
          <Card key={m.label} className="border-border bg-card/40">
            <CardContent className="p-3.5">
              <div className="flex items-center gap-2 mb-2">
                {m.icon}
                <span className="text-[11px] text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-xl font-bold tabular-nums">{m.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Service health grid */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cloud className="h-4 w-4 text-cyan" />
            Microservices Health
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SERVICES.map(svc => (
              <div
                key={svc.name}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg border',
                  svc.status === 'degraded' ? 'border-amber/25 bg-amber/5' : 'border-border bg-card/30'
                )}
              >
                <span className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  svc.status === 'healthy' ? 'bg-emerald' : 'bg-amber'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{svc.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{svc.latency}</span>
                    <span>&middot;</span>
                    <span>{svc.uptime}</span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px] h-5 shrink-0',
                    svc.status === 'healthy' ? 'border-emerald/30 text-emerald' : 'border-amber/30 text-amber'
                  )}
                >
                  {svc.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Region deployment */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4 text-emerald" />
            Active-Active Multi-Region Deployment
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {REGIONS.map(region => (
            <div key={region.name} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    region.status === 'active' ? 'bg-emerald' : 'bg-muted-foreground/30'
                  )} />
                  <span className="text-xs font-medium">{region.name}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] h-5',
                      region.status === 'active' ? 'border-emerald/30 text-emerald' : 'border-border text-muted-foreground'
                    )}
                  >
                    {region.status}
                  </Badge>
                </div>
                <span className="text-[11px] text-muted-foreground">{region.requests}/min</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">CPU</span>
                    <span>{region.cpu}%</span>
                  </div>
                  <Progress value={region.cpu} className="h-1.5" />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">Memory</span>
                    <span>{region.memory}%</span>
                  </div>
                  <Progress value={region.memory} className="h-1.5" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Audit log stats */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber" />
            Security & Audit
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {AUDIT_STATS.map(s => (
              <div key={s.label} className="text-center px-3 py-3 rounded-lg bg-card/30 border border-border">
                <p className="text-lg font-bold tabular-nums">{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 p-2.5 rounded-md bg-emerald/5 border border-emerald/15 text-[11px] text-emerald flex items-center gap-2">
            <Shield className="h-4 w-4 shrink-0" />
            Immutable audit log: All actions are append-only, tamper-evident. Even rogue admin deletions are permanently recorded.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}