import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { alertManager } from '@/lib/monitoring';
import { errorTracker } from '@/lib/monitoring';

/**
 * GET /api/monitoring/alerts — Active alerts, history, and error stats.
 * Requires authentication.
 */
export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const activeAlerts = alertManager.getActiveAlerts();
  const history = alertManager.getAlertHistory(50);
  const errorStats = errorTracker.getStats();

  return NextResponse.json({
    alerts: activeAlerts,
    history,
    errorStats,
  });
}
