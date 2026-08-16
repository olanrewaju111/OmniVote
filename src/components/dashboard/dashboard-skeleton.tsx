'use client';

/**
 * Skeleton loading states for the dashboard.
 * Used during initial data load to show content-shaped placeholders
 * instead of a generic spinner, improving perceived performance.
 */

export function DashboardSkeleton() {
  return (
    <div className="h-full flex flex-col p-4 gap-3 animate-slide-up">
      {/* KPI row skeleton */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>

      {/* Quick actions skeleton */}
      <div className="shrink-0 grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <ActionCardSkeleton key={i} />
        ))}
      </div>

      {/* Feed skeleton */}
      <div className="flex-1 min-h-0 rounded-xl border border-border bg-card/40 overflow-hidden">
        <FeedSkeleton />
      </div>
    </div>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-4 w-4 rounded-full" />
      </div>
      <div className="skeleton h-6 w-12 rounded" />
      <div className="skeleton h-2 w-20 rounded-full" />
    </div>
  );
}

export function ActionCardSkeleton() {
  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-3 space-y-2">
      <div className="skeleton h-7 w-7 rounded-md" />
      <div className="skeleton h-3 w-20 rounded" />
      <div className="skeleton h-2 w-14 rounded" />
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="h-full flex flex-col">
      {/* Feed header */}
      <div className="px-4 py-2.5 border-b border-border/60 flex items-center justify-between">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="flex gap-2">
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-16 rounded-full" />
        </div>
      </div>
      {/* Feed items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/40 bg-card/20 p-3 space-y-2"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="skeleton h-4 w-4 rounded-full" />
                <div className="skeleton h-3 w-24 rounded" />
              </div>
              <div className="skeleton h-3 w-12 rounded" />
            </div>
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-3/4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex gap-4 px-4 py-2.5 border-b border-border/60">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton h-3 rounded" style={{ flex: i === 0 ? 2 : 1 }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-border/30">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton h-3 rounded" style={{ flex: j === 0 ? 2 : 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---- Tab-specific skeletons for code-split components ----

/** Grid of skeleton cards (OSINT, Media Gallery, Campaign Monitor, Flashpoint, Honeypot, etc.) */
export function CardGridSkeleton({ cols = 2, rows = 3 }: { cols?: number; rows?: number }) {
  return (
    <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border/60 bg-card/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="skeleton h-4 w-24 rounded" />
            <div className="skeleton h-5 w-5 rounded-md" />
          </div>
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-3/4 rounded" />
          <div className="flex gap-2 pt-1">
            <div className="skeleton h-6 w-14 rounded-full" />
            <div className="skeleton h-6 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full-height map placeholder with header bar and map grid area */
export function MapSkeleton() {
  return (
    <div className="h-full flex flex-col rounded-xl border border-border/60 bg-card/30 overflow-hidden">
      {/* Header bar */}
      <div className="shrink-0 px-4 py-2.5 border-b border-border/60 flex items-center justify-between">
        <div className="skeleton h-4 w-28 rounded" />
        <div className="flex gap-2">
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-16 rounded-full" />
        </div>
      </div>
      {/* Map placeholder area */}
      <div className="flex-1 min-h-0 map-grid relative">
        <div className="absolute inset-0 bg-muted/20" />
        {/* Grid overlay lines for visual depth */}
        <div className="absolute inset-0 opacity-30">
          <div className="h-full w-full" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, hsl(var(--border)) 39px, hsl(var(--border)) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, hsl(var(--border)) 39px, hsl(var(--border)) 40px)',
          }} />
        </div>
      </div>
    </div>
  );
}

/** Form-shaped skeleton with input rows and a submit button */
export function FormSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      {/* Section header */}
      <div className="space-y-1.5">
        <div className="skeleton h-5 w-40 rounded" />
        <div className="skeleton h-3 w-64 rounded" />
      </div>
      {/* Input rows */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-9 w-full rounded-md" />
        </div>
      ))}
      {/* Submit button */}
      <div className="pt-2">
        <div className="skeleton h-10 w-28 rounded-md" />
      </div>
    </div>
  );
}

/** Chart skeleton with title, chart area, and mini stat boxes */
export function ChartSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="skeleton h-5 w-36 rounded" />
        <div className="flex gap-2">
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-16 rounded-full" />
        </div>
      </div>
      {/* Large chart area */}
      <div className="rounded-lg border border-border/40 bg-muted/10 h-52 flex items-end justify-around px-4 pb-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton rounded-t-sm w-full" style={{ height: `${30 + Math.random() * 60}%` }} />
        ))}
      </div>
      {/* Mini stat boxes */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/40 bg-card/30 p-3 space-y-1.5">
            <div className="skeleton h-2.5 w-16 rounded" />
            <div className="skeleton h-5 w-10 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Two-panel layout: sidebar list + detail panel */
export function ListDetailSkeleton() {
  return (
    <div className="h-full flex gap-4 p-4">
      {/* Left sidebar list */}
      <div className="w-64 shrink-0 space-y-2 overflow-hidden">
        <div className="skeleton h-4 w-24 rounded mb-3" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/40 bg-card/20 p-3 space-y-2">
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-3/4 rounded" />
            <div className="flex gap-2">
              <div className="skeleton h-4 w-12 rounded-full" />
              <div className="skeleton h-4 w-12 rounded-full" />
            </div>
          </div>
        ))}
      </div>
      {/* Right detail panel */}
      <div className="flex-1 min-w-0 rounded-lg border border-border/60 bg-card/30 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="skeleton h-5 w-40 rounded" />
          <div className="flex gap-2">
            <div className="skeleton h-7 w-7 rounded-md" />
            <div className="skeleton h-7 w-7 rounded-md" />
          </div>
        </div>
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="h-px bg-border/40 my-2" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-4/5 rounded" />
        <div className="flex gap-3 pt-2">
          <div className="skeleton h-8 w-20 rounded-md" />
          <div className="skeleton h-8 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
}
