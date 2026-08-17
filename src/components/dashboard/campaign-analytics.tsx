'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, TrendingUp, TrendingDown, Send, MessageSquare,
  Users, Target, Zap, Rocket, Eye, ArrowUpRight, ArrowDownRight,
  Globe, Smartphone, Bell, ThumbsUp, ThumbsDown, Minus,
  Loader2, CheckCircle2, AlertCircle, Sparkles, Crown,
  Medal, Award, ChevronDown, ChevronRight, Copy,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, AreaChart, Area,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { fetchJson } from '@/lib/api';
import { useDashboardStore } from '@/store/dashboard';
import { BUILT_IN_TEMPLATES, type MessageTemplate } from '@/data/templates';

// ─── Data Types ───────────────────────────────────────────────────

interface CampaignAnalytics {
  id: string;
  name: string;
  channel: string;
  sentCount: number;
  deliveredCount: number;
  responseCount: number;
  readCount: number;
  status: string;
  createdAt: string;
  totalRecipients: number;
  failedCount: number;
  templateBody: string | null;
}

interface ContactFunnel {
  total: number;
  messaged: number;
  delivered: number;
  opened: number;
  responded: number;
  converted: number;
}

interface ContactListInfo {
  id: string;
  name: string;
  segment: string | null;
  contactCount: number;
}

interface OsintSentimentCounts {
  POSITIVE: number;
  NEGATIVE: number;
  NEUTRAL: number;
  MIXED: number;
}

interface TimeSeriesPoint {
  date: string;
  sent: number;
  responded: number;
}

// ─── Chart tooltip style ──────────────────────────────────────────

const chartTooltipStyle = {
  contentStyle: { background: 'oklch(0.18 0.006 260)', border: '1px solid oklch(0.28 0.01 260)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: 'oklch(0.9 0 0)' },
};

// ─── Animation variants ──────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

// ─── Color constants ──────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  WHATSAPP: 'oklch(0.72 0.19 163)',
  SMS: 'oklch(0.82 0.17 84)',
  PUSH: 'oklch(0.72 0.16 234)',
};

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  PUSH: 'Push',
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  WHATSAPP: <Smartphone className="size-3.5" />,
  SMS: <MessageSquare className="size-3.5" />,
  PUSH: <Bell className="size-3.5" />,
};

const RANK_STYLES = [
  { border: 'border-amber-500/40', bg: 'bg-amber-500/5', glow: 'shadow-amber-500/10', icon: <Crown className="size-4 text-amber-400" /> },
  { border: 'border-emerald-500/40', bg: 'bg-emerald-500/5', glow: 'shadow-emerald-500/10', icon: <Medal className="size-4 text-emerald-400" /> },
  { border: 'border-rose-500/40', bg: 'bg-rose-500/5', glow: 'shadow-rose-500/10', icon: <Award className="size-4 text-rose-400" /> },
];

const FUNNEL_STAGES = [
  { key: 'total', label: 'Total Contacts', color: 'oklch(0.55 0.17 163)' },
  { key: 'messaged', label: 'Messaged', color: 'oklch(0.65 0.17 163)' },
  { key: 'delivered', label: 'Delivered', color: 'oklch(0.72 0.19 163)' },
  { key: 'opened', label: 'Opened', color: 'oklch(0.72 0.16 234)' },
  { key: 'responded', label: 'Responded', color: 'oklch(0.82 0.17 84)' },
  { key: 'converted', label: 'Converted', color: 'oklch(0.78 0.15 55)' },
];

// ─── Helper: format number ───────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function pct(num: number, den: number): string {
  if (!den) return '0%';
  return `${Math.round((num / den) * 100)}%`;
}

// ─── Helper: generate mock time-series from campaigns ─────────────

