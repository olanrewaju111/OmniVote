import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { runRetention, runRetentionForAllTenants } from '@/lib/audit-engine';
import { requireCsrf } from '@/lib/security/csrf-enforce';

/**
 * GET /api/admin/audit/retention?tenantId=xxx&execute=false
 * POST /api/admin/audit/retention { tenantId?, execute?, retentionDays? }
 *
 * Scan or execute data retention cleanup.
 * SUPER_ADMIN can scan all tenants and execute deletions.
 * TENANT_ADMIN can only scan their own tenant (dry-run only).
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url || 'http://localhost');
    const tenantId = searchParams.get('tenantId');
    const execute = searchParams.get('execute') === 'true';

    if (authUser.role === 'TENANT_ADMIN' && tenantId && tenantId !== authUser.tenantId) {
      return NextResponse.json({ error: 'Cannot access other tenant data' }, { status: 403 });
    }

    if (tenantId) {
      const result = await runRetention(tenantId, 365, execute);
      return NextResponse.json(result);
    }

    // SUPER_ADMIN: scan all tenants
    if (authUser.role === 'SUPER_ADMIN') {
      const results = await runRetentionForAllTenants(execute);
      return NextResponse.json({
        tenants: results.length,
        results,
        totalEligible: results.reduce((s, r) => s + r.scanned.reduce((ss, e) => ss + Math.max(0, e.eligibleCount), 0), 0),
        totalDeleted: results.reduce((s, r) => s + r.totalDeleted, 0),
      });
    }

    // TENANT_ADMIN without explicit tenantId: scan their own
    const result = await runRetention(authUser.tenantId, 365, execute);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Retention scan failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
    // CSRF protection
    const csrfErr = requireCsrf(req);
    if (csrfErr) return csrfErr;

  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(authUser.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  let body: { tenantId?: string; execute?: boolean; retentionDays?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tenantId = body.tenantId || authUser.tenantId;
  if (authUser.role === 'TENANT_ADMIN' && tenantId !== authUser.tenantId) {
    return NextResponse.json({ error: 'Cannot access other tenant data' }, { status: 403 });
  }

  const retentionDays = body.retentionDays || 365;
  const execute = body.execute === true;

  if (execute && authUser.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only SUPER_ADMIN can execute deletions' }, { status: 403 });
  }

  const result = await runRetention(tenantId, retentionDays, execute);
  return NextResponse.json(result);
}