'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useDashboardStore } from '@/store/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bell, ShieldAlert, FileBarChart, Users, Activity, Wifi, WifiOff,
  TrendingUp, TrendingDown, Minus, Zap, Radio, AlertTriangle, Eye, Globe,
} from 'lucide-react';
import { format } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface KPIData {
  unreadAlerts: number;
  activeIncidents: number;
  verifiedPvt: number;
  onlineAgents: number;
  totalAgents: number;
  timestamp: string;
}

interface KPIMetric {
  id: string;
  label: string;
  value: number;
  prevValue: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  formatValue: (v: number) => string;
  suffix?: string;
  trend?: 'up' | 'down' | 'stable';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED NUMBER
// ═══════════════════════════════════════════════════════════════════════════════

function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const frameRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const startValRef = useRef(value);

  useEffect(() => {
    startValRef.current = display;
    startRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - (startRef.current ?? 0);
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValRef.current + (value - startValRef.current) * eased);
      setDisplay(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value, duration]);

  return <span>{display.toLocaleString()}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TREND INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

function TrendIndicator({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const diff = current - prev;
  if (diff === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (diff > 0) {
    return <TrendingUp className="h-3 w-3 text-emerald" />;
  }
  return <TrendingDown className="h-3 w-3 text-rose" />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI CARD
// ═══════════════════════════════════════════════════════════════════════════════

function KPICard({ metric, onClick }: { metric: KPIMetric; onClick?: () => void }) {
  const isAlert = metric.id === 'unreadAlerts' && metric.value > 0;
  const isCritical = metric.id === 'activeIncidents' && metric.value > 10;

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'relative rounded-lg border p-3 cursor-pointer transition-all',
        'bg-card hover:bg-accent/50 border-border/50',
        isAlert && 'border-rose/30 shadow-[0_0_12px_rgba(244,63,94,0.08)]',
        isCritical && 'border-amber/30 shadow-[0_0_12px_rgba(245,158,11,0.08)]',
      )}
    >
      {/* Pulse dot for alerts/incidents */}
      {(isAlert || isCritical) && (
        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose animate-ping" />
      )}

      <div className="flex items-start justify-between mb-2">
        <div className={cn('rounded-md p-1.5', metric.bgColor)}>
          {metric.icon}
        </div>
        <TrendIndicator current={metric.value} prev={metric.prevValue} />
      </div>

      <div className={cn('text-2xl font-bold tabular-nums tracking-tight', metric.color)}>
        <AnimatedNumber value={metric.value} />
        {metric.suffix && <span className="text-sm font-medium ml-0.5">{metric.suffix}</span>}
      </div>

      <p className="text-[11px] text-muted-foreground mt-1 font-medium">{metric.label}</p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINI SPARKLINE (SVG)
// ═══════════════════════════════════════════════════════════════════════════════

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const step = w / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });

  return (
    <svg width={w} height={h} className="opacity-40">
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function SituationalKPI() {
  const { tenantId, sseConnected, setSelectedTab, setUnreadAlerts } = useDashboardStore();
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [history, setHistory] = useState<Record<string, number[]>>({
    unreadAlerts: [], activeIncidents: [], verifiedPvt: [], onlineAgents: [],
  });
  const esRef = useRef<EventSource | null>(null);

  // Connect to SSE for KPI events
  useEffect(() => {
    if (!tenantId) return;

    const es = new EventSource(`/api/sse?tenantId=${encodeURIComponent(tenantId)}`);
    esRef.current = es;

    es.addEventListener('kpi', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as KPIData;
        setKpi(data);

        // Update store for alert badge
        setUnreadAlerts(data.unreadAlerts);

        // Track history for sparklines
        setHistory(prev => {
          const next = { ...prev };
          for (const key of ['unreadAlerts', 'activeIncidents', 'verifiedPvt', 'onlineAgents'] as const) {
            next[key] = [...(prev[key] ?? []), data[key]].slice(-20);
          }
          return next;
        });
      } catch { /* ignore */ }
    });

    // Also capture initial dashboard data
    es.addEventListener('connected', () => {
 // Initial fetch
      fetch(`/api/dashboard?tenantId=${encodeURIComponent(tenantId)}`)
        .then(r => r.json())
        .then((data) => {
          const initial: KPIData = {
            unreadAlerts: data.unreadAlerts ?? 0,
            activeIncidents: data.activeIncidents ?? 0,
            verifiedPvt: data.pvtReports ?? 0,
            onlineAgents: data.onlineAgents ?? 0,
            totalAgents: data.totalAgents ?? 0,
            timestamp: new Date().toISOString(),
          };
          setKpi(initial);
          setUnreadAlerts(initial.unreadAlerts);
        })
        .catch(() => {});
    });

    es.onerror = () => { es.close(); esRef.current = null; };

    return () => { es.close(); esRef.current = null; };
  }, [tenantId, setUnreadAlerts]);

