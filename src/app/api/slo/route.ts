import { NextResponse } from 'next/server';
import { sloTracker, SLO_DEFINITIONS, ELECTION_DAY_SLOS } from '@/lib/sre';

// Initialize tracker on first request (lazy init)
let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await sloTracker.init();
    initialized = true;
  }
}

/**
 * GET /api/slo — Get all SLO reports, error budgets, and deployment freeze status.
 */
export async function GET() {
  await ensureInit();

  const reports = sloTracker.getAllReports();
  const freezeStatus = sloTracker.isDeploymentFrozen();

  // 1-hour window metrics for recent activity
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentMetrics = sloTracker.getAggregatedMetrics(oneHourAgo);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    sloDefinitions: SLO_DEFINITIONS,
    electionDaySLOs: ELECTION_DAY_SLOS,
    reports: reports.map(r => ({
      name: r.slo.name,
      target: r.slo.sloTarget,
      targetPercent: `${(r.slo.sloTarget * 100).toFixed(2)}%`,
      currentSLI: r.currentSLI,
      currentSLIPercent: `${(r.currentSLI * 100).toFixed(4)}%`,
      compliant: r.compliant,
      errorBudget: {
        totalRequests: r.errorBudget.totalRequests,
        failedRequests: r.errorBudget.failedRequests,
        allowedFailures: r.errorBudget.allowedFailures,
        remainingFailures: r.errorBudget.remainingFailures,
        budgetPercent: Math.round(r.errorBudget.budgetPercent * 10) / 10,
        burnRate: Math.round(r.errorBudget.burnRate * 100) / 100,
        status: r.errorBudget.status,
      },
      window: {
        days: r.slo.windowDays,
        start: new Date(r.windowStart).toISOString(),
        end: new Date(r.windowEnd).toISOString(),
      },
    })),
    deploymentFreeze: freezeStatus,
    recentMetrics: {
      window: '1h',
      totalRequests: recentMetrics.totalRequests,
      failedRequests: recentMetrics.failedRequests,
      avgLatencyMs: recentMetrics.avgLatencyMs,
      p95LatencyMs: recentMetrics.p95LatencyMs,
      errorRate: recentMetrics.totalRequests > 0
        ? (recentMetrics.failedRequests / recentMetrics.totalRequests * 100).toFixed(2) + '%'
        : 'N/A',
    },
  });
}
