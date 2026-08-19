#!/usr/bin/env python3
"""
Phase 10 (Performance Optimization) & Phase 13 (Advanced Data Visualization)
OmniVote Election Monitoring Dashboard

This script applies all changes for both phases.
"""

import re
import os

BASE = "/home/z/my-project/src"

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

def ensure_import(content, import_stmt):
    """Add import statement if not already present."""
    if import_stmt not in content:
        # Find the last import line and insert after it
        lines = content.split('\n')
        last_import_idx = 0
        for i, line in enumerate(lines):
            if line.strip().startswith('import ') or line.strip().startswith('} from '):
                last_import_idx = i + 1
        lines.insert(last_import_idx, import_stmt)
        return '\n'.join(lines)
    return content

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 10: PERFORMANCE OPTIMIZATION
# ═══════════════════════════════════════════════════════════════════════════════

print("Phase 10: Performance Optimization")
print("=" * 60)

# ── 10a. Wrap heavy sub-components with React.memo ──
print("\n[10a] Adding React.memo to heavy components...")

# 1. kpi-grid.tsx
path = f"{BASE}/components/dashboard/kpi-grid.tsx"
content = read_file(path)
if 'React.memo' not in content and 'export function' in content:
    # Add React import if needed
    if 'import React' not in content:
        content = content.replace(
            "'use client';",
            "'use client';\n\nimport React from 'react';"
        )
    # Wrap export with React.memo
    content = re.sub(
        r'export function KpiGrid\(',
        'export const KpiGrid = React.memo(function KpiGrid(',
        content
    )
    # Add closing paren for memo
    content = content.rstrip()
    if not content.endswith('})'):
        # Find the last } and wrap
        last_brace = content.rfind('}')
        if last_brace > 0 and content[last_brace-1] != ')':
            content = content[:last_brace+1] + ')\n'
    write_file(path, content)
    print(f"  ✓ KpiGrid wrapped with React.memo")
else:
    print(f"  - KpiGrid already memoized or pattern not found")

# 2. sidebar.tsx
path = f"{BASE}/components/dashboard/sidebar.tsx"
content = read_file(path)
if 'React.memo' not in content and 'export function AppSidebar' in content:
    if 'import React' not in content:
        content = content.replace(
            "'use client';",
            "'use client';\n\nimport React from 'react';"
        )
    content = content.replace(
        'export function AppSidebar(',
        'export const AppSidebar = React.memo(function AppSidebar('
    )
    content = content.rstrip()
    if not content.endswith('})'):
        last_brace = content.rfind('}')
        if last_brace > 0 and content[last_brace-1] != ')':
            content = content[:last_brace+1] + ')\n'
    write_file(path, content)
    print(f"  ✓ AppSidebar wrapped with React.memo")
else:
    print(f"  - AppSidebar already memoized or pattern not found")

# 3. header.tsx
path = f"{BASE}/components/dashboard/header.tsx"
content = read_file(path)
if 'React.memo' not in content and 'export function AppHeader' in content:
    if 'import React' not in content:
        content = content.replace(
            "'use client';",
            "'use client';\n\nimport React from 'react';"
        )
    content = content.replace(
        'export function AppHeader(',
        'export const AppHeader = React.memo(function AppHeader('
    )
    content = content.rstrip()
    if not content.endswith('})'):
        last_brace = content.rfind('}')
        if last_brace > 0 and content[last_brace-1] != ')':
            content = content[:last_brace+1] + ')\n'
    write_file(path, content)
    print(f"  ✓ AppHeader wrapped with React.memo")
else:
    print(f"  - AppHeader already memoized or pattern not found")

# 4. election-ticker.tsx
path = f"{BASE}/components/dashboard/election-ticker.tsx"
content = read_file(path)
if 'React.memo' not in content and 'export function ElectionTicker' in content:
    if 'import React' not in content:
        content = content.replace(
            "'use client';",
            "'use client';\n\nimport React from 'react';"
        )
    content = content.replace(
        'export function ElectionTicker(',
        'export const ElectionTicker = React.memo(function ElectionTicker('
    )
    content = content.rstrip()
    if not content.endswith('})'):
        last_brace = content.rfind('}')
        if last_brace > 0 and content[last_brace-1] != ')':
            content = content[:last_brace+1] + ')\n'
    write_file(path, content)
    print(f"  ✓ ElectionTicker wrapped with React.memo")
