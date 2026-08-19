import { NextResponse } from 'next/server';
import { getWebVitalsAggregator } from '@/lib/monitoring/web-vitals-aggregator';

/**
 * GET /api/metrics/web-vitals — Web Vitals dashboard data.
 *
 * Query params:
 *   route  — filter by route path
 *   metric — filter by specific metric name (LCP, CLS, etc.)
 *
 * Returns:
 *   { stats, anomalies, healthScore, routes, budgetCompliance, anomalyCounts, totalEvents }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const route = url.searchParams.get('route') || undefined;
  const metric = url.searchParams.get('metric') || undefined;

  const agg = getWebVitalsAggregator();

  // Get stats for all metrics or a specific one
  let stats: Record<string, ReturnType<typeof agg.getStats>>;
  if (metric) {
    const s = agg.getStats(metric, route);
    stats = s ? { [metric]: s } : {};
  } else {
    stats = agg.getAllStats(route) as Record<string, ReturnType<typeof agg.getStats>>;
  }

  // Get anomalies
  const anomalies = agg.getAnomalies({
    metric: metric || undefined,
    route,
    limit: 50,
  });

  return NextResponse.json({
    stats,
    anomalies,
    healthScore: agg.getHealthScore(),
    routes: agg.getRoutes(),
    budgetCompliance: agg.getBudgetCompliance(),
    anomalyCounts: agg.getAnomalyCounts(),
    totalEvents: agg.getTotalEvents(),
    bufferUtilization: agg.getBufferUtilization(),
  });
}

/**
 * DELETE /api/metrics/web-vitals — Clear all aggregated vitals.
 * Useful for testing or after deployment resets.
 */
export async function DELETE() {
  const agg = getWebVitalsAggregator();
  agg.clear();
  return NextResponse.json({ ok: true });
}
