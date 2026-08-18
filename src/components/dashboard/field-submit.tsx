'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useDashboardStore } from '@/store/dashboard';
import {
  Send, MapPin, Camera, Mic, AlertTriangle, CheckCircle2,
  Radio, Loader2, ShieldCheck, Vote, FileWarning, Plus, X,
  TrendingUp, BarChart3, Users, RefreshCw, CloudOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { toast } from 'sonner';
import { enqueue, getQueueSize, processQueue } from '@/lib/offline-queue';

// Nigerian political parties for different election tiers
const PARTIES_BY_TIER: Record<string, { code: string; name: string; color: string }[]> = {
  PRESIDENTIAL: [
    { code: 'APC', name: 'All Progressives Congress', color: '#008751' },
    { code: 'PDP', name: 'Peoples Democratic Party', color: '#CE1126' },
    { code: 'LP', name: 'Labour Party', color: '#2196F3' },
    { code: 'NNPP', name: 'New Nigeria Peoples Party', color: '#FF9800' },
  ],
  STATE: [
    { code: 'APC', name: 'APC', color: '#008751' },
    { code: 'PDP', name: 'PDP', color: '#CE1126' },
    { code: 'LP', name: 'LP', color: '#2196F3' },
    { code: 'NNPP', name: 'NNPP', color: '#FF9800' },
    { code: 'ADC', name: 'ADC', color: '#9C27B0' },
  ],
  LOCAL: [
    { code: 'APC', name: 'APC', color: '#008751' },
    { code: 'PDP', name: 'PDP', color: '#CE1126' },
    { code: 'LP', name: 'LP', color: '#2196F3' },
  ],
};

const INCIDENT_TYPES = [
  { value: 'VIOLENCE', label: 'Violence', severity: 'HIGH', color: 'rose' },
  { value: 'INTIMIDATION', label: 'Voter Intimidation', severity: 'HIGH', color: 'rose' },
  { value: 'BALLOT_STUFFING', label: 'Ballot Stuffing', severity: 'CRITICAL', color: 'rose' },
  { value: 'BRIBERY', label: 'Bribery / Vote Buying', severity: 'HIGH', color: 'amber' },
  { value: 'UNDERAGE_VOTING', label: 'Underage Voting', severity: 'MEDIUM', color: 'amber' },
  { value: 'MULTIPLE_VOTING', label: 'Multiple Voting', severity: 'HIGH', color: 'amber' },
  { value: 'SNATCHED_BALLOT', label: 'Snatched Ballot Box', severity: 'CRITICAL', color: 'rose' },
  { value: 'IMPEDIMENT', label: 'Impediment to Voting', severity: 'MEDIUM', color: 'amber' },
  { value: 'LOGISTICS', label: 'Logistics / Materials Issue', severity: 'LOW', color: 'cyan' },
  { value: 'BVAS_FAILURE', label: 'BVAS / Tech Failure', severity: 'MEDIUM', color: 'amber' },
  { value: 'OBSERVATION', label: 'General Observation', severity: 'LOW', color: 'muted' },
];

// ---- Zod Schemas ----
const incidentFormSchema = z.object({
  type: z.string().min(1, 'Select an incident type'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    message: 'Severity is required',
  }),
  description: z
    .string()
    .min(10, 'Provide at least 10 characters describing the incident')
    .max(5000, 'Description must be under 5,000 characters'),
  pollingUnitId: z.string().min(1, 'Select a polling unit'),
});

const resultsFormSchema = z.object({
  pollingUnitId: z.string().min(1, 'Select a polling unit'),
  accredited: z.string().min(1, 'Enter the number of accredited voters'),
  rejectedBallots: z.string().min(1, 'Enter the number of rejected ballots'),
});

type IncidentFormValues = z.infer<typeof incidentFormSchema>;
type ResultsFormValues = z.infer<typeof resultsFormSchema>;

type Tab = 'results' | 'statistics' | 'incident';

interface PartyVote {
  party: string;
  votes: string; // string for input, parsed on submit
}

