'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardStore } from '@/store/dashboard';
import {
  Clock, MapPin, ShieldCheck, CheckCircle2, AlertTriangle, Eye,
  Vote, FileWarning, BarChart3, TrendingUp, Users, Loader2,
  ChevronDown, ChevronUp, CircleDot, UserCircle,
} from 'lucide-react';
import { MediaViewer, MediaThumbnailStrip, type MediaFile } from '@/components/dashboard/media-viewer';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ---- Types ----
interface ReporterInfo {
  id: string; name: string; role: string; phone: string | null;
}

interface ReportResult {
  id: string;
  accreditedVoters: number;
  totalValidVotes: number;
  rejectedBallots: number;
  totalVotesCast: number;
  partyResults: { party: string; name: string; votes: number; color: string }[];
  bvasUsed: boolean;
  materialsArrivedOnTime: boolean;
  securityPresent: boolean;
  violenceOccurred: boolean;
  notes: string;
  verified: boolean;
  submittedAt: string;
  pollingUnit: { id: string; name: string; code: string; state: string; lga: string; ward: string; registeredVoters: number } | null;
  reporter?: ReporterInfo;
}

interface ReportIncident {
  id: string;
  type: string;
  severity: string;
  status: string;
  description: string;
  mediaUrls: string[];
  gpsAnomaly: boolean;
  isQuarantined: boolean;
  c2paVerified: boolean;
  submittedAt: string;
  reviewedAt: string | null;
  pollingUnit: { id: string; name: string; code: string; state: string; lga: string } | null;
  reporter?: ReporterInfo;
}

