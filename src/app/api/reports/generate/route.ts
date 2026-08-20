import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';
import { requireCsrf } from '@/lib/security/csrf-enforce';

// POST /api/reports/generate
// Body: { format: 'excel' | 'pdf', sections?: string[] }
// Generates a comprehensive multi-section election report
export async function POST(req: NextRequest) {
    // CSRF protection
    const csrfErr = requireCsrf(req);
    if (csrfErr) return csrfErr;

  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const body = await req.json().catch(() => ({}));
    const format = body.format || 'excel';

    if (format !== 'excel' && format !== 'pdf') {
      return NextResponse.json({ error: 'Format must be excel or pdf' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Fetch all report data in parallel
    const [
      election, incidents, results, pvtCount, agents, alerts,
      securityEvents, osintPosts, voterSuppression, honeypots,
      flashpoints, geofences,
    ] = await Promise.all([
      db.election.findFirst({ where: { tenantId } }),
      db.incident.findMany({
        where: { tenantId },
        include: { reporter: { select: { name: true } }, pollingUnit: { select: { state: true, lga: true } } },
      }),
      db.electionResult.findMany({
        where: { tenantId },
        include: { pollingUnit: { select: { name: true, code: true, state: true, lga: true, registeredVoters: true } } },
      }),
      db.pvtSubmission.count({ where: { tenantId } }),
      db.user.count({ where: { tenantId, role: 'FIELD_AGENT' } }),
      db.alert.count({ where: { tenantId } }),
      db.securityEvent.count({ where: { tenantId } }),
      db.osintPost.count({ where: { tenantId } }),
      db.voterSuppressionReport.count({ where: { tenantId } }),
      db.honeypotUnit.count({ where: { tenantId } }),
      db.flashpointForecast.count({ where: { tenantId } }),
      db.geofenceZone.count({ where: { tenantId } }),
    ]);

    // Compute state-level aggregation
    const stateAgg: Record<string, { units: number; votes: number; registered: number; incidents: number; violence: number; accredited: number }> = {};
    for (const r of results) {
      const st = r.pollingUnit.state;
      if (!stateAgg[st]) stateAgg[st] = { units: 0, votes: 0, registered: 0, incidents: 0, violence: 0, accredited: 0 };
      stateAgg[st].units += 1;
      stateAgg[st].votes += r.totalVotesCast;
      stateAgg[st].registered += r.pollingUnit.registeredVoters;
      stateAgg[st].accredited += r.accreditedVoters;
      if (r.violenceOccurred) stateAgg[st].violence += 1;
    }
    for (const inc of incidents) {
      const st = inc.pollingUnit?.state;
      if (st && stateAgg[st]) stateAgg[st].incidents += 1;
    }

    const totalRegistered = results.reduce((s, r) => s + r.pollingUnit.registeredVoters, 0);
    const totalVotes = results.reduce((s, r) => s + r.totalVotesCast, 0);
    const severityCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    for (const inc of incidents) {
      severityCounts[inc.severity] = (severityCounts[inc.severity] || 0) + 1;
      typeCounts[inc.type] = (typeCounts[inc.type] || 0) + 1;
    }

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          userId: authUser.userId,
          action: 'DATA_EXPORTED',
          entityType: 'ComprehensiveReport',
          metadata: JSON.stringify({ type: 'comprehensive-report', format, tenantId }),
        },
      });
    } catch { /* non-fatal */ }

    const reportData = {
      election,
      stateAgg,
      totalRegistered,
      totalVotes,
      severityCounts,
      typeCounts,
      summaryStats: {
        pollingUnits: results.length,
        totalAgents: agents,
        totalIncidents: incidents.length,
        criticalIncidents: severityCounts['CRITICAL'] || 0,
        highIncidents: severityCounts['HIGH'] || 0,
        pvtSubmissions: pvtCount,
        alerts,
        securityEvents,
        osintPosts,
        voterSuppression,
        honeypots,
        flashpoints,
        geofences,
        overallTurnout: totalRegistered > 0 ? ((totalVotes / totalRegistered) * 100).toFixed(1) + '%' : 'N/A',
        statesMonitored: Object.keys(stateAgg).length,
        violenceLocations: results.filter(r => r.violenceOccurred).length,
        verifiedResults: results.filter(r => r.verified).length,
      },
    };

    if (format === 'excel') {
      return generateMultiSheetExcel(reportData, today);
    }
    return generateMultiSectionPDF(reportData, today);
  } catch (error) {
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 });
  }
}

