'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDashboardStore } from '@/store/dashboard';
import { fetchJson } from '@/lib/api';
import { Trophy, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface WinProbabilityData {
  winProbability: number;
  confidence: number;
  projectedWinner: string;
  lastUpdated: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function badgeStyle(prob: number) {
  if (prob > 50) return 'border-emerald/25 text-emerald bg-emerald/10';
  if (prob >= 30) return 'border-amber/25 text-amber bg-amber/10';
  return 'border-rose/25 text-rose bg-rose/10';
}

// ─── Component ──────────────────────────────────────────────────────────────

export const WinProbabilityHeader = React.memo(function WinProbabilityHeader() {
  const tenantId = useDashboardStore((s) => s.tenantId);
  const setSelectedTab = useDashboardStore((s) => s.setSelectedTab);
  const [showTooltip, setShowTooltip] = useState(false);

  const { data, isLoading } = useQuery<WinProbabilityData>({
    queryKey: ['win-probability-header', tenantId],
    queryFn: () => fetchJson<WinProbabilityData>(`/api/win-probability?tenantId=${tenantId}`),
    refetchInterval: 30000,
    enabled: !!tenantId,
  });

  if (isLoading || !data) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2 h-7 rounded-md border border-border/40 bg-muted/20">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { winProbability, confidence, projectedWinner } = data;

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        type="button"
        onClick={() => setSelectedTab('pvt')}
        className={cn(
          'hidden sm:inline-flex items-center gap-1 px-2 h-7 rounded-md border text-[10px] font-medium cursor-pointer transition-colors hover:opacity-80',
          badgeStyle(winProbability),
        )}
        aria-label={`Win probability: ${projectedWinner} at ${winProbability}%`}
      >
        <Trophy className="h-3 w-3" aria-hidden="true" />
        <span>{projectedWinner}</span>
        <span className="tabular-nums font-semibold">{winProbability.toFixed(1)}%</span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 rounded-md bg-popover border border-border text-[10px] text-popover-foreground shadow-md z-50 whitespace-nowrap pointer-events-none">
          <div className="font-semibold">{projectedWinner} to Win</div>
          <div className="text-muted-foreground mt-0.5">
            Confidence: {confidence.toFixed(1)}%
          </div>
          {/* Tooltip arrow */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-popover border-l border-t border-border" />
        </div>
      )}
    </div>
  );
});