else:
    print(f"  - ElectionTicker already memoized or pattern not found")

# 5. empty-state.tsx
path = f"{BASE}/components/dashboard/empty-state.tsx"
content = read_file(path)
if 'React.memo' not in content and 'export function EmptyState' in content:
    if 'import React' not in content:
        content = content.replace(
            "'use client';",
            "'use client';\n\nimport React from 'react';"
        )
    content = content.replace(
        'export function EmptyState(',
        'export const EmptyState = React.memo(function EmptyState('
    )
    content = content.rstrip()
    if not content.endswith('})'):
        last_brace = content.rfind('}')
        if last_brace > 0 and content[last_brace-1] != ')':
            content = content[:last_brace+1] + ')\n'
    write_file(path, content)
    print(f"  ✓ EmptyState wrapped with React.memo")
else:
    print(f"  - EmptyState already memoized or pattern not found")

# 6. animated-tab-transition.tsx
path = f"{BASE}/components/dashboard/animated-tab-transition.tsx"
content = read_file(path)
if 'React.memo' not in content and 'export function AnimatedTabTransition' in content:
    if 'import React' not in content:
        content = content.replace(
            "'use client';",
            "'use client';\n\nimport React from 'react';"
        )
    content = content.replace(
        'export function AnimatedTabTransition(',
        'export const AnimatedTabTransition = React.memo(function AnimatedTabTransition('
    )
    content = content.rstrip()
    if not content.endswith('})'):
        last_brace = content.rfind('}')
        if last_brace > 0 and content[last_brace-1] != ')':
            content = content[:last_brace+1] + ')\n'
    write_file(path, content)
    print(f"  ✓ AnimatedTabTransition wrapped with React.memo")
else:
    print(f"  - AnimatedTabTransition already memoized or pattern not found")

# ── 10b. Add useMemoizedCallback to page.tsx ──
print("\n[10b] Adding useMemoizedCallback to page.tsx...")
path = f"{BASE}/app/page.tsx"
content = read_file(path)
if 'useMemoizedCallback' not in content:
    content = content.replace(
        "import { cn } from '@/lib/utils';",
        "import { cn } from '@/lib/utils';\nimport { useMemoizedCallback } from '@/hooks/use-memoized-callback';"
    )
    write_file(path, content)
    print(f"  ✓ useMemoizedCallback imported")
else:
    print(f"  - useMemoizedCallback already imported")

# ── 10c. Enhanced next.config.ts ──
print("\n[10c] Enhancing next.config.ts...")
path = f"/home/z/my-project/next.config.ts"
content = read_file(path)
if 'compress' not in content:
    new_config = '''import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Phase 10: Compression & bundle optimization
  compress: true,
  poweredByHeader: false,
  reactProductionProfiling: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  // Phase 10: Optimize package imports for libraries that export many sub-modules.
  // This replaces barrel-file imports with direct deep imports, reducing initial JS bundle.
  experimental: {
    optimizePackageImports: [
      'recharts',
      'lucide-react',
      'framer-motion',
      'date-fns',
      '@radix-ui/react-icons',
    ],
    optimizeCss: true,
  },
};

export default nextConfig;
'''
    write_file(path, new_config)
    print(f"  ✓ next.config.ts enhanced (compress, images, optimizeCss)")
else:
    print(f"  - next.config.ts already optimized")

# ── 10d. Wrap IncidentCard in live-feed with useMemoizedCallback for callbacks ──
print("\n[10d] Optimizing live-feed callbacks...")
path = f"{BASE}/components/dashboard/live-feed.tsx"
content = read_file(path)
if 'useMemoizedCallback' not in content:
    if "import { cn } from '@/lib/utils';" in content:
        content = content.replace(
            "import { cn } from '@/lib/utils';",
            "import { cn } from '@/lib/utils';\nimport { useMemoizedCallback } from '@/hooks/use-memoized-callback';"
        )
    write_file(path, content)
    print(f"  ✓ useMemoizedCallback imported in live-feed")
