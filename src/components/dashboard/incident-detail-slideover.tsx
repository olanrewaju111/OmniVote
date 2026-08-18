'use client';

import { useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  X, ShieldAlert, AlertTriangle, Eye, MapPin, User, Clock,
  ShieldCheck, ShieldOff, Sparkles, ArrowUpCircle, CheckCircle2,
  Loader2, Image as ImageIcon, FileQuestion, FileText, ExternalLink,
} from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useDashboardStore } from '@/store/dashboard';
import type { Incident } from '@/types/dashboard';

// ---- Props ----

interface IncidentDetailSlideoverProps {
  incident: Incident | null;
  open: boolean;
  onClose: () => void;
}

// ---- Helpers (reuse live-feed logic) ----

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
    case 'VIOLENCE': return <ShieldAlert className="h-4 w-4 text-rose" />;
    case 'INTIMIDATION': return <AlertTriangle className="h-4 w-4 text-amber" />;
    case 'BALLOT_STUFFING': return <AlertTriangle className="h-4 w-4 text-rose" />;
    case 'DEEPFAKE_SUSPECT': return <ShieldAlert className="h-4 w-4 text-violet" />;
    case 'CIB_DETECTED': return <ShieldAlert className="h-4 w-4 text-violet" />;
    case 'GEO_ANOMALY': return <MapPin className="h-4 w-4 text-amber" />;
    default: return <Eye className="h-4 w-4 text-cyan" />;
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'PENDING': return 'border-amber/30 text-amber bg-amber/10';
    case 'REVIEWED': return 'border-emerald/30 text-emerald bg-emerald/10';
    case 'ESCALATED': return 'border-rose/30 text-rose bg-rose/10';
    case 'DISMISSED': return 'border-muted-foreground/30 text-muted-foreground bg-muted';
    case 'QUARANTINED': return 'border-violet/30 text-violet bg-violet/10';
    default: return 'border-border text-muted-foreground bg-muted';
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

function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ---- Component ----

