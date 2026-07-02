'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Upload, Users, Send, CheckCircle, AlertTriangle, Clock,
  BarChart3, Plus, Phone, Shield, FileText, Pause, Play, Loader2,
  X, Eye, MessageCircle, UserPlus, Check,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useDashboardStore } from '@/store/dashboard';

// ─── Types ───────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  templateName: string | null;
  templateBody: string | null;
  templateStatus: string | null;
  contactListId: string | null;
  segment: string | null;
  status: string;
  channel: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  rateLimitPerMin: number | null;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  optOutCount: number;
  consentEnforced: boolean;
  wabaCompliant: boolean;
  createdAt: string;
  contactList: { id: string; name: string; segment: string; contactCount: number } | null;
}

interface ContactList {
  id: string;
  name: string;
  segment: string;
  contactCount: number;
  optedOutCount: number;
  consentVerified: boolean;
  createdAt: string;
}

interface CampaignStats {
  totalCampaigns: number;
  activeSending: number;
  totalDelivered: number;
  totalOptOuts: number;
  totalContacts: number;
}

interface CampaignData {
  campaigns: Campaign[];
  contactLists: ContactList[];
  stats: CampaignStats;
}

interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  category: string;
  isBuiltIn: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────

const SEGMENT_OPTIONS = [
  { value: 'PARTY_MEMBERS', label: 'Party Members' },
  { value: 'POLLING_AGENTS', label: 'Polling Agents' },
  { value: 'VOLUNTEERS', label: 'Volunteers' },
  { value: 'SUBSCRIBERS', label: 'Subscribers' },
  { value: 'ALL', label: 'All Segments' },
];

const CHANNEL_OPTIONS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'SMS', label: 'SMS' },
];

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'border-amber/30 text-amber bg-amber/10',
  SCHEDULED: 'border-cyan/30 text-cyan bg-cyan/10',
  SENDING: 'border-violet/30 text-violet bg-violet/10',
  COMPLETED: 'border-emerald/30 text-emerald bg-emerald/10',
  PAUSED: 'border-amber/30 text-amber bg-amber/10',
  FAILED: 'border-rose/30 text-rose bg-rose/10',
  CANCELLED: 'border-muted-foreground/30 text-muted-foreground bg-muted-foreground/10',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  DRAFT: <FileText className="h-3 w-3" />,
  SCHEDULED: <Clock className="h-3 w-3" />,
  SENDING: <Send className="h-3 w-3" />,
  COMPLETED: <CheckCircle className="h-3 w-3" />,
  PAUSED: <Pause className="h-3 w-3" />,
  FAILED: <AlertTriangle className="h-3 w-3" />,
  CANCELLED: <X className="h-3 w-3" />,
};

