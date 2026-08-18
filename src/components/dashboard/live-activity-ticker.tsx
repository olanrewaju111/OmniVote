'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useDashboardStore } from '@/store/dashboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ShieldAlert, AlertTriangle, FileBarChart, Globe, Shield, MessageCircle,
  MapPin, Eye, Radio, Bell, Pause, Play, Filter, Trash2, ChevronDown,
  Zap, Clock, CheckCircle2, Users, BarChart3, Activity, Volume2, VolumeX,
  ArrowUpRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ActivityEvent {
  id: string;
  type: 'incident' | 'alert' | 'pvt' | 'osint' | 'security' | 'chat' | 'checkin' | 'honeypot' | 'result' | 'kpi';
  title: string;
  description: string;
  severity?: string;
  timestamp: Date;
  meta?: Record<string, unknown>;
}

type EventFilter = 'ALL' | 'incident' | 'alert' | 'pvt' | 'osint' | 'security' | 'chat' | 'checkin' | 'honeypot' | 'result';

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT TYPE CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const EVENT_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  incident: { icon: <ShieldAlert className="h-3.5 w-3.5" />, color: 'text-amber', bgColor: 'bg-amber/10', label: 'Incident' },
  alert: { icon: <Bell className="h-3.5 w-3.5" />, color: 'text-rose', bgColor: 'bg-rose/10', label: 'Alert' },
  pvt: { icon: <FileBarChart className="h-3.5 w-3.5" />, color: 'text-emerald', bgColor: 'bg-emerald/10', label: 'PVT' },
  osint: { icon: <Globe className="h-3.5 w-3.5" />, color: 'text-cyan', bgColor: 'bg-cyan/10', label: 'OSINT' },
  security: { icon: <Shield className="h-3.5 w-3.5" />, color: 'text-violet', bgColor: 'bg-violet/10', label: 'Security' },
  chat: { icon: <MessageCircle className="h-3.5 w-3.5" />, color: 'text-blue', bgColor: 'bg-blue/10', label: 'Chat' },
  checkin: { icon: <MapPin className="h-3.5 w-3.5" />, color: 'text-teal', bgColor: 'bg-teal/10', label: 'Check-In' },
  honeypot: { icon: <Eye className="h-3.5 w-3.5" />, color: 'text-orange', bgColor: 'bg-orange/10', label: 'Honeypot' },
  result: { icon: <BarChart3 className="h-3.5 w-3.5" />, color: 'text-indigo', bgColor: 'bg-indigo/10', label: 'Result' },
};

