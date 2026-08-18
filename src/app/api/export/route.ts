import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

// GET /api/export?type=incidents|audit-logs|results|agents|pvt|alerts|voter-suppression|osint|security-events|geofence|honeypot|flashpoint|accessibility|election-summary&format=csv|excel|pdf
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

    const { searchParams } = new URL(req.url || 'http://localhost');
    const type = searchParams.get('type');
    const format = searchParams.get('format') || 'csv';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!type) {
      return NextResponse.json({ error: 'Export type is required' }, { status: 400 });
    }

    const supportedFormats = ['csv', 'excel', 'xlsx', 'pdf'];
    if (!supportedFormats.includes(format)) {
      return NextResponse.json({ error: 'Unsupported format. Use csv, excel, or pdf' }, { status: 400 });
    }

    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const today = new Date().toISOString().split('T')[0];

    const data = await fetchData(type, tenantId, dateFilter, authUser);
    if (!data) {
      return NextResponse.json(
        { error: `Unknown export type: ${type}` },
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

    if (format === 'pdf') {
      return generatePDFResponse(data, type, today);
    }
    if (format === 'excel' || format === 'xlsx') {
      return generateExcelResponse(data, type, today);
    }
    return generateCSVResponse(data, type, today);
  } catch (error) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

// ---------- Types ----------

type ExportData = {
  title: string;
  headers: string[];
  rows: (string | number | boolean)[][];
  summary: { label: string; value: string | number }[];
};

// ---------- Data fetching ----------

async function fetchData(
  type: string,
  tenantId: string,
  dateFilter: Record<string, Date>,
  authUser: { userId: string; role: string },
): Promise<ExportData | null> {
  switch (type) {
    case 'incidents': return fetchIncidents(tenantId, dateFilter);
    case 'audit-logs': return fetchAuditLogs(tenantId, dateFilter, authUser);
    case 'results': return fetchResults(tenantId, dateFilter);
    case 'agents': return fetchAgents(tenantId);
    case 'alerts': return fetchAlerts(tenantId, dateFilter);
    case 'pvt': return fetchPvt(tenantId, dateFilter);
    case 'voter-suppression': return fetchVoterSuppression(tenantId, dateFilter);
    case 'osint': return fetchOsint(tenantId, dateFilter);
    case 'security-events': return fetchSecurityEvents(tenantId, dateFilter);
    case 'geofence': return fetchGeofence(tenantId);
    case 'honeypot': return fetchHoneypot(tenantId);
    case 'flashpoint': return fetchFlashpoint(tenantId);
    case 'accessibility': return fetchAccessibility(tenantId);
    case 'election-summary': return fetchElectionSummary(tenantId);
    default:
      return null;
  }
}

// ── Incidents ──
async function fetchIncidents(tenantId: string, dateFilter: Record<string, Date>): Promise<ExportData> {
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
  const severityCounts: Record<string, number> = {};
  for (const inc of incidents) {
    severityCounts[inc.severity] = (severityCounts[inc.severity] || 0) + 1;
  }
  return {
    title: 'Incident Report',
    headers: ['ID', 'Type', 'Severity', 'Status', 'Description', 'State', 'LGA', 'Polling Unit', 'Reporter', 'GPS Lat', 'GPS Lng', 'GPS Anomaly', 'Quarantined', 'C2PA Verified', 'Submitted At', 'Reviewed At'],
    rows: incidents.map(i => [
      i.id, i.type, i.severity, i.status,
      (i.description || '').slice(0, 200),
      i.pollingUnit?.state || '', i.pollingUnit?.lga || '',
      i.pollingUnit?.name || '', i.reporter?.name || '',
      i.gpsLatitude ?? '', i.gpsLongitude ?? '',
      i.gpsAnomaly ? 'Yes' : 'No', i.isQuarantined ? 'Yes' : 'No',
      i.c2paVerified ? 'Yes' : 'No',
      i.submittedAt.toISOString(), i.reviewedAt?.toISOString() || '',
    ]),
    summary: [
      { label: 'Total Incidents', value: incidents.length },
      { label: 'Critical', value: severityCounts['CRITICAL'] || 0 },
      { label: 'High', value: severityCounts['HIGH'] || 0 },
      { label: 'Medium', value: severityCounts['MEDIUM'] || 0 },
      { label: 'Low', value: severityCounts['LOW'] || 0 },
      { label: 'Resolved', value: incidents.filter(i => i.status === 'RESOLVED').length },
      { label: 'GPS Anomalies', value: incidents.filter(i => i.gpsAnomaly).length },
    ],
  };
}

// ── Audit Logs ──
async function fetchAuditLogs(tenantId: string, dateFilter: Record<string, Date>, authUser: { userId: string; role: string }): Promise<ExportData> {
  const where: Record<string, unknown> = {};
  if (authUser.role !== 'SUPER_ADMIN') {
    where.user = { tenantId };
  }
  if (Object.keys(dateFilter).length) where.createdAt = dateFilter;
  const logs = await db.auditLog.findMany({
    where,
    include: { user: { select: { name: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const actionCounts: Record<string, number> = {};
  for (const log of logs) {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
  }
  const topActions = Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return {
    title: 'Audit Log',
    headers: ['ID', 'User', 'Role', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'Created At'],
    rows: logs.map(l => [
      l.id, l.user?.name || 'Unknown', l.user?.role || '', l.action,
      l.entityType || '', l.entityId || '', l.ipAddress || '',
      l.createdAt.toISOString(),
    ]),
    summary: [
      { label: 'Total Entries', value: logs.length },
      { label: 'Unique Actions', value: Object.keys(actionCounts).length },
      { label: 'Top Action', value: topActions[0]?.[0] || 'N/A' },
      { label: 'Top Action Count', value: topActions[0]?.[1] || 0 },
      { label: 'Date Range', value: logs.length ? `${logs[logs.length - 1].createdAt.toISOString().slice(0, 10)} to ${logs[0].createdAt.toISOString().slice(0, 10)}` : 'N/A' },
    ],
  };
}

// ── Election Results ──
async function fetchResults(tenantId: string, dateFilter: Record<string, Date>): Promise<ExportData> {
  const where: Record<string, unknown> = { tenantId };
  if (Object.keys(dateFilter).length) where.submittedAt = dateFilter;
  const results = await db.electionResult.findMany({
    where,
    include: {
      pollingUnit: { select: { name: true, code: true, state: true, lga: true, registeredVoters: true } },
      reporter: { select: { name: true } },
    },
    orderBy: { submittedAt: 'desc' },
  });
  const totalAccredited = results.reduce((s, r) => s + r.accreditedVoters, 0);
  const totalVotes = results.reduce((s, r) => s + r.totalVotesCast, 0);
  return {
    title: 'Election Results',
    headers: ['ID', 'Polling Unit', 'Code', 'State', 'LGA', 'Accredited', 'Valid Votes', 'Rejected', 'Total Cast', 'BVAS Used', 'Materials On Time', 'Security Present', 'Violence', 'Verified', 'Reporter', 'Submitted At'],
    rows: results.map(r => [
      r.id, r.pollingUnit.name, r.pollingUnit.code,
      r.pollingUnit.state, r.pollingUnit.lga,
      r.accreditedVoters, r.totalValidVotes, r.rejectedBallots, r.totalVotesCast,
      r.bvasUsed ? 'Yes' : 'No', r.materialsArrivedOnTime ? 'Yes' : 'No',
      r.securityPresent ? 'Yes' : 'No', r.violenceOccurred ? 'Yes' : 'No',
      r.verified ? 'Yes' : 'No', r.reporter?.name || '',
      r.submittedAt.toISOString(),
    ]),
    summary: [
      { label: 'Total Polling Units', value: results.length },
      { label: 'Total Accredited', value: totalAccredited },
      { label: 'Total Votes Cast', value: totalVotes },
      { label: 'Avg Turnout', value: totalAccredited > 0 ? `${((totalVotes / totalAccredited) * 100).toFixed(1)}%` : 'N/A' },
      { label: 'Verified', value: results.filter(r => r.verified).length },
      { label: 'Violence', value: results.filter(r => r.violenceOccurred).length },
    ],
  };
}

// ── Agents ──
async function fetchAgents(tenantId: string): Promise<ExportData> {
  const agents = await db.user.findMany({
    where: { tenantId, role: 'FIELD_AGENT' },
    select: { id: true, name: true, phone: true, lastSeenAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  const now = Date.now();
  const online = agents.filter(a => a.lastSeenAt && (now - a.lastSeenAt.getTime()) < 30 * 60 * 1000).length;
  return {
    title: 'Field Agent Roster',
    headers: ['ID', 'Name', 'Phone', 'Last Seen', 'Status', 'Created At'],
    rows: agents.map(a => [
      a.id, a.name, a.phone || '',
      a.lastSeenAt?.toISOString() || 'Never',
      a.lastSeenAt && (now - a.lastSeenAt.getTime()) < 30 * 60 * 1000 ? 'Online' : a.lastSeenAt ? 'Offline' : 'Never Active',
      a.createdAt.toISOString(),
    ]),
    summary: [
      { label: 'Total Agents', value: agents.length },
      { label: 'Currently Online', value: online },
      { label: 'Never Active', value: agents.filter(a => !a.lastSeenAt).length },
    ],
  };
}

// ── Alerts ──
async function fetchAlerts(tenantId: string, dateFilter: Record<string, Date>): Promise<ExportData> {
  const where: Record<string, unknown> = { tenantId };
  if (Object.keys(dateFilter).length) where.createdAt = dateFilter;
  const alerts = await db.alert.findMany({
    where,
    include: { incident: { select: { severity: true, status: true, type: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const catCounts: Record<string, number> = {};
  for (const a of alerts) {
    catCounts[a.category] = (catCounts[a.category] || 0) + 1;
  }
  return {
    title: 'Alert Report',
    headers: ['ID', 'Type', 'Category', 'Title', 'Description', 'Severity', 'Status', 'Read', 'Created At'],
    rows: alerts.map(a => [
      a.id, a.type, a.category,
      (a.title || '').slice(0, 100),
      (a.description || '').slice(0, 200),
      a.incident?.severity || 'N/A', a.incident?.status || 'N/A',
      a.isRead ? 'Yes' : 'No',
      a.createdAt.toISOString(),
    ]),
    summary: [
      { label: 'Total Alerts', value: alerts.length },
      { label: 'Unread', value: alerts.filter(a => !a.isRead).length },
      { label: 'Critical', value: catCounts['CRITICAL'] || 0 },
      { label: 'Warning', value: catCounts['WARNING'] || 0 },
      { label: 'Info', value: catCounts['INFO'] || 0 },
    ],
  };
}

// ── PVT Submissions ──
async function fetchPvt(tenantId: string, dateFilter: Record<string, Date>): Promise<ExportData> {
  const where: Record<string, unknown> = { tenantId };
  if (Object.keys(dateFilter).length) where.submittedAt = dateFilter;
  const submissions = await db.pvtSubmission.findMany({
    where,
    include: {
      pollingUnit: { select: { name: true, code: true, state: true, lga: true } },
    },
    orderBy: { submittedAt: 'desc' },
  });
  const verified = submissions.filter(s => s.verificationHash).length;
  let totalVotes = 0;
  for (const s of submissions) {
    try {
      const pr = JSON.parse(s.partyResults);
      totalVotes += Object.values(pr as Record<string, number>).reduce((a, b) => a + b, 0);
    } catch { /* empty */ }
  }
  return {
    title: 'PVT / Quick Count',
    headers: ['ID', 'Polling Unit', 'Code', 'State', 'LGA', 'BVAS Serial', 'Total Votes', 'Verified', 'Photo', 'Submitted At'],
    rows: submissions.map(s => {
      let totalV = 0;
      try {
        const pr = JSON.parse(s.partyResults);
        totalV = Object.values(pr as Record<string, number>).reduce((a, b) => a + b, 0);
      } catch { /* empty */ }
      return [
        s.id, s.pollingUnit?.name || '', s.pollingUnit?.code || '',
        s.pollingUnit?.state || '', s.pollingUnit?.lga || '',
        s.bvasSerialNumber || '', totalV,
        s.verificationHash ? 'Verified' : 'Pending',
        s.photoUrl ? 'Yes' : 'No',
        s.submittedAt.toISOString(),
      ];
    }),
    summary: [
      { label: 'Total Submissions', value: submissions.length },
      { label: 'Verified', value: verified },
      { label: 'Unverified', value: submissions.length - verified },
      { label: 'Total Votes (PVT)', value: totalVotes },
      { label: 'With Photo', value: submissions.filter(s => s.photoUrl).length },
    ],
  };
}

// ── Voter Suppression ──
async function fetchVoterSuppression(tenantId: string, dateFilter: Record<string, Date>): Promise<ExportData> {
  const where: Record<string, unknown> = { tenantId };
  if (Object.keys(dateFilter).length) where.createdAt = dateFilter;
  const reports = await db.voterSuppressionReport.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  const severityCounts: Record<string, number> = {};
  for (const r of reports) {
    severityCounts[r.severity] = (severityCounts[r.severity] || 0) + 1;
  }
  return {
    title: 'Voter Suppression Report',
    headers: ['ID', 'Report Type', 'Severity', 'State', 'LGA', 'Title', 'Description', 'Disinformation', 'Counter Measure', 'Created At'],
    rows: reports.map(r => [
      r.id, r.reportType, r.severity, r.state, r.lga || '',
      (r.title || '').slice(0, 100),
      (r.description || '').slice(0, 200),
      r.isDisinformation ? 'Yes' : 'No',
      (r.counterMeasure || '').slice(0, 100),
      r.createdAt.toISOString(),
    ]),
    summary: [
      { label: 'Total Reports', value: reports.length },
      { label: 'Critical', value: severityCounts['CRITICAL'] || 0 },
      { label: 'High', value: severityCounts['HIGH'] || 0 },
      { label: 'Disinformation', value: reports.filter(r => r.isDisinformation).length },
      { label: 'With Counter-Measure', value: reports.filter(r => r.counterMeasure).length },
    ],
  };
}

// ── OSINT Posts ──
async function fetchOsint(tenantId: string, dateFilter: Record<string, Date>): Promise<ExportData> {
  const where: Record<string, unknown> = { tenantId };
  if (Object.keys(dateFilter).length) where.ingestedAt = dateFilter;
  const posts = await db.osintPost.findMany({
    where,
    orderBy: { ingestedAt: 'desc' },
  });
  const sentimentCounts: Record<string, number> = {};
  const platformCounts: Record<string, number> = {};
  for (const p of posts) {
    sentimentCounts[p.sentiment] = (sentimentCounts[p.sentiment] || 0) + 1;
    platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
  }
  return {
    title: 'OSINT Monitoring Report',
    headers: ['ID', 'Platform', 'Author', 'Sentiment', 'CIB Score', 'Virality', 'Content Preview', 'Bot Suspect', 'Ingested At'],
    rows: posts.map(p => [
      p.id, p.platform, p.author || '',
      p.sentiment || 'UNKNOWN', p.cibScore ?? '',
      p.viralityScore ?? '',
      (p.content || '').slice(0, 150),
      p.isBotSuspect ? 'Yes' : 'No',
      p.ingestedAt.toISOString(),
    ]),
    summary: [
      { label: 'Total Posts', value: posts.length },
      { label: 'High CIB (>0.5)', value: posts.filter(p => p.cibScore > 0.5).length },
      { label: 'Bot Suspects', value: posts.filter(p => p.isBotSuspect).length },
      { label: 'Top Platform', value: Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A' },
      { label: 'Negative Sentiment', value: sentimentCounts['NEGATIVE'] || 0 },
    ],
  };
}

// ── Security Events ──
async function fetchSecurityEvents(tenantId: string, dateFilter: Record<string, Date>): Promise<ExportData> {
  const where: Record<string, unknown> = { tenantId };
  if (Object.keys(dateFilter).length) where.createdAt = dateFilter;
  const events = await db.securityEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  const severityCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  for (const e of events) {
    severityCounts[e.severity] = (severityCounts[e.severity] || 0) + 1;
    typeCounts[e.eventType] = (typeCounts[e.eventType] || 0) + 1;
  }
  return {
    title: 'Security Events',
    headers: ['ID', 'Event Type', 'Severity', 'Description', 'Source IP', 'User Agent', 'Resolved', 'Created At'],
    rows: events.map(e => [
      e.id, e.eventType, e.severity,
      (e.description || '').slice(0, 200),
      e.ipAddress || '', e.userAgent || '',
      e.resolved ? 'Yes' : 'No',
      e.createdAt.toISOString(),
    ]),
    summary: [
      { label: 'Total Events', value: events.length },
      { label: 'Critical', value: severityCounts['CRITICAL'] || 0 },
      { label: 'High', value: severityCounts['HIGH'] || 0 },
      { label: 'Resolved', value: events.filter(e => e.resolved).length },
      { label: 'Top Event Type', value: Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A' },
    ],
  };
}

// ── Geofence Zones ──
async function fetchGeofence(tenantId: string): Promise<ExportData> {
  const zones = await db.geofenceZone.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return {
    title: 'Geofence Zones',
    headers: ['ID', 'Name', 'State', 'LGA', 'Radius (m)', 'Center Lat', 'Center Lng', 'Check-In Interval (min)', 'Active', 'Created At'],
    rows: zones.map(z => [
      z.id, z.name, z.state, z.lga || '',
      z.radiusMeters, z.centerLat, z.centerLng,
      z.checkInIntervalMin,
      z.isActive ? 'Active' : 'Inactive',
      z.createdAt.toISOString(),
    ]),
    summary: [
      { label: 'Total Zones', value: zones.length },
      { label: 'Active', value: zones.filter(z => z.isActive).length },
      { label: 'Total Assigned Agents', value: zones.reduce((s, z) => s + (JSON.parse(z.assignedAgentIds) as unknown[]).length, 0) },
    ],
  };
}

// ── Honeypot Units ──
async function fetchHoneypot(tenantId: string): Promise<ExportData> {
  const units = await db.honeypotUnit.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return {
    title: 'Honeypot / Decoy Polling Units',
    headers: ['ID', 'Name', 'State', 'LGA', 'Trap Type', 'Deviation %', 'Deviation Detected', 'Alert Triggered', 'Active', 'Created At'],
    rows: units.map(u => [
      u.id, u.name, u.state, u.lga || '',
      u.trapType, u.deviationPct,
      u.deviationDetected ? 'Yes' : 'No',
      u.alertTriggered ? 'Yes' : 'No',
      u.isActive ? 'Active' : 'Inactive',
      u.createdAt.toISOString(),
    ]),
    summary: [
      { label: 'Total Honeypot Units', value: units.length },
      { label: 'Deviation Detected', value: units.filter(u => u.deviationDetected).length },
      { label: 'Alerts Triggered', value: units.filter(u => u.alertTriggered).length },
      { label: 'Active', value: units.filter(u => u.isActive).length },
      { label: 'Avg Deviation %', value: units.length > 0 ? (units.reduce((s, u) => s + u.deviationPct, 0) / units.length).toFixed(1) : 'N/A' },
    ],
  };
}

// ── Flashpoint Forecasts ──
async function fetchFlashpoint(tenantId: string): Promise<ExportData> {
  const forecasts = await db.flashpointForecast.findMany({
    where: { tenantId },
    orderBy: { generatedAt: 'desc' },
  });
  return {
    title: 'Flashpoint Forecasts',
    headers: ['ID', 'State', 'LGA', 'Risk Level', 'Confidence', 'Contributing Factors', 'AI Model', 'Generated At'],
    rows: forecasts.map(f => {
      let factors = '';
      try { const pf = JSON.parse(f.contributingFactors); factors = Array.isArray(pf) ? (pf as string[]).slice(0, 3).join('; ') : ''; } catch { /* empty */ }
      return [
        f.id, f.state, f.lga || '', f.riskLevel,
        `${(f.confidence * 100).toFixed(0)}%`,
        factors, f.aiModel,
        f.generatedAt.toISOString(),
      ];
    }),
    summary: [
      { label: 'Total Forecasts', value: forecasts.length },
      { label: 'High Risk', value: forecasts.filter(f => f.riskLevel === 'HIGH' || f.riskLevel === 'CRITICAL').length },
      { label: 'Avg Confidence', value: forecasts.length > 0 ? (forecasts.reduce((s, f) => s + f.confidence, 0) / forecasts.length * 100).toFixed(1) + '%' : 'N/A' },
    ],
  };
}

// ── Accessibility Reports ──
async function fetchAccessibility(tenantId: string): Promise<ExportData> {
  const reports = await db.accessibilityReport.findMany({
    where: { tenantId },
    include: { pollingUnit: { select: { name: true, state: true, lga: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return {
    title: 'Accessibility (PWD) Reports',
    headers: ['ID', 'Polling Unit', 'State', 'LGA', 'Overall Score', 'Features', 'Barrier Types', 'PWD Served', 'PWD Turned Away', 'Notes', 'Created At'],
    rows: reports.map(r => {
      let features = '';
      let barriers = '';
      try { const f = JSON.parse(r.features); features = Array.isArray(f) ? (f as string[]).join(', ') : JSON.stringify(f); } catch { features = ''; }
      try { const b = JSON.parse(r.barrierTypes); barriers = Array.isArray(b) ? (b as string[]).slice(0, 3).join('; ') : JSON.stringify(b); } catch { barriers = ''; }
      return [
        r.id, r.pollingUnit?.name || '', r.pollingUnit?.state || '', r.pollingUnit?.lga || '',
        r.overallScore, features, barriers,
        r.pwdVotersServed, r.pwdVotersTurnedAway,
        (r.notes || '').slice(0, 100),
        r.createdAt.toISOString(),
      ];
    }),
    summary: [
      { label: 'Total Reports', value: reports.length },
      { label: 'Avg Score', value: reports.length > 0 ? (reports.reduce((s, r) => s + r.overallScore, 0) / reports.length).toFixed(1) : 'N/A' },
      { label: 'High Score (>=7)', value: reports.filter(r => r.overallScore >= 7).length },
      { label: 'Low Score (<4)', value: reports.filter(r => r.overallScore < 4).length },
      { label: 'PWD Served', value: reports.reduce((s, r) => s + r.pwdVotersServed, 0) },
    ],
  };
}

// ── Comprehensive Election Summary ──
async function fetchElectionSummary(tenantId: string): Promise<ExportData> {
  const [incidents, results, pvtSubs, agents, criticalAlerts] = await Promise.all([
    db.incident.findMany({ where: { tenantId }, include: { pollingUnit: { select: { state: true, lga: true } } } }),
    db.electionResult.findMany({ where: { tenantId }, include: { pollingUnit: { select: { state: true, lga: true, registeredVoters: true, totalVotes: true } } } }),
    db.pvtSubmission.count({ where: { tenantId } }),
    db.user.count({ where: { tenantId, role: 'FIELD_AGENT' } }),
    db.alert.count({ where: { tenantId, category: 'CRITICAL' } }),
  ]);

  const stateAgg: Record<string, { units: number; votes: number; registered: number; incidents: number }> = {};
  for (const r of results) {
    const st = r.pollingUnit.state;
    if (!stateAgg[st]) stateAgg[st] = { units: 0, votes: 0, registered: 0, incidents: 0 };
    stateAgg[st].units += 1;
    stateAgg[st].votes += r.totalVotesCast;
    stateAgg[st].registered += r.pollingUnit.registeredVoters;
  }
  for (const inc of incidents) {
    const st = inc.pollingUnit?.state;
    if (st && stateAgg[st]) stateAgg[st].incidents += 1;
  }

  const totalRegistered = results.reduce((s, r) => s + r.pollingUnit.registeredVoters, 0);
  const totalVotes = results.reduce((s, r) => s + r.totalVotesCast, 0);

  return {
    title: 'Election Summary Report',
    headers: ['State', 'Polling Units', 'Registered Voters', 'Total Votes', 'Turnout %', 'Incidents', 'Incidents/Unit'],
    rows: Object.entries(stateAgg)
      .sort((a, b) => b[1].votes - a[1].votes)
      .map(([state, d]) => [
        state, d.units, d.registered, d.votes,
        d.registered > 0 ? `${((d.votes / d.registered) * 100).toFixed(1)}%` : 'N/A',
        d.incidents,
        d.units > 0 ? (d.incidents / d.units).toFixed(2) : 'N/A',
      ]),
    summary: [
      { label: 'Total States', value: Object.keys(stateAgg).length },
      { label: 'Total Polling Units', value: results.length },
      { label: 'Total Registered', value: totalRegistered },
      { label: 'Total Votes Cast', value: totalVotes },
      { label: 'Overall Turnout', value: totalRegistered > 0 ? `${((totalVotes / totalRegistered) * 100).toFixed(1)}%` : 'N/A' },
      { label: 'Total Incidents', value: incidents.length },
      { label: 'Critical Incidents', value: incidents.filter(i => i.severity === 'CRITICAL').length },
      { label: 'PVT Submissions', value: pvtSubs },
      { label: 'Field Agents', value: agents },
      { label: 'Critical Alerts', value: criticalAlerts },
    ],
  };
}

// ---------- CSV Response ----------

function generateCSVResponse(data: ExportData, type: string, today: string): NextResponse {
  const filename = `omnivote-${type}-${today}.csv`;
  const escapeRow = (row: (string | number | boolean)[]) =>
    row.map(cell => {
      const s = String(cell);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }).join(',');

  const csvContent = [
    `# Omnivote ${data.title} — ${today}`,
    ...data.summary.map(s => `# ${s.label}: ${s.value}`),
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

async function generateExcelResponse(data: ExportData, type: string, today: string): Promise<NextResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ExcelJS = await import('exceljs');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workbook = new (ExcelJS as any).Workbook();
  workbook.creator = 'Omnivote';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(data.title, {
    properties: { tabColor: { argb: '4F46E5' } },
  });

  const titleRow = sheet.addRow([`Omnivote ${data.title} — ${today}`]);
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: '1F2937' } };
  sheet.mergeCells(1, 1, 1, data.headers.length);
  sheet.addRow([]);

  for (const item of data.summary) {
    const row = sheet.addRow([item.label, item.value]);
    row.getCell(1).font = { bold: true, size: 10 };
    row.getCell(2).font = { size: 10 };
  }
  sheet.addRow([]);

  const headerRow = sheet.addRow(data.headers);
  headerRow.eachCell((cell: { font: object; fill: object; border: object }) => {
    cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '374151' } };
    cell.border = { bottom: { style: 'thin', color: { argb: '9CA3AF' } } };
  });

  for (let idx = 0; idx < data.rows.length; idx++) {
    const dataRow = sheet.addRow(data.rows[idx].map(String));
    dataRow.eachCell((cell: { font: object; border: object; fill?: object }) => {
      cell.font = { size: 10 };
      cell.border = { bottom: { style: 'hair', color: { argb: 'E5E7EB' } } };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FAFB' } };
      }
    });
  }

  for (let col = 1; col <= data.headers.length; col++) {
    const maxLen = Math.max(
      ...data.rows.slice(0, 100).map(r => String(r[col - 1] ?? '').length),
      data.headers[col - 1].length,
      10,
    );
    sheet.getColumn(col).width = Math.min(maxLen + 2, 40);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `omnivote-${type}-${today}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// ---------- PDF Response ----------

async function generatePDFResponse(data: ExportData, type: string, today: string): Promise<NextResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jspdfModule: any = await import('jspdf');
  const { jsPDF } = jspdfModule.default ? jspdfModule : jspdfModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`Omnivote ${data.title}`, 14, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
  doc.text(`Export Date: ${today}`, 14, 30);

  doc.setFontSize(9);
  let summaryY = 18;
  for (const item of data.summary) {
    doc.text(`${item.label}: ${item.value}`, pageWidth - 14, summaryY, { align: 'right' });
    summaryY += 5;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(14, 34, pageWidth - 14, 34);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    head: [data.headers],
    body: data.rows.map(row => row.map(String)),
    startY: 38,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Omnivote Election Monitoring — ${data.title} — Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' },
    );
  }

  const buffer = doc.output('arraybuffer');
  const filename = `omnivote-${type}-${today}.pdf`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function capitalize(s: string): string {
  return s.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}
