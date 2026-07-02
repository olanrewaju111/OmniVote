'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { useDashboardStore } from '@/store/dashboard';
import {
  Loader2,
  BarChart3,
  GitCompareArrows,
  Percent,
  Trophy,
  Clock,
  MapPin,
  Smartphone,
  MessageCircle,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PvtData {
  pvtSubmissions: Array<{
    id: string;
    pollingUnit: { name: string; code: string; state: string; lga: string };
    partyResults: Array<{ party: string; votes: number }>;
    accreditedVoters: number;
    totalValidVotes: number;
    rejectedBallots: number;
    totalVotesCast: number;
    source: string;
    isVerified: boolean;
    submittedAt: string;
  }>;
  comparisons: Array<{
    id: string;
    pollingUnit: { name: string; code: string; state: string };
    totalPvtVotes: number;
    totalOfficialVotes: number;
    totalDelta: number;
    deltaPct: number;
    isAnomaly: boolean;
    anomalyReason: string | null;
    partyDeltas: Array<{
      party: string;
      pvtVotes: number;
      officialVotes: number;
      delta: number;
      deltaPct: number;
    }>;
  }>;
  stats: {
    totalSubmissions: number;
    verifiedCount: number;
    unitsWithComparison: number;
    anomalyCount: number;
    bySource: Record<string, number>;
    byState: Record<string, number>;
  };
  sankeyData: {
    nodes: Array<{ id: string; label: string; color: string }>;
    links: Array<{
      source: string;
      target: string;
      value: number;
      state: string;
    }>;
  };
  partyTotals: Array<{ party: string; votes: number }>;
  coverage: {
    totalPollingUnits: number;
    pvtCoveredUnits: number;
    coveragePct: number;
  };
}

interface SankeyLinkPath {
  source: string;
  target: string;
  value: number;
  state: string;
  color: string;
  path: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  linkH: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PARTY_COLORS: Record<string, string> = {
  APC: '#00A651',
  PDP: '#E21A2B',
  LP: '#008751',
  NNPP: '#FF6B00',
};
const DEFAULT_PARTY_COLOR = '#6B7280';

function getPartyColor(party: string): string {
  return PARTY_COLORS[party] || DEFAULT_PARTY_COLOR;
}

const SOURCE_STYLES: Record<string, { label: string; className: string }> = {
  MOBILE: { label: 'Mobile', className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  WHATSAPP: { label: 'WhatsApp', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  PAPER: { label: 'Paper', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
};

// ─── Sankey Layout Engine ────────────────────────────────────────────────────

function buildSankeyLayout(
  sankeyData: PvtData['sankeyData'],
  svgW: number,
  svgH: number,
): {
  nodeRects: Record<string, { x: number; y: number; w: number; h: number; label: string; color: string; isLeft: boolean }>;
  linkPaths: SankeyLinkPath[];
} {
  const { nodes, links } = sankeyData;
  if (!links.length) return { nodeRects: {}, linkPaths: [] };

  const sourceIds = new Set(links.map((l) => l.source));
  const targetIds = new Set(links.map((l) => l.target));
  const leftNodes = nodes.filter((n) => sourceIds.has(n.id));
  const rightNodes = nodes.filter((n) => targetIds.has(n.id));

  // Total flow per node
  const nodeTotals: Record<string, number> = {};
  for (const link of links) {
    nodeTotals[link.source] = (nodeTotals[link.source] || 0) + link.value;
    nodeTotals[link.target] = (nodeTotals[link.target] || 0) + link.value;
  }

  // Scale: total flow on one side (they should be equal)
  const totalLeftFlow = leftNodes.reduce((s, n) => s + (nodeTotals[n.id] || 0), 0);
  const totalRightFlow = rightNodes.reduce((s, n) => s + (nodeTotals[n.id] || 0), 0);
  const maxFlow = Math.max(totalLeftFlow, totalRightFlow, 1);

  const padTop = 16;
  const padBot = 16;
  const availH = svgH - padTop - padBot;
  const nodeW = 14;
  const labelLeftW = 130;
  const labelRightW = 130;
  const leftX = labelLeftW;
  const rightX = svgW - labelRightW - nodeW;

  const scale = availH / maxFlow;

  const nodeRects: Record<
    string,
    { x: number; y: number; w: number; h: number; label: string; color: string; isLeft: boolean }
  > = {};

  // Position left nodes
  let yOff = padTop;
  for (const node of leftNodes) {
    const h = Math.max(4, (nodeTotals[node.id] || 0) * scale);
    nodeRects[node.id] = { x: leftX, y: yOff, w: nodeW, h, label: node.label, color: node.color, isLeft: true };
    yOff += h + 3;
  }

  // Position right nodes
  yOff = padTop;
  for (const node of rightNodes) {
    const h = Math.max(4, (nodeTotals[node.id] || 0) * scale);
    nodeRects[node.id] = {
      x: rightX,
      y: yOff,
      w: nodeW,
      h,
      label: node.label,
      color: node.color,
      isLeft: false,
    };
    yOff += h + 3;
  }

  // Build link paths — track vertical offsets per node
  const linkOffsets: Record<string, number> = {};
  const nodeColorMap: Record<string, string> = {};
  for (const n of nodes) nodeColorMap[n.id] = n.color;

  const linkPaths: SankeyLinkPath[] = [];
  for (const link of links) {
    const src = nodeRects[link.source];
    const tgt = nodeRects[link.target];
    if (!src || !tgt) continue;

    const linkH = Math.max(1.5, link.value * scale);
    const srcOff = linkOffsets[link.source] || 0;
    const tgtOff = linkOffsets[link.target] || 0;

    linkOffsets[link.source] = srcOff + linkH;
    linkOffsets[link.target] = tgtOff + linkH;

    const x1 = src.x + src.w;
    const y1 = src.y + srcOff + linkH / 2;
    const x2 = tgt.x;
    const y2 = tgt.y + tgtOff + linkH / 2;
    const cx = (x1 + x2) / 2;

    const path = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;

    linkPaths.push({
      ...link,
      color: nodeColorMap[link.source] || '#6B7280',
      path,
      x1,
      y1,
      x2,
      y2,
      linkH,
    });
  }

  return { nodeRects, linkPaths };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  subColor,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  subColor?: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="py-4">
        <CardContent className="flex items-start gap-3 px-4 py-0">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">{value}</p>
            {subValue && (
              <p className={cn('mt-0.5 text-xs', subColor ?? 'text-muted-foreground')}>{subValue}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SankeyDiagram({ data }: { data: PvtData['sankeyData'] }) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    source: string;
    target: string;
    value: number;
  } | null>(null);

  const svgW = 680;
  const svgH = 380;

  const { nodeRects, linkPaths } = useMemo(() => buildSankeyLayout(data, svgW, svgH), [data]);

  if (!linkPaths.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No Sankey data available
      </div>
    );
  }

  const leftNodes = Object.values(nodeRects).filter((n) => n.isLeft);
  const rightNodes = Object.values(nodeRects).filter((n) => !n.isLeft);

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Links */}
        {linkPaths.map((lp, i) => (
          <path
            key={`${lp.source}-${lp.target}-${i}`}
            d={lp.path}
            fill="none"
            stroke={lp.color}
            strokeWidth={lp.linkH}
            strokeOpacity={tooltip && tooltip.source !== lp.source && tooltip.target !== lp.target ? 0.12 : 0.35}
            className="cursor-pointer transition-[stroke-opacity] duration-200"
            onMouseEnter={(e) => {
              const rect = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
              const svgEl = e.currentTarget.closest('svg') as SVGSVGElement;
              const pt = svgEl.createSVGPoint();
              pt.x = e.clientX - rect.left;
              pt.y = e.clientY - rect.top;
              const ctm = svgEl.getScreenCTM();
              if (ctm) {
                const svgPt = pt.matrixTransform(ctm.inverse());
                setTooltip({ x: svgPt.x, y: svgPt.y, source: lp.source, target: lp.target, value: lp.value });
              }
            }}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}

        {/* Left node labels */}
        {leftNodes.map((n) => (
          <g key={n.label}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={3} fill={n.color} opacity={0.85} />
            <text
              x={n.x - 8}
              y={n.y + n.h / 2}
              textAnchor="end"
              dominantBaseline="central"
              className="fill-foreground text-[11px] font-medium"
            >
              {n.label}
            </text>
          </g>
        ))}

        {/* Right node labels */}
        {rightNodes.map((n) => (
          <g key={n.label}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={3} fill={n.color} opacity={0.85} />
            <text
              x={n.x + n.w + 8}
              y={n.y + n.h / 2}
              textAnchor="start"
              dominantBaseline="central"
              className="fill-foreground text-[11px] font-medium"
            >
              {n.label}
            </text>
          </g>
        ))}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={tooltip.x - 90}
              y={tooltip.y - 36}
              width={180}
              height={30}
              rx={6}
              className="fill-popover stroke-border"
              strokeWidth={1}
            />
            <text
              x={tooltip.x}
              y={tooltip.y - 16}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground text-[10px]"
            >
              {tooltip.source} → {tooltip.target}: {tooltip.value.toLocaleString()}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function PartyBarChart({ partyTotals }: { partyTotals: PvtData['partyTotals'] }) {
  const maxVotes = useMemo(
    () => Math.max(...partyTotals.map((p) => p.votes), 1),
    [partyTotals],
  );

  return (
    <div className="space-y-2.5 px-1">
      {partyTotals.map((pt, idx) => {
        const pct = (pt.votes / maxVotes) * 100;
        const color = getPartyColor(pt.party);
        return (
          <div key={pt.party} className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-right text-xs font-semibold text-foreground">
              {pt.party}
            </span>
            <div className="relative h-5 flex-1 rounded bg-muted">
              <motion.div
                className="absolute inset-y-0 left-0 rounded"
                style={{ backgroundColor: color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, delay: idx * 0.08, ease: 'easeOut' }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {pt.votes.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DeltaBadge({ pct }: { pct: number }) {
  const abs = Math.abs(pct);
  const colorClass =
    abs > 10
      ? 'text-rose-400 bg-rose-500/15'
      : abs >= 5
        ? 'text-amber-400 bg-amber-500/15'
        : 'text-emerald-400 bg-emerald-500/15';
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium', colorClass)}>
      {pct > 0 ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const style = SOURCE_STYLES[source] || {
    label: source,
    className: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium', style.className)}>
      {style.label}
    </Badge>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '—';
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export function PvtQuickCount() {
  const { tenantId } = useDashboardStore();

  const { data, isLoading } = useQuery<PvtData>({
    queryKey: ['pvt', tenantId],
    queryFn: () => fetch(`/api/pvt?tenantId=${tenantId}`).then((r) => r.json()),
    refetchInterval: 15000,
  });

  // Loading state
  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
      </div>
    );
  }

  const { stats, coverage, sankeyData, partyTotals, comparisons, pvtSubmissions } = data;

  // Derived
  const anomalies = comparisons.filter((c) => c.isAnomaly);
  const recentSubmissions = pvtSubmissions.slice(0, 20);
  const topParty = partyTotals[0];

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* ── Top Stats Bar ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={BarChart3}
          label="Total PVT Submissions"
          value={stats.totalSubmissions.toLocaleString()}
          subValue={`${stats.verifiedCount.toLocaleString()} verified`}
          subColor="text-emerald-400"
          delay={0}
        />
        <StatCard
          icon={GitCompareArrows}
          label="Units Compared"
          value={stats.unitsWithComparison.toLocaleString()}
          subValue={`${stats.anomalyCount} anomalies detected`}
          subColor="text-rose-400"
          delay={0.07}
        />
        <StatCard
          icon={Percent}
          label="Coverage"
          value={`${coverage.coveragePct.toFixed(1)}%`}
          subValue={`${coverage.pvtCoveredUnits.toLocaleString()} of ${coverage.totalPollingUnits.toLocaleString()} units`}
          delay={0.14}
        />
        <StatCard
          icon={Trophy}
          label="Party Leader"
          value={topParty?.party ?? '—'}
          subValue={topParty ? `${topParty.votes.toLocaleString()} votes` : undefined}
          delay={0.21}
        />
      </div>

      {/* ── Main Area: Sankey + Right Column ────────────────────────────── */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="min-h-0 flex-1 grid gap-4 lg:grid-cols-[3fr_2fr]"
      >
        {/* Left: Sankey Diagram */}
        <Card className="flex flex-col overflow-hidden">
          <CardContent className="flex flex-1 flex-col gap-2 overflow-hidden px-4 py-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-foreground">Vote Flow: States → Parties</h3>
            </div>
            <div className="min-h-0 flex-1">
              <SankeyDiagram data={sankeyData} />
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Party Totals + Anomaly Table */}
        <div className="flex min-h-0 flex-col gap-4">
          {/* Party Totals */}
          <Card className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-2 px-4 py-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-foreground">Party Totals</h3>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                <PartyBarChart partyTotals={partyTotals} />
              </div>
            </CardContent>
          </Card>

          {/* Anomaly Table */}
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CardContent className="flex min-h-0 flex-1 flex-col gap-2 px-4 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-foreground">Anomalies</h3>
                <Badge variant="destructive" className="ml-auto text-[10px]">
                  {anomalies.length}
                </Badge>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Polling Unit</TableHead>
                      <TableHead className="text-xs">State</TableHead>
                      <TableHead className="text-right text-xs">PVT</TableHead>
                      <TableHead className="text-right text-xs">Official</TableHead>
                      <TableHead className="text-center text-xs">Delta</TableHead>
                      <TableHead className="text-xs">Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {anomalies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-16 text-center text-xs text-muted-foreground">
                          No anomalies detected
                        </TableCell>
                      </TableRow>
                    )}
                    {anomalies.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="max-w-[120px] truncate text-xs" title={a.pollingUnit.name}>
                          {a.pollingUnit.name}
                        </TableCell>
                        <TableCell className="text-xs">{a.pollingUnit.state}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {a.totalPvtVotes.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {a.totalOfficialVotes.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <DeltaBadge pct={a.deltaPct} />
                        </TableCell>
                        <TableCell className="max-w-[130px] truncate text-xs text-muted-foreground" title={a.anomalyReason ?? ''}>
                          {a.anomalyReason ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* ── Bottom: Recent PVT Submissions ──────────────────────────────── */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex min-h-0 flex-col"
        style={{ flex: '0 0 auto', maxHeight: '260px' }}
      >
        <Card className="flex flex-1 flex-col overflow-hidden">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-2 px-4 py-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-foreground">Recent PVT Submissions</h3>
              <span className="ml-auto text-xs text-muted-foreground">
                Latest {recentSubmissions.length}
              </span>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Time</TableHead>
                    <TableHead className="text-xs">Polling Unit</TableHead>
                    <TableHead className="text-xs">State</TableHead>
                    <TableHead className="text-xs">Source</TableHead>
                    <TableHead className="text-right text-xs">Total Votes</TableHead>
                    <TableHead className="text-center text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSubmissions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-14 text-center text-xs text-muted-foreground">
                        No submissions yet
                      </TableCell>
                    </TableRow>
                  )}
                  {recentSubmissions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {formatTime(sub.submittedAt)}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-xs" title={sub.pollingUnit.name}>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                          {sub.pollingUnit.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{sub.pollingUnit.state}</TableCell>
                      <TableCell>
                        <SourceBadge source={sub.source} />
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums font-medium">
                        {sub.totalVotesCast.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {sub.isVerified ? (
                          <Badge className="gap-1 bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}