function severityBadge(severity?: string) {
  if (!severity) return null;
  const colors: Record<string, string> = {
    CRITICAL: 'bg-rose text-white',
    HIGH: 'bg-amber/15 text-amber',
    MEDIUM: 'bg-cyan/15 text-cyan',
    LOW: 'bg-muted text-muted-foreground',
    WARNING: 'bg-amber/15 text-amber',
    INFO: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm', colors[severity] ?? 'bg-muted text-muted-foreground')}>
      {severity}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE EVENT ROW
// ═══════════════════════════════════════════════════════════════════════════════

function EventRow({ event, onClick, isLatest }: { event: ActivityEvent; onClick?: (e: ActivityEvent) => void; isLatest: boolean }) {
  const config = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.incident;
  const timeAgo = formatDistanceToNow(new Date(event.timestamp), { addSuffix: true });

  return (
    <m.div
      initial={isLatest ? { opacity: 0, x: -20, scale: 0.98 } : false}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex items-start gap-3 px-3 py-2.5 border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer group',
        isLatest && 'bg-amber/5',
      )}
      onClick={() => onClick?.(event)}
    >
      {/* Icon */}
      <div className={cn('shrink-0 mt-0.5 rounded-md p-1.5', config.bgColor, config.color)}>
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground truncate">{event.title}</span>
          {severityBadge(event.severity)}
          <span className={cn('text-[9px] font-medium uppercase px-1.5 py-0.5 rounded-sm', config.bgColor, config.color)}>
            {config.label}
          </span>
        </div>
        {event.description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
        )}
      </div>

      {/* Time */}
      <span className="shrink-0 text-[10px] text-muted-foreground/70 whitespace-nowrap mt-0.5">{timeAgo}</span>
    </m.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function LiveActivityTicker() {
  const { tenantId, sseConnected } = useDashboardStore();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [filter, setFilter] = useState<EventFilter>('ALL');
  const [paused, setPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const latestIdRef = useRef<string>('');

  // Connect to SSE and transform events into unified ActivityEvent format
  useEffect(() => {
    if (!tenantId) return;

    const es = new EventSource(`/api/sse?tenantId=${encodeURIComponent(tenantId)}`);
    eventSourceRef.current = es;

    const processEvent = (type: string, rawData: Record<string, unknown>) => {
      if (paused) return;

      const newEvents: ActivityEvent[] = [];

      switch (type) {
        case 'incidents': {
          const items = (rawData.incidents as Array<Record<string, unknown>>) ?? [];
          for (const item of items) {
            newEvents.push({
              id: item.id as string,
              type: 'incident',
              title: `${item.type ?? 'Observation'} — ${item.description ? String(item.description).slice(0, 60) : 'No details'}`,
              description: String(item.description ?? ''),
              severity: item.severity as string,
              timestamp: new Date(item.submittedAt as string),
              meta: { pollingUnitId: item.pollingUnitId, reportedById: item.reportedById },
            });
          }
          break;
        }
        case 'alerts': {
          const items = (rawData.alerts as Array<Record<string, unknown>>) ?? [];
          for (const item of items) {
            newEvents.push({
              id: item.id as string,
              type: 'alert',
              title: String(item.title ?? 'New Alert'),
              description: String(item.description ?? ''),
              severity: item.category as string,
              timestamp: new Date(item.createdAt as string),
              meta: { incidentId: item.incidentId },
            });
          }
          break;
        }
        case 'pvt': {
          const items = (rawData.results as Array<Record<string, unknown>>) ?? [];
          for (const item of items) {
            newEvents.push({
              id: item.id as string,
              type: 'pvt',
              title: `PVT Result from PU ${String(item.pollingUnitId ?? '').slice(-6) || '???'} submitted`,
              description: `Total votes cast: ${item.totalVotesCast ?? 0}`, // Keep as string template
              timestamp: new Date(item.submittedAt as string),
            });
          }
          break;
        }
        case 'osint': {
          const posts = (rawData.posts as Array<Record<string, unknown>>) ?? [];
          for (const post of posts) {
            newEvents.push({
              id: post.id as string,
              type: 'osint',
              title: `[${post.platform}] ${post.author}: ${String(post.content ?? '').slice(0, 60)}`,
              description: post.isFakeNews ? 'FLAGGED: Potential fake news' : post.isBotSuspect ? 'FLAGGED: Suspected bot activity' : '',
              severity: post.isFakeNews || post.isBotSuspect ? 'HIGH' : undefined,
              timestamp: new Date(post.ingestedAt as string),
              meta: { platform: post.platform, cibScore: post.cibScore },
            });
          }
          break;
        }
        case 'security': {
          const items = (rawData.events as Array<Record<string, unknown>>) ?? [];
          for (const item of items) {
            newEvents.push({
              id: item.id as string,
              type: 'security',
              title: `Security: ${item.eventType ?? 'Event'}`,
              description: String(item.description ?? ''),
              severity: item.severity as string,
              timestamp: new Date(item.createdAt as string),
            });
          }
          break;
        }
        case 'chat': {
          const msgs = (rawData.messages as Array<Record<string, unknown>>) ?? [];
          for (const msg of msgs) {
            const sender = (msg.sender as Record<string, unknown>) ?? {};
            newEvents.push({
              id: msg.id as string,
              type: 'chat',
              title: `${sender.name ?? 'Unknown'}: ${String(msg.body ?? '').slice(0, 80)}`,
              description: '',
              timestamp: new Date(msg.createdAt as string),
            });
          }
          break;
        }
        case 'checkins': {
          const items = (rawData.checkIns as Array<Record<string, unknown>>) ?? [];
          for (const item of items) {
            newEvents.push({
              id: item.id as string,
              type: 'checkin',
              title: `Agent checked ${item.status === 'SOS_TRIGGERED' ? 'SOS' : 'in'} at zone ${String(item.geofenceZoneId ?? '').slice(-6) || '???'}`,
              description: item.status === 'SOS_TRIGGERED' ? 'SOS TRIGGERED — requires immediate attention' : '',
              severity: item.status === 'SOS_TRIGGERED' ? 'CRITICAL' : undefined,
              timestamp: new Date(item.checkedInAt as string),
            });
          }
          break;
        }
        case 'honeypot': {
          const items = (rawData.alerts as Array<Record<string, unknown>>) ?? [];
          for (const item of items) {
            newEvents.push({
              id: item.id as string,
              type: 'honeypot',
              title: `Honeypot Alert: ${item.name} — deviation detected (${Number(item.deviationPct ?? 0).toFixed(1)}%)`,
              description: `Trap type: ${item.trapType ?? 'unknown'}`,
              severity: 'HIGH',
              timestamp: new Date(item.updatedAt as string),
            });
          }
          break;
        }
        case 'results': {
          const items = (rawData.results as Array<Record<string, unknown>>) ?? [];
          for (const item of items) {
            newEvents.push({
              id: item.id as string,
              type: 'result',
              title: `Official result from PU ${String(item.pollingUnitId ?? '').slice(-6) || '???'}`,
              description: `Valid votes: ${item.totalValidVotes ?? 0}, Rejected: ${item.rejectedBallots ?? 0}`,
              timestamp: new Date(item.submittedAt as string),
            });
          }
          break;
        }
      }

      if (newEvents.length > 0) {
        setEvents(prev => {
          const updated = [...newEvents, ...prev];
          return updated.slice(0, 200); // Keep max 200 events
        });
        latestIdRef.current = newEvents[0]?.id ?? '';

        // Update counts
        setEventCounts(prev => {
          const next = { ...prev };
          for (const e of newEvents) {
            next[e.type] = (next[e.type] ?? 0) + 1;
          }
          return next;
        });

        // Play sound for high-severity events
        if (soundEnabled) {
          const hasCritical = newEvents.some(e => e.severity === 'CRITICAL' || e.severity === 'HIGH');
          if (hasCritical) {
            try {
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = 880;
              osc.type = 'sine';
              gain.gain.value = 0.08;
              osc.start();
              osc.stop(ctx.currentTime + 0.15);
            } catch {
              // Audio not available
            }
          }
        }
      }
    };

    // Wire up all event types
    const eventTypes = ['incidents', 'alerts', 'pvt', 'osint', 'security', 'chat', 'checkins', 'honeypot', 'results'];
    eventTypes.forEach(evtType => {
      es.addEventListener(evtType, (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          processEvent(evtType, data);
        } catch { /* ignore parse errors */ }
      });
    });

    es.onerror = () => { es.close(); eventSourceRef.current = null; };

    return () => { es.close(); eventSourceRef.current = null; };
  }, [tenantId, paused, soundEnabled]);

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (!paused && scrollRef.current && latestIdRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length, paused]);

  // Filter events
  const filteredEvents = filter === 'ALL'
    ? events
    : events.filter(e => e.type === filter);

  const clearEvents = () => setEvents([]);
  const totalNew = Object.values(eventCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald" />
          <h3 className="text-sm font-semibold">Live Activity Stream</h3>
          {totalNew > 0 && (
            <Badge variant="secondary" className="text-[10px] bg-emerald/15 text-emerald">
              {totalNew} new
            </Badge>
          )}
          <span className={cn(
            'flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider',
            sseConnected ? 'text-emerald' : 'text-amber',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', sseConnected ? 'bg-emerald animate-pulse-dot' : 'bg-amber')} />
            {sseConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Sound toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute alerts' : 'Enable alerts'}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />}
          </Button>

          {/* Pause/Play */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPaused(!paused)}
            title={paused ? 'Resume stream' : 'Pause stream'}
          >
            {paused ? <Play className="h-3.5 w-3.5 text-amber" /> : <Pause className="h-3.5 w-3.5" />}
          </Button>

          {/* Clear */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-rose"
            onClick={clearEvents}
            title="Clear events"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-muted/20">
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          <Button
            variant={filter === 'ALL' ? 'default' : 'ghost'}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setFilter('ALL')}
          >
            All
            {totalNew > 0 && <Badge variant="secondary" className="ml-1 text-[9px] h-4 min-w-4 px-1">{totalNew}</Badge>}
          </Button>
          {Object.entries(EVENT_CONFIG).map(([key, cfg]) => {
            const count = eventCounts[key] ?? 0;
            return (
              <Button
                key={key}
                variant={filter === key ? 'default' : 'ghost'}
                size="sm"
                className="h-6 text-[10px] px-2 gap-1"
                onClick={() => setFilter(key as EventFilter)}
              >
                <span className={cfg.color}>{cfg.label}</span>
                {count > 0 && <Badge variant="secondary" className="text-[9px] h-4 min-w-4 px-1">{count}</Badge>}
              </Button>
            );
          })}
        </div>
      </div>

      {/* ── Event list ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Radio className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Waiting for events...</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {sseConnected
                ? 'New incidents, alerts, PVT results, and OSINT posts will appear here in real-time'
                : 'Reconnecting to the server...'}
            </p>
          </div>
        ) : (
          <div>
            {filteredEvents.map((event, i) => (
              <EventRow
                key={event.id}
                event={event}
                isLatest={i === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
