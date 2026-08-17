'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  Globe, TrendingUp, TrendingDown, ShieldAlert, Bot,
  Flame, ChevronDown, ChevronUp, MapPin, Clock,
  Heart, Share2, MessageSquare, Eye, Sparkles,
  ExternalLink, Search, Filter, Loader2, AlertTriangle,
  AlertCircle, CheckCircle2, Zap, BarChart3, FileWarning, Users,
  Radio, Fingerprint,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useDashboardStore } from '@/store/dashboard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OsintPost {
  id: string;
  platform: string;
  author: string;
  authorFollowers: number;
  content: string;
  url: string;
  sentiment: string;
  category: string;
  isVerified: boolean;
  isFakeNews: boolean;
  isBotSuspect: boolean;
  cibScore: number;
  aiSummary: string;
  aiFlags: string[];
  viralityScore: number;
  engagement: { likes: number; shares: number; comments: number; views: number };
  keywords: string[];
  location: string | null;
  publishedAt: string;
  ingestedAt: string;
}

interface OsintCounts {
  total: number;
  byCategory: Record<string, number>;
  bySentiment: Record<string, number>;
  byPlatform: Record<string, number>;
  fakeNews: number;
  botSuspect: number;
  viralityAlerts: number;
}

interface OsintTrend {
  value: number;
  up: boolean;
}

