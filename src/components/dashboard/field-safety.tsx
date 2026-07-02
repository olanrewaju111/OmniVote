'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { toast } from 'sonner';
import { useDashboardStore } from '@/store/dashboard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  MapPin, ShieldAlert, Radio, Clock, Users, CheckCircle2,
  AlertTriangle, Wifi, WifiOff, Battery, BatteryLow, BatteryWarning,
  BatteryFull, Satellite, Loader2, Plus, Eye, Activity,
  Signal, Zap, Shield, XCircle, Search,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────
interface GeofenceZone {
  id: string;
  name: string;
  state: string;
  lga: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  pollingUnitIds: string[];
  assignedAgentIds: string[];
  isActive: boolean;
  checkInIntervalMin: number;
  maxMissedCheckIns: number;
  createdAt: string;
}

interface CheckIn {
  id: string;
  agentId: string;
  geofenceZoneId: string;
  status: 'CHECKED_IN' | 'CHECKED_OUT' | 'SOS_TRIGGERED' | 'EXPIRED';
  latitude: number;
  longitude: number;
  isInsideZone: boolean;
  batteryLevel: number | null;
  networkType: string | null;
  accuracyMeters: number | null;
  notes: string | null;
  checkedInAt: string;
  checkedOutAt: string | null;
  agentName: string;
  zoneName: string;
}

interface DeadMansSwitch {
  id: string;
  agentId: string;
  geofenceZoneId: string;
  isActive: boolean;
  checkInDeadline: string;
  lastCheckInAt: string | null;
  missedCheckIns: number;
  escalationLevel: number;
  autoSOSTriggered: boolean;
  resolvedAt: string | null;
  agentName: string;
  zoneName: string | null;
  isOverdue: boolean;
}

interface AgentSafety {
  id: string;
  name: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  isLocked: boolean;
  biometricRiskScore: number | null;
  deviceTrustScore: number | null;
  hasActiveSwitch: boolean;
  switchEscalation: number;
  isOverdue: boolean;
  lastCheckInAt: string | null;
  lastCheckInStatus: string | null;
}

interface Counts {
  totalZones: number;
  activeZones: number;
  activeSwitches: number;
  overdueSwitches: number;
  escalatedSwitches: number;
  sosTriggered: number;
  checkedInNow: number;
  sosCheckIns: number;
  totalFieldAgents: number;
}

interface GeofenceData {
  zones: GeofenceZone[];
  checkIns: CheckIn[];
  switches: DeadMansSwitch[];
  agentSafety: AgentSafety[];
  counts: Counts;
}

// ── Nigerian states for the select ───────────────────────────────────
const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe',
  'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara',
  'Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau',
  'Rivers','Sokoto','Taraba','Yobe','Zamfara',
];