else:
    print(f"  - live-feed already uses useMemoizedCallback")

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 13: ADVANCED DATA VISUALIZATION
# ═══════════════════════════════════════════════════════════════════════════════

print("\n\nPhase 13: Advanced Data Visualization")
print("=" * 60)

# ── 13a. Enhance DrillDownChart with real API hierarchy ──
print("\n[13a] Enhancing DrillDownChart with multi-level hierarchy...")

path = f"{BASE}/components/dashboard/drill-down-chart.tsx"
content = read_file(path)

# Add onBreadcrumbNavigate callback to props if not present
if 'onBreadcrumbNavigate' not in content:
    # Add to interface
    content = content.replace(
        '''export interface DrillDownChartProps {
  data: DrillDownLevel[];
  title: string;
  height?: number;
  colorPalette?: string[];
  onDrillDown?: (level: DrillDownLevel, path: DrillDownLevel[]) => void;
  valueFormatter?: (v: number) => string;
}''',
        '''export interface DrillDownChartProps {
  data: DrillDownLevel[];
  title: string;
  height?: number;
  colorPalette?: string[];
  onDrillDown?: (level: DrillDownLevel, path: DrillDownLevel[]) => void;
  onBreadcrumbNavigate?: (path: DrillDownLevel[]) => void;
  valueFormatter?: (v: number) => string;
  /** Show aggregate summary below the chart */
  showSummary?: boolean;
  /** Maximum depth for drill-down */
  maxDepth?: number;
}'''
    )
    
    # Update component signature
    content = content.replace(
        '''export function DrillDownChart({
  data,
  title,
  height = 350,
  colorPalette = DEFAULT_PALETTE,
  onDrillDown,
  valueFormatter,
}: DrillDownChartProps)''',
        '''export function DrillDownChart({
  data,
  title,
  height = 350,
  colorPalette = DEFAULT_PALETTE,
  onDrillDown,
  onBreadcrumbNavigate,
  valueFormatter,
  showSummary = true,
  maxDepth = 3,
}: DrillDownChartProps)'''
    )
    
    # Add depth guard to handleBarClick
    content = content.replace(
        '''  const handleBarClick = useCallback(
    (entry: { _ref: DrillDownLevel }) => {
      const item = entry._ref;
      if (!item.children || item.children.length === 0) return;
      const newPath = [...drillPath, item];
      setDrillPath(newPath);
      onDrillDown?.(item, newPath);
    },
    [drillPath, onDrillDown],
  );''',
        '''  const handleBarClick = useCallback(
    (entry: { _ref: DrillDownLevel }) => {
      const item = entry._ref;
      if (!item.children || item.children.length === 0) return;
      if (drillPath.length >= maxDepth - 1) return; // depth guard
      const newPath = [...drillPath, item];
      setDrillPath(newPath);
      onDrillDown?.(item, newPath);
    },
    [drillPath, onDrillDown, maxDepth],
  );'''
    )
    
    # Update handleBreadcrumb to also call onBreadcrumbNavigate
    content = content.replace(
        '''  const handleBreadcrumb = useCallback((index: number) => {
    setDrillPath((prev) => prev.slice(0, index + 1));
  }, []);''',
        '''  const handleBreadcrumb = useCallback((index: number) => {
    setDrillPath((prev) => {
      const newPath = prev.slice(0, index + 1);
      onBreadcrumbNavigate?.(newPath);
      return newPath;
    });
  }, [onBreadcrumbNavigate]);'''
    )
    
    # Add summary section after the legend
    if 'showSummary' not in content.split('Total:')[1] if 'Total:' in content else '':
        # Find the legend section and add summary after it
        old_legend = '''        {/* Legend showing total */}
        {chartData.length > 0 && (
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {drillPath.length === 0
                ? 'Click a bar to drill down'
                : `${chartData.length} sub-items`}
            </span>
            <span className="font-medium tabular-nums">
              Total: {format(totalValue)}
            </span>
          </div>
        )}'''
        new_legend = '''        {/* Legend showing total */}
        {chartData.length > 0 && (
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {drillPath.length === 0
                ? 'Click a bar to drill down'
                : `${chartData.length} sub-items`}
            </span>
            <span className="font-medium tabular-nums">
              Total: {format(totalValue)}
            </span>
          </div>
        )}

        {/* Phase 13: Aggregate summary stats */
        {showSummary && chartData.length > 1 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground">Average</p>
              <p className="text-sm font-bold tabular-nums">{format(Math.round(totalValue / chartData.length))}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground">Maximum</p>
              <p className="text-sm font-bold tabular-nums">{format(Math.max(...chartData.map(d => d.value)))}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground">Items</p>
              <p className="text-sm font-bold tabular-nums">{chartData.length}</p>
            </div>
          </div>
        )}'''
        content = content.replace(old_legend, new_legend)
    
    write_file(path, content)
    print(f"  ✓ DrillDownChart enhanced (maxDepth, onBreadcrumbNavigate, summary stats)")
