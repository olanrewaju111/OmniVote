import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getTenantDataStats, getAllTenantStats, getGlobalStats } from '@/lib/audit-engine';

/**
 * GET /api/admin/audit/stats?tenantId=xxx&global=true
 *
 * SUPER_ADMIN: can see all tenants or global stats.
 * TENANT_ADMIN: can only see their own tenant stats.
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
    const global = searchParams.get('global') === 'true';

    // Global stats — SUPER_ADMIN only
    if (global && authUser.role === 'SUPER_ADMIN') {
      const result = await getGlobalStats();
      return NextResponse.json(result);
    }

    // All tenants stats — SUPER_ADMIN only
    if (!tenantId && authUser.role === 'SUPER_ADMIN') {
      const results = await getAllTenantStats();
      return NextResponse.json({ tenants: results.length, stats: results });
    }

    // Specific tenant or self
    const targetTenant = tenantId || authUser.tenantId;
    if (authUser.role === 'TENANT_ADMIN' && targetTenant !== authUser.tenantId) {
      return NextResponse.json({ error: 'Cannot access other tenant data' }, { status: 403 });
    }

    const result = await getTenantDataStats(targetTenant);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stats retrieval failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}