'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Image as ImageIcon, Video, FileAudio, ShieldCheck, ShieldAlert, AlertTriangle,
  Eye, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useDashboardStore } from '@/store/dashboard';
import { fetchJson } from '@/lib/api';
import { EmptyState } from './empty-state';

interface EvidenceItem {
  id: string;
  fileName?: string;
  fileType?: string;
  fileUrl?: string;
  description?: string;
}

interface Dossier {
  id: string;
  title: string;
  description: string | null;
  status: string;
  c2paSigned: boolean;
  aiSummary: string | null;
  aiConfidence: number | null;
  evidenceItems: EvidenceItem[];
  incidentId: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

interface StegoScan {
  id: string;
  fileName: string;
  fileType: string;
  isManipulated: boolean;
  manipulationType: string | null;
  confidence: number;
  elaScore: number;
  scannedAt: string;
  evidenceDossierId?: string;
}

interface MediaGalleryData {
  dossiers: Dossier[];
  stegoScans: StegoScan[];
  stats: {
    totalDossiers: number;
    byStatus: Record<string, number>;
    totalC2paSigned: number;
    totalStegoScans: number;
    manipulatedCount: number;
    manipulationTypes: Record<string, number>;
    avgAiConfidence: number;
  };
}

interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio';
  status: 'VERIFIED' | 'UNVERIFIED' | 'QUARANTINED';
  c2paVerified: boolean;
  incidentId: string | null;
  aiConfidence: number | null;
  aiSummary: string | null;
  isManipulated: boolean | null;
  manipulationType: string | null;
  title: string;
  description: string | null;
  createdAt: string;
  dossierStatus: string;
}

function deriveMediaType(fileType?: string, title?: string): 'image' | 'video' | 'audio' {
  if (fileType) {
    if (fileType === 'MP4' || fileType === 'VIDEO') return 'video';
    if (fileType === 'WAV' || fileType === 'AUDIO') return 'audio';
  }
  if (title) {
    const t = title.toLowerCase();
    if (t.includes('video') || t.includes('recording') || t.includes('footage')) return 'video';
    if (t.includes('audio') || t.includes('voice') || t.includes('recording')) return 'audio';
  }
  return 'image';
}

function deriveStatus(dossier: Dossier, scan?: StegoScan): MediaItem['status'] {
  if (dossier.status === 'DISMISSED') return 'QUARANTINED';
  if (scan?.isManipulated) return 'QUARANTINED';
  if (dossier.status === 'CERTIFIED' || dossier.c2paSigned) return 'VERIFIED';
  if (dossier.status === 'REVIEWED') return 'VERIFIED';
  return 'UNVERIFIED';
}

function relativeTime(date: string | Date) {
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

function typeIcon(type: string) {
  switch (type) {
    case 'video': return <Video className="h-4 w-4" />;
    case 'audio': return <FileAudio className="h-4 w-4" />;
    default: return <ImageIcon className="h-4 w-4" />;
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'VERIFIED':
      return <Badge className="bg-emerald/15 text-emerald border-emerald/30 text-[10px] h-5"><CheckCircle2 className="h-2.5 w-2.5 mr-1" />VERIFIED</Badge>;
    case 'QUARANTINED':
      return <Badge className="bg-rose/15 text-rose border-rose/30 text-[10px] h-5"><XCircle className="h-2.5 w-2.5 mr-1" />QUARANTINED</Badge>;
    default:
      return <Badge className="bg-amber/15 text-amber border-amber/30 text-[10px] h-5"><AlertTriangle className="h-2.5 w-2.5 mr-1" />UNVERIFIED</Badge>;
  }
}

function getGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 6;
  const gradients = [
    'from-emerald/20 to-cyan/20',
    'from-amber/20 to-rose/20',
    'from-violet/20 to-rose/20',
    'from-cyan/20 to-violet/20',
    'from-amber/20 to-violet/20',
    'from-emerald/20 to-amber/20',
  ];
  return gradients[Math.abs(hash)];
}

