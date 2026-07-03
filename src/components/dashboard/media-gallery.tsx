'use client';

import { useState } from 'react';
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
  Eye, CheckCircle2, XCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio';
  status: 'VERIFIED' | 'UNVERIFIED' | 'QUARANTINED';
  c2paVerified: boolean;
  incidentType: string;
  incidentSeverity: string;
  reporter: string;
  timestamp: string;
  description: string;
}

// Simulated media items
const MEDIA_ITEMS: MediaItem[] = [
  { id: 'm1', type: 'image', status: 'QUARANTINED', c2paVerified: false, incidentType: 'DEEPFAKE_SUSPECT', incidentSeverity: 'CRITICAL', reporter: 'Aisha Bello', timestamp: '2h ago', description: 'AI-generated ballot stuffing image — GAN artifacts detected' },
  { id: 'm2', type: 'video', status: 'VERIFIED', c2paVerified: true, incidentType: 'VIOLENCE', incidentSeverity: 'HIGH', reporter: 'Segun Ogunleye', timestamp: '1h ago', description: 'Live footage of voter intimidation at polling unit' },
  { id: 'm3', type: 'image', status: 'QUARANTINED', c2paVerified: false, incidentType: 'DEEPFAKE_SUSPECT', incidentSeverity: 'HIGH', reporter: 'Unknown', timestamp: '1.5h ago', description: 'Spliced image — shadow inconsistency detected by CV engine' },
  { id: 'm4', type: 'image', status: 'VERIFIED', c2paVerified: true, incidentType: 'LOGISTICS', incidentSeverity: 'LOW', reporter: 'Ngozi Chukwu', timestamp: '45m ago', description: 'BVAS device malfunction documentation' },
  { id: 'm5', type: 'video', status: 'UNVERIFIED', c2paVerified: false, incidentType: 'INTIMIDATION', incidentSeverity: 'MEDIUM', reporter: 'Tolu Adesanya', timestamp: '30m ago', description: 'Armed individuals near polling station — pending T&S review' },
  { id: 'm6', type: 'audio', status: 'VERIFIED', c2paVerified: true, incidentType: 'OBSERVATION', incidentSeverity: 'LOW', reporter: 'Emeka Eze', timestamp: '20m ago', description: 'Agent voice report: peaceful voting, high turnout' },
  { id: 'm7', type: 'image', status: 'QUARANTINED', c2paVerified: false, incidentType: 'CIB_DETECTED', incidentSeverity: 'CRITICAL', reporter: 'Unknown', timestamp: '10m ago', description: 'Identical image submitted 12 times from different agents — CIB pattern' },
  { id: 'm8', type: 'video', status: 'VERIFIED', c2paVerified: true, incidentType: 'VIOLENCE', incidentSeverity: 'CRITICAL', reporter: 'Olumide Balogun', timestamp: '5m ago', description: 'SOS-triggered stealth recording — agent in distress' },
  { id: 'm9', type: 'image', status: 'UNVERIFIED', c2paVerified: false, incidentType: 'BALLOT_STUFFING', incidentSeverity: 'HIGH', reporter: 'Kola Ahmed', timestamp: '8m ago', description: 'Alleged ballot stuffing — awaiting Trust & Safety review' },
  { id: 'm10', type: 'audio', status: 'QUARANTINED', c2paVerified: false, incidentType: 'DEEPFAKE_SUSPECT', incidentSeverity: 'HIGH', reporter: 'Unknown', timestamp: '12m ago', description: 'Audio-visual desync detected (0.8s offset) — possible AI-generated audio' },
  { id: 'm11', type: 'image', status: 'VERIFIED', c2paVerified: true, incidentType: 'OBSERVATION', incidentSeverity: 'LOW', reporter: 'Fatima Abubakar', timestamp: '15m ago', description: 'Long queue documentation at Ward 3 Unit 7' },
  { id: 'm12', type: 'video', status: 'QUARANTINED', c2paVerified: false, incidentType: 'CIB_DETECTED', incidentSeverity: 'HIGH', reporter: 'Unknown', timestamp: '18m ago', description: 'Coordinated video submissions from same device fingerprint' },
];

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