function generateTimeSeries(campaigns: CampaignAnalytics[]): TimeSeriesPoint[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const totalSent = campaigns.reduce((s, c) => s + c.sentCount, 0);
  const totalResp = campaigns.reduce((s, c) => s + c.responseCount, 0);

  // Distribute across 7 days with some variation
  const weights = [0.10, 0.14, 0.18, 0.15, 0.20, 0.12, 0.11];
  return days.map((day, i) => ({
    date: day,
    sent: Math.round(totalSent * weights[i] * (0.85 + Math.random() * 0.3)),
    responded: Math.round(totalResp * weights[i] * (0.8 + Math.random() * 0.4)),
  }));
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function CampaignAnalyticsPanel() {
  const tenantId = useDashboardStore((s) => s.tenantId);
  const queryClient = useQueryClient();
  const [quickChannel, setQuickChannel] = useState('WHATSAPP');
  const [quickMessage, setQuickMessage] = useState('');
  const [quickContactList, setQuickContactList] = useState('');
  const [quickName, setQuickName] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  // ─── Data Queries ───────────────────────────────────────────────

  const campaignsQuery = useQuery({
    queryKey: ['campaigns-analytics', tenantId],
    queryFn: () =>
      fetchJson<{ campaigns: CampaignAnalytics[]; contactLists: ContactListInfo[] }>(
        `/api/campaigns?tenantId=${tenantId}`,
      ),
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });

  const contactsQuery = useQuery({
    queryKey: ['campaigns-contacts', tenantId],
    queryFn: () =>
      fetchJson<{ contactLists: ContactListInfo[] }>(
        `/api/campaigns/contacts?tenantId=${tenantId}`,
      ),
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });

  const osintQuery = useQuery({
    queryKey: ['osint-analytics', tenantId],
    queryFn: () =>
      fetchJson<{
        posts: { id: string; sentiment: string; content: string }[];
        counts: { bySentiment: Record<string, number> };
        trends: Record<string, { value: number; up: boolean }>;
      }>(`/api/osint?tenantId=${tenantId}&limit=20`),
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });

  // ─── Quick Launch Mutation ──────────────────────────────────────

  const launchMutation = useMutation({
    mutationFn: () =>
      fetchJson<{ campaign: { id: string } }>('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: quickName || `Quick Campaign ${new Date().toLocaleDateString()}`,
          templateBody: quickMessage,
          channel: quickChannel,
          contactListId: quickContactList || undefined,
          createdBy: 'quick-launch',
        }),
      }),
    onSuccess: () => {
      toast.success('Campaign launched successfully!');
      setQuickMessage('');
      setQuickName('');
      setQuickContactList('');
      queryClient.invalidateQueries({ queryKey: ['campaigns-analytics'] });
    },
    onError: (err: Error) => {
      toast.error(`Launch failed: ${err.message}`);
    },
  });

  // ─── Derived Data ───────────────────────────────────────────────

  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const contactLists = contactsQuery.data?.contactLists ?? [];
  const sentimentCounts = osintQuery.data?.counts?.bySentiment ?? {};

  const sortedCampaigns = useMemo(
    () =>
      [...campaigns]
        .filter((c) => c.sentCount > 0)
        .sort((a, b) => {
          const rateA = a.deliveredCount / Math.max(a.sentCount, 1);
          const rateB = b.deliveredCount / Math.max(b.sentCount, 1);
          return rateB - rateA;
        }),
    [campaigns],
  );

  const topThree = sortedCampaigns.slice(0, 3);

  const funnelData = useMemo<ContactFunnel>(() => {
    const total = campaigns.reduce((s, c) => s + c.totalRecipients, 0) || contactLists.reduce((s, c) => s + c.contactCount, 0);
    const messaged = campaigns.reduce((s, c) => s + c.sentCount, 0);
    const delivered = campaigns.reduce((s, c) => s + c.deliveredCount, 0);
    const opened = campaigns.reduce((s, c) => s + c.readCount, 0);
    const responded = campaigns.reduce((s, c) => s + c.responseCount, 0);
    const converted = Math.round(responded * 0.35);
    return { total: total || 1, messaged, delivered, opened, responded, converted };
  }, [campaigns, contactLists]);

  const channelDistribution = useMemo(() => {
    const map: Record<string, { count: number; sent: number; delivered: number; read: number; responded: number }> = {};
    for (const c of campaigns) {
      const ch = c.channel || 'WHATSAPP';
      if (!map[ch]) map[ch] = { count: 0, sent: 0, delivered: 0, read: 0, responded: 0 };
      map[ch].count++;
      map[ch].sent += c.sentCount;
      map[ch].delivered += c.deliveredCount;
      map[ch].read += c.readCount;
      map[ch].responded += c.responseCount;
    }
    return map;
  }, [campaigns]);

  const channelPieData = useMemo(
    () =>
      Object.entries(channelDistribution).map(([ch, d]) => ({
        name: CHANNEL_LABELS[ch] || ch,
        value: d.sent,
        deliveryRate: d.sent > 0 ? Math.round((d.delivered / d.sent) * 100) : 0,
        readRate: d.sent > 0 ? Math.round((d.read / d.sent) * 100) : 0,
        openRate: d.sent > 0 ? Math.round((d.responded / d.sent) * 100) : 0,
        color: CHANNEL_COLORS[ch] || 'oklch(0.7 0 0)',
      })),
    [channelDistribution],
  );

  const timeSeries = useMemo(() => generateTimeSeries(campaigns), [campaigns]);

  const sentimentSummary = useMemo(() => {
    const pos = sentimentCounts['POSITIVE'] || 0;
    const neg = sentimentCounts['NEGATIVE'] || 0;
    const neu = sentimentCounts['NEUTRAL'] || 0;
    const mixed = sentimentCounts['MIXED'] || 0;
    const total = pos + neg + neu + mixed;
    return { pos, neg, neu, mixed, total };
  }, [sentimentCounts]);

  const sentimentRatio = sentimentSummary.pos > 0 && sentimentSummary.neg > 0
    ? Math.round((sentimentSummary.pos / sentimentSummary.neg) * 100) / 100
    : sentimentSummary.pos > 0 ? Infinity : 0;

  // ─── Loading state ──────────────────────────────────────────────

  const isLoading = campaignsQuery.isLoading && contactsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
            <BarChart3 className="size-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Campaign Analytics</h2>
            <p className="text-xs text-muted-foreground">Voter engagement intelligence &amp; campaign ROI</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs font-normal gap-1">
          <Sparkles className="size-3 text-emerald-400" />
          {campaigns.length} campaigns
        </Badge>
      </motion.div>

      {/* ─── Tabs ────────────────────────────────────────────────── */}
      <Tabs defaultValue="roi" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="roi" className="gap-1.5 text-xs">
            <TrendingUp className="size-3.5" />
            ROI Dashboard
          </TabsTrigger>
          <TabsTrigger value="funnel" className="gap-1.5 text-xs">
            <Users className="size-3.5" />
            Engagement Funnel
          </TabsTrigger>
          <TabsTrigger value="channel" className="gap-1.5 text-xs">
            <Globe className="size-3.5" />
            Channel Performance
          </TabsTrigger>
          <TabsTrigger value="sentiment" className="gap-1.5 text-xs">
            <ThumbsUp className="size-3.5" />
            Sentiment
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════
            TAB 1: ROI DASHBOARD
            ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="roi" className="space-y-4">
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
            {/* Top 3 Highlight Cards */}
            {topThree.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {topThree.map((camp, idx) => {
                  const roi = camp.sentCount > 0
                    ? Math.round((camp.responseCount / camp.sentCount) * 10000) / 100
                    : 0;
                  const style = RANK_STYLES[idx] || RANK_STYLES[2];
                  return (
                    <motion.div key={camp.id} custom={idx} variants={fadeUp}>
                      <Card className={cn(`border ${style.border} ${style.bg} shadow-sm ${style.glow}`)}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            {style.icon}
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              #{idx + 1}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium truncate">{camp.name}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {CHANNEL_ICONS[camp.channel]}
                            <span className="text-[11px] text-muted-foreground">
                              {CHANNEL_LABELS[camp.channel]}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Delivery</span>
                              <span className="font-medium">{pct(camp.deliveredCount, camp.sentCount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Response</span>
                              <span className="font-medium">{pct(camp.responseCount, camp.sentCount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Sent</span>
                              <span className="font-medium">{fmt(camp.sentCount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">ROI Score</span>
                              <span className="font-medium text-emerald-400">{roi}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Full Campaign Table */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="size-4 text-emerald-400" />
                  All Campaigns — Sorted by Delivery Rate
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[420px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-4 py-2 font-medium">Campaign</th>
                        <th className="px-3 py-2 font-medium">Channel</th>
                        <th className="px-3 py-2 font-medium text-right">Sent</th>
                        <th className="px-3 py-2 font-medium text-right">Delivered</th>
                        <th className="px-3 py-2 font-medium text-right">Response</th>
                        <th className="px-3 py-2 font-medium text-right">ROI</th>
                        <th className="px-3 py-2 font-medium text-right">Reach Est.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCampaigns.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                            <AlertCircle className="size-4 mx-auto mb-2 opacity-50" />
                            No campaign data yet. Launch your first campaign below.
                          </td>
                        </tr>
                      ) : (
                        sortedCampaigns.map((camp, idx) => {
                          const roi = camp.sentCount > 0
                            ? Math.round((camp.responseCount / camp.sentCount) * 10000) / 100
                            : 0;
                          const delRate = pct(camp.deliveredCount, camp.sentCount);
                          const respRate = pct(camp.responseCount, camp.sentCount);
                          const reach = Math.round(camp.deliveredCount * 1.12); // estimated network reach
                          const isTop3 = idx < 3;
                          return (
                            <motion.tr
                              key={camp.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: idx * 0.03 }}
                              className={cn(
                                'border-b last:border-0 transition-colors hover:bg-muted/30',
                                isTop3 && RANK_STYLES[idx]?.bg,
                              )}
                            >
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {isTop3 && RANK_STYLES[idx]?.icon}
                                  <div>
                                    <p className="font-medium truncate max-w-[160px]">{camp.name}</p>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1 py-0 mt-0.5"
                                    >
                                      {camp.status}
                                    </Badge>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="inline-flex items-center gap-1">
                                  {CHANNEL_ICONS[camp.channel]}
                                  {CHANNEL_LABELS[camp.channel]}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono">{fmt(camp.sentCount)}</td>
                              <td className="px-3 py-2.5 text-right">
                                <span className={cn(
                                  'font-mono',
                                  parseFloat(delRate) >= 80 ? 'text-emerald-400' :
                                  parseFloat(delRate) >= 60 ? 'text-amber-400' : 'text-rose-400',
                                )}>
                                  {delRate}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <span className={cn(
                                  'font-mono',
                                  parseFloat(respRate) >= 30 ? 'text-emerald-400' :
                                  parseFloat(respRate) >= 15 ? 'text-amber-400' : 'text-muted-foreground',
                                )}>
                                  {respRate}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <span className={cn(
                                  'font-mono font-medium',
                                  roi >= 50 ? 'text-emerald-400' :
                                  roi >= 20 ? 'text-amber-400' : 'text-muted-foreground',
                                )}>
                                  {roi}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                                ~{fmt(reach)}
                              </td>
                            </motion.tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Message Effectiveness Chart */}
            {campaigns.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Zap className="size-4 text-cyan-400" />
                    Message Effectiveness — Last 7 Days
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeSeries} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                        <defs>
                          <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="oklch(0.72 0.16 234)" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="oklch(0.72 0.16 234)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradResp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="oklch(0.72 0.19 163)" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="oklch(0.72 0.19 163)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                        />
                        <Tooltip {...chartTooltipStyle} />
                        <Area
                          type="monotone"
                          dataKey="sent"
                          stroke="oklch(0.72 0.16 234)"
                          strokeWidth={2}
                          fill="url(#gradSent)"
                          name="Sent"
                          dot={{ r: 3, fill: 'oklch(0.72 0.16 234)' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="responded"
                          stroke="oklch(0.72 0.19 163)"
                          strokeWidth={2}
                          fill="url(#gradResp)"
                          name="Responded"
                          dot={{ r: 3, fill: 'oklch(0.72 0.19 163)' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center gap-4 mt-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-cyan-500" /> Messages Sent
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500" /> Responses
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════
            TAB 2: ENGAGEMENT FUNNEL
            ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="funnel" className="space-y-4">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {/* Funnel summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Reach', value: funnelData.total, icon: <Users className="size-4" />, color: 'text-emerald-400' },
                { label: 'Delivery Rate', value: `${pct(funnelData.delivered, funnelData.messaged)}`, icon: <Send className="size-4" />, color: 'text-cyan-400' },
                { label: 'Open Rate', value: `${pct(funnelData.opened, funnelData.delivered)}`, icon: <Eye className="size-4" />, color: 'text-violet-400' },
                { label: 'Conversion', value: `${pct(funnelData.converted, funnelData.total)}`, icon: <Target className="size-4" />, color: 'text-amber-400' },
              ].map((stat, idx) => (
                <motion.div key={stat.label} custom={idx} variants={fadeUp}>
                  <Card className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={stat.color}>{stat.icon}</span>
                      <span className="text-[11px] text-muted-foreground">{stat.label}</span>
                    </div>
                    <p className="text-lg font-bold font-mono">{stat.value}</p>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Visual Funnel */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ArrowDownRight className="size-4 text-emerald-400" />
                  Contact Engagement Funnel
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {FUNNEL_STAGES.map((stage, idx) => {
                  const value = (funnelData as unknown as Record<string, number>)[stage.key] || 0;
                  const widthPct = idx === 0
                    ? 100
                    : Math.max(
                        Math.round(
                          (value / Math.max(funnelData.total, 1)) * 100,
                        ),
                        8,
                      );
                  const percentage = pct(value, funnelData.total);

                  return (
                    <motion.div
                      key={stage.key}
                      custom={idx}
                      variants={fadeUp}
                      className="space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <ChevronRight
                            className="size-3"
                            style={{ color: stage.color }}
                          />
                          {stage.label}
                        </span>
                        <span className="font-mono font-medium">
                          {fmt(value)}{' '}
                          <span className="text-muted-foreground font-normal">
                            ({percentage})
                          </span>
                        </span>
                      </div>
                      <div className="relative h-7 rounded-md overflow-hidden bg-muted/30">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${widthPct}%` }}
                          transition={{
                            delay: idx * 0.12,
                            duration: 0.6,
                            ease: 'easeOut' as const,
                          }}
                          className="absolute inset-y-0 left-0 rounded-md flex items-center justify-center"
                          style={{
                            backgroundColor: stage.color,
                            opacity: 0.15 + idx * 0.06,
                          }}
                        />
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${widthPct}%` }}
                          transition={{
                            delay: idx * 0.12 + 0.05,
                            duration: 0.6,
                            ease: 'easeOut' as const,
                          }}
                          className="absolute inset-y-0 left-0 rounded-md"
                          style={{
                            background: `linear-gradient(90deg, ${stage.color}, ${stage.color}88)`,
                            opacity: 0.5,
                          }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Drop-off analysis */}
            <Card className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                <AlertCircle className="size-3.5" />
                Key Insight
              </p>
              <p className="text-sm">
                {funnelData.messaged > 0 ? (
                  <>
                    From <strong>{fmt(funnelData.messaged)}</strong> messages sent,{' '}
                    <strong className="text-emerald-400">
                      {pct(funnelData.delivered, funnelData.messaged)}
                    </strong>{' '}
                    were delivered. Of those,{' '}
                    <strong className="text-amber-400">
                      {pct(funnelData.opened, funnelData.delivered)}
                    </strong>{' '}
                    were opened and{' '}
                    <strong className="text-cyan-400">
                      {pct(funnelData.responded, funnelData.delivered)}
                    </strong>{' '}
                    responded. Estimated conversion rate:{' '}
                    <strong className="text-violet-400">
                      {pct(funnelData.converted, funnelData.total)}
                    </strong>
                    .
                  </>
                ) : (
                  'No campaign activity yet. Launch a campaign to see funnel analytics.'
                )}
              </p>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════
            TAB 3: CHANNEL PERFORMANCE
            ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="channel" className="space-y-4">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {/* Pie chart + stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <PieChart className="size-4 text-emerald-400" />
                    Channel Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {channelPieData.length === 0 ? (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-xs">
                      No channel data available
                    </div>
                  ) : (
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={channelPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                            nameKey="name"
                          >
                            {channelPieData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.color} stroke="transparent" />
                            ))}
                          </Pie>
                          <Tooltip {...chartTooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-4 mt-2 text-[11px] text-muted-foreground">
                    {channelPieData.map((ch) => (
                      <span key={ch.name} className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ backgroundColor: ch.color }} />
                        {ch.name}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Channel-specific metrics */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Smartphone className="size-4 text-cyan-400" />
                    Channel Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {channelPieData.length === 0 ? (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-xs">
                      No channel data available
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {channelPieData.map((ch, idx) => (
                        <motion.div
                          key={ch.name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ delay: idx * 0.08 }}
                          className="rounded-lg border p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-sm font-medium">
                              <span
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: ch.color }}
                              />
                              {ch.name}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {fmt(ch.value)} sent
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[11px]">
                            <div className="space-y-0.5">
                              <span className="text-muted-foreground">
                                {ch.name === 'WhatsApp' ? 'Read Rate' : ch.name === 'SMS' ? 'Delivery' : 'Open Rate'}
                              </span>
                              <p className="font-mono font-medium text-emerald-400">
                                {ch.name === 'WhatsApp' ? ch.readRate : ch.deliveryRate}%
                              </p>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-muted-foreground">Engagement</span>
                              <p className="font-mono font-medium text-cyan-400">
                                {ch.openRate}%
                              </p>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-muted-foreground">Volume</span>
                              <p className="font-mono font-medium">
                                {fmt(ch.value)}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Channel comparison bar chart */}
            {channelPieData.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="size-4 text-amber-400" />
                    Delivery Rate by Channel
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={channelPieData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }}
                          axisLine={false}
                          tickLine={false}
                          domain={[0, 100]}
                          width={40}
                        />
                        <Tooltip
                          {...chartTooltipStyle}
                          formatter={(value: number) => `${value}%`}
                        />
                        <Bar dataKey="deliveryRate" radius={[6, 6, 0, 0]} maxBarSize={48}>
                          {channelPieData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════
            TAB 4: SENTIMENT
            ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="sentiment" className="space-y-4">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {/* Sentiment Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Positive */}
              <motion.div custom={0} variants={fadeUp}>
                <Card className="p-4 border-emerald-500/20 bg-emerald-500/5">
                  <div className="flex items-center justify-between mb-2">
                    <ThumbsUp className="size-5 text-emerald-400" />
                    {sentimentRatio > 1 ? (
                      <span className="flex items-center text-[11px] text-emerald-400 font-medium">
                        <TrendingUp className="size-3 mr-0.5" />
                        Positive trend
                      </span>
                    ) : (
                      <span className="flex items-center text-[11px] text-muted-foreground font-medium">
                        <Minus className="size-3 mr-0.5" />
                        Neutral
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold font-mono text-emerald-400">
                    {fmt(sentimentSummary.pos)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Positive Mentions</p>
                </Card>
              </motion.div>

              {/* Negative */}
              <motion.div custom={1} variants={fadeUp}>
                <Card className="p-4 border-rose-500/20 bg-rose-500/5">
                  <div className="flex items-center justify-between mb-2">
                    <ThumbsDown className="size-5 text-rose-400" />
                    {sentimentRatio < 1 && sentimentRatio > 0 ? (
                      <span className="flex items-center text-[11px] text-rose-400 font-medium">
                        <TrendingDown className="size-3 mr-0.5" />
                        Caution
                      </span>
                    ) : (
                      <span className="flex items-center text-[11px] text-muted-foreground font-medium">
                        <CheckCircle2 className="size-3 mr-0.5" />
                        Managed
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold font-mono text-rose-400">
                    {fmt(sentimentSummary.neg)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Negative Mentions</p>
                </Card>
              </motion.div>

              {/* Neutral */}
              <motion.div custom={2} variants={fadeUp}>
                <Card className="p-4 border-muted/40 bg-muted/5">
                  <div className="flex items-center justify-between mb-2">
                    <Minus className="size-5 text-muted-foreground" />
                    <Badge variant="outline" className="text-[10px]">
                      {sentimentSummary.total > 0
                        ? pct(sentimentSummary.neu + sentimentSummary.mixed, sentimentSummary.total)
                        : '0%'}
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold font-mono text-muted-foreground">
                    {fmt(sentimentSummary.neu + sentimentSummary.mixed)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Neutral / Mixed</p>
                </Card>
              </motion.div>
            </div>

            {/* Sentiment Ratio */}
            {sentimentSummary.total > 0 && (
              <motion.div custom={3} variants={fadeUp}>
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">Sentiment Distribution</p>
                    <span className={cn(
                      'text-xs font-mono font-medium px-2 py-0.5 rounded-full',
                      sentimentRatio > 1.5
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : sentimentRatio > 1
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : sentimentRatio > 0
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-muted/10 text-muted-foreground',
                    )}>
                      P/N Ratio: {sentimentRatio === Infinity ? '∞' : sentimentRatio.toFixed(2)}
                    </span>
                  </div>
                  {/* Stacked horizontal bar */}
                  <div className="flex h-3 rounded-full overflow-hidden bg-muted/20">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(sentimentSummary.pos / sentimentSummary.total) * 100}%`,
                      }}
                      transition={{ delay: 0.3, duration: 0.8 }}
                      className="bg-emerald-500"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(sentimentSummary.neg / sentimentSummary.total) * 100}%`,
                      }}
                      transition={{ delay: 0.4, duration: 0.8 }}
                      className="bg-rose-500"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${((sentimentSummary.neu + sentimentSummary.mixed) / sentimentSummary.total) * 100}%`,
                      }}
                      transition={{ delay: 0.5, duration: 0.8 }}
                      className="bg-muted-foreground/30"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      Positive {pct(sentimentSummary.pos, sentimentSummary.total)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-rose-500" />
                      Negative {pct(sentimentSummary.neg, sentimentSummary.total)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-muted-foreground/30" />
                      Neutral {pct(sentimentSummary.neu + sentimentSummary.mixed, sentimentSummary.total)}
                    </span>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Sentiment over channel — bar chart */}
            {osintQuery.data?.posts && osintQuery.data.posts.length > 0 && (
              <motion.div custom={4} variants={fadeUp}>
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <BarChart3 className="size-4 text-violet-400" />
                      Sentiment Breakdown by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            {
                              name: 'Positive',
                              value: sentimentSummary.pos,
                              fill: 'oklch(0.72 0.19 163)',
                            },
                            {
                              name: 'Negative',
                              value: sentimentSummary.neg,
                              fill: 'oklch(0.72 0.17 12)',
                            },
                            {
                              name: 'Neutral',
                              value: sentimentSummary.neu,
                              fill: 'oklch(0.7 0 0)',
                            },
                            {
                              name: 'Mixed',
                              value: sentimentSummary.mixed,
                              fill: 'oklch(0.72 0.16 234)',
                            },
                          ]}
                          layout="vertical"
                          margin={{ top: 5, right: 20, bottom: 5, left: 60 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }}
                            axisLine={false}
                            tickLine={false}
                            width={56}
                          />
                          <Tooltip {...chartTooltipStyle} />
                          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={24}>
                            {[
                              'oklch(0.72 0.19 163)',
                              'oklch(0.72 0.17 12)',
                              'oklch(0.7 0 0)',
                              'oklch(0.72 0.16 234)',
                            ].map((color, idx) => (
                              <Cell key={idx} fill={color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {osintQuery.isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading sentiment data...</span>
              </div>
            )}
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════
          QUICK CAMPAIGN LAUNCHER (always visible)
          ═══════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-emerald-500/20 bg-emerald-500/[0.02]">
          <CardHeader className="pb-3 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Rocket className="size-4 text-emerald-400" />
                Quick Campaign Launcher
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] gap-1 h-7 px-2"
                onClick={() => setShowTemplates(!showTemplates)}
              >
                <Copy className="size-3" />
                Templates
                <ChevronDown
                  className={cn('size-3 transition-transform', showTemplates && 'rotate-180')}
                />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* Template suggestions */}
            <AnimatePresence>
              {showTemplates && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="max-h-32 overflow-y-auto rounded-lg border bg-background/50 p-2 space-y-1 mb-3">
                    {BUILT_IN_TEMPLATES.filter(
                      (t) =>
                        t.category === 'GOTV' ||
                        t.category === 'MOBILIZATION' ||
                        t.category === 'REMINDER',
                    )
                      .slice(0, 6)
                      .map((tmpl: MessageTemplate) => (
                        <button
                          key={tmpl.id}
                          type="button"
                          onClick={() => {
                            setQuickMessage(tmpl.body);
                            setQuickName(tmpl.name);
                            setShowTemplates(false);
                          }}
                          className="w-full text-left rounded-md px-2.5 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-start gap-2"
                        >
                          <span className="shrink-0 mt-0.5">
                            <Zap className="size-3 text-amber-400" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{tmpl.name}</p>
                            <p className="text-muted-foreground truncate">{tmpl.body.slice(0, 80)}...</p>
                          </div>
                        </button>
                      ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Campaign Name</Label>
                <Input
                  placeholder="e.g. GOTV Push — Ward 5"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contact List</Label>
                <Select value={quickContactList} onValueChange={setQuickContactList}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select list..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contactLists.map((cl) => (
                      <SelectItem key={cl.id} value={cl.id} className="text-xs">
                        {cl.name} ({fmt(cl.contactCount)} contacts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea
                placeholder="Type your campaign message or pick a template above..."
                value={quickMessage}
                onChange={(e) => setQuickMessage(e.target.value)}
                className="min-h-[60px] text-xs resize-none"
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Select value={quickChannel} onValueChange={setQuickChannel}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WHATSAPP" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="size-3" /> WhatsApp
                    </span>
                  </SelectItem>
                  <SelectItem value="SMS" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="size-3" /> SMS
                    </span>
                  </SelectItem>
                  <SelectItem value="PUSH" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <Bell className="size-3" /> Push
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="sm"
                onClick={() => launchMutation.mutate()}
                disabled={launchMutation.isPending || !quickMessage.trim()}
                className="gap-1.5 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {launchMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Rocket className="size-3.5" />
                )}
                Quick Launch
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default CampaignAnalyticsPanel;
