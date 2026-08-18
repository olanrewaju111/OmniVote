import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// ─── GET /api/scheduled-reports?tenantId=... ──────────────────────────────

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

    const reports = await db.scheduledReport.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      reports: reports.map(r => ({
        id: r.id,
        templateId: r.templateId,
        templateName: r.templateName,
        schedule: r.schedule,
        format: r.format,
        isActive: r.isActive,
        lastRunAt: r.lastRunAt?.toISOString() ?? null,
        nextRunAt: r.nextRunAt?.toISOString() ?? null,
        createdBy: r.createdBy,
        createdAt: r.createdAt.toISOString(),
        filters: JSON.parse(r.filters || '{}'),
      })),
    });
  } catch (err) {
    console.error('[scheduled-reports] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/scheduled-reports ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const body = await req.json();
    const { templateId, templateName, schedule, format, filters } = body;

    if (!templateId || !schedule) {
      return NextResponse.json({ error: 'templateId and schedule are required' }, { status: 400 });
    }

    const VALID_SCHEDULES = ['EVERY_30MIN', 'HOURLY', 'EVERY_2HOURS', 'EVERY_4HOURS', 'EVERY_6HOURS', 'DAILY'];
    if (!VALID_SCHEDULES.includes(schedule)) {
      return NextResponse.json({ error: `Invalid schedule. Must be one of: ${VALID_SCHEDULES.join(', ')}` }, { status: 400 });
    }

    const VALID_FORMATS = ['PDF', 'EXCEL', 'CSV'];
    const fmt = format || 'PDF';
    if (!VALID_FORMATS.includes(fmt)) {
      return NextResponse.json({ error: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}` }, { status: 400 });
    }

    const report = await db.scheduledReport.create({
      data: {
        tenantId,
        templateId,
        templateName: templateName || templateId,
        schedule,
        format: fmt,
        isActive: true,
        nextRunAt: new Date(Date.now() + intervalToMs(schedule)),
        createdBy: authUser.userId,
        filters: JSON.stringify(filters || {}),
      },
    });

    return NextResponse.json({
      report: {
        id: report.id,
        templateId: report.templateId,
        templateName: report.templateName,
        schedule: report.schedule,
        format: report.format,
        isActive: report.isActive,
        lastRunAt: report.lastRunAt?.toISOString() ?? null,
        nextRunAt: report.nextRunAt?.toISOString() ?? null,
        createdBy: report.createdBy,
        createdAt: report.createdAt.toISOString(),
        filters: JSON.parse(report.filters || '{}'),
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[scheduled-reports] POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/scheduled-reports ─────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const body = await req.json();
    const { id, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
    }
    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
    }

    const existing = await db.scheduledReport.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Scheduled report not found' }, { status: 404 });
    }

    const updated = await db.scheduledReport.update({
      where: { id },
      data: {
        isActive,
        nextRunAt: isActive
          ? new Date(Date.now() + intervalToMs(existing.schedule))
          : null,
      },
    });

    return NextResponse.json({ success: true, id: updated.id, isActive: updated.isActive });
  } catch (err) {
    console.error('[scheduled-reports] PATCH Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/scheduled-reports ────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const { searchParams } = new URL(req.url);
    const reportId = searchParams.get('id');
    if (!reportId) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
    }

    await db.scheduledReport.deleteMany({ where: { id: reportId, tenantId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[scheduled-reports] DELETE Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function intervalToMs(schedule: string): number {
  const map: Record<string, number> = {
    EVERY_30MIN: 30 * 60 * 1000,
    HOURLY: 60 * 60 * 1000,
    EVERY_2HOURS: 2 * 60 * 60 * 1000,
    EVERY_4HOURS: 4 * 60 * 60 * 1000,
    EVERY_6HOURS: 6 * 60 * 60 * 1000,
    DAILY: 24 * 60 * 60 * 1000,
  };
  return map[schedule] ?? 60 * 60 * 1000;
}
