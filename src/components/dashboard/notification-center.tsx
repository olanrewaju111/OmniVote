'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Bell, Radio, AlertTriangle, Info, Clock, Shield,
  CheckCheck, Volume2, VolumeX, ArrowUpRight,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { useDashboardStore, type ViewTab } from '@/store/dashboard';

// ─── Types ───────────────────────────────────────────────────────────

interface AlertItem {
  id: string;
  type: 'OPERATIONAL' | 'SECURITY';
  category: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  isRead: boolean;
  createdAt: string;
  incident?: {
    id: string;
    severity: string;
    status: string;
    type: string;
  };
}

type FilterMode = 'ALL' | 'CRITICAL' | 'UNREAD';

// ─── Helpers ─────────────────────────────────────────────────────────

function relativeTime(date: string) {
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

function categoryIcon(category: string) {
  switch (category) {
    case 'CRITICAL':
      return <Radio className="h-3.5 w-3.5 text-rose shrink-0" aria-hidden="true" />;
    case 'WARNING':
      return <AlertTriangle className="h-3.5 w-3.5 text-amber shrink-0" aria-hidden="true" />;
    default:
      return <Info className="h-3.5 w-3.5 text-cyan shrink-0" aria-hidden="true" />;
  }
}

// ─── Sound ───────────────────────────────────────────────────────────

const SOUND_STORAGE_KEY = 'omnivote-alert-sound';

function playCriticalBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.stop(ctx.currentTime + 0.2);
    setTimeout(() => ctx.close(), 500);
  } catch {
    // Audio not available — non-critical
  }
}

function getAlertSoundPref(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = localStorage.getItem(SOUND_STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

function setAlertSoundPref(enabled: boolean) {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
  } catch {
    // localStorage unavailable
  }
}

// ─── Filter pills ────────────────────────────────────────────────────

const FILTERS: { value: FilterMode; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'UNREAD', label: 'Unread' },
];

// ─── Notification Item ───────────────────────────────────────────────

interface NotificationItemProps {
  alert: AlertItem;
  onMarkRead: (id: string) => void;
  onNavigate: (tab: ViewTab) => void;
  onEscalate: (incidentId: string) => void;
  isEscalating: boolean;
}

