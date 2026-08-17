'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { useDashboardStore, TIER_SHORT } from '@/store/dashboard';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  BarChart3, Trophy, AlertTriangle, Users, Download, Copy, Share2,
  ChevronDown, Smartphone, Monitor, QrCode, Eye, Loader2, Sparkles,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const PARTY_COLORS: Record<string, string> = {
  APC: '#008751',
  PDP: '#CE1126',
  LP: '#2196F3',
  NNPP: '#FF9800',
};

const GRADIENTS = {
  'emerald-dark': { start: '#064e3b', mid: '#065f46', end: '#022c22', accent: '#34d399' },
  'amber-dark': { start: '#78350f', mid: '#92400e', end: '#451a03', accent: '#fbbf24' },
  'rose-dark': { start: '#881337', mid: '#9f1239', end: '#4c0519', accent: '#fb7185' },
  'cyan-dark': { start: '#164e63', mid: '#155e75', end: '#083344', accent: '#22d3ee' },
} as const;

type GradientKey = keyof typeof GRADIENTS;
type TemplateType = 'results' | 'victory' | 'incident' | 'turnout';
type AspectRatio = 'story' | 'feed';

const TEMPLATE_CONFIG: Record<TemplateType, {
  icon: typeof BarChart3;
  label: string;
  defaultTitle: string;
  defaultSubtitle: string;
  description: string;
}> = {
  results: {
    icon: BarChart3,
    label: 'Results',
    defaultTitle: 'ELECTION RESULTS UPDATE',
    defaultSubtitle: 'Live results from the field — updated in real time',
    description: 'Party performance bar chart',
  },
  victory: {
    icon: Trophy,
    label: 'Victory',
    defaultTitle: 'SECURING VICTORY',
    defaultSubtitle: 'Leading margin expanding across key states',
    description: 'Celebration milestone',
  },
  incident: {
    icon: AlertTriangle,
    label: 'Alert',
    defaultTitle: 'ELECTION ALERT',
    defaultSubtitle: 'Verified incident reported from the field',
    description: 'Incident bulletin',
  },
  turnout: {
    icon: Users,
    label: 'Turnout',
    defaultTitle: 'VOTER TURNOUT UPDATE',
    defaultSubtitle: 'Citizens exercising their democratic right',
    description: 'Turnout progress ring',
  },
};

interface ResultParty {
  party: string;
  votes: number;
  percentage: number;
}

interface ResultsData {
  parties: ResultParty[];
  totalVotes: number;
  totalPolled: number;
}

// ─── Canvas Renderer ─────────────────────────────────────────────────────────

