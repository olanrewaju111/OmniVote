import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

// GET /api/export?type=incidents|audit-logs|results|agents&format=csv|excel|pdf
// Exports data as CSV, Excel (.xlsx), or PDF for stakeholder reporting
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

    const { searchParams } = new URL(req.url || "http://localhost");
    const type = searchParams.get('type');
    const format = searchParams.get('format') || 'csv';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!type) {
      return NextResponse.json({ error: 'Export type is required (incidents, audit-logs, results, agents)' }, { status: 400 });
    }

    const supportedFormats = ['csv', 'excel', 'xlsx', 'pdf'];
    if (!supportedFormats.includes(format)) {
      return NextResponse.json({ error: 'Unsupported format. Use csv, excel, or pdf' }, { status: 400 });
    }

    // Build date filter
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const today = new Date().toISOString().split('T')[0];

    // Fetch data and get structured result with headers + rows
    const data = await fetchData(type, tenantId, dateFilter, authUser);
    if (!data) {
      return NextResponse.json(
        { error: `Unknown export type: ${type}. Supported: incidents, audit-logs, results, agents` },
        { status: 400 }
      );
    }

    // Audit log (non-fatal)
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

    // Route to the appropriate format handler
    if (format === 'pdf') {
      return generatePDFResponse(data, type, today);
    }

    if (format === 'excel' || format === 'xlsx') {
      return generateExcelResponse(data, type, today);
    }

    // Default: CSV
    return generateCSVResponse(data, type, today);
  } catch (error) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

// ---------- Data fetching ----------

type ExportData = {
  headers: string[];
  rows: (string | number | boolean)[][];
  summary: { label: string; value: string | number }[];
};

