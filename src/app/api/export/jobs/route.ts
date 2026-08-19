import { NextRequest, NextResponse } from 'next/server';
import { exportJobQueue } from '@/lib/export-pipeline';
import { getAuthUser } from '@/lib/auth';

/**
 * GET /api/export/jobs — List export jobs for the current tenant.
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const jobs = exportJobQueue.getJobsByTenant(authUser.tenantId);
    return NextResponse.json({ jobs, stats: exportJobQueue.stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list jobs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/export/jobs?id=xxx — Get a specific job status.
 * (query param `id` used to avoid dynamic route conflicts)
 */
export async function HEAD(req: NextRequest) {
  // Allow checking job status via HEAD
  return GET(req);
}