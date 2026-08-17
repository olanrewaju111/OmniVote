'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardStore } from '@/store/dashboard';
import type { Incident } from '@/app/page';

interface LiveFeedProps {
  incidents: Incident[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  onIncidentClick?: (incident: Incident) => void;
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

export function LiveFeed({ incidents, loading, onLoadMore, hasMore, onIncidentClick }: LiveFeedProps) {
  const { liveFeedPaused, toggleLiveFeed, incidentFilter, setIncidentFilter } = useDashboardStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = incidents.filter(i => {
    if (incidentFilter.type !== 'ALL' && i.type !== incidentFilter.type) return false;
    if (incidentFilter.severity !== 'ALL' && i.severity !== incidentFilter.severity) return false;
    if (incidentFilter.status !== 'ALL' && i.status !== incidentFilter.status) return false;
    return true;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse-dot" />
            <h3 className="text-sm font-semibold">Live Incident Feed</h3>
            <Badge variant="secondary" className="text-[10px] h-5">{filtered.length}</Badge>
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
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((inc, idx) => (
              <motion.div
                key={inc.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ delay: idx * 0.02, duration: 0.2 }}
                className={cn(
                  'rounded-lg border p-3 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  inc.isQuarantined
                    ? 'bg-violet/5 border-violet/25 hover:bg-violet/10'
                    : inc.severity === 'CRITICAL'
                    ? 'bg-rose/5 border-rose/20 hover:bg-rose/10'
                    : 'bg-card/60 border-border hover:bg-card/80'
                )}
                onClick={() => {
                  if (onIncidentClick) {
                    onIncidentClick(inc);
                  } else {
                    setExpandedId(expandedId === inc.id ? null : inc.id);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (onIncidentClick) {
                      onIncidentClick(inc);
                    } else {
                      setExpandedId(expandedId === inc.id ? null : inc.id);
                    }
                  }
                }}
                tabIndex={0}
                role="button"
                aria-expanded={expandedId === inc.id}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">{typeIcon(inc.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                    {expandedId === inc.id && (
                      <motion.div
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
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
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
                  Listening for incoming reports...
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