const BUILT_IN_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tmpl-gotv',
    name: 'GOTV Reminder',
    body: '🗳️ *Election Day Reminder*\n\nDear {name},\n\nTomorrow is election day! Your polling unit is at *{polling_unit}*.\n\n📅 Date: {election_date}\n🕐 Time: 8:00 AM – 2:00 PM\n\nRemember to come with your PVC and arrive early. Every vote counts!\n\n_If you have moved, visit the INEC portal to confirm your unit._\n\nPowered by OmniVote',
    category: 'GOTV',
    isBuiltIn: true,
  },
  {
    id: 'tmpl-rally',
    name: 'Rally Invitation',
    body: '📢 *You\'re Invited to Our Campaign Rally!*\n\nDear {name},\n\nJoin us for a mass rally:\n\n📍 Venue: {venue}\n📅 Date: {date}\n🕐 Time: {time}\n\nCome with friends and family. Let\'s show our strength together!\n\n_Reply STOP to opt out._',
    category: 'RALLY',
    isBuiltIn: true,
  },
  {
    id: 'tmpl-factcheck',
    name: 'Fact-Check Bulletin',
    body: '🔍 *Fact-Check Alert*\n\n⚠️ *Claim:* "{claim}"\n✅ *Verdict:* {verdict}\n\n_{explanation}_\n\nStay informed. Verify before you share.\n\nReport misinformation: reply FACT {phone_number}',
    category: 'FACT_CHECK',
    isBuiltIn: true,
  },
  {
    id: 'tmpl-polling',
    name: 'Polling Location Update',
    body: '📍 *Polling Unit Update*\n\nDear {name},\n\nYour polling unit has been updated:\n\n🏛️ PU Code: {pu_code}\n📍 Location: {pu_address}\nward: {ward}\nLGA: {lga}\n\nPlease verify at voters.inecnigeria.org\n\n_Reply HELP for support._',
    category: 'LOGISTICS',
    isBuiltIn: true,
  },
  {
    id: 'tmpl-education',
    name: 'Voter Education Tip',
    body: '📚 *Did You Know?*\n\n{tip}\n\n💡 *Quick tip:* {action_item}\n\nShare this with 5 friends. An informed voter is a powerful voter!\n\n_This is an educational message from OmniVote._',
    category: 'EDUCATION',
    isBuiltIn: true,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────

function generateNigerianNumbers(count: number): string[] {
  const prefixes = ['0703', '0803', '0806', '0809', '0810', '0811', '0812', '0813', '0814', '0815', '0816', '0817', '0818', '0902', '0903', '0905', '0906', '0907', '0908', '0909', '0913', '0915', '0916'];
  const numbers: string[] = [];
  for (let i = 0; i < count; i++) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
    numbers.push(`${prefix}${suffix}`);
  }
  return numbers;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function segmentLabel(seg: string) {
  return SEGMENT_OPTIONS.find(s => s.value === seg)?.label ?? seg;
}

// ─── Component ───────────────────────────────────────────────────────

export function MobilizationEngine() {
  const queryClient = useQueryClient();
  const { tenantId } = useDashboardStore();

  // Local UI state
  const [activeTab, setActiveTab] = useState('campaigns');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<MessageTemplate[]>([]);

  // New campaign form
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    templateBody: '',
    contactListId: '',
    segment: 'ALL',
    channel: 'WHATSAPP',
    scheduledAt: '',
    rateLimitPerMin: '50',
  });

  // Upload contacts form
  const [uploadForm, setUploadForm] = useState({
    name: '',
    segment: 'VOLUNTEERS',
    consentChecked: false,
  });

  // New template form
  const [templateForm, setTemplateForm] = useState({
    name: '',
    body: '',
  });

  // ─── Data fetching ────────────────────────────────────────────────

  const { data, isLoading } = useQuery<CampaignData>({
    queryKey: ['campaigns', tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?tenantId=${tenantId}`);
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      return res.json();
    },
    enabled: !!tenantId,
  });

  const campaigns = data?.campaigns ?? [];
  const contactLists = data?.contactLists ?? [];
  const stats = data?.stats ?? { totalCampaigns: 0, activeSending: 0, totalDelivered: 0, totalOptOuts: 0, totalContacts: 0 };

  const allTemplates = useMemo(
    () => [...BUILT_IN_TEMPLATES, ...customTemplates],
    [customTemplates],
  );

  // ─── Mutations ────────────────────────────────────────────────────

  const createCampaign = useMutation({
    mutationFn: async (payload: typeof campaignForm) => {
      const res = await fetch(`/api/campaigns?tenantId=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create campaign');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', tenantId] });
      toast.success('Campaign created successfully');
      setNewCampaignOpen(false);
      setCampaignForm({ name: '', templateBody: '', contactListId: '', segment: 'ALL', channel: 'WHATSAPP', scheduledAt: '', rateLimitPerMin: '50' });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create campaign'),
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/campaigns?tenantId=${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update campaign');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', tenantId] });
      toast.success('Campaign updated');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update campaign'),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/campaigns?id=${id}&tenantId=${tenantId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete campaign');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', tenantId] });
      toast.success('Campaign deleted');
      setDetailOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete campaign'),
  });

  const uploadContacts = useMutation({
    mutationFn: async (payload: { name: string; segment: string; contacts: string[] }) => {
      const res = await fetch(`/api/campaigns/contacts?tenantId=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload contacts');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', tenantId] });
      toast.success('Contacts uploaded successfully');
      setUploadOpen(false);
      setUploadForm({ name: '', segment: 'VOLUNTEERS', consentChecked: false });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to upload contacts'),
  });

  // ─── Handlers ─────────────────────────────────────────────────────

  function handleCreateCampaign() {
    if (!campaignForm.name.trim()) { toast.error('Campaign name is required'); return; }
    if (!campaignForm.templateBody.trim()) { toast.error('Message body is required'); return; }
    createCampaign.mutate(campaignForm);
  }

  function handleUploadContacts() {
    if (!uploadForm.name.trim()) { toast.error('List name is required'); return; }
    if (!uploadForm.consentChecked) { toast.error('You must confirm consent'); return; }
    const count = Math.floor(Math.random() * 151) + 50; // 50–200
    const contacts = generateNigerianNumbers(count);
    uploadContacts.mutate({ name: uploadForm.name, segment: uploadForm.segment, contacts });
  }

  function handleCreateTemplate() {
    if (!templateForm.name.trim()) { toast.error('Template name is required'); return; }
    if (!templateForm.body.trim()) { toast.error('Template body is required'); return; }
    const newTmpl: MessageTemplate = {
      id: `tmpl-custom-${Date.now()}`,
      name: templateForm.name,
      body: templateForm.body,
      category: 'CUSTOM',
      isBuiltIn: false,
    };
    setCustomTemplates(prev => [...prev, newTmpl]);
    toast.success('Template saved');
    setTemplateDialogOpen(false);
    setTemplateForm({ name: '', body: '' });
  }

  function useTemplateInCampaign(tmpl: MessageTemplate) {
    setCampaignForm(prev => ({ ...prev, templateBody: tmpl.body }));
    setNewCampaignOpen(true);
    toast.success(`Template "${tmpl.name}" loaded into campaign`);
  }

  function openCampaignDetail(c: Campaign) {
    setSelectedCampaign(c);
    setDetailOpen(true);
  }

  // ─── Loading state ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── KPI Row ──────────────────────────────────────────────────────

  const kpis = [
    { label: 'Total Campaigns', value: stats.totalCampaigns, icon: <Megaphone className="h-4 w-4 text-emerald" />, color: 'text-emerald' },
    { label: 'Active Sending', value: stats.activeSending, icon: <Send className="h-4 w-4 text-cyan" />, color: 'text-cyan' },
    { label: 'Messages Delivered', value: stats.totalDelivered, icon: <CheckCircle className="h-4 w-4 text-violet" />, color: 'text-violet' },
    { label: 'Opt-Out Rate', value: stats.totalContacts > 0 ? `${((stats.totalOptOuts / Math.max(stats.totalContacts, 1)) * 100).toFixed(1)}%` : '0%', icon: <AlertTriangle className="h-4 w-4 text-amber" />, color: 'text-amber' },
  ];

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald/10 border border-emerald/20">
            <Megaphone className="h-5 w-5 text-emerald" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Mobilization Engine</h2>
            <p className="text-xs text-muted-foreground">WhatsApp campaigns &amp; voter outreach</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] h-5 border-emerald/30 text-emerald bg-emerald/10">
            <Shield className="h-2.5 w-2.5 mr-1" />
            WABA Compliant
          </Badge>
          <Badge variant="outline" className="text-[10px] h-5 border-cyan/30 text-cyan bg-cyan/10">
            <Phone className="h-2.5 w-2.5 mr-1" />
            {formatNumber(stats.totalContacts)} Contacts
          </Badge>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {kpis.map((kpi) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-border bg-card/40 rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-muted-foreground font-medium">{kpi.label}</span>
                  {kpi.icon}
                </div>
                <p className={cn('text-2xl font-bold tabular-nums', kpi.color)}>
                  {typeof kpi.value === 'number' ? formatNumber(kpi.value) : kpi.value}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
        <TabsList className="shrink-0 bg-card/40 border border-border rounded-xl h-10 p-1">
          <TabsTrigger
            value="campaigns"
            className="rounded-lg text-xs data-[state=active]:bg-emerald/15 data-[state=active]:text-emerald"
          >
            <Megaphone className="h-3.5 w-3.5 mr-1.5" />
            Campaigns
            {campaigns.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1.5">{campaigns.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="contacts"
            className="rounded-lg text-xs data-[state=active]:bg-cyan/15 data-[state=active]:text-cyan"
          >
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Contacts
            {contactLists.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1.5">{contactLists.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="templates"
            className="rounded-lg text-xs data-[state=active]:bg-violet/15 data-[state=active]:text-violet"
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* ─── Campaigns Tab ─────────────────────────────────────── */}
        <TabsContent value="campaigns" className="flex-1 min-h-0 mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between shrink-0">
            <p className="text-xs text-muted-foreground">
              {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} found
            </p>
            <Button
              size="sm"
              className="h-8 text-xs bg-emerald hover:bg-emerald/90 text-emerald-foreground rounded-lg"
              onClick={() => setNewCampaignOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Campaign
            </Button>
          </div>

          <Card className="border-border bg-card/40 rounded-xl flex-1 min-h-0 overflow-auto">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-9">Name</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-9">Status</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-9">Channel</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-9 text-right">Recipients</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-9 text-right">Sent</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-9 text-right">Delivered</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-9 text-right">Read</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-9">Scheduled</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-9 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {campaigns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-40 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Megaphone className="h-8 w-8 opacity-30" />
                            <p className="text-sm">No campaigns yet</p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs rounded-lg mt-1"
                              onClick={() => setNewCampaignOpen(true)}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Create your first campaign
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      campaigns.map((c, idx) => (
                        <motion.tr
                          key={c.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="border-border hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => openCampaignDetail(c)}
                        >
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2">
                              {c.channel === 'WHATSAPP' ? (
                                <MessageCircle className="h-3.5 w-3.5 text-emerald shrink-0" />
                              ) : (
                                <Phone className="h-3.5 w-3.5 text-amber shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate max-w-[180px]">{c.name}</p>
                                {c.contactList && (
                                  <p className="text-[10px] text-muted-foreground truncate">{c.contactList.name}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant="outline" className={cn('text-[10px] h-5 border', STATUS_STYLES[c.status] ?? 'border-border text-muted-foreground')}>
                              {STATUS_ICONS[c.status] ?? null}
                              {c.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className="text-xs text-muted-foreground">{c.channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'}</span>
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <span className="text-xs font-medium tabular-nums">{formatNumber(c.totalRecipients)}</span>
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <span className="text-xs tabular-nums text-muted-foreground">{formatNumber(c.sentCount)}</span>
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <span className="text-xs tabular-nums text-emerald font-medium">{formatNumber(c.deliveredCount)}</span>
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <span className="text-xs tabular-nums text-violet">{formatNumber(c.readCount)}</span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className="text-[11px] text-muted-foreground">{formatDate(c.scheduledAt)}</span>
                          </TableCell>
                          <TableCell className="py-2.5 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => openCampaignDetail(c)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {c.status === 'SCHEDULED' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-emerald hover:text-emerald"
                                  onClick={() => updateCampaign.mutate({ id: c.id, status: 'SENDING' })}
                                  disabled={updateCampaign.isPending}
                                >
                                  <Play className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {c.status === 'SENDING' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-amber hover:text-amber"
                                  onClick={() => updateCampaign.mutate({ id: c.id, status: 'PAUSED' })}
                                  disabled={updateCampaign.isPending}
                                >
                                  <Pause className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Contacts Tab ──────────────────────────────────────── */}
        <TabsContent value="contacts" className="flex-1 min-h-0 mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">
                {contactLists.length} list{contactLists.length !== 1 ? 's' : ''}
              </p>
              <Badge variant="outline" className="text-[10px] h-5 border-cyan/30 text-cyan bg-cyan/10">
                <Users className="h-2.5 w-2.5 mr-1" />
                {formatNumber(stats.totalContacts)} Total Contacts
              </Badge>
            </div>
            <Button
              size="sm"
              className="h-8 text-xs bg-cyan hover:bg-cyan/90 text-cyan-foreground rounded-lg"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload Contacts
            </Button>
          </div>

          <Card className="border-border bg-card/40 rounded-xl flex-1 min-h-0 overflow-auto">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-9">List Name</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-9">Segment</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-9 text-right">Contacts</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-9 text-right">Opted-Out</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-9">Consent</TableHead>
                    <TableHead className="text-[11px] font-semibold text-muted-foreground h-9">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {contactLists.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-40 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Users className="h-8 w-8 opacity-30" />
                            <p className="text-sm">No contact lists yet</p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs rounded-lg mt-1"
                              onClick={() => setUploadOpen(true)}
                            >
                              <Upload className="h-3 w-3 mr-1" /> Upload your first list
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      contactLists.map((cl, idx) => (
                        <motion.tr
                          key={cl.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="border-border hover:bg-muted/30 transition-colors"
                        >
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2">
                              <UserPlus className="h-3.5 w-3.5 text-cyan shrink-0" />
                              <span className="text-xs font-medium">{cl.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant="outline" className="text-[10px] h-5 border-border text-muted-foreground">
                              {segmentLabel(cl.segment)}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <span className="text-xs font-medium tabular-nums">{formatNumber(cl.contactCount)}</span>
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <span className={cn(
                              'text-xs tabular-nums',
                              cl.optedOutCount > 0 ? 'text-amber font-medium' : 'text-muted-foreground',
                            )}>
                              {formatNumber(cl.optedOutCount)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            {cl.consentVerified ? (
                              <Badge variant="outline" className="text-[10px] h-5 border-emerald/30 text-emerald bg-emerald/10">
                                <Check className="h-2.5 w-2.5 mr-0.5" /> Verified
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-5 border-amber/30 text-amber bg-amber/10">
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className="text-[11px] text-muted-foreground">{formatDate(cl.createdAt)}</span>
                          </TableCell>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Templates Tab ─────────────────────────────────────── */}
        <TabsContent value="templates" className="flex-1 min-h-0 mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between shrink-0">
            <p className="text-xs text-muted-foreground">
              {allTemplates.length} template{allTemplates.length !== 1 ? 's' : ''} available
            </p>
            <Button
              size="sm"
              className="h-8 text-xs bg-violet hover:bg-violet/90 text-violet-foreground rounded-lg"
              onClick={() => setTemplateDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Template
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-auto grid gap-3 content-start">
            <AnimatePresence>
              {allTemplates.map((tmpl, idx) => (
                <motion.div
                  key={tmpl.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Card className="border-border bg-card/40 rounded-xl">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <FileText className="h-3.5 w-3.5 text-violet shrink-0" />
                            <span className="text-sm font-medium">{tmpl.name}</span>
                            {tmpl.isBuiltIn && (
                              <Badge variant="outline" className="text-[10px] h-5 border-violet/30 text-violet bg-violet/10">
                                Built-in
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] h-5 border-border text-muted-foreground">
                              {tmpl.category}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 whitespace-pre-line mb-2 leading-relaxed">
                            {tmpl.body}
                          </p>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground">
                              <BarChart3 className="h-3 w-3 inline mr-0.5" />
                              {tmpl.body.length} chars
                            </span>
                            {tmpl.body.length > 4096 && (
                              <span className="text-[10px] text-amber">
                                <AlertTriangle className="h-3 w-3 inline mr-0.5" />
                                Exceeds 4096 char limit
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs rounded-lg border-emerald/30 text-emerald hover:bg-emerald/10 hover:text-emerald shrink-0"
                          onClick={() => useTemplateInCampaign(tmpl)}
                        >
                          <Send className="h-3 w-3 mr-1.5" />
                          Use in Campaign
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── New Campaign Dialog ─────────────────────────────────── */}
      <Dialog open={newCampaignOpen} onOpenChange={setNewCampaignOpen}>
        <DialogContent className="border-border bg-card rounded-xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-emerald" />
              New Campaign
            </DialogTitle>
            <DialogDescription>
              Create a new WhatsApp or SMS campaign. Ensure all recipients have opted in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Campaign Name</Label>
              <Input
                placeholder="e.g. GOTV Push – Lagos Island"
                value={campaignForm.name}
                onChange={e => setCampaignForm(p => ({ ...p, name: e.target.value }))}
                className="h-9 text-sm rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message Body</Label>
              <Textarea
                placeholder="Type your message here. Use {name}, {polling_unit} for personalization."
                value={campaignForm.templateBody}
                onChange={e => setCampaignForm(p => ({ ...p, templateBody: e.target.value }))}
                className="min-h-[120px] text-sm rounded-lg"
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {campaignForm.templateBody.length} / 4096 characters
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Contact List</Label>
                <Select
                  value={campaignForm.contactListId}
                  onValueChange={v => setCampaignForm(p => ({ ...p, contactListId: v }))}
                >
                  <SelectTrigger className="h-9 text-sm rounded-lg">
                    <SelectValue placeholder="Select list" />
                  </SelectTrigger>
                  <SelectContent>
                    {contactLists.map(cl => (
                      <SelectItem key={cl.id} value={cl.id} className="text-xs">
                        {cl.name} ({formatNumber(cl.contactCount)} contacts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Segment</Label>
                <Select
                  value={campaignForm.segment}
                  onValueChange={v => setCampaignForm(p => ({ ...p, segment: v }))}
                >
                  <SelectTrigger className="h-9 text-sm rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENT_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Channel</Label>
                <Select
                  value={campaignForm.channel}
                  onValueChange={v => setCampaignForm(p => ({ ...p, channel: v }))}
                >
                  <SelectTrigger className="h-9 text-sm rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map(ch => (
                      <SelectItem key={ch.value} value={ch.value} className="text-xs">
                        {ch.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rate Limit / min</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={campaignForm.rateLimitPerMin}
                  onChange={e => setCampaignForm(p => ({ ...p, rateLimitPerMin: e.target.value }))}
                  className="h-9 text-sm rounded-lg"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Schedule (optional)</Label>
              <Input
                type="datetime-local"
                value={campaignForm.scheduledAt}
                onChange={e => setCampaignForm(p => ({ ...p, scheduledAt: e.target.value }))}
                className="h-9 text-sm rounded-lg"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewCampaignOpen(false)} className="rounded-lg text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleCreateCampaign}
              disabled={createCampaign.isPending}
              className="bg-emerald hover:bg-emerald/90 text-emerald-foreground rounded-lg text-xs"
            >
              {createCampaign.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Campaign Detail Dialog ──────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="border-border bg-card rounded-xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald" />
              {selectedCampaign?.name ?? 'Campaign Details'}
            </DialogTitle>
            <DialogDescription>
              Delivery analytics and campaign configuration.
            </DialogDescription>
          </DialogHeader>
          {selectedCampaign && (
            <div className="space-y-4 py-2">
              {/* Status row */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn('text-[10px] h-5 border', STATUS_STYLES[selectedCampaign.status] ?? 'border-border text-muted-foreground')}>
                  {STATUS_ICONS[selectedCampaign.status] ?? null}
                  {selectedCampaign.status}
                </Badge>
                <Badge variant="outline" className="text-[10px] h-5 border-border text-muted-foreground">
                  {selectedCampaign.channel}
                </Badge>
                {selectedCampaign.consentEnforced && (
                  <Badge variant="outline" className="text-[10px] h-5 border-emerald/30 text-emerald bg-emerald/10">
                    <Shield className="h-2.5 w-2.5 mr-0.5" /> Consent Enforced
                  </Badge>
                )}
                {selectedCampaign.wabaCompliant && (
                  <Badge variant="outline" className="text-[10px] h-5 border-cyan/30 text-cyan bg-cyan/10">
                    <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> WABA Compliant
                  </Badge>
                )}
              </div>

              {/* Message preview */}
              {selectedCampaign.templateBody && (
                <Card className="border-emerald/20 bg-emerald/5 rounded-lg">
                  <CardContent className="p-3">
                    <p className="text-[10px] font-medium text-emerald mb-1.5 flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" /> Message Preview
                    </p>
                    <pre className="text-[11px] text-foreground whitespace-pre-wrap leading-relaxed font-sans">
                      {selectedCampaign.templateBody}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Delivery analytics */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground">Delivery Analytics</p>
                {[
                  { label: 'Sent', value: selectedCampaign.sentCount, color: 'bg-cyan', text: 'text-cyan' },
                  { label: 'Delivered', value: selectedCampaign.deliveredCount, color: 'bg-emerald', text: 'text-emerald' },
                  { label: 'Read', value: selectedCampaign.readCount, color: 'bg-violet', text: 'text-violet' },
                  { label: 'Failed', value: selectedCampaign.failedCount, color: 'bg-rose', text: 'text-rose' },
                  { label: 'Opted Out', value: selectedCampaign.optOutCount, color: 'bg-amber', text: 'text-amber' },
                ].map(bar => {
                  const pct = selectedCampaign.totalRecipients > 0
                    ? (bar.value / selectedCampaign.totalRecipients) * 100
                    : 0;
                  return (
                    <div key={bar.label} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">{bar.label}</span>
                        <span className={cn('text-[11px] font-medium tabular-nums', bar.text)}>
                          {formatNumber(bar.value)} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className={cn('h-full rounded-full', bar.color)}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(pct, 100)}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <div>Recipients: <span className="text-foreground font-medium">{formatNumber(selectedCampaign.totalRecipients)}</span></div>
                <div>Segment: <span className="text-foreground font-medium">{segmentLabel(selectedCampaign.segment ?? 'ALL')}</span></div>
                <div>Rate limit: <span className="text-foreground font-medium">{selectedCampaign.rateLimitPerMin ?? '—'}/min</span></div>
                {selectedCampaign.scheduledAt && (
                  <div>Scheduled: <span className="text-foreground font-medium">{formatDate(selectedCampaign.scheduledAt)}</span></div>
                )}
                {selectedCampaign.startedAt && (
                  <div>Started: <span className="text-foreground font-medium">{formatDate(selectedCampaign.startedAt)}</span></div>
                )}
                {selectedCampaign.completedAt && (
                  <div>Completed: <span className="text-foreground font-medium">{formatDate(selectedCampaign.completedAt)}</span></div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {selectedCampaign && (selectedCampaign.status === 'DRAFT' || selectedCampaign.status === 'CANCELLED') && (
              <Button
                variant="outline"
                className="rounded-lg text-xs border-rose/30 text-rose hover:bg-rose/10 hover:text-rose"
                onClick={() => deleteCampaign.mutate(selectedCampaign.id)}
                disabled={deleteCampaign.isPending}
              >
                {deleteCampaign.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <X className="h-3.5 w-3.5 mr-1.5" />}
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailOpen(false)} className="rounded-lg text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Upload Contacts Dialog ──────────────────────────────── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="border-border bg-card rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-cyan" />
              Upload Contacts
            </DialogTitle>
            <DialogDescription>
              Create a new contact list. Phone numbers will be simulated for demo purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">List Name</Label>
              <Input
                placeholder="e.g. Lagos Party Members"
                value={uploadForm.name}
                onChange={e => setUploadForm(p => ({ ...p, name: e.target.value }))}
                className="h-9 text-sm rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Segment</Label>
              <Select
                value={uploadForm.segment}
                onValueChange={v => setUploadForm(p => ({ ...p, segment: v }))}
              >
                <SelectTrigger className="h-9 text-sm rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENT_OPTIONS.filter(s => s.value !== 'ALL').map(s => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Card className="border-amber/20 bg-amber/5 rounded-lg">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-amber shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber mb-1">Consent Requirement</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      All contacts must have explicitly opted in to receive messages. Uploading contacts without consent violates NDPR and WhatsApp Terms of Service.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="consent-check"
                checked={uploadForm.consentChecked}
                onCheckedChange={v => setUploadForm(p => ({ ...p, consentChecked: !!v }))}
                className="mt-0.5"
              />
              <Label htmlFor="consent-check" className="text-[11px] text-muted-foreground leading-relaxed cursor-pointer">
                I confirm that all contacts on this list have given explicit consent to receive election-related communications via the selected channel.
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)} className="rounded-lg text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleUploadContacts}
              disabled={uploadContacts.isPending || !uploadForm.consentChecked}
              className="bg-cyan hover:bg-cyan/90 text-cyan-foreground rounded-lg text-xs"
            >
              {uploadContacts.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              Upload Contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Create Template Dialog ──────────────────────────────── */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="border-border bg-card rounded-xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-violet" />
              Create Template
            </DialogTitle>
            <DialogDescription>
              Design a reusable message template for your campaigns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Template Name</Label>
              <Input
                placeholder="e.g. Election Day Safety Tips"
                value={templateForm.name}
                onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))}
                className="h-9 text-sm rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message Body</Label>
              <Textarea
                placeholder="Type your template message. Use {name}, {polling_unit}, {date} for placeholders."
                value={templateForm.body}
                onChange={e => setTemplateForm(p => ({ ...p, body: e.target.value }))}
                className="min-h-[120px] text-sm rounded-lg"
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {templateForm.body.length} / 4096 characters
              </p>
            </div>

            {/* WhatsApp-style preview */}
            {templateForm.body && (
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <MessageCircle className="h-3 w-3 text-emerald" /> WhatsApp Preview
                </Label>
                <div className="rounded-xl bg-[#0b141a] p-3 max-h-[180px] overflow-auto">
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-emerald/20 flex items-center justify-center shrink-0">
                      <UserPlus className="h-3.5 w-3.5 text-emerald" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-[#005c4b] rounded-xl rounded-tl-sm px-3 py-2">
                        <pre className="text-[12px] text-white/90 whitespace-pre-wrap font-sans leading-relaxed">
                          {templateForm.body}
                        </pre>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[9px] text-white/40">
                            {new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <CheckCircle className="h-3 w-3 text-cyan/60" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)} className="rounded-lg text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleCreateTemplate}
              className="bg-violet hover:bg-violet/90 text-violet-foreground rounded-lg text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}