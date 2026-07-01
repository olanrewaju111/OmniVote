import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const tenant = await db.tenant.findFirst({ where: { slug: 'new' } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // OPERATIONAL | SECURITY

    const where: Record<string, unknown> = { tenantId: tenant.id };
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