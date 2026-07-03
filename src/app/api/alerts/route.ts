import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (authUser) {
      const tenantErr = requireTenantMatch(authUser, tenantId);
      if (tenantErr) return tenantErr;
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // OPERATIONAL | SECURITY

    const where: Record<string, unknown> = { tenantId };
    if (type && type !== 'ALL') where.type = type;

    const alerts = await db.alert.findMany({
      where,
      include: { incident: { select: { id: true, severity: true, status: true, type: true } } },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });

    return NextResponse.json({
      alerts: alerts.map(a => ({
        id: a.id,
        type: a.type,
        category: a.category,
        title: a.title,
        description: a.description,
        isRead: a.isRead,
        createdAt: a.createdAt,
        incident: a.incident,
      })),
      unreadCount: alerts.filter(a => !a.isRead).length,
      operationalCount: alerts.filter(a => a.type === 'OPERATIONAL').length,
      securityCount: alerts.filter(a => a.type === 'SECURITY').length,
      criticalCount: alerts.filter(a => a.category === 'CRITICAL').length,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

// PATCH /api/alerts — mark one or all alerts as read
export async function PATCH(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (authUser) {
      const tenantErr = requireTenantMatch(authUser, tenantId);
      if (tenantErr) return tenantErr;
    }

    const body = await req.json();
    const { alertId, markAllRead } = body;

    if (markAllRead) {
      await db.alert.updateMany({
        where: { tenantId, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true, message: 'All alerts marked as read' });
    }

    if (!alertId) {
      return NextResponse.json({ error: 'alertId or markAllRead is required' }, { status: 400 });
    }

    const alert = await db.alert.findUnique({ where: { id: alertId } });
    if (!alert || alert.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    await db.alert.update({
      where: { id: alertId },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
  }
}