async function fetchData(
  type: string,
  tenantId: string,
  dateFilter: Record<string, Date>,
  authUser: { userId: string; role: string },
): Promise<ExportData | null> {
  switch (type) {
    case 'incidents': {
      const where: Record<string, unknown> = { tenantId };
      if (Object.keys(dateFilter).length) where.submittedAt = dateFilter;
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
        (i.description || '').replace(/"/g, '""'),
        i.pollingUnit?.state || '', i.pollingUnit?.lga || '',
        i.pollingUnit?.name || '', i.reporter.name,
        i.gpsLatitude ?? '', i.gpsLongitude ?? '',
        i.gpsAnomaly ? 'Yes' : 'No',
        i.isQuarantined ? 'Yes' : 'No',
        i.c2paVerified ? 'Yes' : 'No',
        i.submittedAt.toISOString(),
        i.reviewedAt?.toISOString() || '',
      ]);
      const severityCounts: Record<string, number> = {};
      for (const inc of incidents) {
        severityCounts[inc.severity] = (severityCounts[inc.severity] || 0) + 1;
      }
      return {
        headers,
        rows,
        summary: [
          { label: 'Total Incidents', value: incidents.length },
          { label: 'Critical', value: severityCounts['CRITICAL'] || 0 },
          { label: 'High', value: severityCounts['HIGH'] || 0 },
          { label: 'Medium', value: severityCounts['MEDIUM'] || 0 },
          { label: 'Low', value: severityCounts['LOW'] || 0 },
        ],
      };
    }

    case 'audit-logs': {
      const where: Record<string, unknown> = {};
      if (authUser.role !== 'SUPER_ADMIN') {
        where.user = { tenantId };
      }
      if (Object.keys(dateFilter).length) where.createdAt = dateFilter;
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
        (l.metadata || '').replace(/"/g, '""'),
        l.ipAddress || '', l.createdAt.toISOString(),
      ]);
      const actionCounts: Record<string, number> = {};
      for (const log of logs) {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      }
      return {
        headers,
        rows,
        summary: [
          { label: 'Total Log Entries', value: logs.length },
          { label: 'Unique Actions', value: Object.keys(actionCounts).length },
          { label: 'Top Action', value: Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A' },
        ],
      };
    }

    case 'results': {
      const where: Record<string, unknown> = { tenantId };
      if (Object.keys(dateFilter).length) where.submittedAt = dateFilter;
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
      const totalAccredited = results.reduce((sum, r) => sum + r.accreditedVoters, 0);
      const totalVotes = results.reduce((sum, r) => sum + r.totalVotesCast, 0);
      return {
        headers,
        rows,
        summary: [
          { label: 'Total Polling Units', value: results.length },
          { label: 'Total Accredited Voters', value: totalAccredited },
          { label: 'Total Votes Cast', value: totalVotes },
          { label: 'Verified Results', value: results.filter(r => r.verified).length },
          { label: 'Violence Reported', value: results.filter(r => r.violenceOccurred).length },
        ],
      };
    }

    case 'agents': {
      const agents = await db.user.findMany({
        where: { tenantId, role: 'FIELD_AGENT' },
        select: { id: true, name: true, phone: true, lastSeenAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      const headers = ['ID', 'Name', 'Phone', 'Last Seen', 'Created At'];
      const rows = agents.map(a => [
        a.id, a.name, a.phone || '',
        a.lastSeenAt?.toISOString() || 'Never',
        a.createdAt.toISOString(),
      ]);
      const onlineCount = agents.filter(a => a.lastSeenAt && (Date.now() - a.lastSeenAt.getTime()) < 30 * 60 * 1000).length;
      return {
        headers,
        rows,
        summary: [
          { label: 'Total Agents', value: agents.length },
          { label: 'Recently Active', value: onlineCount },
          { label: 'Never Seen', value: agents.filter(a => !a.lastSeenAt).length },
        ],
      };
    }

    default:
      return null;
  }
}

// ---------- CSV Response ----------

function generateCSVResponse(
  data: ExportData,
  type: string,
  today: string,
): NextResponse {
  const filename = `${type}-${today}.csv`;
  const escapeRow = (row: (string | number | boolean)[]) =>
    row.map(cell => {
      const s = String(cell);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }).join(',');

  const csvContent = [
    data.headers.join(','),
    ...data.rows.map(escapeRow),
  ].join('\n');

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// ---------- Excel Response ----------

async function generateExcelResponse(
  data: ExportData,
  type: string,
  today: string,
): Promise<NextResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Omnivote';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(capitalize(type), {
    properties: { tabColor: { argb: '4F46E5' } },
  });

  // Add title row
  const titleRow = sheet.addRow([`Omnivote ${capitalize(type)} Export — ${today}`]);
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: '1F2937' } };
  sheet.mergeCells(1, 1, 1, data.headers.length);

  // Add blank row
  sheet.addRow([]);

  // Add summary section
  for (const item of data.summary) {
    const row = sheet.addRow([item.label, item.value]);
    row.getCell(1).font = { bold: true, size: 10 };
    row.getCell(2).font = { size: 10 };
  }

  // Add blank row
  sheet.addRow([]);

  // Add header row
  const headerRow = sheet.addRow(data.headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '374151' },
    };
    cell.border = {
      bottom: { style: 'thin', color: { argb: '9CA3AF' } },
    };
  });

  // Add data rows
  for (const row of data.rows) {
    const dataRow = sheet.addRow(row.map(String));
    dataRow.eachCell((cell) => {
      cell.font = { size: 10 };
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'E5E7EB' } },
      };
    });
  }

  // Auto-fit column widths (rough heuristic)
  for (let col = 1; col <= data.headers.length; col++) {
    const maxLen = Math.max(
      ...data.rows.map(r => String(r[col - 1] ?? '').length),
      data.headers[col - 1].length,
      10,
    );
    sheet.getColumn(col).width = Math.min(maxLen + 2, 40);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${type}-${today}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// ---------- PDF Response ----------

async function generatePDFResponse(
  data: ExportData,
  type: string,
  today: string,
): Promise<NextResponse> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const jspdfModule: any = await import('jspdf');
  const { jsPDF } = jspdfModule.default ? jspdfModule : jspdfModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`Omnivote ${capitalize(type)} Report`, 14, 18);

  // Subtitle / date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
  doc.text(`Export Date: ${today}`, 14, 30);

  // Summary stats (right-aligned)
  doc.setFontSize(9);
  let summaryY = 18;
  for (const item of data.summary) {
    doc.text(`${item.label}: ${item.value}`, pageWidth - 14, summaryY, { align: 'right' });
    summaryY += 5;
  }

  // Line separator
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 34, pageWidth - 14, 34);

  // Table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    head: [data.headers],
    body: data.rows.map(row => row.map(String)),
    startY: 38,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    margin: { left: 14, right: 14 },
  });

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Omnivote Election Monitoring — ${capitalize(type)} Export — Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' },
    );
  }

  const buffer = doc.output('arraybuffer');
  const filename = `${type}-${today}.pdf`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// ---------- Helpers ----------

function capitalize(s: string): string {
  return s
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
