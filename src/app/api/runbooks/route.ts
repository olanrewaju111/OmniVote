import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { RUNBOOKS, getRunbooksBySeverity } from '@/lib/sre';

async function requireAuth(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  return null;
}

/**
 * GET /api/runbooks — List all runbooks, optionally filtered by severity.
 */
export async function GET(request: Request) {
  const authErr = await requireAuth(request);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const severity = searchParams.get('severity');

  let runbooks = RUNBOOKS;

  if (severity) {
    const validSeverities = ['critical', 'high', 'medium', 'low'];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      );
    }
    runbooks = getRunbooksBySeverity(severity as 'critical' | 'high' | 'medium' | 'low');
  }

  return NextResponse.json({
    total: runbooks.length,
    runbooks: runbooks.map(rb => ({
      id: rb.id,
      title: rb.title,
      severity: rb.severity,
      description: rb.description,
      triggerCondition: rb.triggerCondition,
      estimatedRecoveryTime: rb.estimatedRecoveryTime,
      stepCount: rb.steps.length,
      lastUpdated: rb.lastUpdated,
    })),
  });
}