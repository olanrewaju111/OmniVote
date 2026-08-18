'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useMemoizedCallback } from '@/hooks/use-memoized-callback';
import { ExportButton } from '@/components/dashboard/export-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Pause, Play, Filter, MapPin, Clock, User, AlertTriangle,
  ShieldAlert, ShieldCheck, Eye, ChevronDown, Loader2, Radio,
  Megaphone, ArrowUpRight, MessageCircle, Flag, CheckCircle2,
  Zap, Wifi, WifiOff,
} from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { useDashboardStore } from '@/store/dashboard';
import { toast } from 'sonner';
import type { Incident } from '@/types/dashboard';

interface LiveFeedProps {
  incidents: Incident[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  onIncidentClick?: (incident: Incident) => void;
  /** New incidents received via WebSocket push */
  liveIncidents?: Incident[];
}

function severityColor(s: string) {
  switch (s) {
    case 'CRITICAL': return 'bg-rose text-white border-rose/40';
    case 'HIGH': return 'bg-amber/15 text-amber border-amber/30';
    case 'MEDIUM': return 'bg-cyan/15 text-cyan border-cyan/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function typeIcon(type: string) {
  switch (type) {
    case 'VIOLENCE': return <ShieldAlert className="h-3.5 w-3.5 text-rose" />;
    case 'INTIMIDATION': return <AlertTriangle className="h-3.5 w-3.5 text-amber" />;
    case 'BALLOT_STUFFING': return <AlertTriangle className="h-3.5 w-3.5 text-rose" />;
    case 'DEEPFAKE_SUSPECT': return <ShieldAlert className="h-3.5 w-3.5 text-violet" />;
    case 'CIB_DETECTED': return <ShieldAlert className="h-3.5 w-3.5 text-violet" />;
    case 'GEO_ANOMALY': return <MapPin className="h-3.5 w-3.5 text-amber" />;
    default: return <Eye className="h-3.5 w-3.5 text-cyan" />;
  }
}

function formatTime(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
}

interface IncidentCardProps {
  inc: Incident;
  idx: number;
  isLive: boolean;
  isExpanded: boolean;
  onToggle: (inc: Incident) => void;
  onQuickAction: (action: string, inc: Incident) => void;
}

const IncidentCard = React.memo(function IncidentCard({ inc, idx, isLive, isExpanded, onToggle, onQuickAction }: IncidentCardProps) {
  return (
    <m.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ delay: idx * 0.02, duration: 0.2 }}
      className={cn(
        'rounded-lg border p-3 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isLive && 'ring-1 ring-emerald/30',
        inc.isQuarantined
          ? 'bg-violet/5 border-violet/25 hover:bg-violet/10'
          : inc.severity === 'CRITICAL'
          ? 'bg-rose/5 border-rose/20 hover:bg-rose/10'
          : 'bg-card/60 border-border hover:bg-card/80'
      )}
      onClick={() => onToggle(inc)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle(inc);
        }
      }}
      tabIndex={0}
      role="button"
      aria-expanded={isExpanded}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">{typeIcon(inc.type)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {isLive && (
              <Badge className="text-[10px] h-5 bg-emerald/15 text-emerald border-emerald/30 gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />LIVE
              </Badge>
            )}
            <Badge className={cn('text-[10px] h-5 border', severityColor(inc.severity))}>
              {inc.severity}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground border-border">
              {inc.type.replace(/_/g, ' ')}
            </Badge>
            {inc.gpsAnomaly && (
              <Badge className="text-[10px] h-5 bg-amber/15 text-amber border-amber/30">
                <MapPin className="h-2.5 w-2.5 mr-1" />GEO ANOMALY
              </Badge>
            )}
            {inc.isQuarantined && (
              <Badge className="text-[10px] h-5 bg-violet/15 text-violet border-violet/30">
                <ShieldAlert className="h-2.5 w-2.5 mr-1" />QUARANTINED
              </Badge>
            )}
            {inc.c2paVerified && (
              <Badge className="text-[10px] h-5 bg-emerald/15 text-emerald border-emerald/30">
                <ShieldCheck className="h-2.5 w-2.5 mr-1" />C2PA
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
              {formatTime(inc.submittedAt)}
            </span>
          </div>
          <p className="text-xs text-foreground/80 line-clamp-2">{inc.description}</p>
          {isExpanded && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-2 pt-2 border-t border-border/50 space-y-2"
            >
              {inc.aiSummary && (
                <div className="bg-cyan/5 border border-cyan/15 rounded-md p-2">
                  <p className="text-[10px] font-medium text-cyan mb-1 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> AI ANALYSIS
                  </p>
                  <p className="text-[11px] text-foreground/70">{inc.aiSummary}</p>
                </div>
              )}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><User className="h-3 w-3" />{inc.reporter?.name || 'Unknown'}</span>
                {inc.pollingUnit && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{inc.pollingUnit.state}/{inc.pollingUnit.lga}</span>
                )}
                <Badge variant="outline" className="text-[10px] h-5">{inc.status}</Badge>
              </div>
              <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-amber hover:bg-amber/10 transition-colors"
                  onClick={(e) => { e.stopPropagation(); onQuickAction('escalate', inc); }}
                >
                  <ArrowUpRight className="h-3 w-3" />Escalate
                </button>
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-violet hover:bg-violet/10 transition-colors"
                  onClick={(e) => { e.stopPropagation(); onQuickAction('flag', inc); }}
                >
                  <Flag className="h-3 w-3" />Flag
                </button>
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-cyan hover:bg-cyan/10 transition-colors"
                  onClick={(e) => { e.stopPropagation(); onQuickAction('broadcast', inc); }}
                >
                  <Megaphone className="h-3 w-3" />Broadcast
                </button>
                {inc.status === 'PENDING' && (
                  <button
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-emerald hover:bg-emerald/10 transition-colors ml-auto"
                    onClick={(e) => { e.stopPropagation(); onQuickAction('resolve', inc); }}
                  >
                    <CheckCircle2 className="h-3 w-3" />Resolve
                  </button>
                )}
              </div>
            </m.div>
          )}
        </div>
      </div>
    </m.div>
  );
});