export function IncidentDetailSlideover({
  incident,
  open,
  onClose,
}: IncidentDetailSlideoverProps) {
  const { tenantId } = useDashboardStore();
  const queryClient = useQueryClient();

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  // ---- Mutations ----

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; [key: string]: unknown }) =>
      fetchJson(`/api/incidents/${id}?tenantId=${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: Error) => {
      toast.error('Action failed', { description: err.message });
    },
  });

  const handleEscalate = () => {
    if (!incident) return;
    updateMutation.mutate(
      { id: incident.id, severity: 'CRITICAL' },
      {
        onSuccess: () => {
          toast.success('Incident escalated to CRITICAL');
        },
      },
    );
  };

  const handleDismiss = () => {
    if (!incident) return;
    updateMutation.mutate(
      { id: incident.id, status: 'DISMISSED' },
      {
        onSuccess: () => {
          toast.success('Incident dismissed');
          onClose();
        },
      },
    );
  };

  const handleQuarantine = () => {
    if (!incident) return;
    updateMutation.mutate(
      { id: incident.id, isQuarantined: !incident.isQuarantined },
      {
        onSuccess: () => {
          toast.success(
            incident.isQuarantined
              ? 'Quarantine removed'
              : 'Incident quarantined',
          );
        },
      },
    );
  };

  const handleMarkReviewed = () => {
    if (!incident) return;
    updateMutation.mutate(
      { id: incident.id, status: 'REVIEWED' },
      {
        onSuccess: () => {
          toast.success('Incident marked as reviewed');
        },
      },
    );
  };

  const isActioning = updateMutation.isPending;

  return (
    <AnimatePresence>
      {open && incident && (
        <>
          {/* Backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <m.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] bg-background border-l border-border shadow-2xl flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={`Incident details: ${incident.type.replace(/_/g, ' ')}`}
          >
            {/* ─── Header ─── */}
            <div className="shrink-0 px-5 pt-5 pb-4 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0 p-2 rounded-lg bg-card border border-border">
                    {typeIcon(incident.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Badge
                        className={cn(
                          'text-[10px] h-5 border font-semibold',
                          severityColor(incident.severity),
                        )}
                      >
                        {incident.severity}
                      </Badge>
                      <span className="text-xs font-medium text-foreground">
                        {incident.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] h-5',
                          statusColor(incident.status),
                        )}
                      >
                        {incident.status}
                      </Badge>
                      {incident.isQuarantined && (
                        <Badge className="text-[10px] h-5 bg-violet/15 text-violet border-violet/30">
                          <ShieldOff className="h-2.5 w-2.5 mr-1" />
                          QUARANTINED
                        </Badge>
                      )}
                      {incident.c2paVerified && (
                        <Badge className="text-[10px] h-5 bg-emerald/15 text-emerald border-emerald/30">
                          <ShieldCheck className="h-2.5 w-2.5 mr-1" />
                          C2PA VERIFIED
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8 rounded-md -mt-1 -mr-2"
                  onClick={onClose}
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2.5 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(incident.submittedAt)}
              </p>
            </div>

            {/* ─── Scrollable Body ─── */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-5 py-4 space-y-5">

                {/* Description */}
                <section>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Description
                  </h4>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {incident.description}
                  </p>
                </section>

                <Separator />

                {/* AI Analysis */}
                {incident.aiSummary && (
                  <section>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-cyan" />
                      AI Analysis
                    </h4>
                    <div className="bg-cyan/5 border border-cyan/15 rounded-lg p-3">
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        {incident.aiSummary}
                      </p>
                    </div>
                    {incident.aiFlags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {incident.aiFlags.map((flag) => (
                          <Badge
                            key={flag}
                            variant="outline"
                            className="text-[10px] h-5 text-cyan border-cyan/25 bg-cyan/5"
                          >
                            {flag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* AI Flags (standalone, when no aiSummary) */}
                {!incident.aiSummary && incident.aiFlags.length > 0 && (
                  <section>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-cyan" />
                      AI Flags
                    </h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {incident.aiFlags.map((flag) => (
                        <Badge
                          key={flag}
                          variant="outline"
                          className="text-[10px] h-5 text-cyan border-cyan/25 bg-cyan/5"
                        >
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  </section>
                )}

                {(incident.aiSummary || incident.aiFlags.length > 0) && <Separator />}

                {/* GPS Info */}
                {(incident.gpsLat !== null && incident.gpsLng !== null) && (
                  <section>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      GPS Coordinates
                    </h4>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded-md font-mono tabular-nums">
                        {incident.gpsLat.toFixed(6)}, {incident.gpsLng.toFixed(6)}
                      </code>
                      {incident.gpsAnomaly && (
                        <Badge className="text-[10px] h-5 bg-amber/15 text-amber border-amber/30">
                          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                          GPS ANOMALY
                        </Badge>
                      )}
                    </div>
                  </section>
                )}

                {/* Location */}
                {incident.pollingUnit && (
                  <section>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      Location
                    </h4>
                    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-1.5">
                      <p className="text-sm font-medium text-foreground">
                        {incident.pollingUnit.name}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>{incident.pollingUnit.state}</span>
                        <span className="text-border">·</span>
                        <span>{incident.pollingUnit.lga}</span>
                        {incident.pollingUnit.code && (
                          <>
                            <span className="text-border">·</span>
                            <span className="font-mono">{incident.pollingUnit.code}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {/* Reporter */}
                {incident.reporter && (
                  <section>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      Reporter
                    </h4>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {incident.reporter.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {incident.reporter.role.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                <Separator />

                {/* Timeline */}
                <section>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Timeline
                  </h4>
                  <div className="relative pl-5">
                    {/* Connecting line */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

                    {/* Submitted */}
                    <div className="relative flex items-start gap-3 pb-4">
                      <div className="absolute -left-5 top-0.5 h-3.5 w-3.5 rounded-full bg-emerald border-2 border-background z-10" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">Submitted</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDateTime(incident.submittedAt)}
                        </p>
                      </div>
                    </div>

                    {/* Reviewed */}
                    {incident.reviewedAt ? (
                      <div className="relative flex items-start gap-3">
                        <div className="absolute -left-5 top-0.5 h-3.5 w-3.5 rounded-full bg-cyan border-2 border-background z-10" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">Reviewed</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDateTime(incident.reviewedAt)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="relative flex items-start gap-3">
                        <div className="absolute -left-5 top-0.5 h-3.5 w-3.5 rounded-full bg-muted border-2 border-background z-10" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Awaiting review</p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <Separator />

                {/* Linked Evidence */}
                <LinkedEvidenceSection incidentId={incident.id} tenantId={useDashboardStore.getState().tenantId} />

              </div>
            </ScrollArea>

            {/* ─── Footer Actions ─── */}
            <div className="shrink-0 px-5 py-4 border-t border-border bg-background">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 border-rose/30 text-rose hover:bg-rose/10"
                  disabled={isActioning || incident.severity === 'CRITICAL'}
                  onClick={handleEscalate}
                >
                  {isActioning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowUpCircle className="h-3.5 w-3.5" />
                  )}
                  Escalate
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  disabled={isActioning || incident.status === 'REVIEWED'}
                  onClick={handleMarkReviewed}
                >
                  {isActioning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Mark Reviewed
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    'h-8 text-xs gap-1.5',
                    incident.isQuarantined
                      ? 'border-violet/30 text-violet hover:bg-violet/10'
                      : 'border-amber/30 text-amber hover:bg-amber/10',
                  )}
                  disabled={isActioning}
                  onClick={handleQuarantine}
                >
                  {isActioning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShieldOff className="h-3.5 w-3.5" />
                  )}
                  {incident.isQuarantined ? 'Unquarantine' : 'Quarantine'}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 border-muted-foreground/30 text-muted-foreground hover:bg-muted"
                  disabled={isActioning || incident.status === 'DISMISSED'}
                  onClick={handleDismiss}
                >
                  {isActioning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                  Dismiss
                </Button>
              </div>
            </div>
          </m.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Linked Evidence Sub-Component ───────────────────────────────────────

function LinkedEvidenceSection({ incidentId, tenantId }: { incidentId: string; tenantId: string }) {
  const { data, isLoading } = useQuery<{
    dossiers: Array<{
      id: string;
      title: string;
      status: string;
      c2paSigned: boolean;
      createdAt: string;
      evidenceItems: string;
    }>;
  }>({
    queryKey: ['evidence-for-incident', incidentId],
    queryFn: () =>
      fetchJson(`/api/evidence?tenantId=${tenantId}&incidentId=${incidentId}&limit=10`),
    enabled: !!incidentId && !!tenantId,
  });

  const dossiers = data?.dossiers || [];

  if (isLoading) {
    return (
      <section>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <ImageIcon className="h-3 w-3" />
          Linked Evidence
        </h4>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  return (
    <section>
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
        <ImageIcon className="h-3 w-3" />
        Linked Evidence
        {dossiers.length > 0 && (
          <Badge variant="secondary" className="text-[9px] h-4 ml-auto px-1.5">
            {dossiers.length}
          </Badge>
        )}
      </h4>
      {dossiers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/30 p-4 flex flex-col items-center justify-center gap-1.5">
          <FileQuestion className="h-6 w-6 text-muted-foreground/30" />
          <p className="text-[11px] text-muted-foreground/60">No linked evidence</p>
          <p className="text-[10px] text-muted-foreground/40">Evidence attached to this incident will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dossiers.map((d) => {
            let itemCount = 0;
            try { itemCount = JSON.parse(d.evidenceItems || '[]').length; } catch { /* ignore */ }
            const statusCls = d.status === 'CERTIFIED'
              ? 'text-emerald border-emerald/30'
              : d.status === 'REVIEWED'
                ? 'text-cyan border-cyan/30'
                : 'text-muted-foreground border-border';
            return (
              <div
                key={d.id}
                className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors cursor-pointer group"
                onClick={() => useDashboardStore.getState().setSelectedTab('evidence')}
              >
                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{d.title}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                    <span className="text-border">·</span>
                    <span className={statusCls}>{d.status}</span>
                    {d.c2paSigned && (
                      <>
                        <span className="text-border">·</span>
                        <span className="text-emerald">C2PA</span>
                      </>
                    )}
                  </div>
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
