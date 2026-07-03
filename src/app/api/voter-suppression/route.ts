import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { safeParse } from '@/lib/safe-parse';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

// GET /api/voter-suppression?tenantId=X&reportType=X&state=X&severity=X&status=X
export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (authUser) {
      const tenantErr = requireTenantMatch(authUser, tenantId);
      if (tenantErr) return tenantErr;
    }

    const url = new URL(req.url);
    const reportType = url.searchParams.get('reportType');
    const state = url.searchParams.get('state');
    const severity = url.searchParams.get('severity');
    const status = url.searchParams.get('status');

    // Build where filter
    const where: Record<string, unknown> = { tenantId };
    if (reportType) where.reportType = reportType;
    if (state) where.state = state;
    if (severity) where.severity = severity;
    if (status) where.status = status;

    // Fetch reports
    const reports = await db.voterSuppressionReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate counts (always based on tenant, not filtered by query params)
    const [total, byType, bySeverity, byStatus, disinformationCount] = await Promise.all([
      db.voterSuppressionReport.count({ where: { tenantId } }),
      db.voterSuppressionReport.groupBy({
        by: ['reportType'],
        where: { tenantId },
        _count: { reportType: true },
      }),
      db.voterSuppressionReport.groupBy({
        by: ['severity'],
        where: { tenantId },
        _count: { severity: true },
      }),
      db.voterSuppressionReport.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { status: true },
      }),
      db.voterSuppressionReport.count({ where: { tenantId, isDisinformation: true } }),
    ]);

    // Parse evidenceUrls on each report
    const parsedReports = reports.map((r) => ({
      ...r,
      evidenceUrls: safeParse(r.evidenceUrls),
    }));

    return NextResponse.json({
      reports: parsedReports,
      counts: {
        total,
        byType: Object.fromEntries(byType.map((g) => [g.reportType, g._count.reportType])),
        bySeverity: Object.fromEntries(bySeverity.map((g) => [g.severity, g._count.severity])),
        byStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count.status])),
        disinformationCount,
      },
    });
  } catch (err) {
    console.error('Voter suppression error:', err);
    return NextResponse.json({ error: 'Failed to fetch voter suppression reports' }, { status: 500 });
  }
}

// POST /api/voter-suppression — submit a new voter suppression report
export async function POST(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (authUser) {
      const tenantErr = requireTenantMatch(authUser, tenantId);
      if (tenantErr) return tenantErr;
    }

    const body = await req.json();
    const {
      reportType,
      title,
      description,
      state,
      lga,
      source,
      platform,
      severity,
      isDisinformation,
      reportedById,
    } = body;

    if (!reportType || !title || !state) {
      return NextResponse.json(
        { error: 'reportType, title, and state are required' },
        { status: 400 },
      );
    }

    const report = await db.voterSuppressionReport.create({
      data: {
        tenantId,
        reportType,
        title,
        description: description || '',
        state,
        lga: lga || null,
        source: source || 'FIELD',
        platform: platform || null,
        severity: severity || 'MEDIUM',
        status: 'PENDING',
        isDisinformation: isDisinformation === true,
        affectedArea: lga ? `${lga}, ${state}` : state,
        affectedVoters: null,
        evidenceUrls: '[]',
        counterMeasure: null,
        aiAnalysis: null,
        reportedById: reportedById || null,
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    console.error('Voter suppression create error:', err);
    return NextResponse.json({ error: 'Failed to create voter suppression report' }, { status: 500 });
  }
}