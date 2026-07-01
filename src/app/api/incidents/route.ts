import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const tenant = await db.tenant.findFirst({ where: { slug: 'new' } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = { tenantId: tenant.id };
    if (type && type !== 'ALL') where.type = type;
    if (severity && severity !== 'ALL') where.severity = severity;
    if (status && status !== 'ALL') where.status = status;

    const [incidents, total] = await Promise.all([
      db.incident.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true, role: true } },
          pollingUnit: { select: { id: true, name: true, code: true, state: true, lga: true } },
        },
        orderBy: { submittedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.incident.count({ where }),
    ]);

    return NextResponse.json({
      incidents: incidents.map(inc => ({
        id: inc.id,
        type: inc.type,
        severity: inc.severity,
        status: inc.status,
        description: inc.description,
        gpsLat: inc.gpsLatitude,
        gpsLng: inc.gpsLongitude,
        gpsAnomaly: inc.gpsAnomaly,
        aiSummary: inc.aiSummary,
        aiFlags: JSON.parse(inc.aiFlags || '[]'),
        isQuarantined: inc.isQuarantined,
        c2paVerified: inc.c2paVerified,
        submittedAt: inc.submittedAt,
        reviewedAt: inc.reviewedAt,
        reporter: inc.reporter,
        pollingUnit: inc.pollingUnit,
      })),
      total,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 });
  }
}