function LiveFeedInner({ incidents, loading, onLoadMore, hasMore, onIncidentClick, liveIncidents }: LiveFeedProps) {
  const { liveFeedPaused, toggleLiveFeed, incidentFilter, setIncidentFilter, wsConnected, wsTransport } = useDashboardStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Merge live push incidents with initial incidents (dedup by id)
  const allIncidents = useMemo(() => {
    if (!liveIncidents || liveIncidents.length === 0) return incidents;
    const existingIds = new Set(incidents.map(i => i.id));
    const newOnes = liveIncidents.filter(i => !existingIds.has(i.id));
    return [...newOnes, ...incidents];
  }, [incidents, liveIncidents]);

  // Auto-scroll to top when new incidents arrive
  useEffect(() => {
    if (allIncidents.length > prevCountRef.current && !liveFeedPaused) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
    prevCountRef.current = allIncidents.length;
  }, [allIncidents.length, liveFeedPaused]);

  const filtered = useMemo(() => {
    return allIncidents.filter(i => {
      if (incidentFilter.type !== 'ALL' && i.type !== incidentFilter.type) return false;
      if (incidentFilter.severity !== 'ALL' && i.severity !== incidentFilter.severity) return false;
      if (incidentFilter.status !== 'ALL' && i.status !== incidentFilter.status) return false;
      return true;
    });
  }, [allIncidents, incidentFilter]);

  const newCount = liveIncidents?.length || 0;

  const handleQuickAction = useCallback((action: string, inc: Incident) => {
    const location = inc.pollingUnit ? `${inc.pollingUnit.state}/${inc.pollingUnit.lga}` : 'Unknown location';
    const typeName = inc.type.replace(/_/g, ' ');
    switch (action) {
      case 'escalate':
        toast.warning('Incident escalated', {
          description: `${typeName} in ${location} escalated for immediate review.`,
          action: { label: 'View', onClick: () => onIncidentClick?.(inc) },
        });
        break;
      case 'flag':
        toast.info('Incident flagged', {
          description: `${typeName} flagged for follow-up. T&S team notified.`,
        });
        break;
      case 'broadcast':
        toast.success('Broadcast prepared', {
          description: `Incident briefing for ${location} ready. Open Broadcast to send.`,
        });
        break;
      case 'resolve':
        toast.success('Incident resolved', {
          description: `${typeName} in ${location} marked as resolved.`,
        });
        break;
    }
  }, [onIncidentClick]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-dot" />
            <h3 className="text-sm font-semibold">Live Incident Feed</h3>
            <Badge variant="secondary" className="text-[10px] h-5">{filtered.length}</Badge>
            {/* Live indicator showing push connection */}
            {wsConnected && wsTransport === 'ws' && (
              <Badge className="text-[10px] h-5 bg-emerald/15 text-emerald border-emerald/30 gap-1">
                <Zap className="h-2.5 w-2.5" />LIVE
              </Badge>
            )}
            {wsConnected && wsTransport === 'sse' && (
              <Badge className="text-[10px] h-5 bg-amber/15 text-amber border-amber/30 gap-1">
                <Wifi className="h-2.5 w-2.5" />SSE
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={toggleLiveFeed}
          >
            {liveFeedPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {liveFeedPaused ? 'Resume' : 'Pause'}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton exportType="incidents" label="Export" />
          <Select value={incidentFilter.type} onValueChange={(v) => setIncidentFilter({ ...incidentFilter, type: v })}>
            <SelectTrigger className="h-7 w-32 text-[11px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="VIOLENCE">Violence</SelectItem>
              <SelectItem value="INTIMIDATION">Intimidation</SelectItem>
              <SelectItem value="BALLOT_STUFFING">Ballot Stuffing</SelectItem>
              <SelectItem value="DEEPFAKE_SUSPECT">Deepfake</SelectItem>
              <SelectItem value="CIB_DETECTED">CIB</SelectItem>
              <SelectItem value="GEO_ANOMALY">Geo Anomaly</SelectItem>
              <SelectItem value="LOGISTICS">Logistics</SelectItem>
            </SelectContent>
          </Select>
          <Select value={incidentFilter.severity} onValueChange={(v) => setIncidentFilter({ ...incidentFilter, severity: v })}>
            <SelectTrigger className="h-7 w-28 text-[11px]"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Severity</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Feed */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="p-3 space-y-2">
          {/* New incidents banner */}
          {newCount > 0 && !liveFeedPaused && (
            <m.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg bg-emerald/5 border border-emerald/20 px-3 py-2 flex items-center gap-2 text-xs text-emerald"
            >
              <Zap className="h-3 w-3" />
              <span>{newCount} new incident{newCount > 1 ? 's' : ''} pushed in real-time</span>
            </m.div>
          )}

          <AnimatePresence mode="popLayout">
            {filtered.map((inc, idx) => {
              const isLive = liveIncidents?.some(li => li.id === inc.id);
              return (
                <IncidentCard
                  key={inc.id}
                  inc={inc}
                  idx={idx}
                  isLive={!!isLive}
                  isExpanded={expandedId === inc.id}
                  onToggle={(i) => {
                    if (onIncidentClick) {
                      onIncidentClick(i);
                    } else {
                      setExpandedId(expandedId === i.id ? null : i.id);
                    }
                  }}
                  onQuickAction={handleQuickAction}
                />
              );
            })}
          </AnimatePresence>

          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 animate-scale-in">
              <div className="w-16 h-16 rounded-2xl bg-card/60 border border-border/50 flex items-center justify-center mx-auto mb-4">
                <Radio className="h-7 w-7 text-muted-foreground/25" />
              </div>
              <p className="text-sm font-medium text-foreground/50">No incidents in the feed</p>
              <p className="text-xs text-muted-foreground/40 mt-1.5 max-w-xs mx-auto leading-relaxed">
                {incidents.length === 0
                  ? 'Incidents will appear here in real-time as field agents submit reports from polling units across the federation.'
                  : 'No incidents match your current filter selection. Try adjusting the type or severity filters above.'}
              </p>
              {incidents.length === 0 && (
                <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-emerald/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse-dot" />
                  {wsConnected ? 'Connected — listening for incoming reports...' : 'Connecting to live feed...'}
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Loading incidents...</span>
            </div>
          )}

          {hasMore && !loading && onLoadMore && (
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground/60 hover:text-foreground" onClick={onLoadMore}>
              <ChevronDown className="h-3 w-3 mr-1" /> Load more incidents
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export const LiveFeed = React.memo(LiveFeedInner);