interface ReportsData {
  results: ReportResult[];
  incidents: ReportIncident[];
  counts: {
    totalResults: number;
    totalIncidents: number;
    resultsToday: number;
    incidentsToday: number;
  };
  agents?: { id: string; name: string; email: string }[];
  page?: number;
  hasMore?: boolean;
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'];

// ---- Helpers ----
function formatTime(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
  return d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function sevColor(s: string) {
  switch (s) {
    case 'CRITICAL': return 'bg-rose text-white border-rose/40';
    case 'HIGH': return 'bg-amber/15 text-amber border-amber/30';
    case 'MEDIUM': return 'bg-cyan/15 text-cyan border-cyan/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function statusStyle(status: string) {
  switch (status) {
    case 'REVIEWED': return 'border-emerald/30 text-emerald';
    case 'ESCALATED': return 'border-rose/30 text-rose';
    case 'DISMISSED': return 'border-muted text-muted-foreground';
    case 'QUARANTINED': return 'border-rose/30 text-rose';
    default: return 'border-amber/30 text-amber';
  }
}

const TYPE_LABELS: Record<string, string> = {
  VIOLENCE: 'Violence',
  INTIMIDATION: 'Voter Intimidation',
  BALLOT_STUFFING: 'Ballot Stuffing',
  BRIBERY: 'Bribery / Vote Buying',
  UNDERAGE_VOTING: 'Underage Voting',
  MULTIPLE_VOTING: 'Multiple Voting',
  SNATCHED_BALLOT: 'Snatched Ballot Box',
  IMPEDIMENT: 'Impediment to Voting',
  LOGISTICS: 'Logistics Issue',
  BVAS_FAILURE: 'BVAS / Tech Failure',
  OBSERVATION: 'Observation',
};

// ---- Main Component ----
export function MyReports() {
  const { user, tenantId } = useDashboardStore();
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  const isAdmin = user?.role ? ADMIN_ROLES.includes(user.role) : false;

  // Build query params based on role
  const queryParams = isAdmin
    ? `all=true&tenantId=${tenantId}${selectedAgent !== 'all' ? `&agentId=${selectedAgent}` : ''}&limit=100`
    : `reporterId=${user!.id}`;

  const { data, isLoading, error, refetch } = useQuery<ReportsData>({
    queryKey: ['reports', isAdmin ? 'all' : user?.id, selectedAgent, tenantId],
    queryFn: () => fetchJson(`/api/reports?${queryParams}`),
    enabled: !!user?.id && !!tenantId,
    refetchInterval: 15000,
  });

  const results = data?.results || [];
  const incidents = data?.incidents || [];
  const agents = data?.agents || [];
  const counts = data?.counts || { totalResults: 0, totalIncidents: 0, resultsToday: 0, incidentsToday: 0 };

  // Merge and sort all reports by time for "All" tab
  const allReports = [
    ...results.map(r => ({ ...r, _type: 'result' as const })),
    ...incidents.map(i => ({ ...i, _type: 'incident' as const })),
  ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-emerald mx-auto" />
          <p className="text-sm text-muted-foreground">{isAdmin ? 'Loading all reports...' : 'Loading your reports...'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-6 w-6 text-amber mx-auto" />
          <p className="text-sm text-muted-foreground">Failed to load reports</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-cyan" />
              {isAdmin ? 'All Agent Reports' : 'My Submission History'}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {counts.totalResults + counts.totalIncidents} total reports
              {isAdmin && ` from ${agents.length} agents`}
            </p>
          </div>
          {isAdmin && agents.length > 0 && (
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="h-8 w-48 text-[11px]">
                <UserCircle className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Filter by agent..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Agents</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    <span className="flex items-center gap-2">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {a.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Summary stats strip */}
      <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-border shrink-0 bg-card/30">
        <StatPill label="Results Today" value={counts.resultsToday} icon={<Vote className="h-3.5 w-3.5" />} color="text-emerald" />
        <StatPill label="Incidents Today" value={counts.incidentsToday} icon={<FileWarning className="h-3.5 w-3.5" />} color="text-rose" />
        <StatPill label="Total Results" value={counts.totalResults} icon={<BarChart3 className="h-3.5 w-3.5" />} color="text-cyan" />
        <StatPill label="Total Incidents" value={counts.totalIncidents} icon={<AlertTriangle className="h-3.5 w-3.5" />} color="text-amber" />
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="all" className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-2 shrink-0">
          <TabsList className="h-9 bg-card/60 border border-border w-full">
            <TabsTrigger value="all" className="text-xs h-7 flex-1 gap-1.5">
              <CircleDot className="h-3 w-3" /> All ({allReports.length})
            </TabsTrigger>
            <TabsTrigger value="results" className="text-xs h-7 flex-1 gap-1.5">
              <Vote className="h-3 w-3" /> Results ({results.length})
            </TabsTrigger>
            <TabsTrigger value="incidents" className="text-xs h-7 flex-1 gap-1.5">
              <FileWarning className="h-3 w-3" /> Incidents ({incidents.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="flex-1 min-h-0 mt-0">
          <ReportList reports={allReports} expandedResult={expandedResult} setExpandedResult={setExpandedResult} showReporter={isAdmin} />
        </TabsContent>
        <TabsContent value="results" className="flex-1 min-h-0 mt-0">
          <ReportList reports={results.map(r => ({ ...r, _type: 'result' as const }))} expandedResult={expandedResult} setExpandedResult={setExpandedResult} showReporter={isAdmin} />
        </TabsContent>
        <TabsContent value="incidents" className="flex-1 min-h-0 mt-0">
          <ReportList reports={incidents.map(i => ({ ...i, _type: 'incident' as const }))} expandedResult={expandedResult} setExpandedResult={setExpandedResult} showReporter={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- Stat Pill ----
function StatPill({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-1">
      <div className="flex items-center gap-1">
        <span className={color}>{icon}</span>
        <span className={cn('text-base font-bold tabular-nums', color)}>{value}</span>
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

// ---- Report List ----
function ReportList({ reports, expandedResult, setExpandedResult, showReporter }: {
  reports: Array<{ id: string; type: string; [key: string]: unknown }>;
  expandedResult: string | null;
  setExpandedResult: (id: string | null) => void;
  showReporter: boolean;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFiles, setViewerFiles] = useState<MediaFile[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerTitle, setViewerTitle] = useState('');

  const openMedia = useCallback((urls: string[], index: number, title: string) => {
    const files: MediaFile[] = urls.map(url => ({
      url,
      type: getMediaTypeFromUrl(url),
    }));
    setViewerFiles(files);
    setViewerIndex(index);
    setViewerTitle(title);
    setViewerOpen(true);
  }, []);

  if (reports.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <FileWarning className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No reports found</p>
          <p className="text-[11px] text-muted-foreground/60">
            {showReporter ? 'No reports match the current filter' : 'Submit your first report from the Submit tab'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        <AnimatePresence>
          {reports.map((report, idx) => {
            const isResult = report._type === 'result';

            if (isResult) {
              const r = report as ReportResult & { _type: 'result' };
              const isExpanded = expandedResult === r.id;
              const turnout = r.accreditedVoters > 0 ? Math.round((r.totalVotesCast / r.accreditedVoters) * 10000) / 100 : 0;
              const winner = r.partyResults?.length > 0 ? [...r.partyResults].sort((a, b) => b.votes - a.votes)[0] : null;

              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx, 20) * 0.03, duration: 0.2 }}
                  className="rounded-lg border border-border bg-card/60 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedResult(isExpanded ? null : r.id)}
                    className="w-full text-left p-3 space-y-2 hover:bg-card/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-emerald/15 text-emerald border-emerald/30 text-[10px] h-5">
                        <Vote className="h-2.5 w-2.5 mr-1" /> RESULT
                      </Badge>
                      {r.verified && (
                        <Badge className="bg-emerald text-white text-[10px] h-5 border-0">
                          <ShieldCheck className="h-2.5 w-2.5 mr-1" /> VERIFIED
                        </Badge>
                      )}
                      {showReporter && r.reporter && (
                        <Badge variant="outline" className="text-[10px] h-5">
                          <UserCircle className="h-2.5 w-2.5 mr-1" />
                          {r.reporter.name}
                        </Badge>
                      )}
                      <Badge variant="outline" className={cn('text-[10px] h-5 ml-auto', !r.verified ? 'border-amber/30 text-amber' : '')}>
                        {r.verified ? 'Verified' : 'Pending Review'}
                      </Badge>
                    </div>

                    {r.pollingUnit && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="font-medium text-foreground/80">{r.pollingUnit.name}</span>
                        <span className="text-muted-foreground/50">({r.pollingUnit.code})</span>
                        <span className="text-muted-foreground/50">{r.pollingUnit.state}/{r.pollingUnit.lga}</span>
                      </div>
                    )}

                    {/* Quick stats row */}
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <MiniStat label="Accredited" value={r.accreditedVoters} />
                      <MiniStat label="Valid Votes" value={r.totalValidVotes} color="text-emerald" />
                      <MiniStat label="Rejected" value={r.rejectedBallots} color="text-amber" />
                      <MiniStat label="Turnout" value={`${turnout}%`} color="text-cyan" />
                    </div>

                    {/* Winner bar */}
                    {winner && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium" style={{ color: winner.color }}>{winner.party}: {winner.votes.toLocaleString()}</span>
                          <span className="text-muted-foreground">Leading</span>
                        </div>
                        <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
                          {r.partyResults.map(pr => (
                            <div
                              key={pr.party}
                              className="h-full transition-all"
                              style={{
                                width: `${r.totalVotesCast > 0 ? (pr.votes / r.totalVotesCast) * 100 : 0}%`,
                                backgroundColor: pr.color,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(r.submittedAt)}</span>
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 pt-3 space-y-3 border-t border-border/50">
                          {/* Full party breakdown table */}
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium text-muted-foreground">Full Party Breakdown</p>
                            <div className="rounded-lg border border-border overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-background/80">
                                    <th className="text-left py-1.5 px-2.5 font-medium text-muted-foreground">Party</th>
                                    <th className="text-right py-1.5 px-2.5 font-medium text-muted-foreground">Votes</th>
                                    <th className="text-right py-1.5 px-2.5 font-medium text-muted-foreground">Share</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[...r.partyResults].sort((a, b) => b.votes - a.votes).map((pr, i) => {
                                    const share = r.totalValidVotes > 0 ? ((pr.votes / r.totalValidVotes) * 100).toFixed(1) : '0.0';
                                    return (
                                      <tr key={pr.party} className={cn('border-t border-border/50', i === 0 && 'bg-emerald/5')}>
                                        <td className="py-1.5 px-2.5 flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: pr.color }} />
                                          <span className="font-medium">{pr.party}</span>
                                          {i === 0 && <TrendingUp className="h-3 w-3 text-emerald" />}
                                        </td>
                                        <td className="text-right py-1.5 px-2.5 tabular-nums font-medium">{pr.votes.toLocaleString()}</td>
                                        <td className="text-right py-1.5 px-2.5 tabular-nums text-muted-foreground">{share}%</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Polling unit stats */}
                          <div className="grid grid-cols-2 gap-2">
                            <StatToggle label="BVAS Used" value={r.bvasUsed} />
                            <StatToggle label="Materials On Time" value={r.materialsArrivedOnTime} />
                            <StatToggle label="Security Present" value={r.securityPresent} />
                            <StatToggle label="Violence Occurred" value={r.violenceOccurred} danger />
                          </div>

                          {r.notes && (
                            <div className="rounded-lg bg-background border border-border p-2.5">
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">Agent Notes</p>
                              <p className="text-xs text-foreground/80">{r.notes}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            }

            // Incident card
            const inc = report as ReportIncident & { _type: 'incident' };
            return (
              <motion.div
                key={inc.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx, 20) * 0.03, duration: 0.2 }}
                className="rounded-lg border border-border bg-card/60 p-3 space-y-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={cn('text-[10px] h-5 border', sevColor(inc.severity))}>
                    {inc.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {TYPE_LABELS[inc.type] || inc.type.replace(/_/g, ' ')}
                  </Badge>
                  {showReporter && inc.reporter && (
                    <Badge variant="outline" className="text-[10px] h-5">
                      <UserCircle className="h-2.5 w-2.5 mr-1" />
                      {inc.reporter.name}
                    </Badge>
                  )}
                  <Badge variant="outline" className={cn('text-[10px] h-5 ml-auto', statusStyle(inc.status))}>
                    {inc.status === 'REVIEWED' && <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
                    {inc.status}
                  </Badge>
                </div>

                <p className="text-xs text-foreground/80 leading-relaxed">{inc.description}</p>

                {/* Media thumbnails */}
                {inc.mediaUrls && inc.mediaUrls.length > 0 && (
                  <MediaThumbnailStrip
                    mediaUrls={inc.mediaUrls}
                    onOpen={(i) => openMedia(inc.mediaUrls, i, `${inc.type} — ${inc.pollingUnit?.name || 'Incident'}`)}
                    size="sm"
                  />
                )}

                <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(inc.submittedAt)}</span>
                  {inc.pollingUnit && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{inc.pollingUnit.name} ({inc.pollingUnit.code})</span>
                  )}
                  {inc.gpsAnomaly && (
                    <Badge variant="outline" className="text-[9px] h-4 border-rose/30 text-rose">GPS ANOMALY</Badge>
                  )}
                  {inc.isQuarantined && (
                    <Badge variant="outline" className="text-[9px] h-4 border-amber/30 text-amber">QUARANTINED</Badge>
                  )}
                  {inc.c2paVerified && (
                    <span className="flex items-center gap-1 text-emerald"><ShieldCheck className="h-3 w-3" />C2PA</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ScrollArea>
    <MediaViewer
      files={viewerFiles}
      initialIndex={viewerIndex}
      open={viewerOpen}
      onClose={() => setViewerOpen(false)}
      title={viewerTitle}
    />
    </>
  );
}

// ---- Mini Stat ----
function MiniStat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div>
      <p className={cn('text-sm font-bold tabular-nums', color || 'text-foreground')}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ---- Stat Toggle ----
function StatToggle({ label, value, danger }: { label: string; value: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cn(
        'w-2 h-2 rounded-full shrink-0',
        value ? (danger ? 'bg-rose' : 'bg-emerald') : 'bg-muted-foreground/30'
      )} />
      <span className={cn('text-[11px]', danger && value ? 'text-rose' : 'text-muted-foreground')}>{label}</span>
    </div>
  );
}

// ---- Inline SVG icons ----
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polygon points="5,3 19,12 5,21" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function getMediaTypeFromUrl(url: string): 'image' | 'video' | 'audio' {
  const lower = url.toLowerCase();
  if (/\.(mp4|mov|avi|webm|mkv)/.test(lower)) return 'video';
  if (/\.(mp3|ogg|wav|m4a|aac)/.test(lower)) return 'audio';
  return 'image';
}