// ── Multi-Sheet Excel ──

interface ReportData {
  election: any;
  stateAgg: Record<string, { units: number; votes: number; registered: number; incidents: number; violence: number; accredited: number }>;
  totalRegistered: number;
  totalVotes: number;
  severityCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  summaryStats: Record<string, string | number>;
}

async function generateMultiSheetExcel(data: ReportData, today: string): Promise<NextResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ExcelJS = await import('exceljs');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Workbook = (ExcelJS as any).Workbook;
  const workbook = new Workbook();
  workbook.creator = 'Omnivote';
  workbook.created = new Date();

  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFF' }, size: 10 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '374151' } },
    border: { bottom: { style: 'thin', color: { argb: '9CA3AF' } } },
  };

  // Sheet 1: Executive Summary
  const summarySheet = workbook.addWorksheet('Executive Summary', { properties: { tabColor: { argb: '4F46E5' } } });
  const titleRow = summarySheet.addRow([`Omnivote Comprehensive Election Report — ${today}`]);
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: '1F2937' } };
  summarySheet.addRow([]);
  summarySheet.addRow(['Metric', 'Value']);
  summarySheet.getRow(3).eachCell(c => Object.assign(c, { style: headerStyle } as any));
  const stats = data.summaryStats as Record<string, string | number>;
  for (const [label, value] of Object.entries(stats)) {
 const row = summarySheet.addRow([
      label.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
      value,
    ]);
    row.getCell(1).font = { bold: true, size: 10 };
  }

  // Sheet 2: State-Level Results
  const stateSheet = workbook.addWorksheet('State Results', { properties: { tabColor: { argb: '10B981' } } });
  stateSheet.addRow(['State', 'Polling Units', 'Registered Voters', 'Total Votes', 'Turnout %', 'Incidents', 'Violence', 'Accredited']);
  stateSheet.getRow(1).eachCell(c => Object.assign(c, { style: headerStyle } as any));
  for (const [state, d] of Object.entries(data.stateAgg).sort((a, b) => b[1].votes - a[1].votes)) {
    stateSheet.addRow([
      state, d.units, d.registered, d.votes,
      d.registered > 0 ? ((d.votes / d.registered) * 100).toFixed(1) + '%' : 'N/A',
      d.incidents, d.violence, d.accredited,
    ]);
  }

  // Sheet 3: Incident Summary
  const incSheet = workbook.addWorksheet('Incident Summary', { properties: { tabColor: { argb: 'EF4444' } } });
  incSheet.addRow(['Severity', 'Count', 'Percentage']);
  incSheet.getRow(1).eachCell(c => Object.assign(c, { style: headerStyle } as any));
  const totalInc = Object.values(data.severityCounts).reduce((a, b) => a + b, 0);
  for (const [sev, count] of Object.entries(data.severityCounts).sort((a, b) => b[1] - a[1])) {
    incSheet.addRow([sev, count, totalInc > 0 ? ((count / totalInc) * 100).toFixed(1) + '%' : '0%']);
  }
  incSheet.addRow([]);
  incSheet.addRow(['Type', 'Count']);
  for (const [type, count] of Object.entries(data.typeCounts).sort((a, b) => b[1] - a[1])) {
    incSheet.addRow([type, count]);
  }

  // Auto-fit columns for all sheets
  for (const sheet of workbook.worksheets) {
    sheet.columns.forEach(col => {
      let maxLen = 10;
      col.eachCell({ includeEmpty: false }, cell => {
        maxLen = Math.max(maxLen, String(cell.value || '').length);
      });
      col.width = Math.min(maxLen + 2, 40);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="omnivote-comprehensive-report-${today}.xlsx"`,
    },
  });
}

// ── Multi-Section PDF ──

async function generateMultiSectionPDF(data: ReportData, today: string): Promise<NextResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jspdfModule: any = await import('jspdf');
  const { jsPDF } = jspdfModule.default ? jspdfModule : jspdfModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // ── Cover Page ──
  doc.setFillColor(55, 65, 81);
  doc.rect(0, 0, pw, ph, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('OMNIVOTE', pw / 2, 70, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('Election Monitoring Report', pw / 2, 82, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pw / 2, 100, { align: 'center' });
  if (data.election) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(data.election.title, pw / 2, 120, { align: 'center' });
    if (data.election.date) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Election Date: ${data.election.date}`, pw / 2, 130, { align: 'center' });
    }
  }
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text('Confidential — For authorized personnel only', pw / 2, ph - 30, { align: 'center' });
  doc.text(`Page 1`, pw / 2, ph - 20, { align: 'center' });

  // ── Page 2: Executive Summary ──
  doc.addPage();
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', 14, 20);
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 24, pw - 14, 24);

  const stats = data.summaryStats as Record<string, string | number>;
  const summaryRows = Object.entries(stats).map(([k, v]) => [
    k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
    String(v),
  ]);

  (doc as any).autoTable({
    head: [['Metric', 'Value']],
    body: summaryRows,
    startY: 28,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 14, right: 14 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
  });

  // ── Page 3: State-Level Results ──
  doc.addPage();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('State-Level Results', 14, 20);
  doc.line(14, 24, pw - 14, 24);

  const stateRows = Object.entries(data.stateAgg)
    .sort((a, b) => b[1].votes - a[1].votes)
    .map(([state, d]) => [
      state, String(d.units), String(d.registered), String(d.votes),
      d.registered > 0 ? ((d.votes / d.registered) * 100).toFixed(1) + '%' : 'N/A',
      String(d.incidents), String(d.violence),
    ]);

  (doc as any).autoTable({
    head: [['State', 'Units', 'Registered', 'Votes', 'Turnout', 'Incidents', 'Violence']],
    body: stateRows,
    startY: 28,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 14, right: 14 },
  });

  // ── Page 4: Incident Analysis ──
  doc.addPage();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Incident Analysis', 14, 20);
  doc.line(14, 24, pw - 14, 24);

  // Severity breakdown
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Severity Breakdown', 14, 32);
  const totalInc = Object.values(data.severityCounts).reduce((a, b) => a + b, 0);
  const sevRows = Object.entries(data.severityCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([sev, count]) => [sev, String(count), totalInc > 0 ? ((count / totalInc) * 100).toFixed(1) + '%' : '0%']);

  (doc as any).autoTable({
    head: [['Severity', 'Count', 'Percentage']],
    body: sevRows,
    startY: 36,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [254, 242, 242] },
    margin: { left: 14, right: 14 },
  });

  // Type breakdown
  const lastTable = (doc as any).lastAutoTable;
  const typeEndY = (lastTable?.finalY || 200) + 10;
  doc.setFontSize(11);
  doc.text('Incident Types', 14, typeEndY);
  const typeRows = Object.entries(data.typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => [type, String(count), totalInc > 0 ? ((count / totalInc) * 100).toFixed(1) + '%' : '0%']);

  (doc as any).autoTable({
    head: [['Type', 'Count', 'Percentage']],
    body: typeRows,
    startY: typeEndY + 4,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 251, 235] },
    margin: { left: 14, right: 14 },
  });

  // Add footers to all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Omnivote Election Monitoring — Comprehensive Report — Page ${i} of ${pageCount}`,
      pw / 2,
      ph - 8,
      { align: 'center' },
    );
  }

  const buffer = doc.output('arraybuffer');
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="omnivote-comprehensive-report-${today}.pdf"`,
    },
  });
}