function MediaGalleryInner() {
  const { tenantId } = useDashboardStore();
  const [filter, setFilter] = useState<string>('ALL');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  const { data, isLoading } = useQuery<MediaGalleryData>({
    queryKey: ['evidence', tenantId],
    queryFn: () => fetchJson(`/api/evidence?tenantId=${tenantId}`),
    refetchInterval: 30_000,
  });

  // Build a map of dossier ID → latest stego scan
  const stegoByDossier = new Map<string, StegoScan>();
  if (data?.stegoScans) {
    for (const scan of data.stegoScans) {
      if (scan.evidenceDossierId && (!stegoByDossier.has(scan.evidenceDossierId) || new Date(scan.scannedAt) > new Date(stegoByDossier.get(scan.evidenceDossierId)!.scannedAt))) {
        stegoByDossier.set(scan.evidenceDossierId, scan);
      }
    }
  }

  // Transform dossiers + scans into flat media items
  const items: MediaItem[] = (data?.dossiers || []).map(d => {
    const scan = d.id ? stegoByDossier.get(d.id) : undefined;
    const firstItem = (d.evidenceItems?.[0] as EvidenceItem | undefined);
    return {
      id: d.id,
      type: deriveMediaType(firstItem?.fileType, d.title),
      status: deriveStatus(d, scan),
      c2paVerified: d.c2paSigned,
      incidentId: d.incidentId,
      aiConfidence: d.aiConfidence,
      aiSummary: d.aiSummary,
      isManipulated: scan?.isManipulated ?? null,
      manipulationType: scan?.manipulationType ?? null,
      title: d.title,
      description: d.description,
      createdAt: d.createdAt,
      dossierStatus: d.status,
    };
  });

  const filtered = items.filter(m => {
    if (filter === 'ALL') return true;
    if (filter === 'QUARANTINED') return m.status === 'QUARANTINED';
    if (filter === 'UNVERIFIED') return m.status === 'UNVERIFIED';
    if (filter === 'VERIFIED') return m.status === 'VERIFIED';
    if (filter === 'NO_C2PA') return !m.c2paVerified;
    return true;
  });

  const counts = {
    all: items.length,
    quarantined: items.filter(m => m.status === 'QUARANTINED').length,
    unverified: items.filter(m => m.status === 'UNVERIFIED').length,
    verified: items.filter(m => m.status === 'VERIFIED').length,
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" aria-label="Media gallery">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-cyan" />
            Media Vault
          </h3>
          {data?.stats && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald" />{data.stats.totalC2paSigned} C2PA</span>
              <span>|</span>
              <span className="flex items-center gap-1"><ShieldAlert className="h-3 w-3 text-rose" />{data.stats.manipulatedCount} flagged</span>
              <span>|</span>
              <span>{data.stats.totalDossiers} total</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'ALL', label: `All (${counts.all})` },
            { key: 'QUARANTINED', label: `Quarantined (${counts.quarantined})` },
            { key: 'UNVERIFIED', label: `Unverified (${counts.unverified})` },
            { key: 'VERIFIED', label: `Verified (${counts.verified})` },
          ].map(f => (
            <Button
              key={f.key}
              variant={filter === f.key ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-7 text-[11px]',
                filter === f.key && 'bg-foreground/10 text-foreground',
                f.key === 'QUARANTINED' && filter === f.key && 'bg-rose/15 text-rose'
              )}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid + Detail panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Grid */}
        <ScrollArea className="flex-1">
          <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((item, idx) => (
              <m.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03, duration: 0.2 }}
                className={cn(
                  'rounded-lg border overflow-hidden cursor-pointer transition-all hover:scale-[1.02] outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  item.status === 'QUARANTINED' ? 'border-rose/30' :
                  item.status === 'UNVERIFIED' ? 'border-amber/25' :
                  'border-border'
                )}
                onClick={() => setSelectedItem(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedItem(item); }
                }}
                tabIndex={0}
                role="button"
              >
                {/* Thumbnail placeholder */}
                <div className={cn('aspect-video bg-gradient-to-br relative', getGradient(item.id))} role="img" aria-label={`${item.type} media: ${item.title || 'Untitled'}`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {typeIcon(item.type)}
                  </div>
                  <div className="absolute top-1.5 left-1.5">
                    {statusBadge(item.status)}
                  </div>
                  <div className="absolute top-1.5 right-1.5">
                    <Badge variant="outline" className="bg-black/40 border-white/10 text-white/80 text-[9px] h-4">
                      {item.type.toUpperCase()}
                    </Badge>
                  </div>
                  {item.status === 'QUARANTINED' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <span className="text-rose font-bold text-xs px-3 py-1 rounded border border-rose/50 bg-black/60 transform rotate-[-15deg]">
                        UNVERIFIED
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-2 bg-card/60 space-y-1">
                  <p className="text-[11px] font-medium truncate">{item.title || 'Untitled'}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{relativeTime(item.createdAt)}</span>
                    {item.c2paVerified ? (
                      <span className="flex items-center gap-0.5 text-[9px] text-emerald"><ShieldCheck className="h-2.5 w-2.5" />C2PA</span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground"><XCircle className="h-2.5 w-2.5" />No C2PA</span>
                    )}
                  </div>
                </div>
              </m.div>
            ))}
          </div>
          {!isLoading && filtered.length === 0 && (
            <EmptyState
              icon={ImageIcon}
              title="No media in this category"
              description="Evidence will appear here as dossiers are created and linked to incidents."
              size="sm"
            />
          )}
        </ScrollArea>

        {/* Detail panel — responsive: Dialog on mobile, sidebar on desktop */}
        <AnimatePresence>
          {selectedItem && (
            <m.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-80 border-l border-border bg-card/40 p-4 space-y-3 shrink-0 hidden lg:flex flex-col"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Media Detail</h4>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedItem(null)}>Close</Button>
              </div>
              <div className={cn('aspect-video rounded-lg bg-gradient-to-br flex items-center justify-center', getGradient(selectedItem.id))}>
                {typeIcon(selectedItem.type)}
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto">
                <div className="flex items-center gap-2">
                  {statusBadge(selectedItem.status)}
                  <Badge variant="outline" className="text-[10px]">{selectedItem.type.toUpperCase()}</Badge>
                </div>
                <p className="text-xs font-medium">{selectedItem.title}</p>
                {selectedItem.description && <p className="text-xs text-muted-foreground">{selectedItem.description}</p>}
                {selectedItem.aiSummary && (
                  <div className="p-2 rounded-md bg-cyan/5 border border-cyan/15 text-[11px] text-cyan">
                    <p className="font-medium mb-0.5">AI Analysis</p>
                    {selectedItem.aiSummary}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="text-muted-foreground">Time:</span> {relativeTime(selectedItem.createdAt)}</div>
                  <div><span className="text-muted-foreground">C2PA:</span> {selectedItem.c2paVerified ? 'Verified' : 'Not Present'}</div>
                  <div><span className="text-muted-foreground">AI Confidence:</span> {selectedItem.aiConfidence != null ? `${Math.round(selectedItem.aiConfidence * 100)}%` : 'N/A'}</div>
                  <div><span className="text-muted-foreground">Dossier:</span> {selectedItem.dossierStatus}</div>
                  {selectedItem.isManipulated && (
                    <div className="col-span-2"><span className="text-muted-foreground">Manipulation:</span> <span className="text-rose">{selectedItem.manipulationType?.replace(/_/g, ' ') || 'Detected'}</span></div>
                  )}
                </div>
                {selectedItem.status === 'QUARANTINED' && (
                  <div className="p-2 rounded-md bg-rose/5 border border-rose/20 text-[11px] text-rose">
                    This media has been quarantined by the AI Defense Engine. Trust & Safety review required before release.
                  </div>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {/* Mobile detail overlay */}
        {selectedItem && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setSelectedItem(null)}>
            <m.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-h-[80vh] bg-card rounded-t-xl p-4 space-y-3 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Media Detail</h4>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedItem(null)}>Close</Button>
              </div>
              <div className={cn('aspect-video rounded-lg bg-gradient-to-br flex items-center justify-center', getGradient(selectedItem.id))}>
                {typeIcon(selectedItem.type)}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {statusBadge(selectedItem.status)}
                  <Badge variant="outline" className="text-[10px]">{selectedItem.type.toUpperCase()}</Badge>
                </div>
                <p className="text-xs font-medium">{selectedItem.title}</p>
                {selectedItem.description && <p className="text-xs text-muted-foreground">{selectedItem.description}</p>}
                {selectedItem.aiSummary && (
                  <div className="p-2 rounded-md bg-cyan/5 border border-cyan/15 text-[11px] text-cyan">
                    <p className="font-medium mb-0.5">AI Analysis</p>
                    {selectedItem.aiSummary}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="text-muted-foreground">Time:</span> {relativeTime(selectedItem.createdAt)}</div>
                  <div><span className="text-muted-foreground">C2PA:</span> {selectedItem.c2paVerified ? 'Verified' : 'Not Present'}</div>
                  <div><span className="text-muted-foreground">AI Confidence:</span> {selectedItem.aiConfidence != null ? `${Math.round(selectedItem.aiConfidence * 100)}%` : 'N/A'}</div>
                  <div><span className="text-muted-foreground">Dossier:</span> {selectedItem.dossierStatus}</div>
                  {selectedItem.isManipulated && (
                    <div className="col-span-2"><span className="text-muted-foreground">Manipulation:</span> <span className="text-rose">{selectedItem.manipulationType?.replace(/_/g, ' ') || 'Detected'}</span></div>
                  )}
                </div>
                {selectedItem.status === 'QUARANTINED' && (
                  <div className="p-2 rounded-md bg-rose/5 border border-rose/20 text-[11px] text-rose">
                    This media has been quarantined by the AI Defense Engine. Trust & Safety review required before release.
                  </div>
                )}
              </div>
            </m.div>
          </div>
        )}
      </div>
    </div>
  );
}

export const MediaGallery = React.memo(MediaGalleryInner);