import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';

// GET /api/reports?reporterId=xxx — unified "my reports" for a field agent
// Returns their election results + incidents + summary counts
export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const reporterId = searchParams.get('reporterId');

    if (!reporterId) {
      return NextResponse.json({ error: 'reporterId is required' }, { status: 400 });
    }

    const reporter = await db.user.findFirst({
      where: { id: reporterId, tenantId },
      select: { id: true, name: true, role: true },
    });
    if (!reporter) {
      return NextResponse.json({ error: 'Reporter not found' }, { status: 404 });
    }

    const [results, incidents, resultCount, incidentCount] = await Promise.all([
      db.electionResult.findMany({
        where: { tenantId, reportedById: reporterId },
        include: {
          pollingUnit: { select: { id: true, name: true, code: true, state: true, lga: true, ward: true, registeredVoters: true } },
        },
        orderBy: { submittedAt: 'desc' },
        take: 50,
      }),
      db.incident.findMany({
        where: { tenantId, reportedById: reporterId },
        include: {
          pollingUnit: { select: { id: true, name: true, code: true, state: true, lga: true } },
        },
        orderBy: { submittedAt: 'desc' },
        take: 50,
      }),
      db.electionResult.count({ where: { tenantId, reportedById: reporterId } }),
      db.incident.count({ where: { tenantId, reportedById: reporterId } }),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [resultsToday, incidentsToday] = await Promise.all([
      db.electionResult.count({ where: { tenantId, reportedById: reporterId, submittedAt: { gte: todayStart } } }),
      db.incident.count({ where: { tenantId, reportedById: reporterId, submittedAt: { gte: todayStart } } }),
    ]);

    const mappedResults = results.map(r => ({
      id: r.id,
      accreditedVoters: r.accreditedVoters,
      totalValidVotes: r.totalValidVotes,
      rejectedBallots: r.rejectedBallots,
      totalVotesCast: r.totalVotesCast,
      partyResults: JSON.parse(r.partyResults || '[]'),
      bvasUsed: r.bvasUsed,
      materialsArrivedOnTime: r.materialsArrivedOnTime,
      securityPresent: r.securityPresent,
      violenceOccurred: r.violenceOccurred,
      notes: r.notes,
      verified: r.verified,
      submittedAt: r.submittedAt,
      updatedAt: r.updatedAt,
      pollingUnit: r.pollingUnit,
    }));

    const mappedIncidents = incidents.map(inc => ({
      id: inc.id,
      type: inc.type,
      severity: inc.severity,
      status: inc.status,
      description: inc.description,
      mediaUrls: JSON.parse(inc.mediaUrls || '[]'),
      gpsLat: inc.gpsLatitude,
      gpsLng: inc.gpsLongitude,
      gpsAnomaly: inc.gpsAnomaly,
      aiSummary: inc.aiSummary,
      isQuarantined: inc.isQuarantined,
      c2paVerified: inc.c2paVerified,
      submittedAt: inc.submittedAt,
      reviewedAt: inc.reviewedAt,
      pollingUnit: inc.pollingUnit,
    }));

    return NextResponse.json({
      results: mappedResults,
      incidents: mappedIncidents,
      counts: { totalResults: resultCount, totalIncidents: incidentCount, resultsToday, incidentsToday },
    });
  } catch (error) {
    console.error('Reports fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}