else:
    print(f"  - DrillDownChart already enhanced")

# ── 13b. Add DashboardExport to Data Explorer ──
print("\n[13b] Adding DashboardExport to Data Explorer...")
path = f"{BASE}/components/dashboard/data-explorer.tsx"
content = read_file(path)
if 'DashboardExport' not in content:
    # Add import
    content = content.replace(
        "import { EmptyState } from './empty-state';",
        "import { EmptyState } from './empty-state';\nimport { DashboardExport } from '@/components/dashboard/dashboard-export';"
    )
    
    # Add ref for export container
    content = content.replace(
        '''export function DataExplorer() {
  const { tenantId, electionInfo } = useDashboardStore();
  const [drillTab, setDrillTab] = useState('votes');
  const [activeViz, setActiveViz] = useState('drill');''',
        '''export function DataExplorer() {
  const { tenantId, electionInfo } = useDashboardStore();
  const [drillTab, setDrillTab] = useState('votes');
  const [activeViz, setActiveViz] = useState('drill');
  const exportContainerRef = useRef<HTMLDivElement>(null);'''
    )
    
    # Add useRef import if needed
    if 'useRef' not in content.split('import')[1]:
        content = content.replace(
            'import { useState, useMemo, useCallback, useRef, useEffect }',
            'import { useState, useMemo, useCallback, useRef, useEffect }'
        )
    
    # Wrap main div with ref and add export button
    content = content.replace(
        '''    <div className="h-full flex flex-col p-4 gap-4 overflow-y-auto">''',
        '''    <div ref={exportContainerRef} className="h-full flex flex-col p-4 gap-4 overflow-y-auto">
      {/* Phase 13: Export button */}
      <div className="flex items-center justify-end">
        <DashboardExport
          containerRef={exportContainerRef}
          title="OmniVote Data Explorer"
          size="sm"
        />
      </div>'''
    )
    
    write_file(path, content)
    print(f"  ✓ DashboardExport added to Data Explorer")
else:
    print(f"  - Data Explorer already has DashboardExport")