  const prevKpiRef = useRef<KPIData | null>(null);
  useEffect(() => { if (kpi) prevKpiRef.current = kpi; }, [kpi]);
  const prevKpi = prevKpiRef.current;

  if (!kpi) {
    return (
      <Card className="border-border/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4 animate-pulse" />
            Loading situational awareness...
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics: KPIMetric[] = [
    {
      id: 'unreadAlerts',
      label: 'Unread Alerts',
      value: kpi.unreadAlerts,
      prevValue: prevKpi?.unreadAlerts ?? 0,
      icon: <Bell className="h-4 w-4 text-rose" />,
      color: kpi.unreadAlerts > 0 ? 'text-rose' : 'text-foreground',
      bgColor: 'bg-rose/10',
      formatValue: (v) => v.toLocaleString(),
    },
    {
      id: 'activeIncidents',
      label: 'Active Incidents',
      value: kpi.activeIncidents,
      prevValue: prevKpi?.activeIncidents ?? 0,
      icon: <ShieldAlert className="h-4 w-4 text-amber" />,
      color: kpi.activeIncidents > 10 ? 'text-rose' : kpi.activeIncidents > 5 ? 'text-amber' : 'text-foreground',
      bgColor: 'bg-amber/10',
      formatValue: (v) => v.toLocaleString(),
    },
    {
      id: 'verifiedPvt',
      label: 'Verified PVT Reports',
      value: kpi.verifiedPvt,
      prevValue: prevKpi?.verifiedPvt ?? 0,
      icon: <FileBarChart className="h-4 w-4 text-emerald" />,
      color: 'text-emerald',
      bgColor: 'bg-emerald/10',
      formatValue: (v) => v.toLocaleString(),
    },
    {
      id: 'onlineAgents',
      label: 'Agents Online',
      value: kpi.onlineAgents,
      prevValue: prevKpi?.onlineAgents ?? 0,
      icon: <Users className="h-4 w-4 text-cyan" />,
      color: 'text-cyan',
      bgColor: 'bg-cyan/10',
      formatValue: (v) => `${v}/${kpi.totalAgents}`,
      suffix: `/${kpi.totalAgents}`,
    },
  ];

  const handleMetricClick = (id: string) => {
    switch (id) {
      case 'unreadAlerts': setSelectedTab('alerts'); break;
      case 'activeIncidents': setSelectedTab('feed'); break;
      case 'verifiedPvt': setSelectedTab('pvt'); break;
      case 'onlineAgents': setSelectedTab('agents'); break;
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber" />
          <h3 className="text-sm font-semibold">Situational Awareness</h3>
        </div>
        <div className="flex items-center gap-2">
          {kpi.timestamp && (
            <span className="text-[10px] text-muted-foreground">
              Updated {formatDistanceToNowShort(new Date(kpi.timestamp))} ago
            </span>
          )}
          <span className={cn(
            'flex items-center gap-1 text-[10px] font-semibold uppercase',
            sseConnected ? 'text-emerald' : 'text-amber',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', sseConnected ? 'bg-emerald animate-pulse-dot' : 'bg-amber')} />
            {sseConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {metrics.map(m => (
          <KPICard key={m.id} metric={m} onClick={() => handleMetricClick(m.id)} />
        ))}
      </div>

      {/* Sparklines Row */}
      <div className="flex gap-4 px-1">
        <div className="flex items-center gap-1.5">
          <Bell className="h-3 w-3 text-rose/60" />
          <MiniSparkline data={history.unreadAlerts} color="#f43f5e" />
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="h-3 w-3 text-amber/60" />
          <MiniSparkline data={history.activeIncidents} color="#f59e0b" />
        </div>
        <div className="flex items-center gap-1.5">
          <FileBarChart className="h-3 w-3 text-emerald/60" />
          <MiniSparkline data={history.verifiedPvt} color="#10b981" />
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="h-3 w-3 text-cyan/60" />
          <MiniSparkline data={history.onlineAgents} color="#06b6d4" />
        </div>
      </div>
    </div>
  );
}

// Helper: shorter time format
function formatDistanceToNowShort(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}
