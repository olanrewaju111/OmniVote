'use client';

import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert, AlertTriangle, Info, Radio, CheckCircle2,
  Eye, ShieldOff, Clock, Check, CheckCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardStore } from '@/store/dashboard';

interface Alert {
  id: string;
  type: 'OPERATIONAL' | 'SECURITY';
  category: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  isRead: boolean;
  createdAt: string;
  incident?: { severity: string; status: string; type: string };
}

interface AlertTriageProps {
  alerts: Alert[];
  operationalCount: number;
  securityCount: number;
  criticalCount: number;
}

function categoryIcon(cat: string) {
  switch (cat) {
    case 'CRITICAL': return <Radio className="h-4 w-4 text-rose" />;
    case 'WARNING': return <AlertTriangle className="h-4 w-4 text-amber" />;
    default: return <Info className="h-4 w-4 text-cyan" />;
  }
}

function categoryStyle(cat: string) {
  switch (cat) {
    case 'CRITICAL': return 'border-rose/30 bg-rose/5';
    case 'WARNING': return 'border-amber/25 bg-amber/5';
    default: return 'border-border bg-card/40';
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

export function AlertTriage({ alerts, operationalCount, securityCount, criticalCount }: AlertTriageProps) {
  const { alertFilter, setAlertFilter, tenantId } = useDashboardStore();
  const queryClient = useQueryClient();
  const unreadCount = alerts.filter(a => !a.isRead).length;

  const markReadMutation = useMutation({
    mutationFn: (alertId: string) =>
      fetchJson(`/api/alerts?tenantId=${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ alertId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', tenantId] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () =>
      fetchJson(`/api/alerts?tenantId=${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ markAllRead: true }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', tenantId] });
    },
  });

  const filtered = alerts.filter(a => {
    if (alertFilter !== 'ALL' && a.type !== alertFilter) return false;
    return true;
  });

  const opAlerts = alerts.filter(a => a.type === 'OPERATIONAL');
  const secAlerts = alerts.filter(a => a.type === 'SECURITY');

  return (
    <div className="h-full flex flex-col">
      {/* Header with tabs */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber" />
            Adversarial Alert Triage
          </h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1.5 text-[10px] px-2"
                disabled={markAllReadMutation.isPending}
                onClick={() => markAllReadMutation.mutate()}
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </Button>
            )}
            <Badge variant="destructive" className="text-[10px] h-5">{criticalCount} Critical</Badge>
          </div>
        </div>

        {/* Two-column split indicator */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setAlertFilter('ALL')}
            className={cn(
              'px-3 py-2 rounded-lg border text-center transition-colors',
              alertFilter === 'ALL'
                ? 'bg-foreground/10 border-foreground/20 text-foreground'
                : 'bg-card/40 border-border text-muted-foreground hover:bg-card/60'
            )}
          >
            <p className="text-lg font-bold tabular-nums">{alerts.length}</p>
            <p className="text-[10px] text-muted-foreground">All Alerts</p>
          </button>
          <button
            onClick={() => setAlertFilter('OPERATIONAL')}
            className={cn(
              'px-3 py-2 rounded-lg border text-center transition-colors',
              alertFilter === 'OPERATIONAL'
                ? 'bg-cyan/10 border-cyan/20 text-cyan'
                : 'bg-card/40 border-border text-muted-foreground hover:bg-card/60'
            )}
          >
            <p className="text-lg font-bold tabular-nums text-cyan">{operationalCount}</p>
            <p className="text-[10px] text-muted-foreground">Operational</p>
          </button>
          <button
            onClick={() => setAlertFilter('SECURITY')}
            className={cn(
              'px-3 py-2 rounded-lg border text-center transition-colors',
              alertFilter === 'SECURITY'
                ? 'bg-rose/10 border-rose/20 text-rose'
                : 'bg-card/40 border-border text-muted-foreground hover:bg-card/60'
            )}
          >
            <p className="text-lg font-bold tabular-nums text-rose">{securityCount}</p>
            <p className="text-[10px] text-muted-foreground">Security</p>
          </button>
        </div>
      </div>

      {/* Alert list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-2">
          {filtered.map((alert, idx) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02, duration: 0.2 }}
              className={cn(
                'rounded-lg border p-3 transition-colors',
                categoryStyle(alert.category),
                !alert.isRead && 'ring-1 ring-ring/30'
              )}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">{categoryIcon(alert.category)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] h-5 border',
                        alert.type === 'SECURITY'
                          ? 'text-rose border-rose/30 bg-rose/10'
                          : 'text-cyan border-cyan/30 bg-cyan/10'
                      )}
                    >
                      {alert.type === 'SECURITY' ? <ShieldOff className="h-2.5 w-2.5 mr-1" /> : <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
                      {alert.type}
                    </Badge>
                    {!alert.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                    {!alert.isRead && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markReadMutation.mutate(alert.id);
                        }}
                        className="ml-auto shrink-0 p-0.5 rounded text-muted-foreground hover:text-emerald transition-colors"
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />{formatTime(alert.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs font-medium mb-0.5">{alert.title}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{alert.description}</p>
                  {alert.incident && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[10px] h-5">{alert.incident.severity}</Badge>
                      <Badge variant="outline" className="text-[10px] h-5">{alert.incident.status}</Badge>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No alerts in this category
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}