// ── Helpers ──────────────────────────────────────────────────────────
function formatRelativeTime(d: string | Date | null): string {
  if (!d) return 'Never';
  const date = new Date(d);
  const now = Date.now();
  const diff = Math.floor((now - date.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return date.toLocaleDateString('en-NG', { day: '2-digit', month: 'short' });
}

function formatDeadlineCountdown(deadline: string): { text: string; isOverdue: boolean } {
  const diff = new Date(deadline).getTime() - Date.now();
  const mins = Math.floor(Math.abs(diff) / 60000);
  if (diff > 0) {
    return { text: `${mins}m left`, isOverdue: false };
  }
  return { text: `OVERDUE by ${mins}m`, isOverdue: true };
}

function batteryIcon(level: number | null) {
  if (level === null) return <Battery className="h-3.5 w-3.5 text-muted-foreground" />;
  if (level > 60) return <BatteryFull className="h-3.5 w-3.5 text-emerald" />;
  if (level > 20) return <BatteryWarning className="h-3.5 w-3.5 text-amber" />;
  return <BatteryLow className="h-3.5 w-3.5 text-rose" />;
}

function batteryColor(level: number | null) {
  if (level === null) return 'text-muted-foreground';
  if (level > 60) return 'text-emerald';
  if (level > 20) return 'text-amber';
  return 'text-rose';
}

function statusBadge(status: string) {
  switch (status) {
    case 'CHECKED_IN':
      return <Badge className="border-emerald/30 bg-emerald/10 text-emerald text-[10px]">CHECKED IN</Badge>;
    case 'CHECKED_OUT':
      return <Badge className="border-cyan/30 bg-cyan/10 text-cyan text-[10px]">CHECKED OUT</Badge>;
    case 'SOS_TRIGGERED':
      return <Badge className="border-rose/30 bg-rose/10 text-rose text-[10px] glow-rose animate-pulse-dot">SOS</Badge>;
    case 'EXPIRED':
      return <Badge className="border-amber/30 bg-amber/10 text-amber text-[10px]">EXPIRED</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
}

function escalationBadge(level: number) {
  if (level === 0) return null;
  if (level === 1) return <span className="inline-flex items-center gap-1 text-amber"><span className="h-2 w-2 rounded-full bg-amber animate-pulse-dot" /> Level 1</span>;
  if (level === 2) return <Badge className="border-amber/30 bg-amber/10 text-amber text-[10px]">ESCALATED</Badge>;
  return <Badge className="border-rose/30 bg-rose/10 text-rose text-[10px] animate-pulse-dot glow-rose">EMERGENCY</Badge>;
}

// ── Animation variants ───────────────────────────────────────────────
const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

// ── Main Component ───────────────────────────────────────────────────
export function FieldSafety() {
  const { tenantId, user } = useDashboardStore();
  const queryClient = useQueryClient();

  // Dialog / filter state
  const [createZoneOpen, setCreateZoneOpen] = useState(false);
  const [agentFilter, setAgentFilter] = useState<'ALL' | 'AT_RISK' | 'SOS'>('ALL');
  const [formState, setFormState] = useState({
    name: '', state: '', lga: '', centerLat: '', centerLng: '',
    radiusMeters: '500', checkInIntervalMin: '60', maxMissedCheckIns: '3',
  });

  // ── Query ──────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<GeofenceData>({
    queryKey: ['geofence', tenantId],
    queryFn: () => fetchJson(`/api/geofence?tenantId=${tenantId}`),
    refetchInterval: 10000,
    enabled: !!tenantId,
  });

  // ── Mutations ──────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchJson('/api/geofence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ...body }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofence', tenantId] });
      toast.success('Action completed successfully');
    },
    onError: () => toast.error('Action failed'),
  });

  const handleToggleZone = (zoneId: string, isActive: boolean) => {
    mutation.mutate({ action: 'TOGGLE_ZONE', zoneId, isActive: !isActive });
  };

  const handleResolveSwitch = (switchId: string) => {
    mutation.mutate({ action: 'RESOLVE_SWITCH', switchId, resolvedById: user?.id });
  };

  const handleTriggerSOS = (agentId: string, geofenceZoneId: string) => {
    mutation.mutate({ action: 'TRIGGER_SOS', agentId, geofenceZoneId });
  };

  const handleCheckIn = (agentId: string, geofenceZoneId: string) => {
    mutation.mutate({ action: 'CHECK_IN', agentId, geofenceZoneId, latitude: 0, longitude: 0, isInsideZone: true });
  };

  const handleCreateZone = () => {
    if (!formState.name || !formState.state || !formState.centerLat || !formState.centerLng) {
      toast.error('Name, State, Center Lat, and Center Lng are required');
      return;
    }
    mutation.mutate({
      action: 'CREATE_ZONE',
      name: formState.name,
      state: formState.state,
      lga: formState.lga,
      centerLat: parseFloat(formState.centerLat),
      centerLng: parseFloat(formState.centerLng),
      radiusMeters: parseInt(formState.radiusMeters) || 500,
      checkInIntervalMin: parseInt(formState.checkInIntervalMin) || 60,
      maxMissedCheckIns: parseInt(formState.maxMissedCheckIns) || 3,
    }, {
      onSuccess: () => {
        setCreateZoneOpen(false);
        setFormState({ name: '', state: '', lga: '', centerLat: '', centerLng: '', radiusMeters: '500', checkInIntervalMin: '60', maxMissedCheckIns: '3' });
      },
    });
  };

  // ── Derived data ───────────────────────────────────────────────────
  const counts = data?.counts;
  const activeSwitches = useMemo(() => {
    if (!data) return [];
    return data.switches
      .filter(s => s.isActive)
      .sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return b.escalationLevel - a.escalationLevel;
      });
  }, [data]);

  const filteredAgents = useMemo(() => {
    if (!data) return [];
    let agents = [...data.agentSafety];
    if (agentFilter === 'AT_RISK') {
      agents = agents.filter(a => a.isOverdue || (a.biometricRiskScore !== null && a.biometricRiskScore > 60));
    } else if (agentFilter === 'SOS') {
      agents = agents.filter(a => a.lastCheckInStatus === 'SOS_TRIGGERED');
    }
    return agents.sort((a, b) => {
      const scoreA = (a.biometricRiskScore || 0) + (a.isOverdue ? 100 : 0) + (a.switchEscalation * 25);
      const scoreB = (b.biometricRiskScore || 0) + (b.isOverdue ? 100 : 0) + (b.switchEscalation * 25);
      return scoreB - scoreA;
    });
  }, [data, agentFilter]);

  // ── Loading state ──────────────────────────────────────────────────
  if (isLoading || !data) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-emerald" />
          <h2 className="text-base font-semibold">Field Safety</h2>
          {counts && counts.activeSwitches > 0 && (
            <Badge className="border-rose/30 bg-rose/10 text-rose text-[10px] glow-rose animate-pulse-dot">
              <Radio className="h-3 w-3 mr-1" />
              DEAD-MAN&apos;S SWITCH ACTIVE
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {counts?.totalFieldAgents ?? 0} field agents · {counts?.activeZones ?? 0} zones
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <Tabs defaultValue="dashboard" className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0">
          <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
          <TabsTrigger value="zones" className="text-xs">Geofence Zones</TabsTrigger>
          <TabsTrigger value="roster" className="text-xs">Agent Roster</TabsTrigger>
          <TabsTrigger value="log" className="text-xs">Check-in Log</TabsTrigger>
        </TabsList>

        {/* ────────────────────── TAB 1: DASHBOARD ─────────────────── */}
        <TabsContent value="dashboard" className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-4 mt-2">
            {/* KPI Cards */}
            {counts && (
              <motion.div className="grid grid-cols-2 lg:grid-cols-3 gap-3" variants={container} initial="hidden" animate="show">
                <KpiCard label="Active Zones" value={counts.activeZones} icon={<MapPin className="h-4 w-4 text-emerald" />} accent="emerald" delay={0} />
                <KpiCard label="Agents Checked In" value={counts.checkedInNow} icon={<CheckCircle2 className="h-4 w-4 text-emerald" />} accent="emerald" delay={1} />
                <KpiCard label="Overdue Switches" value={counts.overdueSwitches} icon={<AlertTriangle className="h-4 w-4 text-rose" />} accent="rose" delay={2} />
                <KpiCard label="SOS Alerts" value={counts.sosTriggered} icon={<Radio className="h-4 w-4 text-rose" />} accent="rose" delay={3} />
                <KpiCard label="Escalated Cases" value={counts.escalatedSwitches} icon={<ShieldAlert className="h-4 w-4 text-amber" />} accent="amber" delay={4} />
                <KpiCard label="Field Agents" value={counts.totalFieldAgents} icon={<Users className="h-4 w-4 text-cyan" />} accent="cyan" delay={5} />
              </motion.div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Dead-Man's Switch Monitor */}
              <Card className="bg-card/40 border-border rounded-xl">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-amber" />
                    <span className="text-sm font-semibold">Dead-Man&apos;s Switch Monitor</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{activeSwitches.length} active</Badge>
                </div>
                <ScrollArea className="max-h-72">
                  <div className="p-2 space-y-2">
                    {activeSwitches.length === 0 && (
                      <div className="text-center text-muted-foreground text-xs py-6">No active switches</div>
                    )}
                    {activeSwitches.map(sw => {
                      const deadline = formatDeadlineCountdown(sw.checkInDeadline);
                      return (
                        <motion.div
                          key={sw.id}
                          variants={item}
                          initial="hidden"
                          animate="show"
                          className={cn(
                            'flex items-center justify-between gap-2 p-3 rounded-lg border transition-colors',
                            sw.isOverdue ? 'border-rose/30 bg-rose/5' : sw.escalationLevel >= 2 ? 'border-amber/25 bg-amber/5' : 'border-border bg-card/40',
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium truncate">{sw.agentName}</span>
                              {escalationBadge(sw.escalationLevel)}
                              {sw.autoSOSTriggered && (
                                <Badge className="border-rose/30 bg-rose/10 text-rose text-[9px] glow-rose animate-pulse-dot">AUTO-SOS</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="truncate">{sw.zoneName ?? 'Unknown zone'}</span>
                              <span className={deadline.isOverdue ? 'text-rose font-medium' : ''}>
                                <Clock className="h-3 w-3 inline mr-0.5" />
                                {deadline.text}
                              </span>
                              <span>Missed: {sw.missedCheckIns}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => handleResolveSwitch(sw.id)}>
                              Resolve
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-[10px] px-2" onClick={() => handleTriggerSOS(sw.agentId, sw.geofenceZoneId)}>
                              SOS
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </Card>

              {/* Live Agent Map Placeholder */}
              <Card className="bg-card/40 border-border rounded-xl">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Satellite className="h-4 w-4 text-cyan" />
                    <span className="text-sm font-semibold">Live Agent Positions</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald" /> Checked In</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose" /> SOS</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber" /> Overdue</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground" /> Offline</span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="relative w-full h-56 rounded-lg bg-background/60 map-grid border border-border overflow-hidden">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 224" preserveAspectRatio="xMidYMid meet">
                      {/* Equator-ish line */}
                      <line x1="0" y1="112" x2="400" y2="112" stroke="oklch(0.28 0.01 260 / 0.5)" strokeWidth="0.5" strokeDasharray="4 4" />
                      {/* Vertical center */}
                      <line x1="200" y1="0" x2="200" y2="224" stroke="oklch(0.28 0.01 260 / 0.5)" strokeWidth="0.5" strokeDasharray="4 4" />
                    </svg>
                    {/* Agent dots from zones */}
                    {data.zones.length > 0 && (() => {
                      const allZones = data.zones.filter(z => z.isActive);
                      const lats = allZones.map(z => z.centerLat);
                      const lngs = allZones.map(z => z.centerLng);
                      const minLat = Math.min(...lats, 4);
                      const maxLat = Math.max(...lats, 14);
                      const minLng = Math.min(...lngs, 2.5);
                      const maxLng = Math.max(...lngs, 15);
                      const pad = 20;
                      const w = 400 - pad * 2;
                      const h = 224 - pad * 2;
                      const rangeLat = Math.max(maxLat - minLat, 0.01);
                      const rangeLng = Math.max(maxLng - minLng, 0.01);

                      return allZones.map(zone => {
                        const x = pad + ((zone.centerLng - minLng) / rangeLng) * w;
                        const y = pad + h - ((zone.centerLat - minLat) / rangeLat) * h;
                        const switchData = data.switches.find(s => s.geofenceZoneId === zone.id && s.isActive);
                        const hasSOS = data.checkIns.some(c => c.geofenceZoneId === zone.id && c.status === 'SOS_TRIGGERED');
                        const isOverdue = switchData?.isOverdue ?? false;
                        let color = '#10b981'; // emerald
                        let glow = 'oklch(0.65 0.19 160 / 0.4)';
                        if (hasSOS || switchData?.autoSOSTriggered) { color = '#f43f5e'; glow = 'oklch(0.65 0.22 25 / 0.5)'; }
                        else if (isOverdue) { color = '#f59e0b'; glow = 'oklch(0.75 0.16 75 / 0.4)'; }
                        const hasAgentOnline = data.agentSafety.some(a => zone.assignedAgentIds.includes(a.id) && a.isOnline);
                        if (!hasAgentOnline && !hasSOS && !isOverdue) { color = 'oklch(0.45 0 0)'; glow = 'none'; }

                        return (
                          <g key={zone.id}>
                            <circle cx={x} cy={y} r={hasSOS ? 14 : 10} fill={glow} opacity={0.6}>
                              {hasSOS && <animate attributeName="r" values="10;16;10" dur="2s" repeatCount="indefinite" />}
                              {hasSOS && <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />}
                            </circle>
                            <circle cx={x} cy={y} r={5} fill={color} stroke="oklch(0.18 0.006 260)" strokeWidth="1.5" />
                            <text x={x} y={y - 10} textAnchor="middle" fill="oklch(0.75 0 0)" fontSize="7" fontFamily="sans-serif">{zone.name.slice(0, 12)}</text>
                          </g>
                        );
                      });
                    })()}
                    {data.zones.filter(z => z.isActive).length === 0 && (
                      <text x="200" y="112" textAnchor="middle" fill="oklch(0.5 0 0)" fontSize="11" fontFamily="sans-serif">No active zones to display</text>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ────────────────────── TAB 2: GEOFENCE ZONES ─────────────── */}
        <TabsContent value="zones" className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{data.zones.length} zones configured</span>
              <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => setCreateZoneOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Create Zone
              </Button>
            </div>
            <motion.div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" variants={container} initial="hidden" animate="show">
              {data.zones.map(zone => (
                <motion.div key={zone.id} variants={item}>
                  <Card className={cn('bg-card/40 border-border rounded-xl overflow-hidden', zone.isActive ? 'border-l-2 border-l-emerald' : 'border-l-2 border-l-muted-foreground/30')}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{zone.name}</span>
                            {zone.isActive ? (
                              <Badge className="border-emerald/30 bg-emerald/10 text-emerald text-[9px]">ACTIVE</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] text-muted-foreground">INACTIVE</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{zone.state}{zone.lga ? ` / ${zone.lga}` : ''}</p>
                        </div>
                        <Switch
                          checked={zone.isActive}
                          onCheckedChange={() => handleToggleZone(zone.id, zone.isActive)}
                          className="scale-75 origin-right"
                        />
                      </div>
                      <Separator className="my-2" />
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="block text-muted-foreground/70">Radius</span>
                          <span className="font-medium text-foreground">{zone.radiusMeters}m</span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground/70">Agents</span>
                          <span className="font-medium text-foreground">{zone.assignedAgentIds.length}</span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground/70">PUs</span>
                          <span className="font-medium text-foreground">{zone.pollingUnitIds.length}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-[10px] text-muted-foreground/60 flex items-center gap-3">
                        <span>Interval: {zone.checkInIntervalMin}m</span>
                        <span>Max missed: {zone.maxMissedCheckIns}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              {data.zones.length === 0 && (
                <div className="col-span-full text-center text-muted-foreground text-sm py-10">No geofence zones configured yet</div>
              )}
            </motion.div>
          </div>
        </TabsContent>

        {/* ────────────────────── TAB 3: AGENT ROSTER ───────────────── */}
        <TabsContent value="roster" className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Select value={agentFilter} onValueChange={(v: 'ALL' | 'AT_RISK' | 'SOS') => setAgentFilter(v)}>
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Agents</SelectItem>
                    <SelectItem value="AT_RISK">At Risk</SelectItem>
                    <SelectItem value="SOS">SOS Only</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">{filteredAgents.length} agents</span>
              </div>
            </div>
            <ScrollArea className="max-h-[calc(100vh-220px)]">
              <div className="space-y-2">
                {filteredAgents.map(agent => {
                  const switchStatus = agent.hasActiveSwitch
                    ? agent.isOverdue ? 'Overdue' : 'Active'
                    : agent.lastCheckInStatus === 'SOS_TRIGGERED' ? 'SOS' : 'None';
                  const switchStatusBadge = agent.hasActiveSwitch
                    ? agent.isOverdue
                      ? <Badge className="border-rose/30 bg-rose/10 text-rose text-[9px]">OVERDUE</Badge>
                      : <Badge className="border-amber/30 bg-amber/10 text-amber text-[9px]">ACTIVE</Badge>
                    : agent.lastCheckInStatus === 'SOS_TRIGGERED'
                      ? <Badge className="border-rose/30 bg-rose/10 text-rose text-[9px] glow-rose animate-pulse-dot">SOS</Badge>
                      : <span className="text-[10px] text-muted-foreground">—</span>;
                  const riskScore = (agent.biometricRiskScore || 0) + (agent.isOverdue ? 100 : 0) + (agent.switchEscalation * 25);

                  return (
                    <motion.div
                      key={agent.id}
                      variants={item}
                      initial="hidden"
                      animate="show"
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border bg-card/40',
                        riskScore > 100 ? 'border-rose/20' : riskScore > 30 ? 'border-amber/20' : 'border-border',
                      )}
                    >
                      {/* Online status */}
                      <div className="shrink-0">
                        <div className={cn('h-2.5 w-2.5 rounded-full', agent.isOnline ? 'bg-emerald' : 'bg-muted-foreground/40')} />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium truncate">{agent.name}</span>
                          {switchStatusBadge}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>Last seen: {formatRelativeTime(agent.lastSeenAt)}</span>
                          <span>Trust: {agent.deviceTrustScore ?? '—'}</span>
                          <span>Bio risk: <span className={agent.biometricRiskScore && agent.biometricRiskScore > 60 ? 'text-rose' : 'text-muted-foreground'}>{agent.biometricRiskScore ?? '—'}</span></span>
                          <span>Last check-in: {formatRelativeTime(agent.lastCheckInAt)}</span>
                        </div>
                      </div>
                      {/* Trust progress bar */}
                      <div className="hidden md:flex flex-col items-end gap-1 w-20 shrink-0">
                        <span className="text-[9px] text-muted-foreground">Trust</span>
                        <Progress value={agent.deviceTrustScore ?? 0} className="h-1.5 w-16" />
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => {
                          const zone = data.zones[0];
                          if (zone) handleCheckIn(agent.id, zone.id);
                          else toast.error('No zones available for check-in');
                        }}>
                          Check In
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 text-[10px] px-2" onClick={() => {
                          const zone = data.zones[0];
                          if (zone) handleTriggerSOS(agent.id, zone.id);
                          else toast.error('No zones available');
                        }}>
                          SOS
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
                {filteredAgents.length === 0 && (
                  <div className="text-center text-muted-foreground text-xs py-8">No agents match the selected filter</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        {/* ────────────────────── TAB 4: CHECK-IN LOG ───────────────── */}
        <TabsContent value="log" className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{data.checkIns.length} check-ins recorded</span>
            </div>
            <ScrollArea className="max-h-[calc(100vh-200px)]">
              <div className="space-y-1.5">
                {data.checkIns.map(ci => (
                  <motion.div
                    key={ci.id}
                    variants={item}
                    initial="hidden"
                    animate="show"
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                      ci.status === 'SOS_TRIGGERED' ? 'border-rose/30 bg-rose/5 glow-rose' : 'border-border bg-card/40',
                    )}
                  >
                    <div className="shrink-0">{statusBadge(ci.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{ci.agentName}</span>
                        <span className="text-xs text-muted-foreground truncate">→ {ci.zoneName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {ci.isInsideZone ? 'Inside' : 'Outside'}
                        </span>
                        <span className="flex items-center gap-1">
                          {batteryIcon(ci.batteryLevel)}
                          <span className={batteryColor(ci.batteryLevel)}>{ci.batteryLevel !== null ? `${ci.batteryLevel}%` : '—'}</span>
                        </span>
                        {ci.networkType && (
                          <span className="flex items-center gap-1">
                            <Signal className="h-3 w-3" />
                            {ci.networkType}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatRelativeTime(ci.checkedInAt)}</span>
                  </motion.div>
                ))}
                {data.checkIns.length === 0 && (
                  <div className="text-center text-muted-foreground text-xs py-8">No check-in records</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>

      {/* ──────────────────── CREATE ZONE DIALOG ──────────────────── */}
      <Dialog open={createZoneOpen} onOpenChange={setCreateZoneOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald" />
              Create Geofence Zone
            </DialogTitle>
            <DialogDescription>Define a new geofence zone for field agent monitoring.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Zone Name *</Label>
              <Input className="h-8 text-sm" placeholder="e.g. Ikeja PU-01" value={formState.name} onChange={e => setFormState(s => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">State *</Label>
                <Select value={formState.state} onValueChange={v => setFormState(s => ({ ...s, state: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>
                    {NIGERIAN_STATES.map(st => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">LGA</Label>
                <Input className="h-8 text-sm" placeholder="Local Gov Area" value={formState.lga} onChange={e => setFormState(s => ({ ...s, lga: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Center Latitude *</Label>
                <Input className="h-8 text-sm" type="number" step="any" placeholder="6.5244" value={formState.centerLat} onChange={e => setFormState(s => ({ ...s, centerLat: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Center Longitude *</Label>
                <Input className="h-8 text-sm" type="number" step="any" placeholder="3.3792" value={formState.centerLng} onChange={e => setFormState(s => ({ ...s, centerLng: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Radius (m)</Label>
                <Input className="h-8 text-sm" type="number" placeholder="500" value={formState.radiusMeters} onChange={e => setFormState(s => ({ ...s, radiusMeters: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Check-in (min)</Label>
                <Input className="h-8 text-sm" type="number" placeholder="60" value={formState.checkInIntervalMin} onChange={e => setFormState(s => ({ ...s, checkInIntervalMin: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Max Missed</Label>
                <Input className="h-8 text-sm" type="number" placeholder="3" value={formState.maxMissedCheckIns} onChange={e => setFormState(s => ({ ...s, maxMissedCheckIns: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setCreateZoneOpen(false)}>Cancel</Button>
            <Button size="sm" className="text-xs" onClick={handleCreateZone} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Create Zone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── KPI Card Sub-component ───────────────────────────────────────────
function KpiCard({ label, value, icon, accent, delay }: {
  label: string; value: number; icon: React.ReactNode; accent: 'emerald' | 'rose' | 'amber' | 'cyan'; delay: number;
}) {
  const glowClass = accent === 'rose' ? 'glow-rose' : accent === 'amber' ? 'glow-amber' : accent === 'emerald' ? 'glow-emerald' : '';
  return (
    <motion.div variants={item} transition={{ delay: delay * 0.05 }}>
      <Card className={cn('bg-card/40 border-border rounded-xl', glowClass, value > 0 && (accent === 'rose' || accent === 'amber') ? '' : '')}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className={cn(
            'flex items-center justify-center h-9 w-9 rounded-lg shrink-0',
            accent === 'emerald' && 'bg-emerald/10',
            accent === 'rose' && 'bg-rose/10',
            accent === 'amber' && 'bg-amber/10',
            accent === 'cyan' && 'bg-cyan/10',
          )}>
            {icon}
          </div>
          <div>
            <div className="text-xl font-bold leading-none">{value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}