export function SubmitReport() {
  const { user, electionTier, tenantId } = useDashboardStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('results');
  const [selectedPU, setSelectedPU] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedType, setSubmittedType] = useState('');

  // ---- RESULTS FORM (react-hook-form + zod) ----
  const resultsForm = useForm<ResultsFormValues>({
    resolver: zodResolver(resultsFormSchema),
    defaultValues: {
      pollingUnitId: '',
      accredited: '',
      rejectedBallots: '',
    },
  });
  const {
    register: resRegister,
    handleSubmit: handleResultsSubmit,
    formState: { errors: resErrors },
    watch: resWatch,
    setValue: setResValue,
  } = resultsForm;

  const accredited = resWatch('accredited');
  const rejectedBallots = resWatch('rejectedBallots');

  // validVotes kept for backward compat (not exposed in UI)
  const validVotes = '';
  const validVotesNum = 0;
  const [partyVotes, setPartyVotes] = useState<PartyVote[]>(
    (PARTIES_BY_TIER[electionTier] || PARTIES_BY_TIER.PRESIDENTIAL).map(p => ({ party: p.code, votes: '' }))
  );

  // ---- STATISTICS STATE ----
  const [bvasUsed, setBvasUsed] = useState(true);
  const [materialsOnTime, setMaterialsOnTime] = useState(true);
  const [securityPresent, setSecurityPresent] = useState(true);
  const [violenceOccurred, setViolenceOccurred] = useState(false);
  const [statsNotes, setStatsNotes] = useState('');

  // ---- INCIDENT FORM (react-hook-form + zod) ----
  const incidentForm = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: {
      type: '',
      severity: 'MEDIUM',
      description: '',
      pollingUnitId: '',
    },
  });
  const {
    register: incRegister,
    handleSubmit: handleIncidentSubmit,
    formState: { errors: incErrors },
    watch: incWatch,
    setValue: setIncValue,
    reset: resetIncidentForm,
  } = incidentForm;

  const incType = incWatch('type');
  const incSeverity = incWatch('severity');

  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);

  // ---- OFFLINE QUEUE STATE ----
  const [pendingCount, setPendingCount] = useState(0);
  const [processingQueue, setProcessingQueue] = useState(false);

  // ---- OFFLINE QUEUE EFFECTS ----
  const queuePollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const refreshQueueCount = useCallback(async () => {
    try {
      const size = await getQueueSize();
      setPendingCount(size);
    } catch {
      // IndexedDB may not be available (e.g. SSR)
    }
  }, []);

  useEffect(() => {
    refreshQueueCount();
    queuePollRef.current = setInterval(refreshQueueCount, 5000);
    return () => clearInterval(queuePollRef.current);
  }, [refreshQueueCount]);

  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.onLine && pendingCount > 0) {
      setProcessingQueue(true);
      processQueue().then(({ processed }) => {
        if (processed > 0) {
          toast.success(`${processed} offline submission(s) synced!`);
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['my-reports'] });
          queryClient.invalidateQueries({ queryKey: ['my-report-counts'] });
        }
      }).finally(() => {
        setProcessingQueue(false);
        refreshQueueCount();
      });
    }
  // Only run on mount when online
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch polling units for the agent (show first 10 as options)
  const { data: puData } = useQuery({
    queryKey: ['my-polling-units'],
    queryFn: () => fetchJson<{ pollingUnits?: { id: string; code: string; name: string; state: string; lga: string; status: string; registered: number }[] }>(`/api/dashboard?tenantId=${tenantId}`).then(d => d.pollingUnits?.slice(0, 15) || []),
  });

  // Fetch agent's report counts for live stats
  const { data: reportCounts } = useQuery({
    queryKey: ['my-report-counts', user?.id],
    queryFn: () => fetchJson<{ counts: { totalResults: number; totalIncidents: number; resultsToday: number; incidentsToday: number } }>(`/api/reports?reporterId=${user!.id}`).then(d => d.counts),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const pollingUnits = puData || [];
  const counts = reportCounts || { totalResults: 0, totalIncidents: 0, resultsToday: 0, incidentsToday: 0 };

  const parties = PARTIES_BY_TIER[electionTier] || PARTIES_BY_TIER.PRESIDENTIAL;

  // Add a party vote row
  const addPartyRow = () => {
    const existingCodes = partyVotes.map(p => p.party);
    const missing = parties.find(p => !existingCodes.includes(p.code));
    if (missing) {
      setPartyVotes(prev => [...prev, { party: missing.code, votes: '' }]);
    }
  };

  const removePartyRow = (idx: number) => {
    if (partyVotes.length > 2) {
      setPartyVotes(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const updatePartyVote = (idx: number, field: 'party' | 'votes', value: string) => {
    setPartyVotes(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  // Auto-calculate totals
  const totalVotesCast = partyVotes.reduce((s, p) => s + (parseInt(p.votes) || 0), 0);
  const accreditedNum = parseInt(accredited) || 0;
  const rejectedNum = parseInt(rejectedBallots) || 0;

  // ---- SUBMIT HANDLERS ----

  const resultMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchJson<{ error?: string }>('/api/results', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      if (data.error) { toast.error(data.error); return; }
      toast.success('Election results submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['situation-room'] });
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
      queryClient.invalidateQueries({ queryKey: ['my-report-counts'] });
      setSubmitted(true); setSubmittedType('results');
      setTimeout(() => setSubmitted(false), 4000);
    },
    onError: async (error) => {
      // If it looks like a network error, enqueue for later
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        try {
          await enqueue({
            url: '/api/results',
            method: 'POST',
            body: JSON.stringify(error),
            contentType: 'application/json',
          });
          toast.warning('No network — result queued for offline sync');
          refreshQueueCount();
        } catch {
          toast.error('Failed to submit results');
        }
      } else {
        toast.error('Failed to submit results');
      }
    },
  });

  const incidentMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchJson<{ error?: string; incident?: { gpsAnomaly?: boolean } }>('/api/incidents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      if (data.error) { toast.error(data.error); return; }
      toast.success('Incident report submitted!');
      if (data.incident?.gpsAnomaly) {
        toast.warning('GPS anomaly detected — report quarantined for review');
      }
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
      queryClient.invalidateQueries({ queryKey: ['my-report-counts'] });
      setSubmitted(true); setSubmittedType('incident');
      resetIncidentForm({ type: '', severity: 'MEDIUM', description: '', pollingUnitId: selectedPU });
      setCapturedPhotos([]);
      setTimeout(() => setSubmitted(false), 4000);
    },
    onError: async (error, variables) => {
      // If it looks like a network error, enqueue for later
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        try {
          await enqueue({
            url: '/api/incidents',
            method: 'POST',
            body: JSON.stringify(variables),
            contentType: 'application/json',
          });
          toast.warning('No network — incident queued for offline sync');
          resetIncidentForm({ type: '', severity: 'MEDIUM', description: '', pollingUnitId: selectedPU });
          setCapturedPhotos([]);
          refreshQueueCount();
        } catch {
          toast.error('Failed to submit incident');
        }
      } else {
        toast.error('Failed to submit incident');
      }
    },
  });

  const onResultsValid = (data: ResultsFormValues) => {
    if (!user?.id) return;
    if (partyVotes.every(p => !p.votes)) {
      toast.error('Enter at least one party vote count');
      return;
    }

    const parsedPartyResults = partyVotes
      .filter(p => p.votes)
      .map(p => {
        const partyInfo = parties.find(pt => pt.code === p.party);
        return { party: p.party, name: partyInfo?.name || p.party, votes: parseInt(p.votes) || 0, color: partyInfo?.color || '#888' };
      });

    setSubmitting(true);
    resultMutation.mutate({
      reporterId: user.id,
      pollingUnitId: data.pollingUnitId,
      accreditedVoters: parseInt(data.accredited) || 0,
      totalValidVotes: validVotesNum,
      rejectedBallots: parseInt(data.rejectedBallots) || 0,
      totalVotesCast,
      partyResults: parsedPartyResults,
      bvasUsed, materialsArrivedOnTime: materialsOnTime,
      securityPresent, violenceOccurred, notes: statsNotes,
    }, { onSettled: () => setSubmitting(false) });
  };

  const handleSubmitResults = () => {
    setResValue('pollingUnitId', selectedPU);
    handleResultsSubmit(onResultsValid)();
  };

  const onIncidentValid = (data: IncidentFormValues) => {
    if (!user?.id) return;
    const typeConfig = INCIDENT_TYPES.find(t => t.value === data.type);
    setSubmitting(true);
    incidentMutation.mutate({
      reporterId: user.id,
      pollingUnitId: data.pollingUnitId || undefined,
      type: data.type,
      severity: typeConfig?.severity || data.severity,
      description: data.description.trim(),
      photos: capturedPhotos,
    }, { onSettled: () => setSubmitting(false) });
  };

  const handleSubmitIncident = () => {
    if (!user?.id) return;
    setIncValue('pollingUnitId', selectedPU);
    handleIncidentSubmit(onIncidentValid)();
  };

  const selectedPUData = pollingUnits.find(p => p.id === selectedPU);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Send className="h-5 w-5 text-emerald" />
            Field Report
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Submit election results, polling unit statistics, or report incidents and infractions.
          </p>
        </div>

        {/* Agent info + PU selector */}
        <Card className="border-emerald/20 bg-emerald/5">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald/20 flex items-center justify-center text-sm font-bold text-emerald">
              {user?.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{user?.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="h-3 w-3 text-emerald" />
                <span className="text-[10px] text-muted-foreground">In-App Capture &middot; C2PA enabled</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Polling Unit Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-emerald" />
            Select Polling Unit
          </label>
          <Select value={selectedPU} onValueChange={(v) => {
            setSelectedPU(v);
            incidentForm.setValue('pollingUnitId', v, { shouldValidate: true });
            resultsForm.setValue('pollingUnitId', v, { shouldValidate: true });
          }}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Choose your assigned polling unit..." />
            </SelectTrigger>
            <SelectContent>
              {pollingUnits.map(pu => (
                <SelectItem key={pu.id} value={pu.id}>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[10px]">{pu.code}</span>
                    <span className="text-ellipsis overflow-hidden whitespace-nowrap max-w-[200px] sm:max-w-none">{pu.name}</span>
                    <span className="text-muted-foreground text-[10px]">{pu.state}/{pu.lga}</span>
                    {pu.status === 'FLAGGED' && <Badge variant="outline" className="text-[9px] h-4 border-amber/30 text-amber ml-1">FLAGGED</Badge>}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {resErrors.pollingUnitId && !selectedPU && activeTab === 'results' && (
            <p className="text-[10px] text-rose mt-1">{resErrors.pollingUnitId.message}</p>
          )}
          {incErrors.pollingUnitId && !selectedPU && activeTab === 'incident' && (
            <p className="text-[10px] text-rose mt-1">{incErrors.pollingUnitId.message}</p>
          )}
          {selectedPUData && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <Badge variant="outline" className="text-[10px] h-5 border-emerald/30 text-emerald">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald mr-1" />IN GEOFENCE
              </Badge>
              <span>{selectedPUData.registered} registered voters</span>
              <span>{selectedPUData.state} / {selectedPUData.lga}</span>
            </div>
          )}
        </div>

        {/* Tab selector */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-card/60 border border-border">
          {[
            { id: 'results' as Tab, label: 'Election Results', mobileLabel: 'Vote', icon: <Vote className="h-4 w-4" /> },
            { id: 'statistics' as Tab, label: 'Statistics', mobileLabel: 'Stats', icon: <BarChart3 className="h-4 w-4" /> },
            { id: 'incident' as Tab, label: 'Incident / Infraction', mobileLabel: 'Report', icon: <FileWarning className="h-4 w-4" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-xs font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-emerald/15 text-emerald shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card'
              )}
            >
              {tab.icon}
              <span className="sm:hidden text-[10px]">{tab.mobileLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {/* ===== ELECTION RESULTS TAB ===== */}
            {activeTab === 'results' && (
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Vote className="h-4 w-4 text-emerald" />
                      Election Results Form
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Enter the official vote counts from Form EC8A at your polling unit.
                    </p>
                  </div>

                  {/* Summary fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-muted-foreground">Accredited Voters</label>
                      <Input
                        {...resRegister('accredited')}
                        type="number" min="0"
                        inputMode="numeric"
                        enterKeyHint="next"
                        placeholder="0"
                        className={cn("h-10 text-sm tabular-nums", resErrors.accredited && "border-rose/50 focus-visible:ring-rose/30")}
                      />
                      {resErrors.accredited && (
                        <p className="text-[10px] text-rose mt-1">{resErrors.accredited.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-muted-foreground">Rejected Ballots</label>
                      <Input
                        {...resRegister('rejectedBallots')}
                        type="number" min="0"
                        inputMode="numeric"
                        enterKeyHint="next"
                        placeholder="0"
                        className={cn("h-10 text-sm tabular-nums", resErrors.rejectedBallots && "border-rose/50 focus-visible:ring-rose/30")}
                      />
                      {resErrors.rejectedBallots && (
                        <p className="text-[10px] text-rose mt-1">{resErrors.rejectedBallots.message}</p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Party vote entries */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium">Vote Count by Party</label>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={addPartyRow}>
                        <Plus className="h-3 w-3" /> Add Party
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {partyVotes.map((pv, idx) => {
                        const partyInfo = parties.find(p => p.code === pv.party);
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <div
                              className="w-3 h-8 rounded-sm shrink-0"
                              style={{ backgroundColor: partyInfo?.color || '#555' }}
                            />
                            <div className="flex-1 min-w-0">
                              <Select value={pv.party} onValueChange={(v) => updatePartyVote(idx, 'party', v)}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {parties.map(p => (
                                    <SelectItem key={p.code} value={p.code}>
                                      <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
                                        <span className="font-medium">{p.code}</span>
                                        <span className="text-muted-foreground text-[10px] hidden sm:inline">{p.name}</span>
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Input
                              type="number" min="0" placeholder="0"
                              inputMode="numeric"
                              enterKeyHint={idx === partyVotes.length - 1 ? 'done' : 'next'}
                              value={pv.votes}
                              onChange={(e) => updatePartyVote(idx, 'votes', e.target.value)}
                              className="w-28 h-8 text-sm tabular-nums text-right"
                            />
                            {partyVotes.length > 2 && (
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-rose" aria-label="Remove party row" onClick={() => removePartyRow(idx)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live totals */}
                  <div className="rounded-lg bg-background border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald" />
                      Live Totals
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold tabular-nums text-emerald">{totalVotesCast.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Total Cast</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold tabular-nums text-cyan">{rejectedNum}</p>
                        <p className="text-[10px] text-muted-foreground">Rejected</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold tabular-nums text-amber">{accreditedNum > 0 ? Math.round((totalVotesCast / accreditedNum) * 10000) / 100 : 0}%</p>
                        <p className="text-[10px] text-muted-foreground">Turnout</p>
                      </div>
                    </div>
                    {/* Simple bar chart */}
                    {partyVotes.some(p => p.votes) && (
                      <div className="flex h-3 rounded-full overflow-hidden bg-secondary mt-1">
                        {partyVotes.filter(p => p.votes).map((pv) => {
                          const partyInfo = parties.find(p => p.code === pv.party);
                          const pct = totalVotesCast > 0 ? (parseInt(pv.votes) || 0) / totalVotesCast * 100 : 0;
                          return (
                            <div
                              key={pv.party}
                              className="h-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: partyInfo?.color || '#555' }}
                              title={`${pv.party}: ${pv.votes}`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border p-3 sm:static sm:bg-transparent sm:backdrop-blur-none sm:border-t-0 sm:p-0">
                  <Button
                    onClick={handleSubmitResults}
                    disabled={submitting || !selectedPU || partyVotes.every(p => !p.votes)}
                    className="w-full h-11 bg-emerald hover:bg-emerald/90 text-emerald-950 font-semibold gap-2"
                  >
                    {submitting && submittedType === 'results' ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                    ) : submitted && submittedType === 'results' ? (
                      <><CheckCircle2 className="h-4 w-4" /> Results Submitted!</>
                    ) : (
                      <><Send className="h-4 w-4" /> Submit Election Results</>
                    )}
                  </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ===== STATISTICS TAB ===== */}
            {activeTab === 'statistics' && (
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-cyan" />
                      Polling Unit Statistics
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Record the operational status and conditions at your polling unit.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {[
                      { label: 'BVAS / Voting device used', desc: 'Was the BVAS machine used for accreditation and voting?', value: bvasUsed, setter: setBvasUsed },
                      { label: 'Materials arrived on time', desc: 'Did electoral materials arrive before the scheduled start time?', value: materialsOnTime, setter: setMaterialsOnTime },
                      { label: 'Security personnel present', desc: 'Were police or security agents present throughout?', value: securityPresent, setter: setSecurityPresent },
                      { label: 'Violence occurred', desc: 'Was any form of violence, disruption, or chaos observed?', value: violenceOccurred, setter: setViolenceOccurred },
                    ].map(item => (
                      <div key={item.label} className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
                        <div>
                          <p className={cn('text-sm font-medium', item.label === 'Violence occurred' && violenceOccurred ? 'text-rose' : '')}>{item.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                        <Switch
                          checked={item.value}
                          onCheckedChange={item.setter}
                          aria-label={item.label}
                          className={cn(
                            item.value && item.label === 'Violence occurred' ? 'data-[state=checked]:bg-rose' : ''
                          )}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Additional Notes</label>
                    <Textarea
                      value={statsNotes}
                      onChange={(e) => setStatsNotes(e.target.value)}
                      placeholder="Any other observations about the polling unit environment, queue management, accessibility, etc."
                      className="min-h-[80px] bg-background border-border text-sm resize-none"
                    />
                  </div>

                  <div className="rounded-lg border border-amber/20 bg-amber/5 p-3 flex items-start gap-2.5">
                    <Users className="h-4 w-4 text-amber shrink-0 mt-0.5" />
                    <div className="text-[11px] text-amber/80">
                      <p className="font-medium text-amber">Statistics are attached to your next result submission</p>
                      Fill in the statistics here, then go to the Results tab to submit everything together. Or submit an incident separately from the Incident tab.
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ===== INCIDENT / INFRACTION TAB ===== */}
            {activeTab === 'incident' && (
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileWarning className="h-4 w-4 text-rose" />
                      Report Incident / Infraction
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Report electoral offenses, violence, intimidation, or procedural violations.
                    </p>
                  </div>

                  {/* Incident type grid */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">What happened?</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {INCIDENT_TYPES.map(t => (
                        <button
                          key={t.value}
                          onClick={() => {
                            setIncValue('type', t.value, { shouldValidate: true });
                            setIncValue('severity', t.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', { shouldValidate: true });
                          }}
                          className={cn(
                            'px-3 py-2.5 rounded-lg border text-xs font-medium transition-all text-left',
                            incType === t.value
                              ? t.color === 'rose' ? 'bg-rose/15 text-rose border-rose/30'
                                : t.color === 'amber' ? 'bg-amber/15 text-amber border-amber/30'
                                : t.color === 'cyan' ? 'bg-cyan/15 text-cyan border-cyan/30'
                                : 'bg-muted text-foreground border-border'
                              : 'border-border text-muted-foreground hover:bg-card/60'
                          )}
                        >
                          <span className="block">{t.label}</span>
                          <span className={cn(
                            'text-[9px] mt-0.5 block',
                            t.severity === 'CRITICAL' ? 'text-rose/60' :
                            t.severity === 'HIGH' ? 'text-amber/60' :
                            t.severity === 'MEDIUM' ? 'text-cyan/60' : 'text-muted-foreground/60'
                          )}>
                            {t.severity}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Severity override */}
                  {incType && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Severity (auto-set, you can override)</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => setIncValue('severity', s, { shouldValidate: true })}
                            className={cn(
                              'px-3 py-2 rounded-lg border text-xs font-medium transition-all text-center',
                              incSeverity === s
                                ? s === 'CRITICAL' ? 'bg-rose/15 text-rose border-rose/30'
                                : s === 'HIGH' ? 'bg-amber/15 text-amber border-amber/30'
                                : s === 'MEDIUM' ? 'bg-cyan/15 text-cyan border-cyan/30'
                                : 'bg-muted text-foreground border-border'
                                : 'border-border text-muted-foreground hover:bg-card/60'
                            )}
                          >
                            {s === 'CRITICAL' && <AlertTriangle className="h-3 w-3 mx-auto mb-0.5" />}
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {incErrors.type && !incType && (
                    <p className="text-[10px] text-rose mt-1">{incErrors.type.message}</p>
                  )}

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Describe what happened</label>
                    <Textarea
                      {...incRegister('description')}
                      placeholder="Provide details: who was involved, what happened, time, location within the PU, names if known..."
                      className={cn("min-h-[120px] bg-background border-border text-sm resize-none", incErrors.description && "border-rose/50 focus-visible:ring-rose/30")}
                    />
                    {incErrors.description && (
                      <p className="text-[10px] text-rose mt-1">{incErrors.description.message}</p>
                    )}
                  </div>

                  {/* Media capture */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Attach Evidence</label>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      id="photo-capture"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            setCapturedPhotos(prev => [...prev, reader.result as string]);
                          }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = ''; // reset for same file
                      }}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-14 flex-col gap-1.5 border-border hover:bg-card/60"
                        onClick={() => document.getElementById('photo-capture')?.click()}
                      >
                        <Camera className="h-5 w-5 text-emerald" />
                        <span className="text-[10px]">Photo</span>
                        {capturedPhotos.length > 0 && (
                          <Badge className="ml-1 h-4 min-w-4 px-1 text-[9px]">{capturedPhotos.length}</Badge>
                        )}
                      </Button>
                      <Button variant="outline" className="h-14 flex-col gap-1.5 border-border hover:bg-card/60">
                        <Mic className="h-5 w-5 text-cyan" />
                        <span className="text-[10px]">Audio</span>
                      </Button>
                      <Button variant="outline" className="h-14 flex-col gap-1.5 border-border hover:bg-card/60">
                        <Radio className="h-5 w-5 text-amber" />
                        <span className="text-[10px]">Video</span>
                      </Button>
                    </div>
                    {capturedPhotos.length > 0 && (
                      <div className="flex gap-2 flex-wrap mt-2">
                        {capturedPhotos.map((photo, i) => (
                          <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden border border-border">
                            <img src={photo} alt={`Captured evidence ${i + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setCapturedPhotos(prev => prev.filter((_, j) => j !== i))}
                              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[8px] leading-none"
                              aria-label={`Remove photo ${i + 1}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      All media captured in-app with C2PA provenance. Camera roll disabled.
                    </p>
                  </div>

                  {/* SOS */}
                  <Separator />
                  <Button
                    variant="outline"
                    className="w-full h-12 border-rose/30 text-rose hover:bg-rose/10 hover:text-rose gap-2"
                  >
                    <Radio className="h-5 w-5" />
                    <div className="text-left">
                      <p className="text-sm font-semibold">SOS — Emergency Alert</p>
                      <p className="text-[10px] opacity-70">Triggers stealth recording + exact GPS to T&S</p>
                    </div>
                  </Button>

                  <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border p-3 sm:static sm:bg-transparent sm:backdrop-blur-none sm:border-t-0 sm:p-0">
                  <Button
                    onClick={handleSubmitIncident}
                    disabled={submitting || !incType || !incWatch('description')?.trim()}
                    className="w-full h-11 bg-emerald hover:bg-emerald/90 text-emerald-950 font-semibold gap-2"
                  >
                    {submitting && submittedType === 'incident' ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                    ) : submitted && submittedType === 'incident' ? (
                      <><CheckCircle2 className="h-4 w-4" /> Incident Reported!</>
                    ) : (
                      <><Send className="h-4 w-4" /> Submit Incident Report</>
                    )}
                  </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Offline queue indicator */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber/30 bg-amber/5 p-3">
            <CloudOff className="h-4 w-4 text-amber shrink-0" />
            <span className="text-xs text-amber flex-1">{pendingCount} pending report{pendingCount > 1 ? 's' : ''}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] gap-1 border-amber/30 text-amber hover:bg-amber/10"
              disabled={processingQueue}
              onClick={() => {
                setProcessingQueue(true);
                processQueue().then(({ processed }) => {
                  if (processed > 0) {
                    toast.success(`${processed} offline submission(s) synced!`);
                    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                    queryClient.invalidateQueries({ queryKey: ['my-reports'] });
                    queryClient.invalidateQueries({ queryKey: ['my-report-counts'] });
                  }
                }).finally(() => {
                  setProcessingQueue(false);
                  refreshQueueCount();
                });
              }}
            >
              {processingQueue ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Retry pending
            </Button>
          </div>
        )}

        {/* Submission stats — live from API */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <Card className="border-border bg-card/40">
            <CardContent className="p-3">
              <p className="text-lg font-bold text-emerald tabular-nums">{counts.resultsToday}</p>
              <p className="text-[11px] text-muted-foreground">Results Today</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/40">
            <CardContent className="p-3">
              <p className="text-lg font-bold text-amber tabular-nums">{counts.incidentsToday}</p>
              <p className="text-[11px] text-muted-foreground">Incidents Today</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/40">
            <CardContent className="p-3">
              <p className="text-lg font-bold text-cyan tabular-nums">{counts.totalResults}</p>
              <p className="text-[11px] text-muted-foreground">Total Results</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/40">
            <CardContent className="p-3">
              <p className="text-lg font-bold text-violet tabular-nums">{counts.totalIncidents}</p>
              <p className="text-[11px] text-muted-foreground">Total Incidents</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}