interface OsintResponse {
  posts: OsintPost[];
  counts: OsintCounts;
  trends?: {
    total?: OsintTrend;
    fakeNews?: OsintTrend;
    botSuspect?: OsintTrend;
    viralityAlerts?: OsintTrend;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLATFORMS = ['All', 'X', 'Facebook', 'YouTube', 'TikTok', 'News'] as const;
const CATEGORIES = [
  'All', 'Disinformation', 'Hate Speech', 'CIB Suspect', 'Bot Activity', 'Violence', 'Election News',
] as const;

function platformColor(p: string) {
  switch (p) {
    case 'X': return 'bg-foreground/90 text-background';
    case 'Facebook': return 'bg-cyan/15 text-cyan border-cyan/30';
    case 'YouTube': return 'bg-rose/15 text-rose border-rose/30';
    case 'TikTok': return 'bg-violet/15 text-violet border-violet/30';
    case 'News': return 'bg-amber/15 text-amber border-amber/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function platformIcon(p: string) {
  switch (p) {
    case 'X': return <Radio className="h-3 w-3" />;
    case 'Facebook': return <Users className="h-3 w-3" />;
    case 'YouTube': return <Eye className="h-3 w-3" />;
    case 'TikTok': return <Zap className="h-3 w-3" />;
    case 'News': return <BarChart3 className="h-3 w-3" />;
    default: return <Globe className="h-3 w-3" />;
  }
}

function sentimentStyle(s: string) {
  switch (s) {
    case 'POSITIVE': return 'bg-emerald/15 text-emerald border-emerald/30';
    case 'NEGATIVE': return 'bg-rose/15 text-rose border-rose/30';
    case 'NEUTRAL': return 'bg-muted text-muted-foreground border-border';
    case 'MIXED': return 'bg-amber/15 text-amber border-amber/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function sentimentBarColor(s: string) {
  switch (s) {
    case 'POSITIVE': return 'bg-emerald';
    case 'NEGATIVE': return 'bg-rose';
    case 'NEUTRAL': return 'bg-cyan';
    case 'MIXED': return 'bg-amber';
    default: return 'bg-muted-foreground';
  }
}

function platformBarColor(p: string) {
  switch (p) {
    case 'X': return 'bg-foreground/70';
    case 'Facebook': return 'bg-cyan';
    case 'YouTube': return 'bg-rose';
    case 'TikTok': return 'bg-violet';
    case 'News': return 'bg-amber';
    default: return 'bg-muted-foreground';
  }
}

function formatTime(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OsintMonitor() {
  const { tenantId } = useDashboardStore();

  // Filters
  const [platformFilter, setPlatformFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog
  const [selectedPost, setSelectedPost] = useState<OsintPost | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Collapsible AI summaries
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());

  // Data fetching
  const { data, isLoading, error } = useQuery<OsintResponse>({
    queryKey: ['osint', tenantId],
    queryFn: () => fetchJson(`/api/osint?tenantId=${tenantId}`),
    refetchInterval: 30_000,
    enabled: !!tenantId,
  });

  const posts = data?.posts ?? [];
  const counts = data?.counts ?? {
    total: 0, byCategory: {}, bySentiment: {}, byPlatform: {},
    fakeNews: 0, botSuspect: 0, viralityAlerts: 0,
  };
  const trends = data?.trends;

  // Filtered posts
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (platformFilter !== 'All' && p.platform !== platformFilter) return false;
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          p.content.toLowerCase().includes(q) ||
          p.author.toLowerCase().includes(q) ||
          p.keywords?.some((k) => k.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [posts, platformFilter, categoryFilter, searchQuery]);

  // Sentiment totals for bar
  const sentimentTotals = useMemo(() => {
    const s = counts.bySentiment ?? {};
    const total = Object.values(s).reduce((a, b) => a + b, 0) || 1;
    return { positive: (s.POSITIVE ?? 0) / total, negative: (s.NEGATIVE ?? 0) / total, neutral: (s.NEUTRAL ?? 0) / total, mixed: (s.MIXED ?? 0) / total };
  }, [counts]);

  // Platform totals for bar
  const platformEntries = useMemo(() => {
    const p = counts.byPlatform ?? {};
    const total = Object.values(p).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(p)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count, pct: count / total }));
  }, [counts]);

  const toggleSummary = (id: string) => {
    setExpandedSummaries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openPostDetail = (post: OsintPost) => {
    setSelectedPost(post);
    setDialogOpen(true);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan/10">
            <Globe className="h-5 w-5 text-cyan" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Digital Media & OSINT Monitor</h2>
            <p className="text-[11px] text-muted-foreground">Real-time social media ingestion &amp; threat detection</p>
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* Search */}
          <div className="relative">
            <label htmlFor="osint-search" className="sr-only">Search posts, authors</label>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="osint-search"
              placeholder="Search posts, authors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 flex-1 sm:flex-none sm:w-48 pl-8 text-xs bg-card/40 border-border"
            />
          </div>

          {/* Platform filter */}
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="h-8 flex-1 sm:flex-none sm:w-32 text-xs bg-card/40 border-border">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">{p === 'All' ? 'All Platforms' : p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 flex-1 sm:flex-none sm:w-36 text-xs bg-card/40 border-border">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">{c === 'All' ? 'All Categories' : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── KPI Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {/* Total Posts */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="border-border bg-card/40 backdrop-blur-sm hover:bg-card/60 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Posts Ingested</p>
                  <p className="text-2xl font-bold tabular-nums text-cyan">{formatNumber(counts.total)}</p>
                  {trends?.total ? (() => {
                    const t = trends.total;
                    const Icon = t.up ? TrendingUp : TrendingDown;
                    return (
                      <div className="flex items-center gap-1">
                        <Icon className="h-3 w-3 text-emerald" />
                        <span className="text-[11px] font-medium text-emerald">{t.up ? '+' : '-'}{t.value}%</span>
                        <span className="text-[10px] text-muted-foreground">vs last hr</span>
                      </div>
                    );
                  })() : (
                    <span className="text-[10px] text-muted-foreground">No prior data</span>
                  )}
                </div>
                <div className="p-2.5 rounded-lg bg-cyan/10">
                  <BarChart3 className="h-5 w-5 text-cyan" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Disinformation */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
          <Card className="border-rose/20 bg-rose/5 backdrop-blur-sm hover:bg-rose/10 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Disinformation Detected</p>
                  <p className="text-2xl font-bold tabular-nums text-rose">{formatNumber(counts.fakeNews)}</p>
                  {trends?.fakeNews ? (() => {
                    const t = trends.fakeNews;
                    const Icon = t.up ? TrendingUp : TrendingDown;
                    return (
                      <div className="flex items-center gap-1">
                        <Icon className={"h-3 w-3 text-rose"} />
                        <span className="text-[11px] font-medium text-rose">{t.up ? '+' : '-'}{t.value}%</span>
                        <span className="text-[10px] text-muted-foreground">vs last hr</span>
                      </div>
                    );
                  })() : (
                    <span className="text-[10px] text-muted-foreground">No prior data</span>
                  )}
                </div>
                <div className="p-2.5 rounded-lg bg-rose/10">
                  <FileWarning className="h-5 w-5 text-rose" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bot/CIB */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <Card className="border-amber/20 bg-amber/5 backdrop-blur-sm hover:bg-amber/10 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Bot / CIB Suspects</p>
                  <p className="text-2xl font-bold tabular-nums text-amber">{formatNumber(counts.botSuspect)}</p>
                  {trends?.botSuspect ? (() => {
                    const t = trends.botSuspect;
                    const Icon = t.up ? TrendingUp : TrendingDown;
                    return (
                      <div className="flex items-center gap-1">
                        <Icon className={"h-3 w-3 text-emerald"} />
                        <span className="text-[11px] font-medium text-emerald">{t.up ? '+' : '-'}{t.value}%</span>
                        <span className="text-[10px] text-muted-foreground">vs last hr</span>
                      </div>
                    );
                  })() : (
                    <span className="text-[10px] text-muted-foreground">No prior data</span>
                  )}
                </div>
                <div className="p-2.5 rounded-lg bg-amber/10">
                  <Bot className="h-5 w-5 text-amber" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Virality Alerts */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
          <Card className="border-violet/20 bg-violet/5 backdrop-blur-sm hover:bg-violet/10 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Virality Alerts</p>
                  <p className="text-2xl font-bold tabular-nums text-violet">{formatNumber(counts.viralityAlerts)}</p>
                  {trends?.viralityAlerts ? (() => {
                    const t = trends.viralityAlerts;
                    const Icon = t.up ? TrendingUp : TrendingDown;
                    return (
                      <div className="flex items-center gap-1">
                        <Icon className={"h-3 w-3 text-violet"} />
                        <span className="text-[11px] font-medium text-violet">{t.up ? '+' : '-'}{t.value}%</span>
                        <span className="text-[10px] text-muted-foreground">vs last hr</span>
                      </div>
                    );
                  })() : (
                    <span className="text-[10px] text-muted-foreground">No prior data</span>
                  )}
                </div>
                <div className="p-2.5 rounded-lg bg-violet/10">
                  <Flame className="h-5 w-5 text-violet" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Sentiment + Platform Breakdown Bars ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
        {/* Sentiment */}
        <Card className="border-border bg-card/40 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-cyan" />
                Sentiment Breakdown
              </p>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex bg-muted/50">
              {sentimentTotals.positive > 0 && (
                <div
                  className="bg-emerald transition-all duration-500"
                  style={{ width: `${sentimentTotals.positive * 100}%` }}
                  title={`Positive ${Math.round(sentimentTotals.positive * 100)}%`}
                />
              )}
              {sentimentTotals.negative > 0 && (
                <div
                  className="bg-rose transition-all duration-500"
                  style={{ width: `${sentimentTotals.negative * 100}%` }}
                  title={`Negative ${Math.round(sentimentTotals.negative * 100)}%`}
                />
              )}
              {sentimentTotals.mixed > 0 && (
                <div
                  className="bg-amber transition-all duration-500"
                  style={{ width: `${sentimentTotals.mixed * 100}%` }}
                  title={`Mixed ${Math.round(sentimentTotals.mixed * 100)}%`}
                />
              )}
              {sentimentTotals.neutral > 0 && (
                <div
                  className="bg-cyan transition-all duration-500"
                  style={{ width: `${sentimentTotals.neutral * 100}%` }}
                  title={`Neutral ${Math.round(sentimentTotals.neutral * 100)}%`}
                />
              )}
            </div>
            <div className="flex items-center gap-4 mt-2">
              {[
                { label: 'POSITIVE', pct: sentimentTotals.positive, color: 'bg-emerald' },
                { label: 'NEGATIVE', pct: sentimentTotals.negative, color: 'bg-rose' },
                { label: 'NEUTRAL', pct: sentimentTotals.neutral, color: 'bg-cyan' },
                { label: 'MIXED', pct: sentimentTotals.mixed, color: 'bg-amber' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span className={cn('w-2 h-2 rounded-full', s.color)} />
                  <span className="text-[10px] text-muted-foreground">{s.label}</span>
                  <span className="text-[10px] font-semibold tabular-nums">{Math.round(s.pct * 100)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Platform Distribution */}
        <Card className="border-border bg-card/40 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-violet" />
                Platform Distribution
              </p>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex bg-muted/50">
              {platformEntries.map((p) => (
                <div
                  key={p.name}
                  className={cn('transition-all duration-500', platformBarColor(p.name))}
                  style={{ width: `${p.pct * 100}%` }}
                  title={`${p.name}: ${p.count}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {platformEntries.map((p) => (
                <div key={p.name} className="flex items-center gap-1.5">
                  <span className={cn('w-2 h-2 rounded-full', platformBarColor(p.name))} />
                  <span className="text-[10px] text-muted-foreground">{p.name}</span>
                  <span className="text-[10px] font-semibold tabular-nums">{formatNumber(p.count)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Feed ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 rounded-xl border border-border bg-card/40 backdrop-blur-sm flex flex-col overflow-hidden">
        {/* Feed header */}
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">Post Feed</span>
            <Badge variant="secondary" className="text-[10px] h-5">{filteredPosts.length}</Badge>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse-dot" />
            Streaming live
          </div>
        </div>

        {/* Scrollable feed */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-3 space-y-2">
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Ingesting OSINT data...</p>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <AlertCircle className="h-10 w-10 text-destructive" />
                <p className="text-sm text-muted-foreground">Failed to load data. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </div>
            )}

            {!isLoading && !error && filteredPosts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Globe className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No posts match current filters</p>
              </div>
            )}

            {filteredPosts.map((post, idx) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02, duration: 0.2 }}
                className={cn(
                  'rounded-xl border p-4 cursor-pointer transition-colors',
                  post.isFakeNews
                    ? 'bg-rose/5 border-rose/20 hover:bg-rose/10'
                    : post.viralityScore > 70
                    ? 'bg-violet/5 border-violet/20 hover:bg-violet/10'
                    : 'bg-card/40 border-border hover:bg-card/60'
                )}
                onClick={() => openPostDetail(post)}
              >
                {/* Row 1: Platform badge + Author + Time */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge className={cn('text-[10px] h-5 border gap-1', platformColor(post.platform))}>
                    {platformIcon(post.platform)}
                    {post.platform}
                  </Badge>
                  <span className="text-xs font-medium truncate max-w-40">{post.author}</span>
                  {post.isVerified && (
                    <CheckCircle2 className="h-3 w-3 text-emerald shrink-0" />
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {formatTime(post.publishedAt)}
                  </span>
                </div>

                {/* Row 2: Content */}
                <p className="text-xs text-foreground/80 line-clamp-3 mb-2.5 leading-relaxed">{post.content}</p>

                {/* Row 3: Sentiment + Category badges */}
                <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                  <Badge className={cn('text-[10px] h-5 border', sentimentStyle(post.sentiment))}>
                    {post.sentiment}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground border-border">
                    {post.category}
                  </Badge>

                  {/* Special badges */}
                  {post.isFakeNews && (
                    <Badge className="text-[10px] h-5 bg-rose/15 text-rose border-rose/30">
                      <FileWarning className="h-2.5 w-2.5 mr-1" />
                      FAKE NEWS
                    </Badge>
                  )}
                  {post.isBotSuspect && (
                    <Badge className="text-[10px] h-5 bg-amber/15 text-amber border-amber/30">
                      <Bot className="h-2.5 w-2.5 mr-1" />
                      BOT SUSPECT
                    </Badge>
                  )}
                  {post.cibScore > 0.5 && (
                    <Badge className="text-[10px] h-5 bg-violet/15 text-violet border-violet/30">
                      <Fingerprint className="h-2.5 w-2.5 mr-1" />
                      CIB
                    </Badge>
                  )}
                  {post.isVerified && !post.isFakeNews && (
                    <Badge className="text-[10px] h-5 bg-emerald/15 text-emerald border-emerald/30">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                      VERIFIED
                    </Badge>
                  )}
                </div>

                {/* Row 4: Virality score bar */}
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[10px] text-muted-foreground shrink-0 w-14">Virality</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                    <motion.div
                      className={cn(
                        'h-full rounded-full transition-colors',
                        post.viralityScore > 70 ? 'bg-rose' : post.viralityScore > 40 ? 'bg-amber' : 'bg-emerald'
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(post.viralityScore, 100)}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.02 }}
                    />
                  </div>
                  <span className={cn(
                    'text-[10px] font-bold tabular-nums w-8 text-right',
                    post.viralityScore > 70 ? 'text-rose' : post.viralityScore > 40 ? 'text-amber' : 'text-emerald'
                  )}>
                    {post.viralityScore}
                  </span>
                </div>

                {/* Row 5: Engagement stats */}
                <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground mb-2">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />{formatNumber(post.engagement.likes)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Share2 className="h-3 w-3" />{formatNumber(post.engagement.shares)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />{formatNumber(post.engagement.comments)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />{formatNumber(post.engagement.views)}
                  </span>
                  {post.location && (
                    <span className="flex items-center gap-1 ml-auto text-violet">
                      <MapPin className="h-3 w-3" />{post.location}
                    </span>
                  )}
                </div>

                {/* Row 6: Collapsible AI Summary */}
                {post.aiSummary && (
                  <Collapsible
                    open={expandedSummaries.has(post.id)}
                    onOpenChange={() => toggleSummary(post.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        className="flex items-center gap-1.5 text-[10px] text-cyan hover:text-cyan/80 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Sparkles className="h-3 w-3" />
                        AI Summary
                        {expandedSummaries.has(post.id)
                          ? <ChevronUp className="h-3 w-3" />
                          : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-1.5 p-2 rounded-lg bg-cyan/5 border border-cyan/15">
                        <p className="text-[11px] text-foreground/60 leading-relaxed">{post.aiSummary}</p>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Post Detail Dialog ───────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-border">
          <DialogTitle className="sr-only">Post Detail</DialogTitle>
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2 not-sr-only">
              {selectedPost && platformIcon(selectedPost.platform)}
              {selectedPost?.author}
              {selectedPost?.url && (
                <a
                  href={selectedPost.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                </a>
              )}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground">
              Full post analysis &amp; AI insights
            </DialogDescription>
          </DialogHeader>

          {selectedPost && (
            <div className="space-y-4">
              {/* Platform + Time */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn('text-[10px] h-5 border gap-1', platformColor(selectedPost.platform))}>
                  {platformIcon(selectedPost.platform)}
                  {selectedPost.platform}
                </Badge>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Published {formatTime(selectedPost.publishedAt)}
                </span>
                {selectedPost.authorFollowers > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {formatNumber(selectedPost.authorFollowers)} followers
                  </span>
                )}
                {selectedPost.isVerified && (
                  <Badge className="text-[10px] h-5 bg-emerald/15 text-emerald border-emerald/30">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-1" />VERIFIED
                  </Badge>
                )}
              </div>

              {/* Full content */}
              <div className="rounded-lg border border-border bg-card/40 p-4">
                <p className="text-sm text-foreground/90 leading-relaxed">{selectedPost.content}</p>
              </div>

              {/* Badges row */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge className={cn('text-[10px] h-5 border', sentimentStyle(selectedPost.sentiment))}>
                  {selectedPost.sentiment}
                </Badge>
                <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground border-border">
                  {selectedPost.category}
                </Badge>
                {selectedPost.isFakeNews && (
                  <Badge className="text-[10px] h-5 bg-rose/15 text-rose border-rose/30">
                    <FileWarning className="h-2.5 w-2.5 mr-1" />FAKE NEWS
                  </Badge>
                )}
                {selectedPost.isBotSuspect && (
                  <Badge className="text-[10px] h-5 bg-amber/15 text-amber border-amber/30">
                    <Bot className="h-2.5 w-2.5 mr-1" />BOT SUSPECT
                  </Badge>
                )}
                {selectedPost.cibScore > 0.5 && (
                  <Badge className="text-[10px] h-5 bg-violet/15 text-violet border-violet/30">
                    <Fingerprint className="h-2.5 w-2.5 mr-1" />CIB (score: {selectedPost.cibScore.toFixed(2)})
                  </Badge>
                )}
                {selectedPost.location && (
                  <Badge variant="outline" className="text-[10px] h-5 text-violet border-violet/30">
                    <MapPin className="h-2.5 w-2.5 mr-1" />{selectedPost.location}
                  </Badge>
                )}
              </div>

              {/* Tabs: Analysis | Engagement */}
              <Tabs defaultValue="analysis">
                <TabsList className="h-8">
                  <TabsTrigger value="analysis" className="text-xs h-6 px-3">AI Analysis</TabsTrigger>
                  <TabsTrigger value="engagement" className="text-xs h-6 px-3">Engagement</TabsTrigger>
                  <TabsTrigger value="keywords" className="text-xs h-6 px-3">Keywords</TabsTrigger>
                </TabsList>

                <TabsContent value="analysis" className="mt-3 space-y-3">
                  {selectedPost.aiSummary && (
                    <div className="rounded-lg border border-cyan/15 bg-cyan/5 p-3">
                      <p className="text-[10px] font-medium text-cyan mb-1.5 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />AI SUMMARY
                      </p>
                      <p className="text-xs text-foreground/70 leading-relaxed">{selectedPost.aiSummary}</p>
                    </div>
                  )}
                  {selectedPost.aiFlags && selectedPost.aiFlags.length > 0 && (
                    <div className="rounded-lg border border-amber/15 bg-amber/5 p-3">
                      <p className="text-[10px] font-medium text-amber mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />AI FLAGS
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPost.aiFlags.map((flag) => (
                          <Badge key={flag} variant="outline" className="text-[10px] h-5 text-amber border-amber/30">
                            {flag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedPost.cibScore > 0 && (
                    <div className="rounded-lg border border-violet/15 bg-violet/5 p-3">
                      <p className="text-[10px] font-medium text-violet mb-1.5 flex items-center gap-1">
                        <Fingerprint className="h-3 w-3" />CIB ANALYSIS
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-violet"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(selectedPost.cibScore * 100, 100)}%` }}
                            transition={{ duration: 0.4 }}
                          />
                        </div>
                        <span className="text-xs font-bold tabular-nums text-violet">
                          {(selectedPost.cibScore * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {selectedPost.cibScore > 0.5
                          ? 'High probability of coordinated inauthentic behavior'
                          : selectedPost.cibScore > 0.25
                          ? 'Moderate indicators of coordinated activity'
                          : 'Low CIB indicators detected'}
                      </p>
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs gap-1.5 bg-violet/15 text-violet border border-violet/30 hover:bg-violet/25"
                    variant="outline"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate Counter-Narrative
                  </Button>
                </TabsContent>

                <TabsContent value="engagement" className="mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Likes', value: selectedPost.engagement.likes, icon: <Heart className="h-4 w-4 text-rose" />, color: 'text-rose' },
                      { label: 'Shares', value: selectedPost.engagement.shares, icon: <Share2 className="h-4 w-4 text-cyan" />, color: 'text-cyan' },
                      { label: 'Comments', value: selectedPost.engagement.comments, icon: <MessageSquare className="h-4 w-4 text-amber" />, color: 'text-amber' },
                      { label: 'Views', value: selectedPost.engagement.views, icon: <Eye className="h-4 w-4 text-violet" />, color: 'text-violet' },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-lg border border-border bg-card/40 p-3 flex items-center gap-3"
                      >
                        <div className="p-2 rounded-md bg-muted/50">
                          {stat.icon}
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                          <p className={cn('text-lg font-bold tabular-nums', stat.color)}>
                            {formatNumber(stat.value)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg border border-border bg-card/40 p-3">
                    <p className="text-[10px] text-muted-foreground mb-2">Virality Score</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden">
                        <motion.div
                          className={cn(
                            'h-full rounded-full',
                            selectedPost.viralityScore > 70 ? 'bg-rose' : selectedPost.viralityScore > 40 ? 'bg-amber' : 'bg-emerald'
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(selectedPost.viralityScore, 100)}%` }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                      <span className={cn(
                        'text-xl font-bold tabular-nums',
                        selectedPost.viralityScore > 70 ? 'text-rose' : selectedPost.viralityScore > 40 ? 'text-amber' : 'text-emerald'
                      )}>
                        {selectedPost.viralityScore}
                      </span>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="keywords" className="mt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPost.keywords && selectedPost.keywords.length > 0
                      ? selectedPost.keywords.map((kw) => (
                          <Badge key={kw} variant="outline" className="text-[10px] h-6 text-muted-foreground border-border">
                            {kw}
                          </Badge>
                        ))
                      : <p className="text-xs text-muted-foreground">No keywords extracted</p>
                    }
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}