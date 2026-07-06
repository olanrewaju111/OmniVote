import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

// GET /api/export?type=incidents|audit-logs|results|agents&format=csv
// Exports data as CSV for stakeholder reporting
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

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const format = searchParams.get('format') || 'csv';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!type) {
      return NextResponse.json({ error: 'Export type is required (incidents, audit-logs, results, agents)' }, { status: 400 });
    }

    if (format !== 'csv') {
      return NextResponse.json({ error: 'Only CSV format is supported currently' }, { status: 400 });
    }

    // Build date filter
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    let csvContent = '';
    let filename = `${type}-${new Date().toISOString().split('T')[0]}.csv`;

    switch (type) {
      case 'incidents': {
        const where: Record<string, unknown> = { tenantId };
        if (startDate || endDate) where.submittedAt = dateFilter;
        const incidents = await db.incident.findMany({
          where,
          include: {
            reporter: { select: { name: true, role: true } },
            pollingUnit: { select: { name: true, code: true, state: true, lga: true } },
          },
          orderBy: { submittedAt: 'desc' },
        });
        const headers = ['ID', 'Type', 'Severity', 'Status', 'Description', 'State', 'LGA', 'Polling Unit', 'Reporter', 'GPS Lat', 'GPS Lng', 'GPS Anomaly', 'Quarantined', 'C2PA Verified', 'Submitted At', 'Reviewed At'];
        const rows = incidents.map(i => [
          i.id, i.type, i.severity, i.status,
          `"${(i.description || '').replace(/"/g, '""')}"`,
          i.pollingUnit?.state || '', i.pollingUnit?.lga || '',
          i.pollingUnit?.name || '', i.reporter.name,
          i.gpsLatitude || '', i.gpsLongitude || '',
          i.gpsAnomaly ? 'Yes' : 'No',
          i.isQuarantined ? 'Yes' : 'No',
          i.c2paVerified ? 'Yes' : 'No',
          i.submittedAt.toISOString(),
          i.reviewedAt?.toISOString() || '',
        ]);
        csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        break;
      }

      case 'audit-logs': {
        const where: Record<string, unknown> = {};
        if (authUser.role !== 'SUPER_ADMIN') {
          where.user = { tenantId };
        }
        if (startDate || endDate) where.createdAt = dateFilter;
        const logs = await db.auditLog.findMany({
          where,
          include: {
            user: { select: { name: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
        const headers = ['ID', 'User', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Metadata', 'IP Address', 'Created At'];
        const rows = logs.map(l => [
          l.id, l.user.name, l.user.role, l.action,
          l.entityType || '', l.entityId || '',
          `"${(l.metadata || '').replace(/"/g, '""')}"`,
          l.ipAddress || '', l.createdAt.toISOString(),
        ]);
        csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        break;
      }

      case 'results': {
        const where: Record<string, unknown> = { tenantId };
        if (startDate || endDate) where.submittedAt = dateFilter;
        const results = await db.electionResult.findMany({
          where,
          include: {
            pollingUnit: { select: { name: true, code: true, state: true, lga: true } },
            reporter: { select: { name: true } },
          },
          orderBy: { submittedAt: 'desc' },
        });
        const headers = ['ID', 'Polling Unit', 'Code', 'State', 'LGA', 'Accredited Voters', 'Valid Votes', 'Rejected Ballots', 'Total Votes Cast', 'BVAS Used', 'Materials On Time', 'Security Present', 'Violence', 'Verified', 'Reporter', 'Submitted At'];
        const rows = results.map(r => [
          r.id, r.pollingUnit.name, r.pollingUnit.code,
          r.pollingUnit.state, r.pollingUnit.lga,
          r.accreditedVoters, r.totalValidVotes, r.rejectedBallots, r.totalVotesCast,
          r.bvasUsed ? 'Yes' : 'No', r.materialsArrivedOnTime ? 'Yes' : 'No',
          r.securityPresent ? 'Yes' : 'No', r.violenceOccurred ? 'Yes' : 'No',
          r.verified ? 'Yes' : 'No', r.reporter.name,
          r.submittedAt.toISOString(),
        ]);
        csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        break;
      }

      case 'agents': {
        const agents = await db.user.findMany({
          where: { tenantId, role: 'FIELD_AGENT' },
          select: { id: true, name: true, phone: true, isActive: true, lastSeen: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });
        const headers = ['ID', 'Name', 'Phone', 'Active', 'Last Seen', 'Created At'];
        const rows = agents.map(a => [
          a.id, a.name, a.phone || '',
          a.isActive ? 'Active' : 'Inactive',
          a.lastSeen?.toISOString() || 'Never',
          a.createdAt.toISOString(),
        ]);
        csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown export type: ${type}. Supported: incidents, audit-logs, results, agents` },
          { status: 400 }
        );
    }

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          userId: authUser.userId,
          action: 'DATA_EXPORTED',
          entityType: 'Export',
          metadata: JSON.stringify({ type, format, tenantId, dateRange: { startDate, endDate } }),
        },
      });
    } catch {
      // Non-fatal
    }

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}