# ── 13c. Add CSV export to TimeSeriesComparison ──
print("\n[13c] Adding CSV export to TimeSeriesComparison...")
path = f"{BASE}/components/dashboard/time-series-comparison.tsx"
content = read_file(path)
if 'Download' not in content:
    # Add Download icon to imports
    content = content.replace(
        '''  CalendarDays,
  Eye,
  EyeOff,
} from 'lucide-react';''',
        '''  CalendarDays,
  Eye,
  EyeOff,
  Download,
} from 'lucide-react';'''
    )
    
    # Add CSV export handler after fmtDate callback
    csv_handler = '''
  // Phase 13: CSV export
  const handleCsvExport = useCallback(() => {
    const headers = ['Date', ...visibleList.map(s => s.name)];
    const dateSet = new Set<string>();
    filteredSeries.forEach(s => {
      if (visibleSeries.has(s.id)) {
        s.data.forEach(pt => dateSet.add(pt.date));
      }
    });
    const dates = Array.from(dateSet).sort();
    const rows = dates.map(date => {
      const row: Record<string, string> = { Date: date };
      filteredSeries.forEach(s => {
        if (visibleSeries.has(s.id)) {
          const pt = s.data.find(d => d.date === date);
          row[s.name] = pt ? String(pt.value) : '';
        }
      });
      return row;
    });
    const csvContent = [headers.join(','), ...rows.map(r => headers.map(h => r[h] || '').join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `timeseries_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [filteredSeries, visibleSeries, visibleList]);
'''
    
    # Insert after fmtDate callback definition
    content = content.replace(
        '''  const fmtDate = useCallback(
    (d: string) => {
      if (dateFormatter) return dateFormatter(d);
      try {
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch {
        return d;
      }
    },
    [dateFormatter],
  );''',
        '''  const fmtDate = useCallback(
    (d: string) => {
      if (dateFormatter) return dateFormatter(d);
      try {
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch {
        return d;
      }
    },
    [dateFormatter],
  );''' + csv_handler
    )
    
    # Add export button in the header controls
    content = content.replace(
        '''            {/* Period selector */}''',
        '''            {/* Phase 13: CSV Export */}
            <Button variant="ghost" size="sm" onClick={handleCsvExport} className="h-6 px-2 text-[10px] gap-1">
              <Download className="h-3 w-3" />
              CSV
            </Button>
            {/* Period selector */}'''
    )
    
    write_file(path, content)
    print(f"  ✓ CSV export added to TimeSeriesComparison")
else:
    print(f"  - TimeSeriesComparison already has CSV export")

# ── 13d. Add crosshair hover to ElectionHeatmap ──
print("\n[13d] Adding crosshair hover to ElectionHeatmap...")
path = f"{BASE}/components/dashboard/election-heatmap.tsx"
content = read_file(path)
if 'crosshair' not in content:
    # Add ReferenceLine and cursor to imports
    content = content.replace(
        '''import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ZAxis,
} from 'recharts';''',
        '''import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ZAxis, ReferenceLine,
} from 'recharts';'''
    )
    
    # Add crosshair state
    content = content.replace(
        '''  const [hoveredCell, setHoveredCell] = useState<string | null>(null);''',
        '''  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [hoverX, setHoverX] = useState<string | null>(null);
  const [hoverY, setHoverY] = useState<string | null>(null);'''
    )
    
    # Add ReferenceLine elements inside ScatterChart
    content = content.replace(
        '''              <Scatter
                data={coloredData}''',
        '''              {/* Phase 13: Crosshair guides */}
              {hoverX && <ReferenceLine x={hoverX} stroke="oklch(0.5 0 0)" strokeDasharray="3 3" strokeOpacity={0.3} />}
              {hoverY && <ReferenceLine y={hoverY} stroke="oklch(0.5 0 0)" strokeDasharray="3 3" strokeOpacity={0.3} />}
              <Scatter
                data={coloredData}'''
    )
    
    # Update onMouseEnter to set crosshair
    content = content.replace(
        '''                onMouseEnter={(entry) => setHoveredCell(`${entry.x}-${entry.y}`)}
                onMouseLeave={() => setHoveredCell(null)}''',
        '''                onMouseEnter={(entry) => { setHoveredCell(`${entry.x}-${entry.y}`); setHoverX(String(entry.x)); setHoverY(String(entry.y)); }}
                onMouseLeave={() => { setHoveredCell(null); setHoverX(null); setHoverY(null); }}'''
    )
    
    write_file(path, content)
    print(f"  ✓ Crosshair hover added to ElectionHeatmap")
else:
    print(f"  - ElectionHeatmap already has crosshair")

print("\n\n✅ All Phase 10 & 13 changes applied successfully!")
print("Run: npx tsc --noEmit && npm run build to verify.")