function NotificationItem({
  alert,
  onMarkRead,
  onNavigate,
  onEscalate,
  isEscalating,
}: NotificationItemProps) {
  const handleItemClick = useCallback(() => {
    if (!alert.isRead) onMarkRead(alert.id);
    const tab: ViewTab = alert.type === 'SECURITY' ? 'security' : 'alerts';
    onNavigate(tab);
  }, [alert.id, alert.isRead, alert.type, onMarkRead, onNavigate]);

  const handleReview = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!alert.isRead) onMarkRead(alert.id);
      onNavigate('alerts');
    },
    [alert.id, alert.isRead, onMarkRead, onNavigate],
  );

  const incidentId = alert.incident?.id ?? null;

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group relative flex items-start gap-2.5 px-3 py-2.5 transition-colors cursor-pointer rounded-md mx-1',
        alert.isRead
          ? 'hover:bg-accent/30'
          : 'bg-accent/20 hover:bg-accent/40',
      )}
      onClick={handleItemClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleItemClick();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${alert.isRead ? '' : 'Unread — '}${alert.category} ${alert.type.toLowerCase()} notification: ${alert.title}`}
    >
      {/* Unread dot */}
      {!alert.isRead && (
        <span
          className="absolute top-3 left-1 w-1.5 h-1.5 rounded-full bg-emerald"
          aria-hidden="true"
        />
      )}

      {/* Category icon */}
      <div className="mt-0.5 shrink-0 ml-1.5">{categoryIcon(alert.category)}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Type badge */}
          <Badge
            variant="outline"
            className={cn(
              'text-[9px] h-4 border px-1 font-medium',
              alert.type === 'SECURITY'
                ? 'text-rose border-rose/30 bg-rose/10'
                : 'text-cyan border-cyan/30 bg-cyan/10',
            )}
          >
            {alert.type}
          </Badge>

          {/* Category badge */}
          <Badge
            variant="outline"
            className={cn(
              'text-[9px] h-4 border px-1',
              alert.category === 'CRITICAL'
                ? 'bg-rose/15 text-rose border-rose/30'
                : alert.category === 'WARNING'
                  ? 'bg-amber/15 text-amber border-amber/30'
                  : 'bg-cyan/15 text-cyan border-cyan/30',
            )}
          >
            {alert.category}
          </Badge>

          {/* Timestamp */}
          <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5 ml-auto shrink-0">
            <Clock className="h-2.5 w-2.5" aria-hidden="true" />
            {relativeTime(alert.createdAt)}
          </span>
        </div>

        <p className="text-xs font-medium mt-0.5 truncate">{alert.title}</p>
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {alert.description}
        </p>

        {/* Quick actions for CRITICAL */}
        {alert.category === 'CRITICAL' && (
          <div className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] gap-1 px-2 bg-rose/5 border-rose/20 text-rose hover:bg-rose/10 hover:text-rose"
              onClick={handleReview}
            >
              <Shield className="h-3 w-3" aria-hidden="true" />
              Review
            </Button>
            {incidentId && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] gap-1 px-2 bg-amber/5 border-amber/20 text-amber hover:bg-amber/10 hover:text-amber disabled:opacity-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onEscalate(incidentId);
                }}
                disabled={isEscalating}
              >
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                Escalate
              </Button>
            )}
          </div>
        )}
      </div>
    </m.div>
  );
}

// ─── NotificationCenter (panel content) ──────────────────────────────

export function NotificationCenter() {
  const { tenantId, setSelectedTab, setUnreadAlerts } = useDashboardStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterMode>('ALL');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevCriticalIds = useRef<Set<string>>(new Set());
  const soundRef = useRef(true);

  // Initialize sound preference from localStorage
  useEffect(() => {
    soundRef.current = getAlertSoundPref();
    setSoundEnabled(soundRef.current);
  }, []);

  // Fetch alerts
  const { data: alertsRes, isLoading } = useQuery<{
    alerts: AlertItem[];
  }>({
    queryKey: ['alerts', 'notifications', tenantId],
    queryFn: () => fetchJson(`/api/alerts?tenantId=${tenantId}`),
    refetchInterval: 30_000,
  });

  const allAlerts = alertsRes?.alerts || [];
  const unreadCount = allAlerts.filter((a) => !a.isRead).length;

  // Play sound on new critical alerts
  useEffect(() => {
    if (!soundRef.current) return;
    const criticalIds = new Set(
      allAlerts.filter((a) => a.category === 'CRITICAL' && !a.isRead).map((a) => a.id),
    );
    // Detect new IDs not in previous set
    for (const id of criticalIds) {
      if (!prevCriticalIds.current.has(id)) {
        playCriticalBeep();
        break; // one beep per batch
      }
    }
    prevCriticalIds.current = criticalIds;
  }, [allAlerts]);

  // Update global unread count
  useEffect(() => {
    setUnreadAlerts(unreadCount);
  }, [unreadCount, setUnreadAlerts]);

  // Mark single alert as read
  const markRead = useMutation({
    mutationFn: (alertId: string) =>
      fetchJson(`/api/alerts?tenantId=${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ alertId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    onError: () => {
      toast.error('Failed to mark notification as read');
    },
  });

  // Mark all as read
  const markAllRead = useMutation({
    mutationFn: () =>
      fetchJson(`/api/alerts?tenantId=${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ markAllRead: true }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('All notifications marked as read');
    },
    onError: () => {
      toast.error('Failed to mark all as read');
    },
  });

  // Escalate incident
  const escalateIncident = useMutation({
    mutationFn: (incidentId: string) =>
      fetchJson(`/api/incidents/${incidentId}?tenantId=${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ESCALATED' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      toast.success('Incident escalated successfully');
    },
    onError: () => {
      toast.error('Failed to escalate incident');
    },
  });

  // Navigate to tab
  const handleNavigate = useCallback(
    (tab: ViewTab) => {
      setSelectedTab(tab);
    },
    [setSelectedTab],
  );

  // Sound toggle handler
  const handleSoundToggle = useCallback((checked: boolean) => {
    setSoundEnabled(checked);
    soundRef.current = checked;
    setAlertSoundPref(checked);
  }, []);

  // Filtered alerts
  const filteredAlerts = allAlerts.filter((a) => {
    if (filter === 'CRITICAL') return a.category === 'CRITICAL';
    if (filter === 'UNREAD') return !a.isRead;
    return true;
  });

  return (
    <div className="flex flex-col w-[380px] max-h-[480px]" role="region" aria-label="Notification center">
      {/* ── Header ──────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px] font-bold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <div className="flex items-center gap-1.5" title={soundEnabled ? 'Critical alert sounds on' : 'Critical alert sounds muted'}>
            {soundEnabled ? (
              <Volume2 className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            ) : (
              <VolumeX className="h-3 w-3 text-muted-foreground/40" aria-hidden="true" />
            )}
            <Switch
              checked={soundEnabled}
              onCheckedChange={handleSoundToggle}
              className="scale-75"
              aria-label="Toggle critical alert sounds"
            />
          </div>

          {/* Mark all read */}
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-accent disabled:opacity-50"
              aria-label="Mark all notifications as read"
            >
              <CheckCheck className="h-3 w-3" aria-hidden="true" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* ── Filter pills ────────────────────────── */}
      <div className="flex items-center gap-1 px-4 pb-2 shrink-0" role="tablist" aria-label="Notification filters">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors',
              filter === f.value
                ? 'bg-emerald/15 text-emerald border border-emerald/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-transparent',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Separator className="opacity-50" />

      {/* ── Notification list ───────────────────── */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full max-h-[340px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-xs">
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 rounded-full border-2 border-emerald/30 border-t-emerald animate-spin" />
                <span>Loading notifications…</span>
              </div>
            </div>
          ) : filteredAlerts.length > 0 ? (
            <div className="py-1.5 space-y-0.5">
              <AnimatePresence mode="popLayout">
                {filteredAlerts.map((alert) => (
                  <NotificationItem
                    key={alert.id}
                    alert={alert}
                    onMarkRead={(id) => markRead.mutate(id)}
                    onNavigate={handleNavigate}
                    onEscalate={(incidentId) => escalateIncident.mutate(incidentId)}
                    isEscalating={escalateIncident.isPending}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            /* ── Empty state ────────────────────── */
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="h-10 w-10 rounded-full bg-emerald/10 flex items-center justify-center mb-3">
                <Shield className="h-5 w-5 text-emerald/60" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-foreground/70">All caught up</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                New notifications will appear here
              </p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Footer ───────────────────────────────── */}
      <Separator className="opacity-50" />
      <button
        onClick={() => handleNavigate('alerts')}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="View all alerts"
      >
        View all alerts
        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── NotificationBell (trigger + popover) ────────────────────────────

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { tenantId } = useDashboardStore();

  // Quick unread count for the badge (independent query so the badge shows
  // even when the panel is closed)
  const { data: quickData } = useQuery<{
    alerts: AlertItem[];
  }>({
    queryKey: ['alerts', 'bell-badge', tenantId],
    queryFn: () => fetchJson(`/api/alerts?tenantId=${tenantId}`),
    refetchInterval: 30_000,
    // Keep fresh even while popover is closed
    staleTime: 15_000,
  });

  const unreadCount = (quickData?.alerts || []).filter((a) => !a.isRead).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative h-7 w-7 p-0 bg-background/60 border-border/60 hover:bg-accent/50 transition-colors"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
        >
          <Bell className="h-3.5 w-3.5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 rounded-full bg-destructive text-[8px] font-bold flex items-center justify-center text-white ring-2 ring-background px-0.5">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] p-0 glass-strong rounded-lg border border-border/60 shadow-xl"
        onOpenAutoFocus={(e) => {
          // Prevent popover from stealing focus on open (accessibility-friendly)
          e.preventDefault();
        }}
      >
        <NotificationCenter />
      </PopoverContent>
    </Popover>
  );
}
