'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Send, Phone, Smartphone, Bell, Clock, AlertTriangle, UserX,
  WifiOff, ShieldAlert, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp,
  MessageCircle, RefreshCw, Zap, Users, Eye, Radio, Filter, Reply,
  QrCode, Link2, Unlink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useDashboardStore } from '@/store/dashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────

interface EngStats {
  totalAgents: number; onlineAgents: number; idleAgents: number;
  noDataAgents: number; offlineAgents: number; agentsWithInfractions: number;
  totalMessages: number; pendingMessages: number; failedMessages: number;
}

interface AgentBrief {
  id: string; name: string; email: string; isOnline: boolean;
  lastSeenAt: string | null;
  _count: { incidents: number; results: number; agentMessages: number };
  incidents?: { id: string; type: string; severity: string; submittedAt: string }[];
}

interface Message {
  id: string;
  agentId: string; channel: string; triggerType: string;
  subject: string; body: string; priority: string; status: string;
  deliveredAt: string | null; readAt: string | null;
  responseText: string | null; respondedAt: string | null;
  createdAt: string;
  agent: { id: string; name: string; email: string; isOnline: boolean; lastSeenAt: string | null };
  sentBy: { id: string; name: string; role: string } | null;
}

interface EngagementData {
  stats: EngStats;
  idleAgents: AgentBrief[];
  noDataAgents: AgentBrief[];
  offlineAgents: AgentBrief[];
  agentsWithInfractions: AgentBrief[];
  messages: Message[];
  messageStats: Record<string, number>;
  triggerStats: Record<string, number>;
  statusStats: Record<string, number>;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  WHATSAPP: <MessageCircle className="h-3.5 w-3.5 text-green-400" />,
  SMS: <Phone className="h-3.5 w-3.5 text-blue-400" />,
  PUSH: <Bell className="h-3.5 w-3.5 text-amber-400" />,
  IN_APP: <Smartphone className="h-3.5 w-3.5 text-cyan-400" />,
};

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp', SMS: 'SMS', PUSH: 'Push Notification', IN_APP: 'In-App',
};

