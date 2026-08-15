'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useDashboardStore } from '@/store/dashboard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchJson } from '@/lib/api';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Shield, ShieldAlert, ShieldCheck, Lock, Key, Eye, Clock,
  LogIn, Download, Fingerprint, Zap, Activity, User, Users,
  CheckCircle2, XCircle, AlertTriangle, Info, Plus, Trash2,
  ChevronDown, ChevronUp, Loader2, Settings, FileText,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SecurityEvent {
  id: string;
  eventType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  description: string;
  metadata: Record<string, unknown>;
  resolved: boolean;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface SecurityUser {
  id: string;
  name: string;
  email: string;
  role: string;
  deviceTrustScore: number;
  biometricRiskScore: number;
  isLocked: boolean;
  lastSecurityAuditAt: string | null;
}

interface SecurityPolicies {
  encryptionEnabled: boolean;
  twoFactorEnabled: boolean;
  sessionTimeoutMin: number;
  ipWhitelist: string[];
  dataRetentionDays: number;
  auditLogRetentionDays: number;
}

interface SecurityCounts {
  total: number;
  unresolved: number;
  criticalUnresolved: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}

interface SecurityData {
  events: SecurityEvent[];
  counts: SecurityCounts;
  users: SecurityUser[];
  policies: SecurityPolicies | null;
  securityScore: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald';
  if (score >= 50) return 'text-amber';
  return 'text-rose';
}

function scoreStroke(score: number): string {
  if (score >= 80) return 'stroke-emerald';
  if (score >= 50) return 'stroke-amber';
  return 'stroke-rose';
}

function scoreGlow(score: number): string {
  if (score >= 80) return 'glow-emerald';
  if (score >= 50) return 'glow-amber';
  return 'glow-rose';
}

function severityBadge(severity: string) {
  switch (severity) {
    case 'CRITICAL':
      return (
        <Badge className="bg-rose text-white text-[10px] h-5 border-0">
          <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />
          CRITICAL
        </Badge>
      );
    case 'WARNING':
      return (
        <Badge className="bg-amber/15 text-amber border-amber/30 text-[10px] h-5">
          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
          WARNING
        </Badge>
      );
    default:
      return (
        <Badge className="bg-cyan/15 text-cyan border-cyan/30 text-[10px] h-5">
          <Info className="h-2.5 w-2.5 mr-0.5" />
          INFO
        </Badge>
      );
  }
}

function eventTypeIcon(type: string, className = 'h-4 w-4 shrink-0') {
  switch (type) {
    case 'LOGIN_SUCCESS': return <LogIn className={cn(className, 'text-emerald')} />;
    case 'LOGIN_FAILED': return <LogIn className={cn(className, 'text-rose')} />;
    case 'BRUTE_FORCE': return <ShieldAlert className={cn(className, 'text-rose')} />;
    case 'SUSPICIOUS_ACTIVITY': return <Eye className={cn(className, 'text-amber')} />;
    case 'ENCRYPTION_EVENT': return <Lock className={cn(className, 'text-cyan')} />;
    case 'SESSION_EXPIRED': return <Clock className={cn(className, 'text-amber')} />;
    case 'PERMISSION_CHANGE': return <Key className={cn(className, 'text-amber')} />;
    case 'DATA_EXPORT': return <Download className={cn(className, 'text-cyan')} />;
    case 'CERT_PINNING': return <Fingerprint className={cn(className, 'text-emerald')} />;
    case 'API_ABUSE': return <Zap className={cn(className, 'text-rose')} />;
    default: return <Shield className={cn(className, 'text-muted-foreground')} />;
  }
}

function trustScoreColor(score: number): string {
  if (score > 80) return 'text-emerald';
  if (score >= 50) return 'text-amber';
  return 'text-rose';
}

function trustBarColor(score: number): string {
  if (score > 80) return '[&>div]:bg-emerald';
  if (score >= 50) return '[&>div]:bg-amber';
  return '[&>div]:bg-rose';
}

function riskBarColor(risk: number): string {
  if (risk < 0.3) return '[&>div]:bg-emerald';
  if (risk < 0.7) return '[&>div]:bg-amber';
  return '[&>div]:bg-rose';
}

function riskLabel(risk: number): string {
  if (risk < 0.3) return 'Low';
  if (risk < 0.7) return 'Medium';
  return 'High';
}

function riskLabelColor(risk: number): string {
  if (risk < 0.3) return 'text-emerald';
  if (risk < 0.7) return 'text-amber';
  return 'text-rose';
}

/* ------------------------------------------------------------------ */
/*  Circular Gauge                                                     */
/* ------------------------------------------------------------------ */

function SecurityGauge({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);
  const stroke = scoreStroke(score);

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle
          cx="70" cy="70" r={radius}
          fill="none" strokeWidth="8"
          className="stroke-muted/30"
        />
        <motion.circle
          cx="70" cy="70" r={radius}
          fill="none" strokeWidth="8"
          strokeLinecap="round"
          className={stroke}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <motion.span
          className={cn('text-3xl font-bold tabular-nums', color)}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Overview Tab                                                       */
/* ------------------------------------------------------------------ */

function OverviewTab({ data }: { data: SecurityData }) {
  const { counts, events, policies, users, securityScore } = data;
  const recentEvents = events.slice(0, 10);
  const lockedUsers = users.filter(u => u.isLocked).length;

  const kpis = [
    {
      label: 'Unresolved Events',
      value: counts.unresolved,
      icon: <AlertTriangle className="h-4 w-4 text-amber" />,
      color: counts.unresolved > 0 ? 'text-amber' : 'text-emerald',
      glow: counts.unresolved > 0 ? '' : 'glow-emerald',
    },
    {
      label: 'Critical Threats',
      value: counts.criticalUnresolved,
      icon: <ShieldAlert className="h-4 w-4 text-rose" />,
      color: counts.criticalUnresolved > 0 ? 'text-rose' : 'text-emerald',
      glow: counts.criticalUnresolved > 0 ? 'glow-rose' : '',
    },
    {
      label: 'Locked Users',
      value: lockedUsers,
      icon: <User className="h-4 w-4 text-rose" />,
      color: lockedUsers > 0 ? 'text-rose' : 'text-muted-foreground',
      glow: '',
    },
    {
      label: 'Security Score',
      value: securityScore,
      icon: <ShieldCheck className="h-4 w-4" style={{ color: 'var(--color-emerald)' }} />,
      color: scoreColor(securityScore),
      glow: scoreGlow(securityScore),
    },
  ];

  return (
    <div className="space-y-4 overflow-y-auto flex-1 pr-1">
      {/* Security Score + KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4">
        {/* Gauge */}
        <Card className="bg-card/40 border-border">
          <CardContent className="p-4 flex flex-col items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Security Score</span>
            <SecurityGauge score={securityScore} />
            <Badge
              className={cn(
                'text-[10px] h-5',
                securityScore >= 80
                  ? 'bg-emerald/15 text-emerald border-emerald/30'
                  : securityScore >= 50
                    ? 'bg-amber/15 text-amber border-amber/30'
                    : 'bg-rose/15 text-rose border-rose/30',
              )}
              variant="outline"
            >
              {securityScore >= 80 ? 'Healthy' : securityScore >= 50 ? 'Needs Attention' : 'At Risk'}
            </Badge>
          </CardContent>
        </Card>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.35 }}
            >
              <Card className={cn('bg-card/40 border-border h-full', kpi.glow && kpi.glow)}>
                <CardContent className="p-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    {kpi.icon}
                    <span className="text-[11px] text-muted-foreground">{kpi.label}</span>
                  </div>
                  <p className={cn('text-xl font-bold tabular-nums', kpi.color)}>{kpi.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Policy Status */}
      {policies && (
        <Card className="bg-card/40 border-border">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
              <Settings className="h-3.5 w-3.5" />
              Policy Status
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-card/30 border border-border">
                <Lock className={cn('h-4 w-4', policies.encryptionEnabled ? 'text-emerald' : 'text-muted-foreground/40')} />
                <div>
                  <p className="text-xs font-medium">Encryption</p>
                  <p className={cn('text-[10px]', policies.encryptionEnabled ? 'text-emerald' : 'text-muted-foreground')}>
                    AES-256 {policies.encryptionEnabled ? 'Active' : 'Disabled'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-card/30 border border-border">
                <Shield className={cn('h-4 w-4', policies.twoFactorEnabled ? 'text-emerald' : 'text-muted-foreground/40')} />
                <div>
                  <p className="text-xs font-medium">Two-Factor Auth</p>
                  <p className={cn('text-[10px]', policies.twoFactorEnabled ? 'text-emerald' : 'text-muted-foreground')}>
                    {policies.twoFactorEnabled ? 'Enforced' : 'Disabled'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-card/30 border border-border">
                <Clock className="h-4 w-4 text-cyan" />
                <div>
                  <p className="text-xs font-medium">Session Timeout</p>
                  <p className="text-[10px] text-muted-foreground">{policies.sessionTimeoutMin} min</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-card/30 border border-border">
                <Fingerprint className={cn('h-4 w-4', policies.ipWhitelist.length > 0 ? 'text-emerald' : 'text-muted-foreground/40')} />
                <div>
                  <p className="text-xs font-medium">IP Whitelist</p>
                  <p className="text-[10px] text-muted-foreground">{policies.ipWhitelist.length} IPs</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Events */}
      <Card className="bg-card/40 border-border">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Recent Events
            </h3>
            <span className="text-[10px] text-muted-foreground">{counts.total} total</span>
          </div>
          <div className="space-y-1.5">
            {recentEvents.map((event) => (
              <div
                key={event.id}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors',
                  event.severity === 'CRITICAL'
                    ? 'border-rose/20 bg-rose/5'
                    : event.severity === 'WARNING'
                      ? 'border-amber/15 bg-amber/5'
                      : 'border-border bg-card/20',
                )}
              >
                {eventTypeIcon(event.eventType)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{event.description}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {event.eventType}
                    {event.ipAddress && (
                      <span className="ml-2">· {event.ipAddress}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {severityBadge(event.severity)}
                  {!event.resolved && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse-dot" />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 w-20 text-right">
                  {formatDate(event.createdAt)}
                </span>
              </div>
            ))}
            {recentEvents.length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No security events recorded
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Event Log Tab                                                      */
/* ------------------------------------------------------------------ */

function EventLogTab({ data, resolveMutation }: {
  data: SecurityData;
  resolveMutation: { mutate: (vars: { eventId: string; resolvedById: string | null }) => void; isPending: boolean };
}) {
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const eventTypes = useMemo(() => {
    const types = new Set(data.events.map(e => e.eventType));
    return Array.from(types).sort();
  }, [data.events]);

  const filtered = useMemo(() => {
    return data.events.filter(e => {
      if (severityFilter !== 'ALL' && e.severity !== severityFilter) return false;
      if (typeFilter !== 'ALL' && e.eventType !== typeFilter) return false;
      return true;
    });
  }, [data.events, severityFilter, typeFilter]);

  const currentUser = useDashboardStore(s => s.user);

  const handleResolve = (eventId: string) => {
    resolveMutation.mutate({
      eventId,
      resolvedById: currentUser?.id || null,
    });
  };

  return (
    <div className="flex flex-col gap-3 flex-1 overflow-hidden">
      {/* Filter row */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Severities</SelectItem>
            <SelectItem value="INFO">Info</SelectItem>
            <SelectItem value="WARNING">Warning</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {eventTypes.map(t => (
              <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {filtered.length} of {data.events.length} events
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] h-8 w-28">Time</TableHead>
              <TableHead className="text-[10px] h-8 w-36">Type</TableHead>
              <TableHead className="text-[10px] h-8 w-24">Severity</TableHead>
              <TableHead className="text-[10px] h-8">Description</TableHead>
              <TableHead className="text-[10px] h-8 w-28">IP Address</TableHead>
              <TableHead className="text-[10px] h-8 w-28">User</TableHead>
              <TableHead className="text-[10px] h-8 w-20">Status</TableHead>
              <TableHead className="text-[10px] h-8 w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(event => (
              <>
                <TableRow
                  key={event.id}
                  className={cn(
                    'cursor-pointer transition-colors',
                    expandedId === event.id && 'bg-card/60',
                  )}
                  onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                >
                  <TableCell className="text-[10px] py-2 text-muted-foreground">
                    {formatDate(event.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs py-2">
                    <div className="flex items-center gap-1.5">
                      {eventTypeIcon(event.eventType, 'h-3.5 w-3.5')}
                      <span>{event.eventType.replace(/_/g, ' ')}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">{severityBadge(event.severity)}</TableCell>
                  <TableCell className="text-xs py-2 max-w-[300px] truncate">{event.description}</TableCell>
                  <TableCell className="text-[10px] py-2 text-muted-foreground font-mono">
                    {event.ipAddress || '—'}
                  </TableCell>
                  <TableCell className="text-[10px] py-2 text-muted-foreground">
                    {event.userId || '—'}
                  </TableCell>
                  <TableCell className="py-2">
                    {event.resolved ? (
                      <Badge className="bg-emerald/15 text-emerald border-emerald/30 text-[10px] h-5" variant="outline">
                        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                        Resolved
                      </Badge>
                    ) : (
                      <Badge className="bg-amber/15 text-amber border-amber/30 text-[10px] h-5" variant="outline">
                        <Clock className="h-2.5 w-2.5 mr-0.5" />
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {expandedId === event.id ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </TableCell>
                </TableRow>
                {expandedId === event.id && (
                  <TableRow key={`${event.id}-detail`}>
                    <TableCell colSpan={8} className="px-6 py-3">
                      <div className="bg-card/40 border border-border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold">Event Details</span>
                          {!event.resolved && (
                            <Button
                              size="sm"
                              className="h-6 text-[10px] bg-emerald/15 text-emerald hover:bg-emerald/25 border-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResolve(event.id);
                              }}
                              disabled={resolveMutation.isPending}
                            >
                              {resolveMutation.isPending ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              )}
                              Resolve Event
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-muted-foreground">Event ID: </span>
                            <span className="font-mono">{event.id}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Created: </span>
                            <span>{formatDate(event.createdAt)}</span>
                          </div>
                          {event.userAgent && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">User Agent: </span>
                              <span className="font-mono break-all">{event.userAgent}</span>
                            </div>
                          )}
                          {event.resolvedAt && (
                            <div>
                              <span className="text-muted-foreground">Resolved At: </span>
                              <span>{formatDate(event.resolvedAt)}</span>
                            </div>
                          )}
                          {event.resolvedById && (
                            <div>
                              <span className="text-muted-foreground">Resolved By: </span>
                              <span>{event.resolvedById}</span>
                            </div>
                          )}
                        </div>
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <>
                            <Separator className="bg-border" />
                            <div>
                              <span className="text-[10px] text-muted-foreground font-medium">Metadata:</span>
                              <pre className="text-[10px] mt-1 p-2 rounded bg-card/60 border border-border overflow-x-auto max-h-32 overflow-y-auto font-mono">
                                {JSON.stringify(event.metadata, null, 2)}
                              </pre>
                            </div>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                  No events match the selected filters
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Users Tab                                                          */
/* ------------------------------------------------------------------ */

function UsersTab({ data, userMutation }: {
  data: SecurityData;
  userMutation: { mutate: (vars: { action: string; userId: string; reason?: string }, options?: { onSuccess?: () => void }) => void; isPending: boolean };
}) {
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    userId: string;
    userName: string;
    action: 'LOCK' | 'UNLOCK';
  }>({ open: false, userId: '', userName: '', action: 'LOCK' });

  const handleAction = () => {
    if (!confirmDialog.userId) return;
    userMutation.mutate(
      {
        action: confirmDialog.action === 'LOCK' ? 'LOCK_USER' : 'UNLOCK_USER',
        userId: confirmDialog.userId,
        reason: confirmDialog.action === 'LOCK' ? 'Manual lock by security admin' : undefined,
      },
      {
        onSuccess: () => setConfirmDialog({ open: false, userId: '', userName: '', action: 'LOCK' }),
      },
    );
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3 flex-1 overflow-hidden">
        <div className="flex items-center gap-2 shrink-0">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{data.users.length} users</span>
        </div>

        <div className="flex-1 overflow-y-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] h-8">Name</TableHead>
                <TableHead className="text-[10px] h-8">Email</TableHead>
                <TableHead className="text-[10px] h-8 w-24">Role</TableHead>
                <TableHead className="text-[10px] h-8 w-32">Trust Score</TableHead>
                <TableHead className="text-[10px] h-8 w-28">Biometric Risk</TableHead>
                <TableHead className="text-[10px] h-8 w-28">Last Audit</TableHead>
                <TableHead className="text-[10px] h-8 w-24">Status</TableHead>
                <TableHead className="text-[10px] h-8 w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="text-xs py-2.5 font-medium">
                    <div className="flex items-center gap-2">
                      {user.isLocked ? (
                        <XCircle className="h-3.5 w-3.5 text-rose shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald shrink-0" />
                      )}
                      {user.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-[10px] py-2.5 text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Badge className="bg-cyan/15 text-cyan border-cyan/30 text-[10px] h-5" variant="outline">
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={user.deviceTrustScore}
                        className={cn('h-1.5 w-16', trustBarColor(user.deviceTrustScore))}
                      />
                      <span className={cn('text-[10px] font-medium tabular-nums', trustScoreColor(user.deviceTrustScore))}>
                        {user.deviceTrustScore}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 cursor-default">
                          <Progress
                            value={user.biometricRiskScore * 100}
                            className={cn('h-1.5 w-12', riskBarColor(user.biometricRiskScore))}
                          />
                          <span className={cn('text-[10px] font-medium', riskLabelColor(user.biometricRiskScore))}>
                            {riskLabel(user.biometricRiskScore)}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                        <p>Biometric risk score: <span className="font-mono font-medium">{(user.biometricRiskScore * 100).toFixed(1)}%</span></p>
                        <p className="text-muted-foreground mt-1">
                          {user.biometricRiskScore < 0.3
                            ? 'Low risk — biometric patterns are consistent with enrolled identity.'
                            : user.biometricRiskScore < 0.7
                              ? 'Medium risk — some anomalies detected in biometric verification.'
                              : 'High risk — significant discrepancies in biometric data. Review recommended.'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-[10px] py-2.5 text-muted-foreground">
                    {formatDate(user.lastSecurityAuditAt)}
                  </TableCell>
                  <TableCell className="py-2.5">
                    {user.isLocked ? (
                      <Badge className="bg-rose/15 text-rose border-rose/30 text-[10px] h-5" variant="outline">
                        <Lock className="h-2.5 w-2.5 mr-0.5" />
                        Locked
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald/15 text-emerald border-emerald/30 text-[10px] h-5" variant="outline">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5">
                    {user.isLocked ? (
                      <Button
                        size="sm"
                        className="h-6 text-[10px] bg-emerald/15 text-emerald hover:bg-emerald/25 border-0"
                        onClick={() => setConfirmDialog({ open: true, userId: user.id, userName: user.name, action: 'UNLOCK' })}
                        disabled={userMutation.isPending}
                      >
                        Unlock
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-6 text-[10px] bg-rose/15 text-rose hover:bg-rose/25 border-0"
                        onClick={() => setConfirmDialog({ open: true, userId: user.id, userName: user.name, action: 'LOCK' })}
                        disabled={userMutation.isPending}
                      >
                        Lock
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data.users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Confirm Dialog */}
        <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(d => ({ ...d, open }))}>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                {confirmDialog.action === 'LOCK' ? (
                  <Lock className="h-4 w-4 text-rose" />
                ) : (
                  <UnlockIcon className="h-4 w-4 text-emerald" />
                )}
                {confirmDialog.action === 'LOCK' ? 'Lock User Account' : 'Unlock User Account'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {confirmDialog.action === 'LOCK'
                  ? `Are you sure you want to lock ${confirmDialog.userName}? The user will be immediately signed out and prevented from logging in.`
                  : `Are you sure you want to unlock ${confirmDialog.userName}? The user will be able to log in again.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setConfirmDialog({ open: false, userId: '', userName: '', action: 'LOCK' })}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className={cn(
                  'h-8 text-xs border-0',
                  confirmDialog.action === 'LOCK'
                    ? 'bg-rose text-white hover:bg-rose/80'
                    : 'bg-emerald text-white hover:bg-emerald/80',
                )}
                onClick={handleAction}
                disabled={userMutation.isPending}
              >
                {userMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {confirmDialog.action === 'LOCK' ? 'Lock Account' : 'Unlock Account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

/* Simple unlock icon (avoid importing Unlock from lucide if not available) */
function UnlockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Policies Tab                                                       */
/* ------------------------------------------------------------------ */

function PoliciesTab({ data, policyMutation }: {
  data: SecurityData;
  policyMutation: { mutate: (body: Record<string, unknown>) => void; isPending: boolean };
}) {
  const policies = data.policies;
  const [encryptionEnabled, setEncryptionEnabled] = useState(policies?.encryptionEnabled ?? false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(policies?.twoFactorEnabled ?? false);
  const [sessionTimeout, setSessionTimeout] = useState(policies?.sessionTimeoutMin ?? 30);
  const [dataRetention, setDataRetention] = useState(policies?.dataRetentionDays ?? 365);
  const [auditLogRetention, setAuditLogRetention] = useState(policies?.auditLogRetentionDays ?? 90);
  const [ipList, setIpList] = useState<string[]>(policies?.ipWhitelist ?? []);
  const [newIp, setNewIp] = useState('');

  const handleAddIp = () => {
    const trimmed = newIp.trim();
    if (!trimmed) return;
    if (ipList.includes(trimmed)) {
      toast.error('IP address already in whitelist');
      return;
    }
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(trimmed)) {
      toast.error('Invalid IP address format');
      return;
    }
    setIpList(prev => [...prev, trimmed]);
    setNewIp('');
  };

  const handleRemoveIp = (ip: string) => {
    setIpList(prev => prev.filter(i => i !== ip));
  };

  const handleSave = () => {
    policyMutation.mutate({
      action: 'UPDATE_POLICY',
      encryptionEnabled,
      twoFactorEnabled,
      sessionTimeoutMin: sessionTimeout,
      ipWhitelist: JSON.stringify(ipList),
      dataRetentionDays: dataRetention,
    });
  };

  const hasChanges = policies && (
    encryptionEnabled !== policies.encryptionEnabled ||
    twoFactorEnabled !== policies.twoFactorEnabled ||
    sessionTimeout !== policies.sessionTimeoutMin ||
    dataRetention !== policies.dataRetentionDays ||
    auditLogRetention !== policies.auditLogRetentionDays ||
    JSON.stringify(ipList) !== JSON.stringify(policies.ipWhitelist)
  );

  if (!policies) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
        No policy data available
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto flex-1 pr-1">
      {/* Encryption & 2FA */}
      <Card className="bg-card/40 border-border">
        <CardContent className="p-4 space-y-4">
          <h3 className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            Authentication & Encryption
          </h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-cyan" />
              <div>
                <Label className="text-xs font-medium">Encryption at Rest (AES-256)</Label>
                <p className="text-[10px] text-muted-foreground">Encrypt all sensitive data stored in the database</p>
              </div>
            </div>
            <Switch
              checked={encryptionEnabled}
              onCheckedChange={setEncryptionEnabled}
            />
          </div>

          <Separator className="bg-border" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-emerald" />
              <div>
                <Label className="text-xs font-medium">Two-Factor Authentication</Label>
                <p className="text-[10px] text-muted-foreground">Require 2FA for all user accounts in this tenant</p>
              </div>
            </div>
            <Switch
              checked={twoFactorEnabled}
              onCheckedChange={setTwoFactorEnabled}
            />
          </div>

          <Separator className="bg-border" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Fingerprint className="h-4 w-4 text-amber" />
              <div>
                <Label className="text-xs font-medium">IP Whitelisting</Label>
                <p className="text-[10px] text-muted-foreground">Restrict access to whitelisted IP addresses only</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-card/60 border-border text-[10px] h-5" variant="outline">
                {ipList.length} IPs
              </Badge>
              <Switch
                checked={ipList.length > 0}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    setIpList([]);
                  }
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session & Retention */}
      <Card className="bg-card/40 border-border">
        <CardContent className="p-4 space-y-4">
          <h3 className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Session & Data Retention
          </h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Session Timeout</Label>
              <span className="text-xs font-medium tabular-nums text-cyan">{sessionTimeout} min</span>
            </div>
            <Slider
              value={[sessionTimeout]}
              onValueChange={([v]) => setSessionTimeout(v)}
              min={5}
              max={120}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>5 min</span>
              <span>120 min</span>
            </div>
          </div>

          <Separator className="bg-border" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data Retention (days)</Label>
              <Input
                type="number"
                value={dataRetention}
                onChange={(e) => setDataRetention(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={3650}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">How long to retain election and incident data</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Audit Log Retention (days)</Label>
              <Input
                type="number"
                value={auditLogRetention}
                onChange={(e) => setAuditLogRetention(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={3650}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">How long to retain security audit logs</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* IP Whitelist Management */}
      <Card className="bg-card/40 border-border">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
            <Fingerprint className="h-3.5 w-3.5" />
            IP Whitelist Management
          </h3>

          <div className="flex items-center gap-2">
            <Input
              placeholder="e.g. 192.168.1.0/24"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddIp()}
              className="h-8 text-xs font-mono flex-1"
            />
            <Button
              size="sm"
              className="h-8 text-xs bg-emerald/15 text-emerald hover:bg-emerald/25 border-0 shrink-0"
              onClick={handleAddIp}
              disabled={!newIp.trim()}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>

          {ipList.length > 0 ? (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {ipList.map(ip => (
                <div
                  key={ip}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-card/30 border border-border group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
                    <span className="text-xs font-mono">{ip}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-rose opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveIp(ip)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-[10px] text-muted-foreground">
              No IP addresses in whitelist. Add IPs above or disable IP whitelisting.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between sticky bottom-0 py-2">
        {hasChanges && (
          <span className="text-[10px] text-amber flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Unsaved changes
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {hasChanges && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                if (!policies) return;
                setEncryptionEnabled(policies.encryptionEnabled);
                setTwoFactorEnabled(policies.twoFactorEnabled);
                setSessionTimeout(policies.sessionTimeoutMin);
                setDataRetention(policies.dataRetentionDays);
                setAuditLogRetention(policies.auditLogRetentionDays);
                setIpList(policies.ipWhitelist);
                toast.info('Changes discarded');
              }}
            >
              Discard
            </Button>
          )}
          <Button
            size="sm"
            className={cn(
              'h-8 text-xs',
              hasChanges
                ? 'bg-emerald text-white hover:bg-emerald/80'
                : 'bg-muted text-muted-foreground',
            )}
            onClick={handleSave}
            disabled={!hasChanges || policyMutation.isPending}
          >
            {policyMutation.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <ShieldCheck className="h-3 w-3 mr-1" />
            )}
            Save Policies
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Export                                                        */
/* ------------------------------------------------------------------ */

export function SecurityCenter() {
  const tenantId = useDashboardStore(s => s.tenantId);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<SecurityData>({
    queryKey: ['security', tenantId],
    queryFn: async () => {
      return fetchJson(`/api/security?tenantId=${tenantId}`);
    },
    refetchInterval: 15000,
    enabled: !!tenantId,
  });

  /* Mutations */
  const resolveMutation = useMutation({
    mutationFn: async (vars: { eventId: string; resolvedById: string | null }) => {
      await fetchJson('/api/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESOLVE_EVENT',
          eventId: vars.eventId,
          resolvedById: vars.resolvedById,
        }),
      });
    },
    onSuccess: () => {
      toast.success('Event resolved successfully');
      queryClient.invalidateQueries({ queryKey: ['security', tenantId] });
    },
    onError: () => {
      toast.error('Failed to resolve event');
    },
  });

  const userMutation = useMutation({
    mutationFn: async (vars: { action: string; userId: string; reason?: string }) => {
      await fetchJson('/api/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: vars.action,
          userId: vars.userId,
          reason: vars.reason,
        }),
      });
    },
    onSuccess: (_data, vars) => {
      const label = vars.action === 'LOCK_USER' ? 'locked' : 'unlocked';
      toast.success(`User ${label} successfully`);
      queryClient.invalidateQueries({ queryKey: ['security', tenantId] });
    },
    onError: (_data, vars) => {
      toast.error(`Failed to ${vars.action.replace('_', ' ').toLowerCase()}`);
    },
  });

  const policyMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      await fetchJson('/api/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success('Security policies updated');
      queryClient.invalidateQueries({ queryKey: ['security', tenantId] });
    },
    onError: () => {
      toast.error('Failed to update policies');
    },
  });

  /* Render */
  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Shield className="h-5 w-5 text-emerald" />
          <h2 className="text-sm font-semibold">Security Center</h2>
        </div>
        {data && (
          <Badge
            className={cn(
              'text-[10px] h-5 font-medium',
              data.securityScore >= 80
                ? 'bg-emerald/15 text-emerald border-emerald/30'
                : data.securityScore >= 50
                  ? 'bg-amber/15 text-amber border-amber/30'
                  : 'bg-rose/15 text-rose border-rose/30',
            )}
            variant="outline"
          >
            <Activity className="h-2.5 w-2.5 mr-0.5" />
            Score: {data.securityScore}
          </Badge>
        )}
      </div>

      {/* Content */}
      {isLoading && !data ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
          <span className="ml-2 text-xs text-muted-foreground">Loading security data...</span>
        </div>
      ) : isError && !data ? (
        <div className="flex-1 flex items-center justify-center">
          <ShieldAlert className="h-6 w-6 text-rose mr-2" />
          <span className="text-xs text-rose">Failed to load security data</span>
        </div>
      ) : data ? (
        <Tabs defaultValue="overview" className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="shrink-0 h-8">
            <TabsTrigger value="overview" className="text-[11px] px-3 gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="events" className="text-[11px] px-3 gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Event Log
              {data.counts.unresolved > 0 && (
                <Badge className="bg-amber/15 text-amber border-amber/30 text-[9px] h-4 ml-0.5 px-1">
                  {data.counts.unresolved}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="text-[11px] px-3 gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Users
            </TabsTrigger>
            <TabsTrigger value="policies" className="text-[11px] px-3 gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Policies
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 overflow-hidden mt-2">
            <OverviewTab data={data} />
          </TabsContent>

          <TabsContent value="events" className="flex-1 overflow-hidden mt-2">
            <EventLogTab data={data} resolveMutation={resolveMutation} />
          </TabsContent>

          <TabsContent value="users" className="flex-1 overflow-hidden mt-2">
            <UsersTab data={data} userMutation={userMutation} />
          </TabsContent>

          <TabsContent value="policies" className="flex-1 overflow-hidden mt-2">
            <PoliciesTab data={data} policyMutation={policyMutation} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}