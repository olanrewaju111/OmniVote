import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { safeParse } from '@/lib/safe-parse';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

// GET /api/reports
//   ?reporterId=xxx       — single agent's reports (field agent view)
//   ?all=true             — all tenant reports with reporter info (admin/analyst view)
//   ?all=true&agentId=xxx — filter to a specific agent
//   ?page=1&limit=50      — pagination
export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (authUser) {
      const tenantErr = requireTenantMatch(authUser, tenantId);
      if (tenantErr) return tenantErr;
    }

    const { searchParams } = new URL(req.url);
    const reporterId = searchParams.get('reporterId');
    const viewAll = searchParams.get('all') === 'true';
    const agentId = searchParams.get('agentId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const skip = (page - 1) * limit;

    // ── Single agent view (field agent "My Reports") ──
    if (reporterId && !viewAll) {
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

      return NextResponse.json({
        results: results.map(mapResult),
        incidents: incidents.map(mapIncident),
        counts: { totalResults: resultCount, totalIncidents: incidentCount, resultsToday, incidentsToday },
      });
    }

    // ── All tenant reports (admin / analyst view) ──
    if (viewAll) {
      // Build where clause — optionally filter by agentId
      const resultWhere: Record<string, unknown> = { tenantId };
      const incidentWhere: Record<string, unknown> = { tenantId };
      if (agentId) {
        resultWhere.reportedById = agentId;
        incidentWhere.reportedById = agentId;
      }

      // Fetch agents list for the filter dropdown
      const agents = await db.user.findMany({
        where: { tenantId, role: 'FIELD_AGENT' },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      });

      const [results, incidents, resultCount, incidentCount] = await Promise.all([
        db.electionResult.findMany({
          where: resultWhere,
          include: {
            pollingUnit: { select: { id: true, name: true, code: true, state: true, lga: true, ward: true, registeredVoters: true } },
            reporter: { select: { id: true, name: true, role: true, phone: true } },
          },
          orderBy: { submittedAt: 'desc' },
          skip,
          take: limit,
        }),
        db.incident.findMany({
          where: incidentWhere,
          include: {
            pollingUnit: { select: { id: true, name: true, code: true, state: true, lga: true } },
            reporter: { select: { id: true, name: true, role: true, phone: true } },
          },
          orderBy: { submittedAt: 'desc' },
          skip,
          take: limit,
        }),
        db.electionResult.count({ where: resultWhere }),
        db.incident.count({ where: incidentWhere }),
      ]);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const [resultsToday, incidentsToday] = await Promise.all([
        db.electionResult.count({ where: { ...resultWhere, submittedAt: { gte: todayStart } } }),
        db.incident.count({ where: { ...incidentWhere, submittedAt: { gte: todayStart } } }),
      ]);

      return NextResponse.json({
        results: results.map(r => ({ ...mapResult(r), reporter: r.reporter })),
        incidents: incidents.map(i => ({ ...mapIncident(i), reporter: i.reporter })),
        counts: { totalResults: resultCount, totalIncidents: incidentCount, resultsToday, incidentsToday },
        agents, // for filter dropdown
        page,
        limit,
        hasMore: (skip + limit) < (resultCount + incidentCount),
      });
    }

    return NextResponse.json({ error: 'Specify reporterId or all=true' }, { status: 400 });
  } catch (error) {
    console.error('Reports fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

// ── Mappers ──
interface ResultRow {
  id: string;
  accreditedVoters: number;
  totalValidVotes: number;
  rejectedBallots: number;
  totalVotesCast: number;
  partyResults: string;
  bvasUsed: boolean;
  materialsArrivedOnTime: boolean;
  securityPresent: boolean;
  violenceOccurred: boolean;
  notes: string;
  verified: boolean;
  submittedAt: string;
  updatedAt: string;
  pollingUnit: { id: string; name: string; code: string; state: string; lga: string; ward: string; registeredVoters: number };
}

function mapResult(r: ResultRow) {
  return {
    id: r.id,
    accreditedVoters: r.accreditedVoters,
    totalValidVotes: r.totalValidVotes,
    rejectedBallots: r.rejectedBallots,
    totalVotesCast: r.totalVotesCast,
    partyResults: safeParse(r.partyResults),
    bvasUsed: r.bvasUsed,
    materialsArrivedOnTime: r.materialsArrivedOnTime,
    securityPresent: r.securityPresent,
    violenceOccurred: r.violenceOccurred,
    notes: r.notes,
    verified: r.verified,
    submittedAt: r.submittedAt,
    updatedAt: r.updatedAt,
    pollingUnit: r.pollingUnit,
  };
}

interface IncidentRow {
  id: string;
  type: string;
  severity: string;
  status: string;
  description: string;
  mediaUrls: string;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAnomaly: boolean;
  aiSummary: string | null;
  isQuarantined: boolean;
  c2paVerified: boolean;
  submittedAt: string;
  reviewedAt: string | null;
  pollingUnit: { id: string; name: string; code: string; state: string; lga: string } | null;
}

function mapIncident(inc: IncidentRow) {
  return {
    id: inc.id,
    type: inc.type,
    severity: inc.severity,
    status: inc.status,
    description: inc.description,
    mediaUrls: safeParse(inc.mediaUrls),
    gpsLat: inc.gpsLatitude,
    gpsLng: inc.gpsLongitude,
    gpsAnomaly: inc.gpsAnomaly,
    aiSummary: inc.aiSummary,
    isQuarantined: inc.isQuarantined,
    c2paVerified: inc.c2paVerified,
    submittedAt: inc.submittedAt,
    reviewedAt: inc.reviewedAt,
    pollingUnit: inc.pollingUnit,
  };
}