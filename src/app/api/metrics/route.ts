import { NextResponse, NextRequest } from 'next/server';
import { sloTracker, latencyHistogram, requestCounter, activeConnections } from '@/lib/sre';
import { errorTracker, alertManager } from '@/lib/monitoring';
import { getWebVitalsAggregator } from '@/lib/monitoring/web-vitals-aggregator';
import { broadcastWebVitals } from '@/lib/ws-broadcast';

let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await sloTracker.init();
    initialized = true;
  }
}

/**
 * GET /api/metrics — Prometheus-compatible metrics endpoint.
 *
 * Returns metrics in Prometheus text exposition format.
 * This endpoint is meant to be scraped by a Prometheus server.
 */
export async function GET() {
  await ensureInit();

  const now = Date.now();
  const lines: string[] = [];

  // ─── Process metrics ──────────────────────────────────────────────
  const memUsage = process.memoryUsage();
  const uptimeSeconds = process.uptime();

  lines.push('# HELP omnivote_process_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE omnivote_process_uptime_seconds gauge');
  lines.push(`omnivote_process_uptime_seconds ${uptimeSeconds}`);
  lines.push('');

  lines.push('# HELP omnivote_process_memory_rss_bytes Process RSS memory in bytes');
  lines.push('# TYPE omnivote_process_memory_rss_bytes gauge');
  lines.push(`omnivote_process_memory_rss_bytes ${memUsage.rss}`);
  lines.push('');

  lines.push('# HELP omnivote_process_memory_heap_used_bytes Process heap used in bytes');
  lines.push('# TYPE omnivote_process_memory_heap_used_bytes gauge');
  lines.push(`omnivote_process_memory_heap_used_bytes ${memUsage.heapUsed}`);
  lines.push('');

  lines.push('# HELP omnivote_process_memory_heap_total_bytes Process heap total in bytes');
  lines.push('# TYPE omnivote_process_memory_heap_total_bytes gauge');
  lines.push(`omnivote_process_memory_heap_total_bytes ${memUsage.heapTotal}`);
  lines.push('');

  lines.push('# HELP omnivote_process_memory_external_bytes Process external memory in bytes');
  lines.push('# TYPE omnivote_process_memory_external_bytes gauge');
  lines.push(`omnivote_process_memory_external_bytes ${memUsage.external || 0}`);
  lines.push('');

  // ─── WebSocket connections ────────────────────────────────────────
  lines.push('# HELP omnivote_websocket_connections_active Number of active WebSocket connections');
  lines.push('# TYPE omnivote_websocket_connections_active gauge');
  lines.push(`omnivote_websocket_connections_active ${activeConnections.getValue()}`);
  lines.push('');

  // ─── Request counters ─────────────────────────────────────────────
  const counterMetrics = requestCounter.getMetrics();

  lines.push('# HELP omnivote_http_requests_total Total HTTP requests');
  lines.push('# TYPE omnivote_http_requests_total counter');
  lines.push(`omnivote_http_requests_total ${counterMetrics.total}`);
  lines.push('');

  lines.push('# HELP omnivote_http_errors_total Total HTTP 5xx errors');
  lines.push('# TYPE omnivote_http_errors_total counter');
  lines.push(`omnivote_http_errors_total ${counterMetrics.errors5xx}`);
  lines.push('');

  lines.push('# HELP omnivote_http_client_errors_total Total HTTP 4xx errors');
  lines.push('# TYPE omnivote_http_client_errors_total counter');
  lines.push(`omnivote_http_client_errors_total ${counterMetrics.errors4xx}`);
  lines.push('');

  // Per-route request totals
  for (const [route, count] of Object.entries(counterMetrics.byRoute)) {
    const escapedRoute = route.replace(/[^a-zA-Z0-9_]/g, '_');
    lines.push(`omnivote_http_requests_total{route="${escapedRoute}"} ${count}`);
  }
  lines.push('');

  // Per-status code totals
  for (const [status, count] of Object.entries(counterMetrics.byStatus)) {
    lines.push(`omnivote_http_responses_total{status="${status}"} ${count}`);
  }
  lines.push('');

  // ─── Latency histograms (per route) ───────────────────────────────
  lines.push('# HELP omnivote_http_request_duration_seconds Request duration in seconds');
  lines.push('# TYPE omnivote_http_request_duration_seconds histogram');

  for (const route of latencyHistogram.getAllRoutes()) {
    const escapedRoute = route.replace(/[^a-zA-Z0-9_]/g, '_');
    const buckets = latencyHistogram.getBuckets(route);
    for (const b of buckets) {
      const le = b.le === Infinity ? '+Inf' : (b.le / 1000).toString();
      lines.push(`omnivote_http_request_duration_seconds_bucket{route="${escapedRoute}",le="${le}"} ${b.count}`);
    }
    const total = buckets[buckets.length - 1].count;
    lines.push(`omnivote_http_request_duration_seconds_count{route="${escapedRoute}"} ${total}`);
    // _sum is approximated (we store counts, not sum of durations)
    lines.push(`omnivote_http_request_duration_seconds_sum{route="${escapedRoute}"} 0`);
  }
  lines.push('');

  // ─── SLO compliance gauges ────────────────────────────────────────
  const reports = sloTracker.getAllReports();
  lines.push('# HELP omnivote_slo_compliance Current SLO compliance (1=compliant, 0=non-compliant)');
  lines.push('# TYPE omnivote_slo_compliance gauge');
  for (const report of reports) {
    lines.push(`omnivote_slo_compliance{slo="${report.slo.name}"} ${report.compliant ? 1 : 0}`);
  }
  lines.push('');

  lines.push('# HELP omnivote_slo_current_sli Current SLI value (0-1)');
  lines.push('# TYPE omnivote_slo_current_sli gauge');
  for (const report of reports) {
    lines.push(`omnivote_slo_current_sli{slo="${report.slo.name}"} ${report.currentSLI}`);
  }
  lines.push('');

  lines.push('# HELP omnivote_slo_error_budget_remaining Error budget remaining (0-100%)');
  lines.push('# TYPE omnivote_slo_error_budget_remaining gauge');
  for (const report of reports) {
    lines.push(`omnivote_slo_error_budget_remaining{slo="${report.slo.name}"} ${report.errorBudget.budgetPercent}`);
  }
  lines.push('');

  lines.push('# HELP omnivote_slo_burn_rate SLO burn rate (1=on target, >1=burning faster)');
  lines.push('# TYPE omnivote_slo_burn_rate gauge');
  for (const report of reports) {
    lines.push(`omnivote_slo_burn_rate{slo="${report.slo.name}"} ${report.errorBudget.burnRate}`);
  }
  lines.push('');

  // ─── Error tracker stats ──────────────────────────────────────────
  const errorStats = errorTracker.getStats();

  lines.push('# HELP omnivote_errors_total Total captured errors');
  lines.push('# TYPE omnivote_errors_total counter');
  lines.push(`omnivote_errors_total ${errorStats.total}`);
  lines.push('');

  lines.push('# HELP omnivote_errors_by_severity Errors grouped by severity');
  lines.push('# TYPE omnivote_errors_by_severity gauge');
  for (const [severity, count] of Object.entries(errorStats.bySeverity)) {
    lines.push(`omnivote_errors_by_severity{severity="${severity}"} ${count}`);
  }
  lines.push('');

  lines.push('# HELP omnivote_errors_by_route Errors grouped by route');
  lines.push('# TYPE omnivote_errors_by_route gauge');
  for (const [route, count] of Object.entries(errorStats.byRoute)) {
    const escapedRoute = route.replace(/[^a-zA-Z0-9_]/g, '_');
    lines.push(`omnivote_errors_by_route{route="${escapedRoute}"} ${count}`);
  }
  lines.push('');

  lines.push('# HELP omnivote_errors_last_hour Errors in the last hour');
  lines.push('# TYPE omnivote_errors_last_hour gauge');
  lines.push(`omnivote_errors_last_hour ${errorStats.lastHour}`);
  lines.push('');

  lines.push('# HELP omnivote_errors_last_24h Errors in the last 24 hours');
  lines.push('# TYPE omnivote_errors_last_24h gauge');
  lines.push(`omnivote_errors_last_24h ${errorStats.last24h}`);
  lines.push('');

  // ─── Alert manager stats ──────────────────────────────────────────
  const activeAlerts = alertManager.getActiveAlerts();

  lines.push('# HELP omnivote_alerts_active Number of currently active alerts');
  lines.push('# TYPE omnivote_alerts_active gauge');
  lines.push(`omnivote_alerts_active ${activeAlerts.length}`);
  lines.push('');

  lines.push('# HELP omnivote_alerts_by_severity Active alerts by severity');
  lines.push('# TYPE omnivote_alerts_by_severity gauge');
  for (const severity of ['info', 'warning', 'critical'] as const) {
    const count = activeAlerts.filter(a => a.severity === severity).length;
    lines.push(`omnivote_alerts_by_severity{severity="${severity}"} ${count}`);
  }
  lines.push('');

  // ─── Web Vitals aggregation (Phase 19) ──────────────────────────────
  const vitalsAgg = getWebVitalsAggregator();
  lines.push(vitalsAgg.toPrometheus());

  // ─── Build response ───────────────────────────────────────────────
  const body = lines.join('\n');

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

/**
 * POST /api/metrics — Accept client-side metrics (web vitals, client errors).
 *
 * Phase 15: This endpoint now accepts fire-and-forget POST payloads from:
 *   - PerformanceObserver component (web vitals)
 *   - ErrorBoundary (client errors)
 *   - usePerformanceMetrics hook
 *
 * Body shape:
 *   { type: 'web-vital', name, value, timestamp }
 *   { type: 'web-vitals', component, renderTime, fcp, lcp, cls, timestamp }
 *   { type: 'client-error', message, stack, componentStack, severity?, tags?, route? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type } = body;

    if (type === 'client-error') {
      // Forward client errors to the error tracker
      errorTracker.capture(body.message || 'Unknown client error', {
        severity: body.severity || 'error',
        context: {
          route: body.route,
        },
        tags: body.tags || ['client'],
        fingerprint: `client:${body.message || 'unknown'}`,
      });
    }
    // Phase 19: Aggregate web vitals for real-time analysis
    if (type === 'web-vital') {
      const aggregator = getWebVitalsAggregator();
      aggregator.record({
        name: body.name,
        value: body.value,
        timestamp: body.timestamp || new Date().toISOString(),
        route: body.route,
        navigationId: body.navigationId,
        deviceType: body.deviceType,
        connectionType: body.connectionType,
      });
      // Phase 21: Broadcast aggregated vitals to connected dashboards
      broadcastVitalsSnapshot(aggregator, body.tenantId);
    }
    if (type === 'web-vitals') {
      const aggregator = getWebVitalsAggregator();
      const vitals = body.vitals || [];
      aggregator.recordBatch(
        vitals.map((v: { name: string; value: number; timestamp?: string }) => ({
          name: v.name,
          value: v.value,
          timestamp: v.timestamp || new Date().toISOString(),
          route: body.route,
        }))
      );
      // Phase 21: Broadcast aggregated vitals to connected dashboards
      broadcastVitalsSnapshot(aggregator, body.tenantId);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // always 200 to not break fire-and-forget
  }
}

/**
 * Broadcast a vitals snapshot to connected dashboards via WebSocket.
 * Extracted as a helper to keep the POST handler clean.
 * Uses a default tenant for the global dashboard view.
 */
function broadcastVitalsSnapshot(
  aggregator: ReturnType<typeof getWebVitalsAggregator>,
  tenantId?: string,
) {
  // Only broadcast every ~5s to avoid flooding WebSocket clients
  const now = Date.now();
  if (!broadcastVitalsSnapshot.lastBroadcast || now - broadcastVitalsSnapshot.lastBroadcast > 5000) {
    broadcastVitalsSnapshot.lastBroadcast = now;
    const tid = tenantId || 'default';
    broadcastWebVitals(tid, {
      stats: aggregator.getAllStats() as Record<string, unknown>,
      healthScore: aggregator.getHealthScore(),
      anomalies: aggregator.getAnomalies({ limit: 20 }),
      anomalyCounts: aggregator.getAnomalyCounts(),
      totalEvents: aggregator.getTotalEvents(),
      budgetCompliance: aggregator.getBudgetCompliance() as Record<string, unknown>,
      routes: aggregator.getRoutes(),
      bufferUtilization: aggregator.getBufferUtilization(),
    });
  }
}
broadcastVitalsSnapshot.lastBroadcast = 0;
