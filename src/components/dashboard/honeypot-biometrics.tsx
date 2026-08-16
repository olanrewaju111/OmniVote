'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Radar, Fingerprint, Accessibility, Plus, Loader2, ShieldAlert,
  Shield, AlertTriangle, AlertCircle, Eye, EyeOff, CheckCircle2, XCircle,
  Wifi, WifiOff, Lock, Users, Activity, TrendingDown, Target,
  Siren, CircleDot, Circle, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { toast } from 'sonner';
import { useDashboardStore } from '@/store/dashboard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

interface HoneypotResult {
  party: string;
  votes: number;
}

interface Honeypot {
  id: string;
  name: string;
  state: string;
  lga: string | null;
  isDecoy: boolean;
  trapType: string;
  isActive: boolean;
  expectedResults: HoneypotResult[];
  officialResults: HoneypotResult[];
  deviationDetected: boolean;
  deviationPct: number;
  alertTriggered: boolean;
  pollingUnit: { name: string; code: string };
}

interface AccessibilityReport {
  id: string;
  pollingUnit: { name: string; code: string; state: string };
  features: {
    rampAccess: boolean;
    brailleBallots: boolean;
    signLanguage: boolean;
    assistiveTech: boolean;
    accessibleToilet: boolean;
  };
  barrierTypes: string[];
  pwdVotersServed: number;
  pwdVotersTurnedAway: number;
  overallScore: number;
  verified: boolean;
  createdAt: string;
}

interface BiometricAgent {
  id: string;
  name: string;
  biometricRiskScore: number;
  deviceTrustScore: number;
  isLocked: boolean;
  biometricProfile: {
    typingCadence?: number;
    touchPressure?: number;
    gyroPattern?: string;
    lastProfiled?: string;
  } | null;
}

interface HoneypotData {
  honeypots: Honeypot[];
  accessibility: AccessibilityReport[];
  stats: {
    totalHoneypots: number;
    activeHoneypots: number;
    byTrapType: Record<string, number>;
    deviationsDetected: number;
    alertsTriggered: number;
    avgDeviationPct: number;
    totalAccessibilityReports: number;
    avgAccessibilityScore: number;
    pwdServed: number;
    pwdTurnedAway: number;
  };
  biometricSummary: {
    totalProfiled: number;
    avgRiskScore: number;
    avgTrustScore: number;
    highRiskAgents: number;
    agents: BiometricAgent[];
  };
  trapEffectiveness: {
    totalTraps: number;
    trapsWithDeviations: number;
    effectivenessPct: number;
  };
}

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const TRAP_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  GHOST_UNIT: { label: 'Ghost Unit', color: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
  TAMPER_TRAP: { label: 'Tamper Trap', color: 'text-orange', bg: 'bg-orange/10', border: 'border-orange/30' },
  REPLAY_DETECTOR: { label: 'Replay Detector', color: 'text-cyan', bg: 'bg-cyan/10', border: 'border-cyan/30' },
};

const BARRIER_OPTIONS = [
  'No Ramp', 'Narrow Doorway', 'Missing Signage', 'No Assistive Tech',
  'Untrained Staff', 'Inaccessible Restroom', 'Poor Lighting',
  'Uneven Surface', 'No Handrails', 'Language Barrier',
];

const FEATURE_LABELS: Record<string, string> = {
  rampAccess: 'Ramp Access',
  brailleBallots: 'Braille Ballots',
  signLanguage: 'Sign Language',
  assistiveTech: 'Assistive Tech',
  accessibleToilet: 'Accessible Toilet',
};

// ────────────────────────────────────────────
// Helper: Stat card
// ────────────────────────────────────────────

