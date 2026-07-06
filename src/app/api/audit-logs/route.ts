import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';
import { safeParse } from '@/lib/safe-parse';

// GET /api/audit-logs — query audit log entries (TENANT_ADMIN+, SUPER_ADMIN sees all)
export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Only admins and analysts can view audit logs
    if (!['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions to view audit logs' }, { status: 403 });
    }

    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const entityType = searchParams.get('entityType');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};

    // SUPER_ADMIN can see all tenants; others see their own
    if (authUser.role !== 'SUPER_ADMIN') {
      where.user = { tenantId };
    }

    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (userId) where.userId = userId;

    // Date range filters
    if (startDate || endDate) {
      where.createdAt = {} as Record<string, Date>;
      if (startDate) (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, Date>).lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, role: true, tenantId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs: logs.map(log => ({
        id: log.id,
        userId: log.userId,
        userName: log.user.name,
        userRole: log.user.role,
        userTenantId: log.user.tenantId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: safeParse<Record<string, unknown>>(log.metadata),
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      })),
      total,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}