import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { safeParse } from '@/lib/safe-parse';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = { tenantId };
    if (type && type !== 'ALL') where.type = type;
    if (severity && severity !== 'ALL') where.severity = severity;
    if (status && status !== 'ALL') where.status = status;
    const reporterId = searchParams.get('reporterId');
    if (reporterId) where.reportedById = reporterId;

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
        aiFlags: safeParse<string[]>(inc.aiFlags),
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

// POST /api/incidents — submit a new incident/infraction report
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reporterId, pollingUnitId, type, severity, description } = body;

    if (!reporterId || !type || !description) {
      return NextResponse.json({ error: 'reporterId, type, and description are required' }, { status: 400 });
    }

    // Resolve reporter's tenant
    const reporter = await db.user.findUnique({ where: { id: reporterId }, select: { tenantId: true } });
    if (!reporter) return NextResponse.json({ error: 'Reporter not found' }, { status: 404 });

    const validTypes = [
      'OBSERVATION', 'VIOLENCE', 'INTIMIDATION', 'BALLOT_STUFFING',
      'LOGISTICS', 'BRIBERY', 'VOTE_BUYING', 'UNDERAGE_VOTING',
      'MULTIPLE_VOTING', 'SNATCHED_BALLOT', 'IMPEDIMENT',
      'DEEPFAKE_SUSPECT', 'CIB_DETECTED', 'GEO_ANOMALY',
    ];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (severity && !validSeverities.includes(severity)) {
      return NextResponse.json({ error: 'Invalid severity' }, { status: 400 });
    }

    const tenant = await db.tenant.findUnique({ where: { id: reporter.tenantId } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Get reporter's PU GPS if no coordinates provided
    let gpsLat = body.gpsLat || null;
    let gpsLng = body.gpsLng || null;
    if (!gpsLat && pollingUnitId) {
      const pu = await db.pollingUnit.findUnique({ where: { id: pollingUnitId }, select: { latitude: true, longitude: true } });
      if (pu) { gpsLat = pu.latitude; gpsLng = pu.longitude; }
    }

    // Deterministic GPS anomaly: flag if coordinates are suspiciously round (likely fake)
    let gpsAnomaly = false;
    if (gpsLat !== null && gpsLng !== null) {
      const latStr = String(gpsLat);
      const lngStr = String(gpsLng);
      // Flag if coordinates have too many trailing zeros (e.g. 6.000000, 3.000000)
      const latZeros = (latStr.split('.')[1] || '').replace(/0+$/, '').length === 0;
      const lngZeros = (lngStr.split('.')[1] || '').replace(/0+$/, '').length === 0;
      // Flag if both lat and lng are suspiciously round numbers
      gpsAnomaly = latZeros && lngZeros && (latStr.includes('.0') || lngStr.includes('.0'));
    }

    const incident = await db.incident.create({
      data: {
        tenantId: reporter.tenantId,
        pollingUnitId: pollingUnitId || null,
        reportedById: reporterId,
        type,
        severity: severity || 'MEDIUM',
        description,
        gpsLatitude: gpsLat,
        gpsLongitude: gpsLng,
        gpsAnomaly,
        isQuarantined: gpsAnomaly,
      },
    });

    // Create alert for HIGH/CRITICAL
    if (severity === 'HIGH' || severity === 'CRITICAL' || type === 'VIOLENCE' || type === 'BALLOT_STUFFING') {
      try {
        await db.alert.create({
          data: {
            tenantId: reporter.tenantId,
            incidentId: incident.id,
            type: type === 'VIOLENCE' || type === 'BALLOT_STUFFING' ? 'SECURITY' : 'OPERATIONAL',
            category: severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
            title: `${type.replace(/_/g, ' ')} reported at ${pollingUnitId ? 'polling unit' : 'unknown location'}`,
            description: description.substring(0, 200),
          },
        });
      } catch {
        // Non-fatal: alert creation failure should not block incident submission
      }
    }

    // Audit log
    try {
      await db.auditLog.create({
      data: {
        userId: reporterId,
        action: 'INCIDENT_REPORTED',
        entityType: 'Incident',
        entityId: incident.id,
        metadata: JSON.stringify({ type, severity, hasGpsAnomaly: gpsAnomaly }),
      },
    });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      incident: {
        id: incident.id,
        type: incident.type,
        severity: incident.severity,
        status: incident.status,
        gpsAnomaly,
        submittedAt: incident.submittedAt,
      },
    }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to submit incident';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}