function StatCard({
  icon, label, value, color, sub,
}: {
  icon: React.ReactNode; label: string; value: string | number; color: string; sub?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald', cyan: 'text-cyan', amber: 'text-amber',
    rose: 'text-rose', purple: 'text-purple', foreground: 'text-foreground',
  };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card className="border-border bg-card/40">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={colorMap[color] || 'text-muted-foreground'}>{icon}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
          </div>
          <p className={cn('text-lg font-bold tabular-nums', colorMap[color] || 'text-foreground')}>{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ────────────────────────────────────────────
// Helper: Colored progress bar
// ────────────────────────────────────────────

function ColorBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-2 bg-secondary rounded-full overflow-hidden w-full min-w-[80px]">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

// ────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────

export function HoneypotBiometrics() {
  const queryClient = useQueryClient();
  const { tenantId } = useDashboardStore();

  // Dialog states
  const [honeypotDialogOpen, setHoneypotDialogOpen] = useState(false);
  const [accessibilityDialogOpen, setAccessibilityDialogOpen] = useState(false);

  // ── Honeypot form state ──
  const [hpName, setHpName] = useState('');
  const [hpState, setHpState] = useState('');
  const [hpLga, setHpLga] = useState('');
  const [hpTrapType, setHpTrapType] = useState('');
  const [hpExpectedResults, setHpExpectedResults] = useState<Array<{ party: string; votes: string }>>([
    { party: '', votes: '' },
  ]);

  // ── Accessibility form state ──
  const [arPollingUnitId, setArPollingUnitId] = useState('');
  const [arFeatures, setArFeatures] = useState({
    rampAccess: false, brailleBallots: false, signLanguage: false,
    assistiveTech: false, accessibleToilet: false,
  });
  const [arBarriers, setArBarriers] = useState<string[]>([]);
  const [arPwdServed, setArPwdServed] = useState('');
  const [arPwdTurnedAway, setArPwdTurnedAway] = useState('');
  const [arScore, setArScore] = useState([50]);

  // ── Data fetching ──
  const { data, isLoading, isError, refetch } = useQuery<HoneypotData>({
    queryKey: ['honeypot', tenantId],
    queryFn: () =>
      fetchJson(`/api/honeypot?tenantId=${tenantId}`),
    refetchInterval: 30000,
  });

  // ── Mutation ──
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchJson(`/api/honeypot?tenantId=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['honeypot', tenantId] });
      toast.success('Action completed successfully');
    },
    onError: () => {
      toast.error('Failed to complete action');
    },
  });

  const isMutating = mutation.isPending;

  // ── Derived data ──
  const honeypots = data?.honeypots || [];
  const accessibility = data?.accessibility || [];
  const stats = data?.stats;
  const biometricSummary = data?.biometricSummary;
  const trapEffectiveness = data?.trapEffectiveness;
  const biometricAgents = useMemo(
    () =>
      [...(biometricSummary?.agents || [])].sort(
        (a, b) => b.biometricRiskScore - a.biometricRiskScore,
      ),
    [biometricSummary],
  );

  // ── Honeypot dialog handlers ──
  const resetHoneypotForm = () => {
    setHpName('');
    setHpState('');
    setHpLga('');
    setHpTrapType('');
    setHpExpectedResults([{ party: '', votes: '' }]);
  };

  const handleAddResultRow = () => {
    setHpExpectedResults((prev) => [...prev, { party: '', votes: '' }]);
  };

  const handleRemoveResultRow = (idx: number) => {
    setHpExpectedResults((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleResultChange = (idx: number, field: 'party' | 'votes', value: string) => {
    setHpExpectedResults((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  };

  const handleSubmitHoneypot = () => {
    if (!hpName.trim() || !hpState.trim() || !hpTrapType) {
      toast.error('Please fill in name, state, and trap type');
      return;
    }
    const validResults = hpExpectedResults
      .filter((r) => r.party.trim() && r.votes.trim())
      .map((r) => ({ party: r.party.trim(), votes: Number(r.votes) }));
    mutation.mutate(
      {
        action: 'CREATE_HONEYPOT',
        name: hpName.trim(),
        state: hpState.trim(),
        lga: hpLga.trim() || null,
        trapType: hpTrapType,
        expectedResults: validResults,
      },
      {
        onSuccess: () => {
          setHoneypotDialogOpen(false);
          resetHoneypotForm();
        },
      },
    );
  };

  // ── Accessibility dialog handlers ──
  const resetAccessibilityForm = () => {
    setArPollingUnitId('');
    setArFeatures({
      rampAccess: false, brailleBallots: false, signLanguage: false,
      assistiveTech: false, accessibleToilet: false,
    });
    setArBarriers([]);
    setArPwdServed('');
    setArPwdTurnedAway('');
    setArScore([50]);
  };

  const toggleBarrier = (barrier: string) => {
    setArBarriers((prev) =>
      prev.includes(barrier) ? prev.filter((b) => b !== barrier) : [...prev, barrier],
    );
  };

  const toggleFeature = (key: keyof typeof arFeatures) => {
    setArFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmitAccessibility = () => {
    if (!arPollingUnitId.trim()) {
      toast.error('Please enter a polling unit ID');
      return;
    }
    mutation.mutate(
      {
        action: 'CREATE_ACCESSIBILITY_REPORT',
        pollingUnitId: arPollingUnitId.trim(),
        features: arFeatures,
        barrierTypes: arBarriers,
        pwdVotersServed: Number(arPwdServed) || 0,
        pwdVotersTurnedAway: Number(arPwdTurnedAway) || 0,
        overallScore: arScore[0],
      },
      {
        onSuccess: () => {
          setAccessibilityDialogOpen(false);
          resetAccessibilityForm();
        },
      },
    );
  };

  // ── Render ──
  return (
    <div className="h-full flex flex-col p-4 sm:p-6 gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Radar className="h-5 w-5 text-purple" />
            Honeypot Stations, Biometrics & PWD Tracking
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Decoy traps, agent biometric verification, and accessibility compliance
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-1.5 text-xs"
        >
          <Activity className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {isError ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[200px] text-center p-6">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <p className="text-sm text-muted-foreground">Failed to load data. Please try again.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-purple" />
        </div>
      ) : (
        <Tabs defaultValue="honeypot" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="shrink-0">
            <TabsTrigger value="honeypot" className="gap-1.5 text-xs">
              <ShieldAlert className="h-3.5 w-3.5" />
              Honeypot Stations
            </TabsTrigger>
            <TabsTrigger value="biometrics" className="gap-1.5 text-xs">
              <Fingerprint className="h-3.5 w-3.5" />
              Biometrics
            </TabsTrigger>
            <TabsTrigger value="pwd" className="gap-1.5 text-xs">
              <Accessibility className="h-3.5 w-3.5" />
              PWD / Accessibility
            </TabsTrigger>
          </TabsList>

          {/* ═══════════ TAB 1: Honeypot Stations ═══════════ */}
          <TabsContent value="honeypot" className="flex-1 min-h-0 flex flex-col gap-4 mt-3">
            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 shrink-0">
              <StatCard
                icon={<ShieldAlert className="h-3.5 w-3.5" />}
                label="Total Traps"
                value={stats?.totalHoneypots ?? 0}
                color="purple"
              />
              <StatCard
                icon={<CircleDot className="h-3.5 w-3.5" />}
                label="Active Traps"
                value={stats?.activeHoneypots ?? 0}
                color="emerald"
              />
              <StatCard
                icon={<TrendingDown className="h-3.5 w-3.5" />}
                label="Deviations Detected"
                value={stats?.deviationsDetected ?? 0}
                color="rose"
              />
              <StatCard
                icon={<Siren className="h-3.5 w-3.5" />}
                label="Alerts Triggered"
                value={stats?.alertsTriggered ?? 0}
                color="rose"
                sub="Critical"
              />
              <StatCard
                icon={<Target className="h-3.5 w-3.5" />}
                label="Trap Effectiveness"
                value={`${trapEffectiveness?.effectivenessPct ?? 0}%`}
                color="emerald"
                sub={`${trapEffectiveness?.trapsWithDeviations ?? 0} of ${trapEffectiveness?.totalTraps ?? 0}`}
              />
            </div>

            {/* Create button */}
            <div className="shrink-0 flex justify-end">
              <Button
                size="sm"
                onClick={() => setHoneypotDialogOpen(true)}
                className="gap-1.5 text-xs bg-purple hover:bg-purple/90"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Honeypot
              </Button>
            </div>

            {/* Honeypot cards grid */}
            <ScrollArea className="flex-1 min-h-0">
              {honeypots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <ShieldAlert className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No honeypot stations deployed</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pr-4 pb-4">
                  {honeypots.map((hp, idx) => (
                    <motion.div
                      key={hp.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.25 }}
                    >
                      <Card
                        className={cn(
                          'border transition-colors',
                          hp.alertTriggered
                            ? 'border-rose/50 bg-rose/5'
                            : hp.deviationDetected
                              ? 'border-amber/40 bg-amber/5'
                              : 'border-border bg-card/40',
                        )}
                      >
                        <CardContent className="p-4 space-y-3">
                          {/* Top: name, status, type */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold truncate">{hp.name}</span>
                                {hp.alertTriggered && (
                                  <Badge className="bg-rose text-white text-[10px] h-5 px-1.5 gap-1">
                                    <Siren className="h-3 w-3" />
                                    SOS
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {hp.state}{hp.lga ? ` · ${hp.lga}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] h-5 px-1.5',
                                  TRAP_TYPE_CONFIG[hp.trapType]?.bg,
                                  TRAP_TYPE_CONFIG[hp.trapType]?.color,
                                  TRAP_TYPE_CONFIG[hp.trapType]?.border,
                                )}
                              >
                                {TRAP_TYPE_CONFIG[hp.trapType]?.label || hp.trapType}
                              </Badge>
                              <div className="flex items-center gap-1">
                                {hp.isActive ? (
                                  <>
                                    <span className="h-2 w-2 rounded-full bg-emerald animate-pulse" />
                                    <span className="text-[10px] text-emerald">Active</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                                    <span className="text-[10px] text-muted-foreground">Inactive</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Deviation banner */}
                          {hp.deviationDetected && (
                            <div className="flex items-center gap-2 rounded-md bg-rose/10 border border-rose/30 px-3 py-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-rose shrink-0" />
                              <span className="text-xs font-semibold text-rose">DEVIATION DETECTED</span>
                              <span className="text-xs text-rose/70 ml-auto tabular-nums">{hp.deviationPct.toFixed(1)}%</span>
                            </div>
                          )}

                          {/* Results comparison */}
                          <div className="rounded-md border border-border overflow-hidden">
                            <div className="grid grid-cols-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/50 px-3 py-1.5 font-medium">
                              <span>Expected</span>
                              <span>Official</span>
                            </div>
                            {hp.officialResults.length === 0 ? (
                              <div className="text-xs text-muted-foreground/70 italic px-3 py-2 border-t border-border/50">
                                No official results received yet
                              </div>
                            ) : (
                              hp.expectedResults.map((er, ri) => {
                                const or = hp.officialResults.find((o) => o.party === er.party);
                                return (
                                  <div
                                    key={ri}
                                    className="grid grid-cols-2 text-xs border-t border-border/50 px-3 py-1.5"
                                  >
                                    <span className="tabular-nums">
                                      <span className="text-muted-foreground mr-1.5">{er.party}:</span>
                                      {er.votes.toLocaleString()}
                                    </span>
                                    <span className="tabular-nums">
                                      <span className="text-muted-foreground mr-1.5">{er.party}:</span>
                                      {or ? or.votes.toLocaleString() : '—'}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Deviation footer */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Deviation</span>
                            <span
                              className={cn(
                                'font-bold tabular-nums',
                                hp.deviationPct > 5 ? 'text-rose' : 'text-emerald',
                              )}
                            >
                              {hp.deviationPct.toFixed(1)}%
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* ═══════════ TAB 2: Biometrics ═══════════ */}
          <TabsContent value="biometrics" className="flex-1 min-h-0 flex flex-col gap-4 mt-3">
            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <StatCard
                icon={<Fingerprint className="h-3.5 w-3.5" />}
                label="Total Profiled"
                value={biometricSummary?.totalProfiled ?? 0}
                color="cyan"
              />
              <StatCard
                icon={<TrendingDown className="h-3.5 w-3.5" />}
                label="Avg Risk Score"
                value={biometricSummary?.avgRiskScore != null ? biometricSummary.avgRiskScore.toFixed(2) : '0.00'}
                color="amber"
              />
              <StatCard
                icon={<ShieldAlert className="h-3.5 w-3.5" />}
                label="High Risk Agents"
                value={biometricSummary?.highRiskAgents ?? 0}
                color="rose"
              />
              <StatCard
                icon={<Shield className="h-3.5 w-3.5" />}
                label="Avg Trust Score"
                value={biometricSummary?.avgTrustScore != null ? biometricSummary.avgTrustScore.toFixed(2) : '0.00'}
                color="emerald"
              />
            </div>

            {/* Biometrics table */}
            <ScrollArea className="flex-1 min-h-0">
              {biometricAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Fingerprint className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No biometric profiles recorded</p>
                </div>
              ) : (
                <Table className="pr-4 pb-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Agent Name</TableHead>
                      <TableHead className="text-xs">Risk Score</TableHead>
                      <TableHead className="text-xs">Trust Score</TableHead>
                      <TableHead className="text-xs">Device Status</TableHead>
                      <TableHead className="text-xs">Locked</TableHead>
                      <TableHead className="text-xs">Profile Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {biometricAgents.map((agent, idx) => {
                      const riskColor =
                        agent.biometricRiskScore > 0.7
                          ? 'text-rose'
                          : agent.biometricRiskScore > 0.3
                            ? 'text-amber'
                            : 'text-emerald';
                      const riskBarColor =
                        agent.biometricRiskScore > 0.7
                          ? 'var(--color-rose)'
                          : agent.biometricRiskScore > 0.3
                            ? 'var(--color-amber)'
                            : 'var(--color-emerald)';

                      return (
                        <motion.tr
                          key={agent.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03, duration: 0.2 }}
                          className="border-b transition-colors hover:bg-muted/50"
                        >
                          <TableCell className="text-xs font-medium py-2.5">{agent.name}</TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2 min-w-[140px]">
                              <ColorBar value={agent.biometricRiskScore} max={1} color={riskBarColor} />
                              <span className={cn('text-xs font-bold tabular-nums shrink-0', riskColor)}>
                                {agent.biometricRiskScore.toFixed(2)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className="text-xs tabular-nums text-cyan font-medium">
                              {agent.deviceTrustScore.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            {agent.isLocked ? (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <WifiOff className="h-3 w-3" />
                                Offline
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-emerald">
                                <Wifi className="h-3 w-3" />
                                Online
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {agent.isLocked ? (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-rose/30 text-rose bg-rose/10 gap-1">
                                <Lock className="h-2.5 w-2.5" />
                                Locked
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-emerald/30 text-emerald bg-emerald/10 gap-1">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Open
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {agent.biometricProfile ? (
                              <div className="flex flex-wrap gap-1">
                                {agent.biometricProfile.typingCadence != null && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 border-cyan/30 text-cyan">
                                    TC: {agent.biometricProfile.typingCadence}ms
                                  </Badge>
                                )}
                                {agent.biometricProfile.touchPressure != null && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber/30 text-amber">
                                    TP: {agent.biometricProfile.touchPressure}
                                  </Badge>
                                )}
                                {agent.biometricProfile.gyroPattern && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 border-purple/30 text-purple">
                                    GP: {agent.biometricProfile.gyroPattern}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          {/* ═══════════ TAB 3: PWD / Accessibility ═══════════ */}
          <TabsContent value="pwd" className="flex-1 min-h-0 flex flex-col gap-4 mt-3">
            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 shrink-0">
              <StatCard
                icon={<Accessibility className="h-3.5 w-3.5" />}
                label="Total Reports"
                value={stats?.totalAccessibilityReports ?? 0}
                color="cyan"
              />
              <StatCard
                icon={<Activity className="h-3.5 w-3.5" />}
                label="Avg Score"
                value={stats?.avgAccessibilityScore != null ? `${stats.avgAccessibilityScore.toFixed(1)}` : '0'}
                color="amber"
              />
              <StatCard
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="PWD Served"
                value={stats?.pwdServed ?? 0}
                color="emerald"
              />
              <StatCard
                icon={<XCircle className="h-3.5 w-3.5" />}
                label="PWD Turned Away"
                value={stats?.pwdTurnedAway ?? 0}
                color="rose"
              />
              <StatCard
                icon={<Eye className="h-3.5 w-3.5" />}
                label="Verified"
                value={accessibility.filter((r) => r.verified).length}
                color="emerald"
                sub={`of ${accessibility.length}`}
              />
            </div>

            {/* Create button */}
            <div className="shrink-0 flex justify-end">
              <Button
                size="sm"
                onClick={() => setAccessibilityDialogOpen(true)}
                className="gap-1.5 text-xs bg-cyan hover:bg-cyan/90 text-black"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Report
              </Button>
            </div>

            {/* Accessibility table */}
            <ScrollArea className="flex-1 min-h-0">
              {accessibility.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Accessibility className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No accessibility reports filed</p>
                </div>
              ) : (
                <Table className="pr-4 pb-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Polling Unit</TableHead>
                      <TableHead className="text-xs">State</TableHead>
                      <TableHead className="text-xs">Score</TableHead>
                      <TableHead className="text-xs">PWD Served</TableHead>
                      <TableHead className="text-xs">Turned Away</TableHead>
                      <TableHead className="text-xs">Barriers</TableHead>
                      <TableHead className="text-xs">Verified</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessibility.map((report, idx) => {
                      const scoreColor =
                        report.overallScore > 80
                          ? 'text-emerald'
                          : report.overallScore > 60
                            ? 'text-cyan'
                            : report.overallScore > 30
                              ? 'text-amber'
                              : 'text-rose';
                      const scoreBarColor =
                        report.overallScore > 80
                          ? 'var(--color-emerald)'
                          : report.overallScore > 60
                            ? 'var(--color-cyan)'
                            : report.overallScore > 30
                              ? 'var(--color-amber)'
                              : 'var(--color-rose)';

                      return (
                        <motion.tr
                          key={report.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03, duration: 0.2 }}
                          className="border-b transition-colors hover:bg-muted/50"
                        >
                          <TableCell className="py-2.5">
                            <div>
                              <p className="text-xs font-medium">{report.pollingUnit.name}</p>
                              <p className="text-[10px] text-muted-foreground">{report.pollingUnit.code}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground py-2.5">
                            {report.pollingUnit.state}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <ColorBar value={report.overallScore} max={100} color={scoreBarColor} />
                              <span className={cn('text-xs font-bold tabular-nums shrink-0', scoreColor)}>
                                {report.overallScore}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs tabular-nums py-2.5 text-emerald font-medium">
                            {report.pwdVotersServed}
                          </TableCell>
                          <TableCell className="text-xs tabular-nums py-2.5 text-rose font-medium">
                            {report.pwdVotersTurnedAway}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {report.barrierTypes.map((b, bi) => (
                                <Badge
                                  key={bi}
                                  variant="outline"
                                  className="text-[9px] h-4 px-1 border-amber/30 text-amber"
                                >
                                  {b}
                                </Badge>
                              ))}
                              {report.barrierTypes.length === 0 && (
                                <span className="text-[11px] text-muted-foreground">None</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            {report.verified ? (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-emerald/30 text-emerald bg-emerald/10 gap-1">
                                <Eye className="h-2.5 w-2.5" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-muted-foreground/30 text-muted-foreground gap-1">
                                <EyeOff className="h-2.5 w-2.5" />
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground py-2.5 tabular-nums">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* DIALOG: Create Honeypot                               */}
      {/* ═══════════════════════════════════════════════════ */}
      <Dialog open={honeypotDialogOpen} onOpenChange={(open) => {
        if (!open) resetHoneypotForm();
        setHoneypotDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-purple" />
              Create Honeypot Station
            </DialogTitle>
            <DialogDescription>
              Deploy a decoy polling unit to detect result manipulation. Set expected results for comparison.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="hp-name" className="text-xs">Name</Label>
              <Input
                id="hp-name"
                value={hpName}
                onChange={(e) => setHpName(e.target.value)}
                placeholder="e.g. Ghost PU-001"
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="hp-state" className="text-xs">State</Label>
                <Input
                  id="hp-state"
                  value={hpState}
                  onChange={(e) => setHpState(e.target.value)}
                  placeholder="e.g. Lagos"
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hp-lga" className="text-xs">LGA</Label>
                <Input
                  id="hp-lga"
                  value={hpLga}
                  onChange={(e) => setHpLga(e.target.value)}
                  placeholder="e.g. Ikeja"
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Trap Type</Label>
              <Select value={hpTrapType} onValueChange={setHpTrapType}>
                <SelectTrigger className="text-sm w-full">
                  <SelectValue placeholder="Select trap type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GHOST_UNIT">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-purple" />
                      Ghost Unit
                    </span>
                  </SelectItem>
                  <SelectItem value="TAMPER_TRAP">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-orange" />
                      Tamper Trap
                    </span>
                  </SelectItem>
                  <SelectItem value="REPLAY_DETECTOR">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan" />
                      Replay Detector
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Expected Results</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddResultRow}
                  className="h-6 text-[10px] gap-1 text-purple"
                >
                  <Plus className="h-3 w-3" />
                  Add Party
                </Button>
              </div>
              {hpExpectedResults.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={row.party}
                    onChange={(e) => handleResultChange(idx, 'party', e.target.value)}
                    placeholder="Party name"
                    className="text-xs h-8"
                  />
                  <Input
                    value={row.votes}
                    onChange={(e) => handleResultChange(idx, 'votes', e.target.value)}
                    placeholder="Votes"
                    type="number"
                    min={0}
                    className="text-xs h-8 w-24"
                  />
                  {hpExpectedResults.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveResultRow(idx)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-rose shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetHoneypotForm();
                setHoneypotDialogOpen(false);
              }}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitHoneypot}
              disabled={isMutating || !hpName.trim() || !hpState.trim() || !hpTrapType}
              className="text-xs bg-purple hover:bg-purple/90 gap-1.5"
            >
              {isMutating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Deploy Trap
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════ */}
      {/* DIALOG: Create Accessibility Report                   */}
      {/* ═══════════════════════════════════════════════════ */}
      <Dialog open={accessibilityDialogOpen} onOpenChange={(open) => {
        if (!open) resetAccessibilityForm();
        setAccessibilityDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Accessibility className="h-4 w-4 text-cyan" />
              Create Accessibility Report
            </DialogTitle>
            <DialogDescription>
              File a PWD accessibility compliance report for a polling unit. Assess features and barriers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Polling Unit ID */}
            <div className="space-y-2">
              <Label htmlFor="ar-pu-id" className="text-xs">Polling Unit ID</Label>
              <Input
                id="ar-pu-id"
                value={arPollingUnitId}
                onChange={(e) => setArPollingUnitId(e.target.value)}
                placeholder="e.g. PU-12-03-005"
                className="text-sm"
              />
            </div>

            <Separator />

            {/* Features checklist */}
            <div className="space-y-2">
              <Label className="text-xs">Available Features</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.entries(FEATURE_LABELS) as [keyof typeof arFeatures, string][]).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`ar-feat-${key}`}
                      checked={arFeatures[key]}
                      onCheckedChange={() => toggleFeature(key)}
                    />
                    <Label htmlFor={`ar-feat-${key}`} className="text-xs font-normal cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Barriers multi-select */}
            <div className="space-y-2">
              <Label className="text-xs">Barrier Types</Label>
              <div className="flex flex-wrap gap-1.5">
                {BARRIER_OPTIONS.map((barrier) => (
                  <Badge
                    key={barrier}
                    variant="outline"
                    className={cn(
                      'text-[10px] h-6 px-2 cursor-pointer transition-colors',
                      arBarriers.includes(barrier)
                        ? 'border-rose/40 text-rose bg-rose/10'
                        : 'border-border text-muted-foreground hover:border-rose/30 hover:text-rose',
                    )}
                    onClick={() => toggleBarrier(barrier)}
                  >
                    {barrier}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* PWD numbers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ar-served" className="text-xs">PWD Served</Label>
                <Input
                  id="ar-served"
                  value={arPwdServed}
                  onChange={(e) => setArPwdServed(e.target.value)}
                  placeholder="0"
                  type="number"
                  min={0}
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ar-turned" className="text-xs">PWD Turned Away</Label>
                <Input
                  id="ar-turned"
                  value={arPwdTurnedAway}
                  onChange={(e) => setArPwdTurnedAway(e.target.value)}
                  placeholder="0"
                  type="number"
                  min={0}
                  className="text-sm"
                />
              </div>
            </div>

            <Separator />

            {/* Score slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Overall Accessibility Score</Label>
                <span
                  className={cn(
                    'text-sm font-bold tabular-nums',
                    arScore[0] > 80
                      ? 'text-emerald'
                      : arScore[0] > 60
                        ? 'text-cyan'
                        : arScore[0] > 30
                          ? 'text-amber'
                          : 'text-rose',
                  )}
                >
                  {arScore[0]}
                </span>
              </div>
              <Slider
                value={arScore}
                onValueChange={setArScore}
                min={0}
                max={100}
                step={1}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0 — Poor</span>
                <span>30</span>
                <span>60</span>
                <span>80</span>
                <span>100 — Excellent</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetAccessibilityForm();
                setAccessibilityDialogOpen(false);
              }}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitAccessibility}
              disabled={isMutating || !arPollingUnitId.trim()}
              className="text-xs bg-cyan hover:bg-cyan/90 text-black gap-1.5"
            >
              {isMutating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Accessibility className="h-3.5 w-3.5" />
                  Submit Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}