const TRIGGER_LABELS: Record<string, string> = {
  IDLE_DETECTION: 'Idle Detection', NO_DATA: 'No Data', INCIDENT_FOLLOWUP: 'Incident Follow-up',
  INFRACTION_REMINDER: 'Infraction Reminder', SCHEDULED_CHECKIN: 'Scheduled Check-in', MANUAL: 'Manual',
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber/15 text-amber border-amber/30',
  SENT: 'bg-blue/15 text-blue border-blue/30',
  DELIVERED: 'bg-emerald/15 text-emerald border-emerald/30',
  READ: 'bg-violet/15 text-violet border-violet/30',
  FAILED: 'bg-rose/15 text-rose border-rose/30',
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'text-muted-foreground', NORMAL: 'text-cyan', HIGH: 'text-amber', URGENT: 'text-rose font-bold',
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Component ───────────────────────────────────────────────────────

export function AgentEngagement() {
  const queryClient = useQueryClient();
  const { tenantId, user } = useDashboardStore();

  // Filters
  const [msgFilter, setMsgFilter] = useState<{ triggerType: string; channel: string; status: string }>({
    triggerType: 'ALL', channel: 'ALL', status: 'ALL',
  });
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeAgent, setComposeAgent] = useState<{ id: string; name: string } | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [bulkChannel, setBulkChannel] = useState('WHATSAPP');

  // Fetch engagement data
  const { data, isLoading, refetch } = useQuery<EngagementData>({
    queryKey: ['engagement', tenantId, msgFilter],
    queryFn: () => {
      const p = new URLSearchParams(`?tenantId=${tenantId}&view=messages`);
      if (msgFilter.triggerType !== 'ALL') p.set('triggerType', msgFilter.triggerType);
      if (msgFilter.channel !== 'ALL') p.set('channel', msgFilter.channel);
      if (msgFilter.status !== 'ALL') p.set('status', msgFilter.status);
      return fetch(`/api/engagement?${p}`).then(r => r.json());
    },
    refetchInterval: 15000,
    enabled: !!tenantId,
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, tenantId }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engagement'] });
      setComposeOpen(false);
      setComposeAgent(null);
      toast.success('Message sent successfully');
    },
    onError: () => toast.error('Failed to send message'),
  });

  // Bulk engage mutation
  const bulkMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/engagement', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, tenantId }),
      }).then(r => r.json()),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['engagement'] });
      toast.success(`Engaged ${result.engaged} agents via ${CHANNEL_LABELS[result.channel] || result.channel}`);
    },
    onError: () => toast.error('Bulk engagement failed'),
  });

  const handleBulkEngage = useCallback((group: string) => {
    bulkMutation.mutate({
      action: 'BULK_ENGAGE',
      targetGroup: group,
      channel: bulkChannel,
      sentById: user?.id,
    });
  }, [bulkChannel, user?.id, bulkMutation]);

  const handleSendMessage = useCallback((agentId: string, channel: string, subject: string, body: string, priority: string) => {
    sendMutation.mutate({ agentId, channel, triggerType: 'MANUAL', subject, body, priority, sentById: user?.id });
  }, [sendMutation, user?.id]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald" />
      </div>
    );
  }

  const stats = data?.stats || {} as EngStats;
  const messages = data?.messages || [];

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-hidden">
      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber/10 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-amber" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Agent Engagement Center</h2>
            <p className="text-xs text-muted-foreground">Monitor, engage, and follow up with field agents</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* ─── Stats Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 shrink-0">
        <StatCard icon={<Users className="h-4 w-4" />} label="Total Agents" value={stats.totalAgents || 0} color="text-foreground" />
        <StatCard icon={<Wifi className="h-3.5 w-3.5" />} label="Online" value={stats.onlineAgents || 0} color="text-emerald" />
        <StatCard icon={<Clock className="h-3.5 w-3.5" />} label="Idle" value={stats.idleAgents || 0} color="text-amber" />
        <StatCard icon={<UserX className="h-3.5 w-3.5" />} label="No Data" value={stats.noDataAgents || 0} color="text-rose" />
        <StatCard icon={<WifiOff className="h-3.5 w-3.5" />} label="Offline" value={stats.offlineAgents || 0} color="text-muted-foreground" />
        <StatCard icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Infractions" value={stats.agentsWithInfractions || 0} color="text-violet" />
        <StatCard icon={<MessageSquare className="h-3.5 w-3.5" />} label="Messages" value={stats.totalMessages || 0} color="text-cyan" />
      </div>

      {/* ─── WhatsApp Connection Panel ──────────────────────── */}
      <WhatsAppPanel tenantId={tenantId} />

      {/* ─── Tabs: Agent Groups | Messages | Compose ──────────── */}
      <Tabs defaultValue="groups" className="flex-1 min-h-0 flex flex-col">
        <TabsList className="shrink-0 bg-card/60 border border-border">
          <TabsTrigger value="groups" className="gap-2 text-xs"><Users className="h-3.5 w-3.5" /> Agent Groups</TabsTrigger>
          <TabsTrigger value="messages" className="gap-2 text-xs"><MessageSquare className="h-3.5 w-3.5" /> Message Log <Badge variant="secondary" className="ml-1 h-5 text-[10px]">{messages.length}</Badge></TabsTrigger>
          <TabsTrigger value="compose" className="gap-2 text-xs"><Send className="h-3.5 w-3.5" /> Compose</TabsTrigger>
        </TabsList>

        {/* ─── Agent Groups Tab ──────────────────────────────── */}
        <TabsContent value="groups" className="flex-1 overflow-y-auto mt-3 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Idle Agents */}
            <AgentGroupCard
              title="Idle Agents"
              description="Online but no reports in 30+ minutes"
              icon={<Clock className="h-5 w-5 text-amber" />}
              badgeColor="bg-amber/10 text-amber border-amber/30"
              count={stats.idleAgents || 0}
              agents={data?.idleAgents || []}
              bulkAction="IDLE"
              bulkChannel={bulkChannel}
              onBulkEngage={handleBulkEngage}
              onSendMessage={(agent) => { setComposeAgent({ id: agent.id, name: agent.name }); setComposeOpen(true); }}
              isLoading={bulkMutation.isPending}
            />

            {/* No-Data Agents */}
            <AgentGroupCard
              title="No Data Submitted"
              description="Zero results and zero incidents reported"
              icon={<UserX className="h-5 w-5 text-rose" />}
              badgeColor="bg-rose/10 text-rose border-rose/30"
              count={stats.noDataAgents || 0}
              agents={data?.noDataAgents || []}
              bulkAction="NO_DATA"
              bulkChannel={bulkChannel}
              onBulkEngage={handleBulkEngage}
              onSendMessage={(agent) => { setComposeAgent({ id: agent.id, name: agent.name }); setComposeOpen(true); }}
              isLoading={bulkMutation.isPending}
            />

            {/* Offline Agents */}
            <AgentGroupCard
              title="Offline Agents"
              description="Not seen in 1+ hour"
              icon={<WifiOff className="h-5 w-5 text-muted-foreground" />}
              badgeColor="bg-muted text-muted-foreground border-border"
              count={stats.offlineAgents || 0}
              agents={data?.offlineAgents || []}
              bulkAction="OFFLINE"
              bulkChannel={bulkChannel}
              onBulkEngage={handleBulkEngage}
              onSendMessage={(agent) => { setComposeAgent({ id: agent.id, name: agent.name }); setComposeOpen(true); }}
              isLoading={bulkMutation.isPending}
            />

            {/* Infraction Agents */}
            <AgentGroupCard
              title="Infraction Flagged"
              description="Quarantined reports or GPS anomalies"
              icon={<ShieldAlert className="h-5 w-5 text-violet" />}
              badgeColor="bg-violet/10 text-violet border-violet/30"
              count={stats.agentsWithInfractions || 0}
              agents={data?.agentsWithInfractions || []}
              bulkAction="INFRACTION"
              bulkChannel={bulkChannel}
              onBulkEngage={handleBulkEngage}
              onSendMessage={(agent) => { setComposeAgent({ id: agent.id, name: agent.name }); setComposeOpen(true); }}
              isLoading={bulkMutation.isPending}
              showIncidents
            />
          </div>

          {/* Channel selector for bulk actions */}
          <div className="flex items-center gap-3 px-2">
            <span className="text-xs text-muted-foreground">Bulk engagement channel:</span>
            <Select value={bulkChannel} onValueChange={setBulkChannel}>
              <SelectTrigger className="w-48 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WHATSAPP"><span className="flex items-center gap-2"><MessageCircle className="h-3.5 w-3.5 text-green-400" /> WhatsApp</span></SelectItem>
                <SelectItem value="SMS"><span className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-blue-400" /> SMS</span></SelectItem>
                <SelectItem value="PUSH"><span className="flex items-center gap-2"><Bell className="h-3.5 w-3.5 text-amber-400" /> Push Notification</span></SelectItem>
                <SelectItem value="IN_APP"><span className="flex items-center gap-2"><Smartphone className="h-3.5 w-3.5 text-cyan-400" /> In-App Message</span></SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* ─── Message Log Tab ────────────────────────────────── */}
        <TabsContent value="messages" className="flex-1 min-h-0 flex flex-col mt-3 gap-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={msgFilter.triggerType} onValueChange={(v) => setMsgFilter(f => ({ ...f, triggerType: v }))}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Trigger" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Triggers</SelectItem>
                <SelectItem value="IDLE_DETECTION">Idle Detection</SelectItem>
                <SelectItem value="NO_DATA">No Data</SelectItem>
                <SelectItem value="INCIDENT_FOLLOWUP">Incident Follow-up</SelectItem>
                <SelectItem value="INFRACTION_REMINDER">Infraction</SelectItem>
                <SelectItem value="SCHEDULED_CHECKIN">Check-in</SelectItem>
                <SelectItem value="MANUAL">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={msgFilter.channel} onValueChange={(v) => setMsgFilter(f => ({ ...f, channel: v }))}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Channel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Channels</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="SMS">SMS</SelectItem>
                <SelectItem value="PUSH">Push</SelectItem>
                <SelectItem value="IN_APP">In-App</SelectItem>
              </SelectContent>
            </Select>
            <Select value={msgFilter.status} onValueChange={(v) => setMsgFilter(f => ({ ...f, status: v }))}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="READ">Read</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>

            {/* Quick stats */}
            <div className="ml-auto flex items-center gap-3">
              {data?.statusStats && Object.entries(data.statusStats).map(([k, v]) => (
                <span key={k} className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span className={cn('w-1.5 h-1.5 rounded-full',
                    k === 'DELIVERED' || k === 'READ' ? 'bg-emerald' :
                    k === 'FAILED' ? 'bg-rose' :
                    k === 'PENDING' ? 'bg-amber' : 'bg-blue'
                  )} />
                  {k}: {v}
                </span>
              ))}
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No messages matching your filters
              </div>
            ) : (
              messages.map((msg) => (
                <MessageRow key={msg.id} msg={msg} onClick={() => setSelectedMsg(msg)} />
              ))
            )}
          </div>
        </TabsContent>

        {/* ─── Compose Tab ───────────────────────────────────── */}
        <TabsContent value="compose" className="flex-1 mt-3">
          <ComposeForm
            preselectedAgent={composeAgent}
            onSend={handleSendMessage}
            onClose={() => { setComposeAgent(null); }}
            isSending={sendMutation.isPending}
          />
        </TabsContent>
      </Tabs>

      {/* ─── Message Detail Dialog ───────────────────────────── */}
      <Dialog open={!!selectedMsg} onOpenChange={() => setSelectedMsg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">{selectedMsg?.subject}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              To: {selectedMsg?.agent.name} ({selectedMsg?.agent.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={cn('text-[10px]', STATUS_STYLES[selectedMsg?.status || ''])}>
                {selectedMsg?.status}
              </Badge>
              <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                {CHANNEL_ICONS[selectedMsg?.channel || '']} {CHANNEL_LABELS[selectedMsg?.channel || '']}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {TRIGGER_LABELS[selectedMsg?.triggerType || '']}
              </Badge>
              <Badge variant="outline" className={cn('text-[10px]', PRIORITY_STYLES[selectedMsg?.priority || ''])}>
                {selectedMsg?.priority}
              </Badge>
            </div>

            <Separator />

            <div className="bg-card/60 rounded-lg p-3 border border-border">
              <p className="text-xs leading-relaxed whitespace-pre-wrap">{selectedMsg?.body}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
              <span>Delivered: {selectedMsg?.deliveredAt ? timeAgo(selectedMsg.deliveredAt) : '—'}</span>
              <span>Read: {selectedMsg?.readAt ? timeAgo(selectedMsg.readAt) : '—'}</span>
              <span>Sent by: {selectedMsg?.sentBy ? selectedMsg.sentBy.name : 'System'}</span>
              <span>Created: {selectedMsg?.createdAt ? timeAgo(selectedMsg.createdAt) : '—'}</span>
            </div>

            {selectedMsg?.responseText && (
              <>
                <Separator />
                <div className="bg-emerald/5 rounded-lg p-3 border border-emerald/20">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Reply className="h-3 w-3 text-emerald" />
                    <span className="text-[10px] font-medium text-emerald">Agent Response</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{selectedMsg.respondedAt ? timeAgo(selectedMsg.respondedAt) : ''}</span>
                  </div>
                  <p className="text-xs leading-relaxed">{selectedMsg.responseText}</p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => {
              if (selectedMsg) {
                setComposeAgent({ id: selectedMsg.agentId, name: selectedMsg.agent.name });
                setSelectedMsg(null);
              }
            }}>
              <Send className="h-3.5 w-3.5 mr-1" /> Follow Up
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedMsg(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className="bg-card/40 border-border py-2.5 px-3">
      <div className="flex items-center gap-2">
        <div className={color}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground truncate">{label}</p>
          <p className={cn('text-lg font-bold tabular-nums leading-tight', color)}>{value}</p>
        </div>
      </div>
    </Card>
  );
}

function AgentGroupCard({
  title, description, icon, badgeColor, count, agents, bulkAction, bulkChannel, onBulkEngage, onSendMessage, isLoading, showIncidents,
}: {
  title: string; description: string; icon: React.ReactNode; badgeColor: string;
  count: number; agents: AgentBrief[];
  bulkAction: string; bulkChannel: string;
  onBulkEngage: (group: string) => void;
  onSendMessage: (agent: AgentBrief) => void;
  isLoading: boolean; showIncidents?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayed = expanded ? agents : agents.slice(0, 5);

  return (
    <Card className="bg-card/40 border-border">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-card flex items-center justify-center border border-border">
              {icon}
            </div>
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {title}
                <Badge variant="outline" className={cn('text-[10px] h-5', badgeColor)}>{count}</Badge>
              </CardTitle>
              <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] gap-1.5"
            onClick={() => onBulkEngage(bulkAction)}
            disabled={count === 0 || isLoading}
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            Engage All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {agents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No agents in this group</p>
        ) : (
          <div className="space-y-1.5">
            {displayed.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between rounded-md px-2.5 py-1.5 bg-background/50 border border-border/50 hover:border-border transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[9px] bg-emerald/15 text-emerald">
                      {agent.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{agent.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className={cn('w-1.5 h-1.5 rounded-full', agent.isOnline ? 'bg-emerald' : 'bg-muted-foreground/40')} />
                      {timeAgo(agent.lastSeenAt)}
                      <span className="text-muted-foreground/50">|</span>
                      <span>{agent._count.results}R {agent._count.incidents}I</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {showIncidents && agent.incidents && agent.incidents.length > 0 && (
                    <Badge variant="outline" className="text-[9px] h-5 text-rose border-rose/30">
                      {agent.incidents[0].type.replace(/_/g, ' ')}
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onSendMessage(agent)}>
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {agents.length > 5 && (
              <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] gap-1" onClick={() => setExpanded(!expanded)}>
                {expanded ? <><ChevronUp className="h-3 w-3" /> Show Less</> : <><ChevronDown className="h-3 w-3" /> Show {agents.length - 5} More</>}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MessageRow({ msg, onClick }: { msg: Message; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-lg border border-border bg-card/30 px-3 py-2.5 cursor-pointer hover:bg-card/60 hover:border-border transition-colors"
      onClick={onClick}
    >
      {/* Channel icon */}
      <div className="w-8 h-8 rounded-md bg-background border border-border flex items-center justify-center shrink-0 mt-0.5">
        {CHANNEL_ICONS[msg.channel] || <MessageSquare className="h-3.5 w-3.5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium truncate">{msg.subject}</span>
          <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 shrink-0', STATUS_STYLES[msg.status])}>
            {msg.status}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-1">{msg.body}</p>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/70">
          <span>To: {msg.agent.name}</span>
          <span className="text-muted-foreground/30">|</span>
          <span>{TRIGGER_LABELS[msg.triggerType] || msg.triggerType}</span>
          <span className="text-muted-foreground/30">|</span>
          <span>{timeAgo(msg.createdAt)}</span>
          {msg.responseText && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <span className="text-emerald flex items-center gap-0.5"><Reply className="h-2.5 w-2.5" /> Replied</span>
            </>
          )}
        </div>
      </div>

      {/* Priority + Agent status */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={cn('text-[10px]', PRIORITY_STYLES[msg.priority])}>{msg.priority}</span>
        <span className={cn('w-2 h-2 rounded-full', msg.agent.isOnline ? 'bg-emerald' : 'bg-muted-foreground/30')} />
      </div>
    </motion.div>
  );
}

function ComposeForm({
  preselectedAgent, onSend, onClose, isSending,
}: {
  preselectedAgent: { id: string; name: string } | null;
  onSend: (agentId: string, channel: string, subject: string, body: string, priority: string) => void;
  onClose: () => void;
  isSending: boolean;
}) {
  const { tenantId } = useDashboardStore();
  const [agentId, setAgentId] = useState(preselectedAgent?.id || '');
  const [channel, setChannel] = useState('WHATSAPP');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('NORMAL');

  // Fetch agents for dropdown
  const { data: agentsData } = useQuery<{ users: { id: string; name: string; email: string; isOnline: boolean }[] }>({
    queryKey: ['agents-list', tenantId],
    queryFn: () => fetch(`/api/agents?role=FIELD_AGENT&tenantId=${tenantId}`).then(r => r.json()),
    enabled: !!tenantId,
  });

  const agents = agentsData?.users || [];

  const handleSubmit = () => {
    if (!agentId || !subject.trim() || !body.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    onSend(agentId, channel, subject, body, priority);
    setSubject(''); setBody('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card className="bg-card/40 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="h-4 w-4 text-emerald" />
            Compose Message to Field Agent
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">
            Send a message via WhatsApp, SMS, Push Notification, or In-App
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Agent select */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Agent *</label>
            {preselectedAgent ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[8px] bg-emerald/15 text-emerald">
                    {preselectedAgent.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs">{preselectedAgent.name}</span>
                <Button variant="ghost" size="sm" className="ml-auto h-6 text-[10px]" onClick={onClose}>Change</Button>
              </div>
            ) : (
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select agent..." /></SelectTrigger>
                <SelectContent>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <span className={cn('w-1.5 h-1.5 rounded-full', a.isOnline ? 'bg-emerald' : 'bg-muted-foreground/30')} />
                        {a.name} ({a.email})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Channel + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Channel</label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WHATSAPP"><span className="flex items-center gap-2"><MessageCircle className="h-3.5 w-3.5 text-green-400" /> WhatsApp</span></SelectItem>
                  <SelectItem value="SMS"><span className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-blue-400" /> SMS</span></SelectItem>
                  <SelectItem value="PUSH"><span className="flex items-center gap-2"><Bell className="h-3.5 w-3.5 text-amber-400" /> Push Notification</span></SelectItem>
                  <SelectItem value="IN_APP"><span className="flex items-center gap-2"><Smartphone className="h-3.5 w-3.5 text-cyan-400" /> In-App</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Subject *</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Message subject..." className="h-9 text-xs" />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Message *</label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type your message to the field agent..." rows={5} className="text-xs" />
          </div>

          {/* Quick templates */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Quick Templates</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Status Check', s: 'Status Check Required', b: 'Please provide your current situation report: voter queue length, BVAS status, any incidents, and security presence at your polling unit.' },
                { label: 'Urgent Follow-up', s: 'URGENT: Immediate Response Required', b: 'Critical incident reported in your area. Please confirm your safety and provide an immediate update on the situation. If you are in danger, move to a safe location.' },
                { label: 'Result Reminder', s: 'Election Results Submission', b: 'Voting has concluded at your polling unit. Please submit the official election results immediately, including the result sheet photograph and all party vote counts.' },
                { label: 'Evidence Request', s: 'Additional Evidence Required', b: 'The incident you reported needs more documentation. Please capture: wide-angle photos, a 30-second video walkthrough, and statements from any witnesses.' },
              ].map((t) => (
                <Button key={t.label} variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => { setSubject(t.s); setBody(t.b); }}>
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Send */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { setSubject(''); setBody(''); onClose(); }}>Cancel</Button>
            <Button size="sm" className="gap-2 bg-emerald hover:bg-emerald/90 text-emerald-950" onClick={handleSubmit} disabled={isSending}>
              {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send via {CHANNEL_LABELS[channel]}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Need Wifi icon
function Wifi({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h.01" /><path d="M2 8.82a15 15 0 0 1 20 0" /><path d="M5 12.859a10 10 0 0 1 14 0" /><path d="M8.5 16.429a5 5 0 0 1 7 0" />
    </svg>
  );
}

// ─── WhatsApp Connection Panel ──────────────────────────────────

function WhatsAppPanel({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();

  const { data: waStatus, isLoading: waLoading, refetch: waRefetch } = useQuery({
    queryKey: ['whatsapp-status', tenantId],
    queryFn: () => fetch(`/api/whatsapp?tenantId=${tenantId}`).then(r => r.json()),
    refetchInterval: 5000,
    enabled: !!tenantId,
  });

  const linkMutation = useMutation({
    mutationFn: (phone: string) =>
      fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, phone }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
      toast.success('WhatsApp linking initiated');
    },
    onError: (e) => toast.error('Linking failed'),
  });

  const disconnectMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/whatsapp?action=disconnect&tenantId=${tenantId}`, { method: 'PUT' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
      toast.success('WhatsApp disconnected');
    },
  });

  const [linkPhone, setLinkPhone] = useState('');

  const status = waStatus?.status || 'DISCONNECTED';
  const phone = waStatus?.phone || waStatus?.whatsappPhone || '';
  const jid = waStatus?.jid || waStatus?.whatsappJid || '';
  const qrCode = waStatus?.qrCode || '';
  const mode = waStatus?.mode || (waStatus?.status === 'DISCONNECTED' ? 'OFFLINE' : 'UNKNOWN');

  const isConnected = status === 'CONNECTED';
  const isQRReady = status === 'QR_READY';
  const isConnecting = status === 'CONNECTING';

  const statusColor = isConnected ? 'text-green-400' : isQRReady ? 'text-amber' : isConnecting ? 'text-cyan' : 'text-muted-foreground';
  const statusBg = isConnected ? 'bg-green-500' : isQRReady ? 'bg-amber' : isConnecting ? 'bg-cyan animate-pulse' : 'bg-muted-foreground/30';

  return (
    <Card className="bg-card/40 border-border shrink-0">
      <CardContent className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">WhatsApp Integration</span>
                <span className={cn('w-2 h-2 rounded-full', statusBg)} />
                <span className={cn('text-[10px] font-medium', statusColor)}>
                  {status}
                </span>
                {mode === 'MOCK' && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-amber border-amber/30">DEV MODE</Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isConnected ? (
                  <>Connected as <span className="font-mono text-[10px]">{jid}</span></>
                ) : isQRReady ? (
                  'Scan QR code with WhatsApp to link this tenant'
                ) : isConnecting ? (
                  'Generating QR code...'
                ) : (
                  'Not connected — link a WhatsApp number to enable agent messaging'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected && (
              <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1.5 text-rose border-rose/30 hover:bg-rose/10" onClick={() => disconnectMutation.mutate()}>
                <Unlink className="h-3 w-3" /> Disconnect
              </Button>
            )}

            {!isConnected && !isConnecting && !isQRReady && (
              <div className="flex items-center gap-2">
                <Input
                  value={linkPhone}
                  onChange={(e) => setLinkPhone(e.target.value)}
                  placeholder="+2348012345678"
                  className="h-7 w-36 text-[11px]"
                />
                <Button
                  size="sm"
                  className="h-7 text-[10px] gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => { if (linkPhone) linkMutation.mutate(linkPhone); }}
                  disabled={linkMutation.isPending || !linkPhone}
                >
                  {linkMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                  Link
                </Button>
              </div>
            )}

            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => waRefetch()}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* QR Code display */}
        {isQRReady && qrCode && (
          <div className="mt-3 flex items-center gap-4 p-3 bg-background/50 rounded-lg border border-border">
            <div className="w-32 h-32 bg-white rounded-md flex items-center justify-center border border-border shrink-0 p-2">
              {mode === 'MOCK' ? (
                <div className="text-center">
                  <QrCode className="h-8 w-8 text-muted-foreground/40 mx-auto mb-1" />
                  <p className="text-[9px] text-muted-foreground">MOCK QR</p>
                  <p className="text-[8px] text-muted-foreground/60 font-mono">{qrCode.substring(0, 20)}...</p>
                </div>
              ) : (
                /* In production, render actual QR code image from the base64 data */
                <QrCode className="h-24 w-24 text-foreground/20" />
              )}
            </div>
            <div className="text-[11px] text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Scan with WhatsApp</p>
              <p>1. Open WhatsApp on your phone</p>
              <p>2. Go to Settings → Linked Devices</p>
              <p>3. Tap "Link a Device"</p>
              <p>4. Scan this QR code</p>
              <p className="text-[10px] text-amber pt-1">QR refreshes automatically. Connection will be saved for future sessions.</p>
            </div>
          </div>
        )}

        {/* Connected info */}
        {isConnected && (
          <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {phone}</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-400" /> Bridge Active</span>
            <span>Messages sent via WhatsApp will use this number. Agent replies are auto-recorded.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}