# Refactor & Sparklines — Work Record

## Task
Split monolithic page.tsx (868 lines) into modules + add KPI trend sparklines.

## Files Created (6 new)

| File | Lines | Purpose |
|------|-------|---------|
| `src/types/dashboard.ts` | 72 | Shared types: `Incident`, `DashboardData`, `AlertsData`, `MapBoundsData`, `TabContentProps` |
| `src/components/dashboard/lazy-components.tsx` | 96 | All `next/dynamic` imports + `TAB_SKELETONS` + `createDynamic` helper |
| `src/components/dashboard/tab-renderer.tsx` | 227 | `TabContent` component: switch on `activeTab`, renders correct lazy component wrapped in `ErrorBoundary` |
| `src/hooks/use-dashboard-websocket.ts` | 218 | `useDashboardWebSocket` hook: WS + SSE event handlers, `liveIncidents` state, toast notifications |
| `src/components/dashboard/overview-tab.tsx` | 141 | `OverviewTab` component: KPI grid, quick actions, election widgets, embedded live feed |

## Files Modified (4)

| File | Before | After | Change |
|------|--------|-------|--------|
| `src/app/page.tsx` | 868 | **247** | Removed all tab rendering, WS logic, OverviewTab. Now just: auth, data queries, layout shell, delegates to `TabContent` |
| `src/components/dashboard/kpi-grid.tsx` | 289 | 440 | Added `MiniSparkline` SVG component, `generateSparkData` (4 modes), `sparkline` prop on `KpiCard`, sparklines on all 6 primary KPI cards |
| `src/components/dashboard/live-feed.tsx` | — | — | Updated import: `@/app/page` → `@/types/dashboard` |
| `src/components/dashboard/incident-detail-slideover.tsx` | — | — | Updated import: `@/app/page` → `@/types/dashboard` |

## Part A: Extraction Summary

- **page.tsx reduced from 868 → 247 lines (71.6% reduction)**
- Zero circular dependencies (lazy-components breaks the cycle between tab-renderer and overview-tab)
- `Incident` type re-exported from page.tsx for backward compat (though all consumers updated)
- All lint and TypeScript errors resolved in new files
- `tsc --noEmit`: **0 errors**

## Part B: KPI Sparklines

### MiniSparkline Component
- Renders inline SVG with smooth cubic bezier path through 12 data points
- Gradient fill under the line using CSS custom properties (`var(--color-emerald)` etc.)
- Responsive via `viewBox`, default 60×24px
- End-point dot indicator
- Unique gradient IDs prevent SVG conflicts

### Sparkline Data Generation
4 deterministic modes using seeded pseudo-random (consistent across renders):
- **`stable`** — Agents Online: small ±6% fluctuations
- **`rising`** — Polling Units / Avg Turnout: upward trend with noise
- **`walk`** — Total Incidents / Quarantined: random walk trending to current value
- **`volatile`** — Critical/SOS: ±12% swings, spiky pattern

### KPI Cards with Sparklines
| Card | Color | Mode |
|------|-------|------|
| Agents Online | emerald | stable |
| Polling Units | cyan | rising |
| Avg Turnout | emerald | rising |
| Total Incidents | amber | walk |
| Critical / SOS | rose | volatile |
| Quarantined | violet | walk |

Sparkline appears below the card content, right-aligned.