function renderCardToCanvas(opts: {
  template: TemplateType;
  aspectRatio: AspectRatio;
  title: string;
  subtitle: string;
  party: string;
  showWatermark: boolean;
  showQr: boolean;
  gradient: GradientKey;
  electionName: string;
  results?: ResultParty[];
  dashboardStats?: {
    totalRegistered: number;
    totalVotes: number;
    avgTurnout: number;
    openUnits: number;
    totalPollingUnits: number;
  };
  incidentInfo?: {
    severity: string;
    location: string;
    description: string;
  };
}): HTMLCanvasElement {
  const { template, aspectRatio, title, subtitle, party, showWatermark, showQr, gradient, electionName, results, dashboardStats, incidentInfo } = opts;

  const isStory = aspectRatio === 'story';
  const W = isStory ? 1080 : 1200;
  const H = isStory ? 1920 : 628;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const g = GRADIENTS[gradient];

  // ── Background gradient ──
  const bgGrad = ctx.createLinearGradient(0, 0, W * 0.3, H);
  bgGrad.addColorStop(0, g.start);
  bgGrad.addColorStop(0.5, g.mid);
  bgGrad.addColorStop(1, g.end);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // ── Subtle decorative elements ──
  ctx.save();
  ctx.globalAlpha = 0.06;
  const radGrad = ctx.createRadialGradient(W * 0.8, H * 0.2, 0, W * 0.8, H * 0.2, W * 0.5);
  radGrad.addColorStop(0, g.accent);
  radGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // ── Decorative corner lines ──
  ctx.save();
  ctx.strokeStyle = g.accent;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 2;
  // Top-left corner
  ctx.beginPath();
  ctx.moveTo(40, 80); ctx.lineTo(40, 40); ctx.lineTo(80, 40);
  ctx.stroke();
  // Bottom-right corner
  ctx.beginPath();
  ctx.moveTo(W - 40, H - 80); ctx.lineTo(W - 40, H - 40); ctx.lineTo(W - 80, H - 40);
  ctx.stroke();
  ctx.restore();

  // ── Font sizes scaled by aspect ratio ──
  const scale = isStory ? 1 : 0.6;
  const titleSize = Math.round(40 * scale);
  const subtitleSize = Math.round(22 * scale);
  const bodySize = Math.round(28 * scale);
  const smallSize = Math.round(18 * scale);
  const tinySize = Math.round(14 * scale);
  const pad = Math.round(60 * scale);

  // ── Election name chip at top ──
  ctx.save();
  ctx.font = `600 ${tinySize}px system-ui, -apple-system, sans-serif`;
  const chipText = electionName.toUpperCase();
  const chipW = ctx.measureText(chipText).width + 24;
  const chipH = tinySize + 12;
  const chipX = pad;
  const chipY = pad;
  ctx.fillStyle = g.accent;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.roundRect(chipX, chipY, chipW, chipH, chipH / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = g.accent;
  ctx.fillText(chipText, chipX + 12, chipY + chipH - 4);
  ctx.restore();

  // ── Title ──
  ctx.save();
  ctx.font = `800 ${titleSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  wrapText(ctx, title, pad, pad + 50 * scale, W - pad * 2, titleSize * 1.25);
  ctx.restore();

  // ── Template-specific content ──
  const contentY = pad + (isStory ? 180 : 110);

  if (template === 'results') {
    drawResultsContent(ctx, results || [], party, W, H, contentY, pad, bodySize, smallSize, scale, g);
  } else if (template === 'victory') {
    drawVictoryContent(ctx, results || [], party, W, H, contentY, pad, bodySize, smallSize, scale, g);
  } else if (template === 'incident') {
    drawIncidentContent(ctx, incidentInfo, W, H, contentY, pad, bodySize, smallSize, tinySize, scale, g);
  } else if (template === 'turnout') {
    drawTurnoutContent(ctx, dashboardStats, W, H, contentY, pad, bodySize, smallSize, tinySize, scale, g);
  }

  // ── Subtitle ──
  if (subtitle) {
    ctx.save();
    ctx.font = `400 ${subtitleSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.textBaseline = 'top';
    const subY = H - pad - (showWatermark ? 80 * scale : 20 * scale) - subtitleSize;
    wrapText(ctx, subtitle, pad, subY, W - pad * 2, subtitleSize * 1.3);
    ctx.restore();
  }

  // ── Watermark ──
  if (showWatermark) {
    ctx.save();
    ctx.font = `500 ${tinySize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textBaseline = 'bottom';
    const wmText = 'Source: OmniVote Monitor';
    const wmX = showQr ? pad + 60 * scale : pad;
    ctx.fillText(wmText, wmX, H - pad + 8);
    ctx.restore();
  }

  // ── QR Code placeholder ──
  if (showQr) {
    ctx.save();
    const qrSize = Math.round(48 * scale);
    const qrX = W - pad - qrSize;
    const qrY = H - pad - qrSize + 8;
    // White background
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.roundRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 6);
    ctx.fill();
    // QR pattern (decorative)
    ctx.fillStyle = g.start;
    ctx.fillRect(qrX + 4, qrY + 4, qrSize - 8, qrSize - 8);
    // QR corners
    ctx.fillStyle = '#ffffff';
    const cornerSize = qrSize * 0.3;
    // Top-left
    ctx.fillRect(qrX + 6, qrY + 6, cornerSize - 4, 2);
    ctx.fillRect(qrX + 6, qrY + 6, 2, cornerSize - 4);
    ctx.fillRect(qrX + 6, qrY + cornerSize - 2, cornerSize - 4, 2);
    ctx.fillRect(qrX + cornerSize - 4, qrY + 6, 2, cornerSize - 4);
    // Top-right
    ctx.fillRect(qrX + qrSize - cornerSize - 2, qrY + 6, cornerSize - 4, 2);
    ctx.fillRect(qrX + qrSize - cornerSize - 2, qrY + 6, 2, cornerSize - 4);
    ctx.fillRect(qrX + qrSize - cornerSize - 2, qrY + cornerSize - 2, cornerSize - 4, 2);
    ctx.fillRect(qrX + qrSize - 8, qrY + 6, 2, cornerSize - 4);
    // Bottom-left
    ctx.fillRect(qrX + 6, qrY + qrSize - cornerSize - 2, cornerSize - 4, 2);
    ctx.fillRect(qrX + 6, qrY + qrSize - cornerSize - 2, 2, cornerSize - 4);
    ctx.fillRect(qrX + 6, qrY + qrSize - 8, cornerSize - 4, 2);
    ctx.fillRect(qrX + cornerSize - 4, qrY + qrSize - cornerSize - 2, 2, cornerSize - 4);
    ctx.restore();
  }

  // ── Bottom accent line ──
  ctx.save();
  const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
  lineGrad.addColorStop(0, 'transparent');
  lineGrad.addColorStop(0.3, g.accent);
  lineGrad.addColorStop(0.7, g.accent);
  lineGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = lineGrad;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, H - pad - (showWatermark ? 36 * scale : 0));
  ctx.lineTo(W - pad, H - pad - (showWatermark ? 36 * scale : 0));
  ctx.stroke();
  ctx.restore();

  return canvas;
}

// ── Canvas drawing helpers ──

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (const word of words) {
    const testLine = line + (line ? ' ' : '') + word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
}

function drawResultsContent(
  ctx: CanvasRenderingContext2D,
  parties: ResultParty[],
  highlightParty: string,
  W: number, H: number,
  startY: number,
  pad: number,
  bodySize: number, smallSize: number,
  scale: number,
  g: typeof GRADIENTS[GradientKey],
) {
  if (!parties.length) return;

  const sorted = [...parties].sort((a, b) => b.votes - a.votes);
  const maxVotes = sorted[0]?.votes || 1;
  const barAreaW = W - pad * 2;
  const actualBarH = Math.round(56 * scale);
  const actualBarGap = Math.round(20 * scale);
  const barRadius = Math.round(8 * scale);

  let y = startY;

  sorted.forEach((p, i) => {
    const color = PARTY_COLORS[p.party] || g.accent;
    const isHighlighted = p.party === highlightParty;
    const pct = Math.max(0.02, p.votes / maxVotes);
    const barW = Math.max(4, (barAreaW - 160 * scale) * pct);

    // Party label
    ctx.save();
    ctx.font = `700 ${bodySize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = isHighlighted ? g.accent : 'rgba(255,255,255,0.9)';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.party, pad, y + actualBarH / 2);
    ctx.restore();

    // Bar background
    const barX = pad + 80 * scale;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(barX, y, barAreaW - 160 * scale, actualBarH, barRadius);
    ctx.fill();

    // Bar fill
    const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    barGrad.addColorStop(0, color);
    barGrad.addColorStop(1, color + 'cc');
    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.roundRect(barX, y, barW, actualBarH, barRadius);
    ctx.fill();
    ctx.restore();

    // Percentage
    ctx.save();
    ctx.font = `600 ${smallSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(`${p.percentage.toFixed(1)}%`, W - pad, y + actualBarH / 2);
    ctx.restore();

    y += actualBarH + actualBarGap;
  });

  // Total votes footer
  const totalVotes = parties.reduce((s, p) => s + p.votes, 0);
  ctx.save();
  ctx.font = `400 ${smallSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textBaseline = 'top';
  ctx.fillText(`Total: ${totalVotes.toLocaleString()} votes counted`, pad, y + 8);
  ctx.restore();
}

function drawVictoryContent(
  ctx: CanvasRenderingContext2D,
  parties: ResultParty[],
  highlightParty: string,
  W: number, H: number,
  startY: number,
  pad: number,
  bodySize: number, smallSize: number,
  scale: number,
  g: typeof GRADIENTS[GradientKey],
) {
  const top = parties.find(p => p.party === highlightParty) || parties[0];
  if (!top) return;

  const color = PARTY_COLORS[top.party] || g.accent;
  const y = startY;

  // Big percentage
  ctx.save();
  ctx.font = `900 ${Math.round(120 * scale)}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.globalAlpha = 0.15;
  ctx.fillText(`${top.percentage.toFixed(1)}%`, pad, y);
  ctx.restore();

  // Party name
  ctx.save();
  ctx.font = `800 ${Math.round(64 * scale)}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.fillText(top.party, pad, y + 90 * scale);
  ctx.restore();

  // Leading text
  ctx.save();
  ctx.font = `500 ${bodySize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = g.accent;
  ctx.textBaseline = 'top';
  ctx.fillText('LEADING THE RACE', pad, y + 170 * scale);
  ctx.restore();

  // Stats row
  if (parties.length >= 2) {
    const second = [...parties].sort((a, b) => b.votes - a.votes)[1];
    const margin = top.votes - (second?.votes || 0);
    const statsY = y + 220 * scale;

    // Margin box
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(pad, statsY, W - pad * 2, Math.round(80 * scale), Math.round(16 * scale));
    ctx.fill();

    const colW = (W - pad * 2) / 3;
    ctx.font = `700 ${Math.round(32 * scale)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillText(top.votes.toLocaleString(), pad + colW * 0.5, statsY + 12 * scale);

    ctx.font = `400 ${smallSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('TOTAL VOTES', pad + colW * 0.5, statsY + 50 * scale);

    // Margin
    ctx.font = `700 ${Math.round(32 * scale)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = g.accent;
    ctx.fillText(`+${margin.toLocaleString()}`, pad + colW * 1.5, statsY + 12 * scale);

    ctx.font = `400 ${smallSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('MARGIN', pad + colW * 1.5, statsY + 50 * scale);

    // % share
    ctx.font = `700 ${Math.round(32 * scale)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${top.percentage.toFixed(1)}%`, pad + colW * 2.5, statsY + 12 * scale);

    ctx.font = `400 ${smallSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('VOTE SHARE', pad + colW * 2.5, statsY + 50 * scale);

    ctx.textAlign = 'left';
    ctx.restore();
  }
}

function drawIncidentContent(
  ctx: CanvasRenderingContext2D,
  incidentInfo: { severity: string; location: string; description: string } | undefined,
  W: number, H: number,
  startY: number,
  pad: number,
  bodySize: number, smallSize: number, tinySize: number,
  scale: number,
  g: typeof GRADIENTS[GradientKey],
) {
  const severity = incidentInfo?.severity || 'HIGH';
  const location = incidentInfo?.location || 'Field Report';
  const description = incidentInfo?.description || 'Incident details pending verification';

  const y = startY;
  const severityColors: Record<string, string> = {
    CRITICAL: '#f43f5e',
    HIGH: '#f97316',
    MEDIUM: '#eab308',
    LOW: '#22c55e',
  };
  const sevColor = severityColors[severity] || severityColors.HIGH;

  // Severity badge
  ctx.save();
  ctx.font = `700 ${smallSize}px system-ui, -apple-system, sans-serif`;
  const sevText = `${severity} SEVERITY`;
  const sevW = ctx.measureText(sevText).width + 28;
  ctx.fillStyle = sevColor;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.roundRect(pad, y, sevW, smallSize + 16, (smallSize + 16) / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = sevColor;
  ctx.fillText(sevText, pad + 14, y + smallSize + 8);
  ctx.restore();

  // Location
  ctx.save();
  ctx.font = `600 ${bodySize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.fillText(`📍 ${location}`, pad, y + (smallSize + 30) * scale);
  ctx.restore();

  // Description
  ctx.save();
  ctx.font = `400 ${bodySize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textBaseline = 'top';
  wrapText(ctx, description, pad, y + (smallSize + 70) * scale, W - pad * 2, bodySize * 1.4);
  ctx.restore();

  // Verified badge
  const badgeY = y + (smallSize + 130) * scale;
  ctx.save();
  ctx.font = `500 ${tinySize}px system-ui, -apple-system, sans-serif`;
  const badgeText = '✓ Verified by OmniVote';
  const badgeW = ctx.measureText(badgeText).width + 20;
  ctx.fillStyle = g.accent;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.roundRect(pad, badgeY, badgeW, tinySize + 12, (tinySize + 12) / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = g.accent;
  ctx.fillText(badgeText, pad + 10, badgeY + tinySize + 6);
  ctx.restore();
}

function drawTurnoutContent(
  ctx: CanvasRenderingContext2D,
  stats: { totalRegistered: number; totalVotes: number; avgTurnout: number; openUnits: number; totalPollingUnits: number } | undefined,
  W: number, H: number,
  startY: number,
  pad: number,
  bodySize: number, smallSize: number, tinySize: number,
  scale: number,
  g: typeof GRADIENTS[GradientKey],
) {
  const registered = stats?.totalRegistered || 0;
  const votes = stats?.totalVotes || 0;
  const turnout = stats?.avgTurnout || 0;

  const y = startY;
  const centerX = W / 2;
  const ringOuterR = Math.round(130 * scale);
  const ringInnerR = Math.round(100 * scale);
  const ringLineW = Math.round(20 * scale);

  // Progress ring background
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, y + ringOuterR + 20, ringOuterR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = ringLineW;
  ctx.stroke();

  // Progress ring fill
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (Math.PI * 2 * turnout) / 100;
  ctx.beginPath();
  ctx.arc(centerX, y + ringOuterR + 20, ringOuterR, startAngle, endAngle);
  const ringGrad = ctx.createLinearGradient(centerX - ringOuterR, 0, centerX + ringOuterR, 0);
  ringGrad.addColorStop(0, g.accent);
  ringGrad.addColorStop(1, g.accent + 'aa');
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = ringLineW;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  // Percentage in center
  ctx.save();
  ctx.font = `900 ${Math.round(72 * scale)}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(`${turnout.toFixed(1)}%`, centerX, y + ringOuterR + 10);
  ctx.font = `400 ${smallSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('TURNOUT', centerX, y + ringOuterR + 55);
  ctx.textAlign = 'left';
  ctx.restore();

  // Stats boxes
  const boxY = y + ringOuterR * 2 + 60 * scale;
  const boxW = (W - pad * 2 - 20 * scale) / 2;
  const boxH = Math.round(80 * scale);

  // Registered voters box
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.roundRect(pad, boxY, boxW, boxH, 12);
  ctx.fill();
  ctx.font = `700 ${Math.round(28 * scale)}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.fillText(registered.toLocaleString(), pad + 16, boxY + 12);
  ctx.font = `400 ${tinySize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('REGISTERED VOTERS', pad + 16, boxY + 50);
  ctx.restore();

  // Votes counted box
  const box2X = pad + boxW + 20 * scale;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.roundRect(box2X, boxY, boxW, boxH, 12);
  ctx.fill();
  ctx.font = `700 ${Math.round(28 * scale)}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = g.accent;
  ctx.textBaseline = 'top';
  ctx.fillText(votes.toLocaleString(), box2X + 16, boxY + 12);
  ctx.font = `400 ${tinySize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('VOTES COUNTED', box2X + 16, boxY + 50);
  ctx.restore();
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SocialCards() {
  const { tenantId, electionTier } = useDashboardStore();
  const electionName = TIER_SHORT[electionTier];

  // State
  const [template, setTemplate] = useState<TemplateType>('results');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('story');
  const [title, setTitle] = useState(TEMPLATE_CONFIG.results.defaultTitle);
  const [subtitle, setSubtitle] = useState(TEMPLATE_CONFIG.results.defaultSubtitle);
  const [party, setParty] = useState('APC');
  const [showWatermark, setShowWatermark] = useState(true);
  const [showQr, setShowQr] = useState(false);
  const [gradient, setGradient] = useState<GradientKey>('emerald-dark');
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fetch results data
  const { data: resultsData } = useQuery<ResultsData>({
    queryKey: ['results', tenantId],
    queryFn: () => fetchJson(`/api/results?tenantId=${tenantId}`),
    refetchInterval: 30_000,
    enabled: !!tenantId,
  });

  // Fetch dashboard stats
  const { data: dashStats } = useQuery<{
    election: {
      totalRegistered: number;
      totalVotes: number;
      avgTurnout: number;
      openUnits: number;
      totalPollingUnits: number;
    };
  }>({
    queryKey: ['dashboard', tenantId, 'social-cards'],
    queryFn: () => fetchJson(`/api/dashboard?tenantId=${tenantId}`),
    refetchInterval: 30_000,
    enabled: !!tenantId,
    select: (d) => d,
  });

  // Mock incident info (in real use, this would come from selected incident)
  const incidentInfo = {
    severity: 'HIGH',
    location: 'Ward 3, Surulere LGA, Lagos',
    description: 'Reports of ballot box snatching at PU 012. Security agencies have been alerted. Field agents monitoring the situation.',
  };

  // Update title/subtitle when template changes
  useEffect(() => {
    const cfg = TEMPLATE_CONFIG[template];
    setTitle(cfg.defaultTitle);
    setSubtitle(cfg.defaultSubtitle);
  }, [template]);

  // Available parties from results
  const parties = resultsData?.parties || [
    { party: 'APC', votes: 1_245_678, percentage: 36.2 },
    { party: 'PDP', votes: 1_089_432, percentage: 31.7 },
    { party: 'LP', votes: 756_234, percentage: 22.0 },
    { party: 'NNPP', votes: 348_901, percentage: 10.1 },
  ];

  // Render canvas
  const getCanvas = useCallback(() => {
    return renderCardToCanvas({
      template,
      aspectRatio,
      title,
      subtitle,
      party,
      showWatermark,
      showQr,
      gradient,
      electionName,
      results: parties,
      dashboardStats: dashStats?.election,
      incidentInfo,
    });
  }, [template, aspectRatio, title, subtitle, party, showWatermark, showQr, gradient, electionName, parties, dashStats?.election, incidentInfo]);

  // Update preview canvas
  useEffect(() => {
    const canvas = getCanvas();
    canvasRef.current = canvas;
    const previewEl = document.getElementById('social-card-preview');
    if (previewEl) {
      const cvs = previewEl as HTMLCanvasElement;
      const ctx = cvs.getContext('2d');
      if (ctx) {
        cvs.width = canvas.width;
        cvs.height = canvas.height;
        ctx.drawImage(canvas, 0, 0);
      }
    }
  }, [getCanvas]);

  // Export handlers
  const downloadPng = useCallback(async () => {
    setIsExporting(true);
    try {
      const canvas = getCanvas();
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Failed to generate image');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `omnivote-${template}-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Card downloaded successfully');
      }, 'image/png');
    } catch {
      toast.error('Failed to export card');
    } finally {
      setIsExporting(false);
    }
  }, [getCanvas, template]);

  const copyToClipboard = useCallback(async () => {
    setIsExporting(true);
    try {
      const canvas = getCanvas();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      );
      if (!blob) {
        toast.error('Failed to generate image');
        return;
      }
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      toast.success('Card copied to clipboard');
    } catch {
      toast.error('Clipboard access denied — try downloading instead');
    } finally {
      setIsExporting(false);
    }
  }, [getCanvas]);

  const shareCard = useCallback(async () => {
    setIsExporting(true);
    try {
      if (typeof navigator.share === 'function') {
        const canvas = getCanvas();
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png')
        );
        if (!blob) {
          toast.error('Failed to generate image');
          return;
        }
        const file = new File([blob], `omnivote-${template}.png`, { type: 'image/png' });
        await navigator.share({
          title: `OmniVote — ${title}`,
          text: subtitle,
          files: [file],
        });
        toast.success('Shared successfully');
      } else {
        // Fallback to download
        await downloadPng();
        toast.info('Web Share API not available — downloaded instead');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast.error('Sharing failed — try downloading instead');
      }
    } finally {
      setIsExporting(false);
    }
  }, [getCanvas, template, title, subtitle, downloadPng]);

  const isStory = aspectRatio === 'story';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald" />
              Social Media Cards
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generate shareable election cards for campaigns
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Aspect ratio toggle */}
            <div className="flex items-center rounded-lg border border-border bg-card/50 p-0.5">
              <button
                onClick={() => setAspectRatio('story')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                  isStory
                    ? 'bg-emerald text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Story
              </button>
              <button
                onClick={() => setAspectRatio('feed')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                  !isStory
                    ? 'bg-emerald text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Monitor className="h-3.5 w-3.5" />
                Feed
              </button>
            </div>
          </div>
        </div>

        {/* Template selector */}
        <div className="flex gap-2">
          {(Object.entries(TEMPLATE_CONFIG) as [TemplateType, typeof TEMPLATE_CONFIG[TemplateType]][]).map(
            ([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setTemplate(key)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1.5 rounded-lg border p-2.5 transition-all text-center',
                    template === key
                      ? 'border-emerald/50 bg-emerald/10 text-emerald shadow-sm'
                      : 'border-border/60 bg-card/30 text-muted-foreground hover:bg-card/50 hover:text-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[11px] font-medium leading-tight">{cfg.label}</span>
                </motion.button>
              );
            }
          )}
        </div>
      </div>

      {/* Main content: preview + customization */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 p-4 pt-2 overflow-hidden">
        {/* Card Preview */}
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className={cn(
            'relative rounded-2xl overflow-hidden shadow-2xl',
            isStory
              ? 'w-[220px] h-[391px] md:w-[270px] md:h-[480px]'
              : 'w-full max-w-[520px]'
          )}>
            {/* Phone frame mockup for story */}
            {isStory && (
              <div className="absolute inset-0 rounded-2xl border-[3px] border-white/20 pointer-events-none z-10" />
            )}
            {/* Notch for story */}
            {isStory && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-20" />
            )}
            <canvas
              id="social-card-preview"
              className={cn(
                'w-full h-full object-contain',
                !isStory && 'rounded-xl'
              )}
            />
            {/* Overlay badge */}
            <div className="absolute top-2 right-2 z-20">
              <Badge variant="secondary" className="text-[9px] bg-black/40 text-white/80 border-0 backdrop-blur-sm">
                <Eye className="h-2.5 w-2.5 mr-1" />
                Preview
              </Badge>
            </div>
          </div>
        </div>

        {/* Customization Panel */}
        <div className={cn(
          'shrink-0 lg:w-80 xl:w-96 rounded-xl border border-border/60 bg-card/40 overflow-hidden',
          'flex flex-col'
        )}>
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-card/60 transition-colors">
                <span className="text-sm font-semibold text-foreground">Customize Card</span>
                <motion.div
                  animate={{ rotate: settingsOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </motion.div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto">
                {/* Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="card-title" className="text-xs">Title</Label>
                  <Input
                    id="card-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="Card title..."
                  />
                </div>

                {/* Subtitle */}
                <div className="space-y-1.5">
                  <Label htmlFor="card-subtitle" className="text-xs">Subtitle</Label>
                  <Textarea
                    id="card-subtitle"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="text-sm min-h-[60px] resize-none"
                    placeholder="Card subtitle..."
                  />
                </div>

                <Separator className="bg-border/40" />

                {/* Party filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Highlight Party</Label>
                  <Select value={party} onValueChange={setParty}>
                    <SelectTrigger className="h-8 text-sm w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {parties.map((p) => (
                        <SelectItem key={p.party} value={p.party}>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-sm inline-block"
                              style={{ backgroundColor: PARTY_COLORS[p.party] || '#888' }}
                            />
                            {p.party}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Background gradient */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Background Theme</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.entries(GRADIENTS) as [GradientKey, typeof GRADIENTS[GradientKey]][]).map(
                      ([key, g]) => (
                        <button
                          key={key}
                          onClick={() => setGradient(key)}
                          className={cn(
                            'relative h-10 rounded-lg border-2 transition-all overflow-hidden',
                            gradient === key
                              ? 'border-white/80 ring-2 ring-emerald/50 scale-105'
                              : 'border-transparent hover:border-white/30'
                          )}
                          style={{
                            background: `linear-gradient(135deg, ${g.start}, ${g.mid}, ${g.end})`,
                          }}
                          title={key.replace('-', ' ')}
                        >
                          {gradient === key && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute inset-0 flex items-center justify-center"
                            >
                              <div className="w-3 h-3 rounded-full bg-white/90" />
                            </motion.div>
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <Separator className="bg-border/40" />

                {/* Toggles */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="watermark-toggle" className="text-xs cursor-pointer">
                      Include Watermark
                    </Label>
                    <Switch
                      id="watermark-toggle"
                      checked={showWatermark}
                      onCheckedChange={setShowWatermark}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="qr-toggle" className="text-xs cursor-pointer">
                      <span className="flex items-center gap-1.5">
                        <QrCode className="h-3.5 w-3.5" />
                        Include QR Code
                      </span>
                    </Label>
                    <Switch
                      id="qr-toggle"
                      checked={showQr}
                      onCheckedChange={setShowQr}
                    />
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Action bar */}
          <div className="border-t border-border/40 p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                onClick={downloadPng}
                disabled={isExporting}
                className="bg-emerald hover:bg-emerald/90 text-white text-xs h-9"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Download
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={copyToClipboard}
                disabled={isExporting}
                className="text-xs h-9"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copy
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={shareCard}
                disabled={isExporting}
                className="text-xs h-9"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Share2 className="h-3.5 w-3.5" />
                )}
                Share
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/50 text-center">
              {isStory ? '1080 × 1920px' : '1200 × 628px'} · PNG
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}