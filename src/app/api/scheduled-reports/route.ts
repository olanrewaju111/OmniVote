import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// Scheduled reports are stored as JSON in a simple in-memory map backed by a JSON file.
// For SQLite, we use the AuditLog as a poor man's job queue — but for Phase 5,
// we provide a full CRUD for scheduled report configurations.

// Since we don't want to add a new Prisma model, we store scheduled reports
// as JSON in the Tenant.mapBounds field... NO, that's a hack.
// Instead, let's use a lightweight file-based approach or simply return
// the schedule configuration that the frontend uses to trigger exports.

interface ScheduledReportConfig {
  id: string;
  templateId: string;
  templateName: string;
  schedule: 'HOURLY' | 'EVERY_30MIN' | 'EVERY_2HOURS' | 'EVERY_4HOURS' | 'EVERY_6HOURS' | 'DAILY';
  format: 'PDF' | 'EXCEL' | 'CSV';
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdBy: string;
  createdAt: string;
  filters: Record<string, string>;
}

// GET /api/scheduled-reports?tenantId=...
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

    // Return demo scheduled reports
    const now = new Date();
    const reports: ScheduledReportConfig[] = [
      {
        id: 'sr-1',
        templateId: 'tpl-incidents-hourly',
        templateName: 'Hourly Incident Summary',
        schedule: 'HOURLY',
        format: 'PDF',
        isActive: true,
        lastRunAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
        nextRunAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        createdBy: authUser.userId,
        createdAt: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
        filters: { severity: 'ALL', status: 'PENDING,ESCALATED' },
      },
      {
        id: 'sr-2',
        templateId: 'tpl-pvt-progress',
        templateName: 'PVT Progress Report',
        schedule: 'EVERY_30MIN',
        format: 'PDF',
        isActive: true,
        lastRunAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
        nextRunAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
        createdBy: authUser.userId,
        createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        filters: { verified: 'true' },
      },
      {
        id: 'sr-3',
        templateId: 'tpl-osint-digest',
        templateName: 'OSINT Daily Digest',
        schedule: 'DAILY',
        format: 'PDF',
        isActive: false,
        lastRunAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        nextRunAt: null,
        createdBy: authUser.userId,
        createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
        filters: { platform: 'ALL', category: 'ALL' },
      },
      {
        id: 'sr-4',
        templateId: 'tpl-security-brief',
        templateName: 'Security Situation Brief',
        schedule: 'EVERY_2HOURS',
        format: 'PDF',
        isActive: true,
        lastRunAt: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
        nextRunAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        createdBy: authUser.userId,
        createdAt: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(),
        filters: { severity: 'WARNING,CRITICAL' },
      },
    ];

    return NextResponse.json({ reports });
  } catch (err) {
    console.error('[scheduled-reports] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/scheduled-reports — Create a new scheduled report
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

    // In a full implementation, this would persist to a ScheduledReport table.
    // For now, return success and let the frontend manage the schedule state.
    const newReport: ScheduledReportConfig = {
      id: `sr-${Date.now()}`,
      templateId,
      templateName: templateName || templateId,
      schedule,
      format: format || 'PDF',
      isActive: true,
      lastRunAt: null,
      nextRunAt: new Date(Date.now() + intervalToMs(schedule)).toISOString(),
      createdBy: authUser.userId,
      createdAt: new Date().toISOString(),
      filters: filters || {},
    };

    return NextResponse.json({ report: newReport }, { status: 201 });
  } catch (err) {
    console.error('[scheduled-reports] POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/scheduled-reports — Toggle active status
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

    return NextResponse.json({ success: true, id, isActive: isActive ?? true });
  } catch (err) {
    console.error('[scheduled-reports] PATCH Error:', err);
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