// Deterministic gradient based on id
function getGradient(id: string) {
  const hash = id.charCodeAt(1) % 6;
  const gradients = [
    'from-emerald/20 to-cyan/20',
    'from-amber/20 to-rose/20',
    'from-violet/20 to-rose/20',
    'from-cyan/20 to-violet/20',
    'from-amber/20 to-violet/20',
    'from-emerald/20 to-amber/20',
  ];
  return gradients[hash];
}

export function MediaGallery() {
  const [filter, setFilter] = useState<string>('ALL');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  const filtered = MEDIA_ITEMS.filter(m => {
    if (filter === 'ALL') return true;
    if (filter === 'QUARANTINED') return m.status === 'QUARANTINED';
    if (filter === 'UNVERIFIED') return m.status === 'UNVERIFIED';
    if (filter === 'VERIFIED') return m.status === 'VERIFIED';
    if (filter === 'NO_C2PA') return !m.c2paVerified;
    return true;
  });

  const counts = {
    all: MEDIA_ITEMS.length,
    quarantined: MEDIA_ITEMS.filter(m => m.status === 'QUARANTINED').length,
    unverified: MEDIA_ITEMS.filter(m => m.status === 'UNVERIFIED').length,
    verified: MEDIA_ITEMS.filter(m => m.status === 'VERIFIED').length,
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-cyan" />
            Media Vault
          </h3>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald" />C2PA Verified</span>
            <span>|</span>
            <span className="flex items-center gap-1"><ShieldAlert className="h-3 w-3 text-rose" />Quarantined</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03, duration: 0.2 }}
                className={cn(
                  'rounded-lg border overflow-hidden cursor-pointer transition-all hover:scale-[1.02]',
                  item.status === 'QUARANTINED' ? 'border-rose/30' :
                  item.status === 'UNVERIFIED' ? 'border-amber/25' :
                  'border-border'
                )}
                onClick={() => setSelectedItem(item)}
              >
                {/* Thumbnail placeholder */}
                <div className={cn('aspect-video bg-gradient-to-br relative', getGradient(item.id))}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {typeIcon(item.type)}
                  </div>
                  {/* Status overlay */}
                  <div className="absolute top-1.5 left-1.5">
                    {statusBadge(item.status)}
                  </div>
                  {/* Type badge */}
                  <div className="absolute top-1.5 right-1.5">
                    <Badge variant="outline" className="bg-black/40 border-white/10 text-white/80 text-[9px] h-4">
                      {item.type.toUpperCase()}
                    </Badge>
                  </div>
                  {/* Quarantine watermark */}
                  {item.status === 'QUARANTINED' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <span className="text-rose font-bold text-xs px-3 py-1 rounded border border-rose/50 bg-black/60 transform rotate-[-15deg]">
                        UNVERIFIED
                      </span>
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="p-2 bg-card/60 space-y-1">
                  <p className="text-[11px] font-medium truncate">{item.reporter}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{item.timestamp}</span>
                    {item.c2paVerified ? (
                      <span className="flex items-center gap-0.5 text-[9px] text-emerald"><ShieldCheck className="h-2.5 w-2.5" />C2PA</span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground"><XCircle className="h-2.5 w-2.5" />No C2PA</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>

        {/* Detail panel */}
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-80 border-l border-border bg-card/40 p-4 space-y-3 shrink-0 hidden lg:block"
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
              <p className="text-xs">{selectedItem.description}</p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-muted-foreground">Reporter:</span> {selectedItem.reporter}</div>
                <div><span className="text-muted-foreground">Time:</span> {selectedItem.timestamp}</div>
                <div><span className="text-muted-foreground">C2PA:</span> {selectedItem.c2paVerified ? 'Verified' : 'Not Present'}</div>
                <div><span className="text-muted-foreground">Incident:</span> {selectedItem.incidentType.replace(/_/g, ' ')}</div>
              </div>
              {selectedItem.status === 'QUARANTINED' && (
                <div className="p-2 rounded-md bg-rose/5 border border-rose/20 text-[11px] text-rose">
                  This media has been quarantined by the AI Defense Engine. Trust & Safety review required before release.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

