'use client';

import { useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FileSearch, ShieldCheck, ScanEye, Globe, Plus, Trash2, Eye,
  Loader2, RefreshCw, Clock, AlertTriangle, CheckCircle2, XCircle,
  FolderOpen, Fingerprint, Activity, Wifi, WifiOff, Signal,
  ChevronDown, ChevronUp, FileWarning, FileQuestion, Zap,
  Database, AlertOctagon, BarChart3, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useDashboardStore } from '@/store/dashboard';
import { toast } from 'sonner';
import { fetchJson } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────

interface EvidenceItem {
  type: string;
  url: string;
  c2paVerified: boolean;
  aiAnalysis: string;
}

interface Dossier {
  id: string;
  title: string;
  description: string;
  evidenceItems: EvidenceItem[];
  c2paSigned: boolean;
  aiSummary: string | null;
  aiConfidence: number;
  status: string;
  createdAt: string;
}

interface NoiseAnalysis {
  mean: number;
  stdDev: number;
  uniformity: number;
}

interface StegoScan {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  isManipulated: boolean;
  manipulationType: string | null;
  confidence: number;
  elaScore: number | null;
  noiseAnalysis: NoiseAnalysis | null;
  metadataDiff: any;
  scanDurationMs: number;
  scannedAt: string;
}

interface EvidenceStats {
  totalDossiers: number;
  byStatus: Record<string, number>;
  totalC2paSigned: number;
  totalStegoScans: number;
  manipulatedCount: number;
  manipulationTypes: Record<string, number>;
  avgAiConfidence: number;
}

interface EcPortalStatus {
  lastScrapeAt: string | null;
  totalScraped: number;
  scrapeErrors: number;
  portalHealth: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
}

