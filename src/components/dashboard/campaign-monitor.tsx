'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useDashboardStore } from '@/store/dashboard';
import {
  Calendar, MapPin, Users, AlertTriangle, Flag, Eye, CheckCircle,
  XCircle, TrendingUp, Mic, Megaphone, Shield, Plus,
  Loader2, ImageIcon, Radio,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CampaignEvent {
  id: string;
  eventType: string;
  title: string;
  description: string;
  party: string;
  state: string;
  lga: string;
  venue: string;
  latitude: number | null;
  longitude: number | null;
  estimatedCrowd: number | null;
  tone: string;
  mediaUrls: string[];
  aiFlags: string[];
  incidentCount: number;
  eventDate: string;
  createdAt: string;
  reporter: { name: string } | null;
}

interface CampaignEventsData {
  events: CampaignEvent[];
  counts: {
    total: number;
    byType: Record<string, number>;
    byParty: Record<string, number>;
    byState: Record<string, number>;
    hateSpeechFlags: number;
    stateResourceFlags: number;
  };
}

interface SuppressionReport {
  id: string;
  reportType: string;
  title: string;
  description: string;
  state: string;
  lga: string;
  source: string;
  platform: string;
  severity: string;
  status: string;
  isDisinformation: boolean;
  affectedArea: string;
  affectedVoters: number;
  evidenceUrls: string[];
  counterMeasure: string | null;
  aiAnalysis: string | null;
  createdAt: string;
}

interface SuppressionData {
  reports: SuppressionReport[];
  counts: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
    disinformationCount: number;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENT_TYPES: Record<string, string> = {
  RALLY: 'Rally',
  TOWN_HALL: 'Town Hall',
  DEBATE: 'Debate',
  PRESS_CONF: 'Press Conference',
  DOOR_TO_DOOR: 'Door-to-Door',
};

const EVENT_ICONS: Record<string, React.ReactNode> = {
  RALLY: <Megaphone className="h-4 w-4" />,
  TOWN_HALL: <Users className="h-4 w-4" />,
  DEBATE: <Mic className="h-4 w-4" />,
  PRESS_CONF: <Radio className="h-4 w-4" />,
  DOOR_TO_DOOR: <Flag className="h-4 w-4" />,
};

const PARTY_COLORS: Record<string, string> = {
  APC: 'bg-emerald/15 text-emerald border-emerald/30',
  PDP: 'bg-rose/15 text-rose border-rose/30',
  LP: 'bg-violet/15 text-violet border-violet/30',
  NNPP: 'bg-amber/15 text-amber border-amber/30',
  APGA: 'bg-cyan/15 text-cyan border-cyan/30',
};

const TONE_STYLES: Record<string, string> = {
  POSITIVE: 'bg-emerald/15 text-emerald border-emerald/30',
  NEUTRAL: 'bg-cyan/15 text-cyan border-cyan/30',
  NEGATIVE: 'bg-rose/15 text-rose border-rose/30',
  AGGRESSIVE: 'bg-rose text-white border-rose/40',
  INCITING: 'bg-rose text-white border-rose/40',
};

const SUPPRESSION_TYPES: Record<string, string> = {
  FALSE_POLLING_INFO: 'False Polling Info',
  INTIMIDATION_THREAT: 'Intimidation / Threat',
  VOTER_ID_BLOCKED: 'Voter ID Blocked',
  MATERIALS_WITHHELD: 'Materials Withheld',
  FAKE_SCHEDULE: 'Fake Schedule',
};

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'bg-rose text-white border-rose/40',
  HIGH: 'bg-amber/15 text-amber border-amber/30',
  MEDIUM: 'bg-cyan/15 text-cyan border-cyan/30',
  LOW: 'bg-muted text-muted-foreground border-border',
};

const STATUS_STYLES: Record<string, string> = {
  VERIFIED: 'border-emerald/30 text-emerald',
  PENDING: 'border-amber/30 text-amber',
  DISMISSED: 'border-muted text-muted-foreground',
  ESCALATED: 'border-rose/30 text-rose',
  INVESTIGATING: 'border-cyan/30 text-cyan',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function getWeekCount(events: CampaignEvent[]): number {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  return events.filter(e => new Date(e.eventDate) >= weekAgo).length;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CampaignMonitor() {
  const { tenantId } = useDashboardStore();
  const queryClient = useQueryClient();

  // ── Fetch Campaign Events ──
  const {
    data: eventsData,
    isLoading: eventsLoading,
    error: eventsError,
  } = useQuery<CampaignEventsData>({
    queryKey: ['campaign-events', tenantId],
    queryFn: () => fetch(`/api/campaign-events?tenantId=${tenantId}`).then(r => r.json()),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  // ── Fetch Voter Suppression ──
  const {
    data: suppressionData,
    isLoading: suppressionLoading,
    error: suppressionError,
  } = useQuery<SuppressionData>({
    queryKey: ['voter-suppression', tenantId],
    queryFn: () => fetch(`/api/voter-suppression?tenantId=${tenantId}`).then(r => r.json()),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const events = eventsData?.events || [];
  const eventCounts = eventsData?.counts || {
    total: 0, byType: {}, byParty: {}, byState: {}, hateSpeechFlags: 0, stateResourceFlags: 0,
  };

  const reports = suppressionData?.reports || [];
  const suppressionCounts = suppressionData?.counts || {
    total: 0, byType: {}, bySeverity: {}, byStatus: {}, disinformationCount: 0,
  };

  const verifiedCount = suppressionCounts.byStatus?.VERIFIED || 0;
  const pendingCount = suppressionCounts.byStatus?.PENDING || 0;

  // ── Log Event Mutation ──
  const logEventMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetch(`/api/campaign-events?tenantId=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-events', tenantId] });
      toast.success('Campaign event logged successfully');
      setEventDialogOpen(false);
      resetEventForm();
    },
    onError: () => toast.error('Failed to log campaign event'),
  });

  // ── Report Suppression Mutation ──
  const reportSuppressionMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetch(`/api/voter-suppression?tenantId=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voter-suppression', tenantId] });
      toast.success('Suppression report submitted successfully');
      setSuppressionDialogOpen(false);
      resetSuppressionForm();
    },
    onError: () => toast.error('Failed to submit suppression report'),
  });

  // ── Event Dialog State ──
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventForm, setEventForm] = useState({
    eventType: '', title: '', party: '', state: '', lga: '', venue: '',
    estimatedCrowd: '', tone: '', description: '',
  });

  const resetEventForm = () => setEventForm({
    eventType: '', title: '', party: '', state: '', lga: '', venue: '',
    estimatedCrowd: '', tone: '', description: '',
  });

  // ── Suppression Dialog State ──
  const [suppressionDialogOpen, setSuppressionDialogOpen] = useState(false);
  const [suppressionForm, setSuppressionForm] = useState({
    reportType: '', title: '', description: '', state: '', lga: '', source: '', severity: '',
  });

  const resetSuppressionForm = () => setSuppressionForm({
    reportType: '', title: '', description: '', state: '', lga: '', source: '', severity: '',
  });

  // ── Tab Filters ──
  const [eventPartyFilter, setEventPartyFilter] = useState('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');
  const [suppressionTypeFilter, setSuppressionTypeFilter] = useState('ALL');
  const [suppressionSeverityFilter, setSuppressionSeverityFilter] = useState('ALL');
  const [suppressionStatusFilter, setSuppressionStatusFilter] = useState('ALL');

  // ── Filtered Data ──
  const filteredEvents = events.filter(e => {
    if (eventPartyFilter !== 'ALL' && e.party !== eventPartyFilter) return false;
    if (eventTypeFilter !== 'ALL' && e.eventType !== eventTypeFilter) return false;
    return true;
  });

  const filteredReports = reports.filter(r => {
    if (suppressionTypeFilter !== 'ALL' && r.reportType !== suppressionTypeFilter) return false;
    if (suppressionSeverityFilter !== 'ALL' && r.severity !== suppressionSeverityFilter) return false;
    if (suppressionStatusFilter !== 'ALL' && r.status !== suppressionStatusFilter) return false;
    return true;
  });

  // ── Hate Speech Items ──
  const hateSpeechItems = events.filter(e =>
    e.aiFlags?.includes('hate_speech_detected')
  );

  // ── Billboard Simulated Data ──
  const billboards = [
    { id: 'bb-1', party: 'APC', location: 'Lagos – Ikeja GRA', extractedText: 'Progress for All – Vote APC', photoCount: 4, dominance: 92 },
    { id: 'bb-2', party: 'PDP', location: 'Abuja – Central Business District', extractedText: 'Rescue Mission Continues – Atiku 2027', photoCount: 3, dominance: 87 },
    { id: 'bb-3', party: 'LP', location: 'Lagos – Lekki Expressway', extractedText: 'New Nigeria – Obi', photoCount: 5, dominance: 78 },
    { id: 'bb-4', party: 'APC', location: 'Kano – Nassarawa GRA', extractedText: 'Renewed Hope – Tinubu', photoCount: 2, dominance: 95 },
    { id: 'bb-5', party: 'PDP', location: 'Rivers – Port Harcourt', extractedText: 'Power to the People – PDP', photoCount: 3, dominance: 71 },
    { id: 'bb-6', party: 'NNPP', location: 'Kano – Kano City', extractedText: 'Kwankwaso for Kano', photoCount: 6, dominance: 64 },
    { id: 'bb-7', party: 'APC', location: 'Oyo – Ibadan Ring Road', extractedText: 'APC: Moving Forward Together', photoCount: 2, dominance: 83 },
    { id: 'bb-8', party: 'LP', location: 'Anambra – Awka', extractedText: 'Obi-Datti: The Youth Choice', photoCount: 4, dominance: 59 },
  ];

  const billboardByParty = billboards.reduce((acc, b) => {
    acc[b.party] = (acc[b.party] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const uniqueStates = [...new Set(billboards.map(b => b.location.split(' – ')[0]))];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-violet" />
          <h3 className="text-sm font-semibold">Pre-Election Campaign Monitoring</h3>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Track campaign events, voter suppression, billboards &amp; hate speech
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="events" className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-2 shrink-0">
          <TabsList className="h-9 bg-card/60 border border-border w-full">
            <TabsTrigger value="events" className="text-xs h-7 flex-1 gap-1.5">
              <Megaphone className="h-3 w-3" /> Campaign Events
            </TabsTrigger>
            <TabsTrigger value="suppression" className="text-xs h-7 flex-1 gap-1.5">
              <AlertTriangle className="h-3 w-3" /> Voter Suppression
            </TabsTrigger>
            <TabsTrigger value="billboards" className="text-xs h-7 flex-1 gap-1.5">
              <ImageIcon className="h-3 w-3" /> Billboards
            </TabsTrigger>
            <TabsTrigger value="hate-speech" className="text-xs h-7 flex-1 gap-1.5">
              <Flag className="h-3 w-3" /> Hate Speech
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Campaign Events Tab ── */}
        <TabsContent value="events" className="flex-1 min-h-0 mt-0 flex flex-col">
          <EventsTab
            events={filteredEvents}
            counts={eventCounts}
            weekCount={getWeekCount(events)}
            isLoading={eventsLoading}
            error={eventsError}
            partyFilter={eventPartyFilter}
            setPartyFilter={setEventPartyFilter}
            typeFilter={eventTypeFilter}
            setTypeFilter={setEventTypeFilter}
            onLogEvent={() => setEventDialogOpen(true)}
            refetch={() => queryClient.invalidateQueries({ queryKey: ['campaign-events', tenantId] })}
          />
        </TabsContent>

        {/* ── Voter Suppression Tab ── */}
        <TabsContent value="suppression" className="flex-1 min-h-0 mt-0 flex flex-col">
          <SuppressionTab
            reports={filteredReports}
            counts={suppressionCounts}
            verifiedCount={verifiedCount}
            pendingCount={pendingCount}
            isLoading={suppressionLoading}
            error={suppressionError}
            typeFilter={suppressionTypeFilter}
            setTypeFilter={setSuppressionTypeFilter}
            severityFilter={suppressionSeverityFilter}
            setSeverityFilter={setSuppressionSeverityFilter}
            statusFilter={suppressionStatusFilter}
            setStatusFilter={setSuppressionStatusFilter}
            onReportSuppression={() => setSuppressionDialogOpen(true)}
            refetch={() => queryClient.invalidateQueries({ queryKey: ['voter-suppression', tenantId] })}
          />
        </TabsContent>

        {/* ── Billboards Tab ── */}
        <TabsContent value="billboards" className="flex-1 min-h-0 mt-0 flex flex-col">
          <BillboardsTab billboards={billboards} byParty={billboardByParty} states={uniqueStates} />
        </TabsContent>

        {/* ── Hate Speech Tab ── */}
        <TabsContent value="hate-speech" className="flex-1 min-h-0 mt-0 flex flex-col">
          <HateSpeechTab items={hateSpeechItems} isLoading={eventsLoading} />
        </TabsContent>
      </Tabs>

      {/* ── Log Event Dialog ── */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Campaign Event</DialogTitle>
            <DialogDescription>Record a new campaign event for monitoring and AI analysis.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Event Type</Label>
              <Select value={eventForm.eventType} onValueChange={v => setEventForm(f => ({ ...f, eventType: v }))}>
                <SelectTrigger size="sm" className="w-full text-xs">
                  <SelectValue placeholder="Select event type..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Title</Label>
              <Input
                placeholder="e.g. Gubernatorial Rally – Lagos"
                className="text-xs h-8"
                value={eventForm.title}
                onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Party</Label>
                <Select value={eventForm.party} onValueChange={v => setEventForm(f => ({ ...f, party: v }))}>
                  <SelectTrigger size="sm" className="w-full text-xs">
                    <SelectValue placeholder="Select party..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(PARTY_COLORS).map(p => (
                      <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Tone</Label>
                <Select value={eventForm.tone} onValueChange={v => setEventForm(f => ({ ...f, tone: v }))}>
                  <SelectTrigger size="sm" className="w-full text-xs">
                    <SelectValue placeholder="Select tone..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(TONE_STYLES).map(t => (
                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">State</Label>
                <Input
                  placeholder="e.g. Lagos"
                  className="text-xs h-8"
                  value={eventForm.state}
                  onChange={e => setEventForm(f => ({ ...f, state: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">LGA</Label>
                <Input
                  placeholder="e.g. Ikeja"
                  className="text-xs h-8"
                  value={eventForm.lga}
                  onChange={e => setEventForm(f => ({ ...f, lga: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Venue</Label>
              <Input
                placeholder="e.g. Tafawa Balewa Square"
                className="text-xs h-8"
                value={eventForm.venue}
                onChange={e => setEventForm(f => ({ ...f, venue: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Estimated Crowd Size</Label>
              <Input
                type="number"
                placeholder="e.g. 5000"
                className="text-xs h-8"
                value={eventForm.estimatedCrowd}
                onChange={e => setEventForm(f => ({ ...f, estimatedCrowd: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                placeholder="Describe the event details..."
                className="text-xs min-h-[60px]"
                value={eventForm.description}
                onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setEventDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="text-xs bg-emerald hover:bg-emerald/90 text-white"
                disabled={!eventForm.eventType || !eventForm.title || logEventMutation.isPending}
                onClick={() => logEventMutation.mutate({
                  eventType: eventForm.eventType,
                  title: eventForm.title,
                  party: eventForm.party || null,
                  state: eventForm.state || null,
                  lga: eventForm.lga || null,
                  venue: eventForm.venue || null,
                  estimatedCrowd: eventForm.estimatedCrowd ? parseInt(eventForm.estimatedCrowd) : null,
                  tone: eventForm.tone || null,
                  description: eventForm.description || null,
                })}
              >
                {logEventMutation.isPending && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                Log Event
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Report Suppression Dialog ── */}
      <Dialog open={suppressionDialogOpen} onOpenChange={setSuppressionDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Voter Suppression</DialogTitle>
            <DialogDescription>Submit a verified report of voter suppression or intimidation.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Report Type</Label>
              <Select value={suppressionForm.reportType} onValueChange={v => setSuppressionForm(f => ({ ...f, reportType: v }))}>
                <SelectTrigger size="sm" className="w-full text-xs">
                  <SelectValue placeholder="Select report type..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SUPPRESSION_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Title</Label>
              <Input
                placeholder="Brief title for this report"
                className="text-xs h-8"
                value={suppressionForm.title}
                onChange={e => setSuppressionForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Severity</Label>
                <Select value={suppressionForm.severity} onValueChange={v => setSuppressionForm(f => ({ ...f, severity: v }))}>
                  <SelectTrigger size="sm" className="w-full text-xs">
                    <SelectValue placeholder="Select severity..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(SEVERITY_STYLES).map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Source</Label>
                <Input
                  placeholder="e.g. Field Agent, Social Media"
                  className="text-xs h-8"
                  value={suppressionForm.source}
                  onChange={e => setSuppressionForm(f => ({ ...f, source: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">State</Label>
                <Input
                  placeholder="e.g. Rivers"
                  className="text-xs h-8"
                  value={suppressionForm.state}
                  onChange={e => setSuppressionForm(f => ({ ...f, state: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">LGA</Label>
                <Input
                  placeholder="e.g. Obio-Akpor"
                  className="text-xs h-8"
                  value={suppressionForm.lga}
                  onChange={e => setSuppressionForm(f => ({ ...f, lga: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                placeholder="Describe the suppression incident in detail..."
                className="text-xs min-h-[80px]"
                value={suppressionForm.description}
                onChange={e => setSuppressionForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setSuppressionDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="text-xs bg-rose hover:bg-rose/90 text-white"
                disabled={!suppressionForm.reportType || !suppressionForm.title || reportSuppressionMutation.isPending}
                onClick={() => reportSuppressionMutation.mutate({
                  reportType: suppressionForm.reportType,
                  title: suppressionForm.title,
                  description: suppressionForm.description || null,
                  state: suppressionForm.state || null,
                  lga: suppressionForm.lga || null,
                  source: suppressionForm.source || null,
                  severity: suppressionForm.severity || null,
                })}
              >
                {reportSuppressionMutation.isPending && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                Submit Report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Events Tab ──────────────────────────────────────────────────────────────

function EventsTab({
  events, counts, weekCount, isLoading, error, partyFilter, setPartyFilter,
  typeFilter, setTypeFilter, onLogEvent, refetch,
}: {
  events: CampaignEvent[];
  counts: CampaignEventsData['counts'];
  weekCount: number;
  isLoading: boolean;
  error: Error | null;
  partyFilter: string;
  setPartyFilter: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  onLogEvent: () => void;
  refetch: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-emerald mx-auto" />
          <p className="text-sm text-muted-foreground">Loading campaign events...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-6 w-6 text-amber mx-auto" />
          <p className="text-sm text-muted-foreground">Failed to load campaign events</p>
          <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-border shrink-0 bg-card/30">
        <KpiCard label="Total Events" value={counts.total} icon={<Megaphone className="h-3.5 w-3.5" />} color="text-emerald" />
        <KpiCard label="This Week" value={weekCount} icon={<Calendar className="h-3.5 w-3.5" />} color="text-cyan" />
        <KpiCard label="Hate Speech Flags" value={counts.hateSpeechFlags} icon={<Flag className="h-3.5 w-3.5" />} color="text-rose" />
        <KpiCard label="State Resource Misuse" value={counts.stateResourceFlags} icon={<Shield className="h-3.5 w-3.5" />} color="text-amber" />
      </div>

      {/* Filters + Actions */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0 flex-wrap">
        <Select value={partyFilter} onValueChange={setPartyFilter}>
          <SelectTrigger size="sm" className="w-28 text-[11px]">
            <SelectValue placeholder="Party" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All Parties</SelectItem>
            {Object.keys(PARTY_COLORS).map(p => (
              <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger size="sm" className="w-36 text-[11px]">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All Types</SelectItem>
            {Object.entries(EVENT_TYPES).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button size="sm" className="text-xs h-7 gap-1.5 bg-emerald hover:bg-emerald/90 text-white" onClick={onLogEvent}>
            <Plus className="h-3 w-3" /> Log Event
          </Button>
        </div>
      </div>

      {/* Events Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {events.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <Megaphone className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">No campaign events found</p>
              <p className="text-[11px] text-muted-foreground/60">Log your first campaign event to begin monitoring</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <AnimatePresence>
              {events.map((event, idx) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx, 15) * 0.03, duration: 0.25 }}
                >
                  <Card className="border-border bg-card/40 rounded-xl overflow-hidden">
                    <CardContent className="p-3 space-y-2.5">
                      {/* Top row: icon + type + party */}
                      <div className="flex items-start gap-2">
                        <div className={cn(
                          'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                          event.eventType === 'RALLY' ? 'bg-emerald/15 text-emerald' :
                          event.eventType === 'DEBATE' ? 'bg-violet/15 text-violet' :
                          event.eventType === 'TOWN_HALL' ? 'bg-cyan/15 text-cyan' :
                          event.eventType === 'PRESS_CONF' ? 'bg-amber/15 text-amber' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {EVENT_ICONS[event.eventType] || <Megaphone className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{event.title}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge className={cn('text-[9px] h-4 border', PARTY_COLORS[event.party] || 'border-muted text-muted-foreground')}>
                              {event.party}
                            </Badge>
                            <Badge className={cn('text-[9px] h-4 border', TONE_STYLES[event.tone] || 'border-muted text-muted-foreground')}>
                              {event.tone}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Location */}
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{event.venue || 'Unknown venue'}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {event.state}{event.lga ? ` / ${event.lga}` : ''}
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {formatNumber(event.estimatedCrowd)}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {event.eventDate ? formatTime(event.eventDate) : '—'}
                        </span>
                      </div>

                      {/* AI Flags */}
                      {event.aiFlags && event.aiFlags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {event.aiFlags.map(flag => (
                            <Badge
                              key={flag}
                              variant="outline"
                              className={cn(
                                'text-[9px] h-4',
                                flag === 'hate_speech_detected'
                                  ? 'border-rose/30 text-rose'
                                  : flag.includes('state_resource')
                                    ? 'border-amber/30 text-amber'
                                    : 'border-cyan/30 text-cyan'
                              )}
                            >
                              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                              {flag.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Reporter */}
                      {event.reporter && (
                        <p className="text-[10px] text-muted-foreground/60 truncate">
                          Reported by {event.reporter.name}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Suppression Tab ─────────────────────────────────────────────────────────

function SuppressionTab({
  reports, counts, verifiedCount, pendingCount, isLoading, error,
  typeFilter, setTypeFilter, severityFilter, setSeverityFilter,
  statusFilter, setStatusFilter, onReportSuppression, refetch,
}: {
  reports: SuppressionReport[];
  counts: SuppressionData['counts'];
  verifiedCount: number;
  pendingCount: number;
  isLoading: boolean;
  error: Error | null;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  severityFilter: string;
  setSeverityFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  onReportSuppression: () => void;
  refetch: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-rose mx-auto" />
          <p className="text-sm text-muted-foreground">Loading suppression reports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-6 w-6 text-amber mx-auto" />
          <p className="text-sm text-muted-foreground">Failed to load suppression reports</p>
          <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-border shrink-0 bg-card/30">
        <KpiCard label="Total Reports" value={counts.total} icon={<AlertTriangle className="h-3.5 w-3.5" />} color="text-rose" />
        <KpiCard label="Verified" value={verifiedCount} icon={<CheckCircle className="h-3.5 w-3.5" />} color="text-emerald" />
        <KpiCard label="Pending" value={pendingCount} icon={<Eye className="h-3.5 w-3.5" />} color="text-amber" />
        <KpiCard label="Disinformation" value={counts.disinformationCount} icon={<XCircle className="h-3.5 w-3.5" />} color="text-violet" />
      </div>

      {/* Filters + Actions */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0 flex-wrap">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger size="sm" className="w-36 text-[11px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All Types</SelectItem>
            {Object.entries(SUPPRESSION_TYPES).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger size="sm" className="w-28 text-[11px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All Severity</SelectItem>
            {Object.keys(SEVERITY_STYLES).map(s => (
              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-32 text-[11px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All Status</SelectItem>
            {Object.keys(STATUS_STYLES).map(s => (
              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button size="sm" className="text-xs h-7 gap-1.5 bg-rose hover:bg-rose/90 text-white" onClick={onReportSuppression}>
            <Plus className="h-3 w-3" /> Report Suppression
          </Button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {reports.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <AlertTriangle className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">No suppression reports found</p>
              <p className="text-[11px] text-muted-foreground/60">Submit a report or adjust your filters</p>
            </div>
          </div>
        ) : (
          <div className="p-3">
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-card/60 border-b border-border">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Title</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">State</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Severity</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Source</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Disinfo</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Affected</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-center py-2 px-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {reports.map((report, idx) => (
                        <motion.tr
                          key={report.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(idx, 20) * 0.02, duration: 0.2 }}
                          className="border-b border-border/50 hover:bg-card/40 transition-colors"
                        >
                          <td className="py-2 px-3">
                            <Badge variant="outline" className="text-[9px] h-4">
                              {SUPPRESSION_TYPES[report.reportType] || report.reportType}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 max-w-[180px] truncate font-medium">{report.title}</td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {report.state}{report.lga ? ` / ${report.lga}` : ''}
                          </td>
                          <td className="py-2 px-3">
                            <Badge className={cn('text-[9px] h-4 border', SEVERITY_STYLES[report.severity] || 'border-muted text-muted-foreground')}>
                              {report.severity}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{report.source || '—'}</td>
                          <td className="py-2 px-3">
                            <Badge variant="outline" className={cn('text-[9px] h-4', STATUS_STYLES[report.status] || 'border-muted text-muted-foreground')}>
                              {report.status}
                            </Badge>
                          </td>
                          <td className="py-2 px-3">
                            {report.isDisinformation ? (
                              <Badge className="bg-violet/15 text-violet border-violet/30 text-[9px] h-4">
                                <XCircle className="h-2.5 w-2.5 mr-0.5" /> Yes
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {report.affectedVoters ? report.affectedVoters.toLocaleString() : '—'}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                            {formatTime(report.createdAt)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
                              <Eye className="h-3 w-3" />
                            </Button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Billboards Tab ──────────────────────────────────────────────────────────

function BillboardsTab({
  billboards, byParty, states,
}: {
  billboards: {
    id: string; party: string; location: string; extractedText: string;
    photoCount: number; dominance: number;
  }[];
  byParty: Record<string, number>;
  states: string[];
}) {
  return (
    <>
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-border shrink-0 bg-card/30">
        <KpiCard label="Total Tracked" value={billboards.length} icon={<ImageIcon className="h-3.5 w-3.5" />} color="text-emerald" />
        <KpiCard label="Parties Covered" value={Object.keys(byParty).length} icon={<TrendingUp className="h-3.5 w-3.5" />} color="text-cyan" />
        <KpiCard label="States Covered" value={states.length} icon={<MapPin className="h-3.5 w-3.5" />} color="text-amber" />
      </div>

      {/* Party Breakdown */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <span className="text-[10px] text-muted-foreground font-medium">By Party:</span>
        {Object.entries(byParty).map(([party, count]) => (
          <Badge key={party} className={cn('text-[9px] h-5 border', PARTY_COLORS[party] || 'border-muted text-muted-foreground')}>
            {party}: {count}
          </Badge>
        ))}
      </div>

      {/* Billboards Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence>
            {billboards.map((bb, idx) => (
              <motion.div
                key={bb.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.25 }}
              >
                <Card className="border-border bg-card/40 rounded-xl overflow-hidden">
                  <CardContent className="p-3 space-y-2.5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <Badge className={cn('text-[9px] h-5 border', PARTY_COLORS[bb.party] || 'border-muted text-muted-foreground')}>
                        {bb.party}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <ImageIcon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{bb.photoCount} photos</span>
                      </div>
                    </div>

                    {/* Extracted Text */}
                    <p className="text-xs font-medium text-foreground/90 leading-relaxed line-clamp-2">
                      &ldquo;{bb.extractedText}&rdquo;
                    </p>

                    {/* Location */}
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{bb.location}</span>
                    </div>

                    {/* Dominance Score */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Dominance Score</span>
                        <span className={cn(
                          'font-semibold tabular-nums',
                          bb.dominance >= 80 ? 'text-emerald' :
                          bb.dominance >= 60 ? 'text-amber' : 'text-rose'
                        )}>
                          {bb.dominance}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${bb.dominance}%` }}
                          transition={{ delay: 0.2 + idx * 0.04, duration: 0.6, ease: 'easeOut' }}
                          className={cn(
                            'h-full rounded-full',
                            bb.dominance >= 80 ? 'bg-emerald' :
                            bb.dominance >= 60 ? 'bg-amber' : 'bg-rose'
                          )}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

// ─── Hate Speech Tab ─────────────────────────────────────────────────────────

function HateSpeechTab({
  items, isLoading,
}: {
  items: CampaignEvent[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-rose mx-auto" />
          <p className="text-sm text-muted-foreground">Scanning for hate speech...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header stat */}
      <div className="px-4 py-3 border-b border-border shrink-0 bg-card/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Flag className="h-4 w-4 text-rose" />
            <span className="text-sm font-semibold text-rose">{items.length}</span>
            <span className="text-xs text-muted-foreground">hate speech flags detected</span>
          </div>
          {items.length > 0 && (
            <Badge className="bg-rose text-white text-[10px] h-5 border-0">
              <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Requires Review
            </Badge>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <CheckCircle className="h-8 w-8 text-emerald/30 mx-auto" />
              <p className="text-sm text-muted-foreground">No hate speech flags detected</p>
              <p className="text-[11px] text-muted-foreground/60">AI scans campaign events for hate speech in real-time</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {items.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
                  className="rounded-xl border border-border bg-card/40 p-3 space-y-2"
                >
                  {/* Header row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-rose text-white text-[9px] h-5 border-0">
                      <Flag className="h-2.5 w-2.5 mr-0.5" /> HATE SPEECH
                    </Badge>
                    <Badge className={cn('text-[9px] h-5 border', PARTY_COLORS[item.party] || 'border-muted text-muted-foreground')}>
                      {item.party}
                    </Badge>
                    <Badge className={cn('text-[9px] h-5 border', TONE_STYLES[item.tone] || 'border-muted text-muted-foreground')}>
                      {item.tone}
                    </Badge>
                    <Badge className={cn(
                      'text-[9px] h-5 border',
                      item.incidentCount > 0 ? 'bg-rose text-white border-rose/40' : 'border-amber/30 text-amber'
                    )}>
                      {item.incidentCount > 0 ? 'CRITICAL' : 'WARNING'}
                    </Badge>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <p className="text-xs font-semibold">{item.title}</p>
                    {item.description && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* AI Analysis / Flags */}
                  {item.aiFlags && item.aiFlags.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg bg-rose/5 border border-rose/10 p-2">
                      <Shield className="h-3.5 w-3.5 text-rose shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[10px] font-medium text-rose">AI Analysis</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          {item.aiFlags.map(flag => (
                            <Badge key={flag} variant="outline" className="text-[9px] h-4 border-rose/30 text-rose">
                              {flag.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{item.state}{item.lga ? ` / ${item.lga}` : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />{item.eventDate ? formatTime(item.eventDate) : '—'}
                    </span>
                    {item.reporter && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />{item.reporter.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Mic className="h-3 w-3" />{EVENT_TYPES[item.eventType] || item.eventType}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon, color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="border-border bg-card/40 rounded-xl">
      <CardContent className="p-2.5 flex flex-col items-center justify-center gap-1">
        <div className="flex items-center gap-1">
          <span className={color}>{icon}</span>
          <span className={cn('text-base font-bold tabular-nums', color)}>{value}</span>
        </div>
        <span className="text-[10px] text-muted-foreground text-center leading-tight">{label}</span>
      </CardContent>
    </Card>
  );
}