interface EvidenceData {
  dossiers: Dossier[];
  stegoScans: StegoScan[];
  stats: EvidenceStats;
  ecPortalStatus: EcPortalStatus;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function statusConfig(status: string) {
  switch (status) {
    case 'DRAFT':
      return { label: 'Draft', cls: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400' };
    case 'REVIEWED':
      return { label: 'Reviewed', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-400' };
    case 'CERTIFIED':
      return { label: 'Certified', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' };
    case 'DISMISSED':
      return { label: 'Dismissed', cls: 'border-rose-500/30 bg-rose-500/10 text-rose-400' };
    default:
      return { label: status, cls: 'border-border bg-card text-muted-foreground' };
  }
}

function confidenceColor(val: number) {
  if (val >= 80) return 'bg-emerald-500';
  if (val >= 60) return 'bg-amber-500';
  return 'bg-rose-500';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

const SCRAPE_LOG_ENTRIES = [
  { relTime: 'Just now', msg: 'Fetched 47 results from INEC portal' },
  { relTime: '14s ago', msg: 'Parsed Form EC8A for 12 LGAs' },
  { relTime: '31s ago', msg: 'Validated C2PA signatures on 8 scanned PDFs' },
  { relTime: '50s ago', msg: 'Detected 2 duplicate entries in ward-level data' },
  { relTime: '1m ago', msg: 'Scraped presidential results for 3 additional states' },
  { relTime: '1m ago', msg: 'Portal session refreshed — new auth token acquired' },
  { relTime: '2m ago', msg: 'Downloaded 31 Form EC8B (senatorial) results' },
  { relTime: '2m ago', msg: 'Compared scraped totals vs official upload — 0.02% delta' },
  { relTime: '2m ago', msg: 'Indexed 156 polling unit result images' },
  { relTime: '3m ago', msg: 'Portal rate-limit hit — backing off 30s before retry' },
];

// ─── Stat Card ───────────────────────────────────────────────────────

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  iconColor: string;
  subtitle?: string;
}

function StatCard({ icon: Icon, label, value, iconColor, subtitle }: StatCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded-md', iconColor)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground truncate">{label}</p>
            <p className="text-base font-bold tabular-nums leading-tight">{value}</p>
            {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function EvidenceDossier() {
  const { tenantId } = useDashboardStore();
  const queryClient = useQueryClient();

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formIncidentId, setFormIncidentId] = useState('');
  const [scanFileName, setScanFileName] = useState('');
  const [scanFileType, setScanFileType] = useState('JPEG');

  // Data fetching
  const { data, isLoading, refetch } = useQuery<EvidenceData>({
    queryKey: ['evidence', tenantId],
    queryFn: () =>
      fetchJson(`/api/evidence?tenantId=${tenantId}`),
    refetchInterval: 15000,
  });

  // Mutation
  const mutation = useMutation({
    mutationFn: (body: any) =>
      fetchJson('/api/evidence?tenantId=' + tenantId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', tenantId] });
    },
    onError: (err) => {
      toast.error('Operation failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    },
  });

  const dossiers = data?.dossiers ?? [];
  const stegoScans = data?.stegoScans ?? [];
  const stats = data?.stats;
  const ecPortal = data?.ecPortalStatus;

  // Handlers
  function handleCreateDossier() {
    if (!formTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    mutation.mutate(
      { action: 'CREATE_DOSSIER', title: formTitle, description: formDesc, incidentId: formIncidentId || undefined },
      {
        onSuccess: () => {
          toast.success('Dossier created');
          setCreateOpen(false);
          setFormTitle('');
          setFormDesc('');
          setFormIncidentId('');
        },
        onError: () => toast.error('Failed to create dossier'),
      },
    );
  }

  function handleReviewDossier(status: 'CERTIFIED' | 'DISMISSED') {
    if (!selectedDossier) return;
    mutation.mutate(
      { action: 'REVIEW_DOSSIER', dossierId: selectedDossier.id, status },
      {
        onSuccess: () => {
          toast.success(`Dossier ${status.toLowerCase()}`);
          setReviewOpen(false);
          setSelectedDossier(null);
        },
        onError: () => toast.error('Failed to update dossier'),
      },
    );
  }

  function handleDeleteDossier() {
    if (!selectedDossier) return;
    mutation.mutate(
      { action: 'DELETE_DOSSIER', dossierId: selectedDossier.id },
      {
        onSuccess: () => {
          toast.success('Dossier deleted');
          setDeleteOpen(false);
          setSelectedDossier(null);
        },
        onError: () => toast.error('Failed to delete dossier'),
      },
    );
  }

  function handleScan() {
    if (!scanFileName.trim()) {
      toast.error('File name is required');
      return;
    }
    mutation.mutate(
      { action: 'SCAN_STEGO', fileName: scanFileName, fileType: scanFileType },
      {
        onSuccess: () => {
          toast.success('Steganography scan initiated');
          setScanOpen(false);
          setScanFileName('');
          setScanFileType('JPEG');
        },
        onError: () => toast.error('Failed to initiate scan'),
      },
    );
  }

  // ─── Loading State ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">Loading evidence data...</p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="dossiers" className="h-full flex flex-col">
        {/* Tab bar */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <TabsList className="h-9">
            <TabsTrigger value="dossiers" className="gap-1.5 text-xs">
              <FolderOpen className="h-3.5 w-3.5" />
              Evidence Dossiers
            </TabsTrigger>
            <TabsTrigger value="stego" className="gap-1.5 text-xs">
              <ScanEye className="h-3.5 w-3.5" />
              Stego Analysis
            </TabsTrigger>
            <TabsTrigger value="ecportal" className="gap-1.5 text-xs">
              <Globe className="h-3.5 w-3.5" />
              EC Portal
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Tab 1: Evidence Dossiers ───────────────────────────── */}
        <TabsContent value="dossiers" className="flex-1 min-h-0 flex flex-col px-4 pb-4">
          {/* Stats row */}
          <div className="grid grid-cols-5 gap-2 mb-3 shrink-0">
            <StatCard
              icon={FolderOpen}
              label="Total Dossiers"
              value={stats?.totalDossiers ?? 0}
              iconColor="bg-foreground/10"
            />
            <StatCard
              icon={CheckCircle2}
              label="Certified"
              value={stats?.byStatus?.CERTIFIED ?? 0}
              iconColor="bg-emerald-500/15 text-emerald-400"
            />
            <StatCard
              icon={Fingerprint}
              label="C2PA Signed"
              value={stats?.totalC2paSigned ?? 0}
              iconColor="bg-cyan-500/15 text-cyan-400"
            />
            <StatCard
              icon={Eye}
              label="Under Review"
              value={(stats?.byStatus?.REVIEWED ?? 0) + (stats?.byStatus?.DRAFT ?? 0)}
              iconColor="bg-amber-500/15 text-amber-400"
            />
            <StatCard
              icon={BarChart3}
              label="AI Avg Confidence"
              value={`${(stats?.avgAiConfidence ?? 0).toFixed(1)}%`}
              iconColor="bg-foreground/10"
            />
          </div>

          {/* Create button */}
          <div className="flex justify-end mb-3 shrink-0">
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Create Dossier
            </Button>
          </div>

          {/* Dossier grid */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-4">
              {dossiers.map((d, idx) => {
                const sc = statusConfig(d.status);
                return (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.25 }}
                  >
                    <Card className="bg-card border-border hover:border-foreground/20 transition-colors">
                      <CardContent className="p-4">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold truncate">{d.title}</h4>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {formatDate(d.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {d.c2paSigned && (
                              <Badge className="text-[10px] h-5 border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                                <Fingerprint className="h-2.5 w-2.5 mr-0.5" />
                                C2PA
                              </Badge>
                            )}
                            <Badge className={cn('text-[10px] h-5 border', sc.cls)}>
                              {sc.label}
                            </Badge>
                          </div>
                        </div>

                        {/* AI confidence */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground">AI Confidence</span>
                            <span className={cn('text-[11px] font-medium tabular-nums',
                              d.aiConfidence >= 80 ? 'text-emerald-400' : d.aiConfidence >= 60 ? 'text-amber-400' : 'text-rose-400'
                            )}>
                              {d.aiConfidence.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-foreground/10 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all', confidenceColor(d.aiConfidence))}
                              style={{ width: `${Math.max(0, Math.min(100, d.aiConfidence))}%` }}
                            />
                          </div>
                        </div>

                        {/* AI summary */}
                        {d.aiSummary && (
                          <p className="text-[11px] text-muted-foreground line-clamp-3 mb-2.5">
                            {d.aiSummary}
                          </p>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <FileSearch className="h-3 w-3" />
                              {d.evidenceItems?.length ?? 0} items
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[10px] gap-1 px-2"
                              onClick={() => { setSelectedDossier(d); setReviewOpen(true); }}
                            >
                              <Eye className="h-3 w-3" />
                              Review
                            </Button>
                            <AlertDialog open={deleteOpen && selectedDossier?.id === d.id} onOpenChange={(open) => { if (!open) setSelectedDossier(null); setDeleteOpen(open); }}>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-[10px] gap-1 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                  onClick={() => { setSelectedDossier(d); setDeleteOpen(true); }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Dossier</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete &quot;{d.title}&quot;? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setSelectedDossier(null)}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-rose-600 hover:bg-rose-700 text-white"
                                    onClick={handleDeleteDossier}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}

              {dossiers.length === 0 && (
                <div className="col-span-2 text-center py-16 text-muted-foreground">
                  <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No dossiers yet</p>
                  <p className="text-xs mt-1">Create your first evidence dossier to get started.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ── Tab 2: Stego Analysis ──────────────────────────────── */}
        <TabsContent value="stego" className="flex-1 min-h-0 flex flex-col px-4 pb-4">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 mb-3 shrink-0">
            <StatCard
              icon={ScanEye}
              label="Total Scans"
              value={stats?.totalStegoScans ?? 0}
              iconColor="bg-foreground/10"
            />
            <StatCard
              icon={AlertOctagon}
              label="Manipulated"
              value={stats?.manipulatedCount ?? 0}
              iconColor="bg-rose-500/15 text-rose-400"
            />
            <StatCard
              icon={CheckCircle2}
              label="Clean"
              value={(stats?.totalStegoScans ?? 0) - (stats?.manipulatedCount ?? 0)}
              iconColor="bg-emerald-500/15 text-emerald-400"
            />
            <StatCard
              icon={BarChart3}
              label="Avg Confidence"
              value={stegoScans.length > 0
                ? `${(stegoScans.reduce((sum, s) => sum + s.confidence, 0) / stegoScans.length).toFixed(1)}%`
                : '0%'}
              iconColor="bg-foreground/10"
            />
          </div>

          {/* Scan button */}
          <div className="flex justify-end mb-3 shrink-0">
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setScanOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Scan File
            </Button>
          </div>

          {/* Scan results table */}
          <ScrollArea className="flex-1 min-h-0">
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-[10px] h-9">File Name</TableHead>
                      <TableHead className="text-[10px] h-9">Type</TableHead>
                      <TableHead className="text-[10px] h-9">Size</TableHead>
                      <TableHead className="text-[10px] h-9">Status</TableHead>
                      <TableHead className="text-[10px] h-9">Manipulation</TableHead>
                      <TableHead className="text-[10px] h-9 text-right">Confidence</TableHead>
                      <TableHead className="text-[10px] h-9 text-right">ELA Score</TableHead>
                      <TableHead className="text-[10px] h-9 text-right">Duration</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stegoScans.map((scan) => (
                      <Fragment key={scan.id}>
                        <TableRow
                          className="border-border cursor-pointer"
                          onClick={() => setExpandedRow(expandedRow === scan.id ? null : scan.id)}
                        >
                          <TableCell className="text-xs font-medium py-2.5">{scan.fileName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{scan.fileType}</TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">{formatBytes(scan.fileSize)}</TableCell>
                          <TableCell>
                            {scan.isManipulated ? (
                              <Badge className="text-[10px] h-5 border border-rose-500/30 bg-rose-500/10 text-rose-400">
                                Manipulated
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] h-5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                                Clean
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {scan.manipulationType ? (
                              <span className="text-xs text-rose-400 font-medium">{scan.manipulationType}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            <span className={cn(
                              scan.confidence >= 80 ? 'text-rose-400' : scan.confidence >= 60 ? 'text-amber-400' : 'text-muted-foreground'
                            )}>
                              {scan.confidence.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                            {scan.elaScore !== null ? scan.elaScore.toFixed(2) : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                            {formatDuration(scan.scanDurationMs)}
                          </TableCell>
                          <TableCell>
                            {expandedRow === scan.id
                              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            }
                          </TableCell>
                        </TableRow>
                        {expandedRow === scan.id && scan.noiseAnalysis && (
                          <TableRow className="border-border bg-muted/20">
                            <TableCell colSpan={9} className="py-3 px-4">
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-0.5">Noise Mean</p>
                                  <p className="text-xs font-medium tabular-nums">{scan.noiseAnalysis.mean.toFixed(4)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-0.5">Noise Std Dev</p>
                                  <p className="text-xs font-medium tabular-nums">{scan.noiseAnalysis.stdDev.toFixed(4)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-0.5">Noise Uniformity</p>
                                  <p className="text-xs font-medium tabular-nums">{scan.noiseAnalysis.uniformity.toFixed(4)}</p>
                                </div>
                              </div>
                              {scan.metadataDiff && Object.keys(scan.metadataDiff).length > 0 && (
                                <div className="mt-2 pt-2 border-t border-border">
                                  <p className="text-[10px] text-muted-foreground mb-1">Metadata Differences</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(scan.metadataDiff).map(([key, val]) => (
                                      <Badge key={key} variant="outline" className="text-[10px] h-5">
                                        {key}: <span className="text-rose-400 ml-1">{String(val)}</span>
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}

                    {stegoScans.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="h-32 text-center">
                          <div className="text-muted-foreground">
                            <ScanEye className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No scans yet</p>
                            <p className="text-xs mt-1">Run a steganography analysis to detect manipulation.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </ScrollArea>
        </TabsContent>

        {/* ── Tab 3: EC Portal Interrogator ───────────────────────── */}
        <TabsContent value="ecportal" className="flex-1 min-h-0 flex flex-col px-4 pb-4">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-cyan-400" />
              EC Portal Interrogator
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-3 w-3" />
              Auto-Refresh
            </Button>
          </div>

          {/* Portal health card */}
          <Card className="bg-card border-border mb-3 shrink-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  'relative flex items-center justify-center w-12 h-12 rounded-full',
                  ecPortal?.portalHealth === 'ONLINE' && 'bg-emerald-500/15',
                  ecPortal?.portalHealth === 'DEGRADED' && 'bg-amber-500/15',
                  ecPortal?.portalHealth === 'OFFLINE' && 'bg-rose-500/15',
                )}>
                  {ecPortal?.portalHealth === 'ONLINE' && (
                    <Wifi className="h-5 w-5 text-emerald-400" />
                  )}
                  {ecPortal?.portalHealth === 'DEGRADED' && (
                    <Signal className="h-5 w-5 text-amber-400" />
                  )}
                  {ecPortal?.portalHealth === 'OFFLINE' && (
                    <WifiOff className="h-5 w-5 text-rose-400" />
                  )}
                  {ecPortal?.portalHealth === 'ONLINE' && (
                    <span className="absolute inset-0 rounded-full border-2 border-emerald-400/50 animate-ping" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={cn(
                      'text-[10px] h-5 border',
                      ecPortal?.portalHealth === 'ONLINE' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                      ecPortal?.portalHealth === 'DEGRADED' && 'border-amber-500/30 bg-amber-500/10 text-amber-400',
                      ecPortal?.portalHealth === 'OFFLINE' && 'border-rose-500/30 bg-rose-500/10 text-rose-400',
                    )}>
                      {ecPortal?.portalHealth}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Portal Health</span>
                  </div>
                  <p className="text-sm font-medium">
                    {ecPortal?.portalHealth === 'ONLINE' && 'All systems operational'}
                    {ecPortal?.portalHealth === 'DEGRADED' && 'Experiencing intermittent issues'}
                    {ecPortal?.portalHealth === 'OFFLINE' && 'Portal unreachable'}
                  </p>
                </div>
              </div>

              <Separator className="my-3 bg-border" />

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" /> Last Scrape
                  </p>
                  <p className="text-sm font-medium mt-0.5">{ecPortal?.lastScrapeAt ? timeAgo(ecPortal.lastScrapeAt) : 'Never'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Database className="h-2.5 w-2.5" /> Total Scraped
                  </p>
                  <p className="text-sm font-medium mt-0.5 tabular-nums">{(ecPortal?.totalScraped ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" /> Scrape Errors
                  </p>
                  <p className="text-sm font-medium mt-0.5 tabular-nums">{ecPortal?.scrapeErrors ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scrape log */}
          <Card className="bg-card border-border flex-1 min-h-0 flex flex-col">
            <CardContent className="p-4 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center gap-2 mb-3 shrink-0">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                <h4 className="text-xs font-semibold">Scrape Log</h4>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-1.5 pb-2">
                  {SCRAPE_LOG_ENTRIES.map((entry, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.2 }}
                      className="flex items-start gap-3 py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 mt-px">
                        {entry.relTime}
                      </span>
                      <span className="text-[11px] text-foreground/80">{entry.msg}</span>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Create Dossier Dialog ─────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Evidence Dossier</DialogTitle>
            <DialogDescription>
              Compile evidence items into a verifiable dossier with AI analysis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dossier-title" className="text-xs">Title <span className="text-rose-400">*</span></Label>
              <Input
                id="dossier-title"
                placeholder="e.g. Ballot Box Snatching — Ward 12"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dossier-desc" className="text-xs">Description</Label>
              <Textarea
                id="dossier-desc"
                placeholder="Describe the evidence being compiled..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dossier-incident" className="text-xs">Incident ID (optional)</Label>
              <Input
                id="dossier-incident"
                placeholder="Link to an existing incident"
                value={formIncidentId}
                onChange={(e) => setFormIncidentId(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateDossier} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Review Dossier Dialog ─────────────────────────────────── */}
      <Dialog open={reviewOpen} onOpenChange={(open) => { if (!open) setSelectedDossier(null); setReviewOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Dossier</DialogTitle>
            <DialogDescription>
              Certify this dossier as verified evidence or dismiss it.
            </DialogDescription>
          </DialogHeader>
          {selectedDossier && (
            <div className="space-y-3">
              <Card className="bg-muted/30 border-border">
                <CardContent className="p-3">
                  <p className="text-sm font-semibold">{selectedDossier.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {selectedDossier.evidenceItems?.length ?? 0} evidence items · AI Confidence: {selectedDossier.aiConfidence.toFixed(1)}%
                  </p>
                  {selectedDossier.aiSummary && (
                    <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-3">{selectedDossier.aiSummary}</p>
                  )}
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground">
                {selectedDossier.c2paSigned
                  ? 'This dossier includes C2PA-signed evidence items for cryptographic verification.'
                  : 'No C2PA signatures found on evidence items in this dossier.'}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
              onClick={() => handleReviewDossier('DISMISSED')}
              disabled={mutation.isPending}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Dismiss
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleReviewDossier('CERTIFIED')}
              disabled={mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              Certify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Scan Stego Dialog ─────────────────────────────────────── */}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Steganography Analysis</DialogTitle>
            <DialogDescription>
              Run AI-powered steganography and ELA analysis on a file to detect manipulation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="scan-file" className="text-xs">File Name <span className="text-rose-400">*</span></Label>
              <Input
                id="scan-file"
                placeholder="e.g. ballot_photo_ward12.jpg"
                value={scanFileName}
                onChange={(e) => setScanFileName(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">File Type</Label>
              <Select value={scanFileType} onValueChange={setScanFileType}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JPEG">JPEG</SelectItem>
                  <SelectItem value="PNG">PNG</SelectItem>
                  <SelectItem value="MP4">MP4</SelectItem>
                  <SelectItem value="WAV">WAV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setScanOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleScan} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              <ScanEye className="h-3.5 w-3.5 mr-1" />
              Scan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}