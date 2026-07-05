import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

export async function GET(req: Request) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    // Mandatory authentication — middleware catches missing tokens,
    // this is defense-in-depth for tenant isolation
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    // Fetch tenant settings (mapBounds) and active election in parallel
    const [tenant, activeElection] = await Promise.all([
      db.tenant.findUnique({ where: { id: tenantId }, select: { mapBounds: true } }),
      db.election.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'UPCOMING'] } },
      select: { id: true, title: true, tier: true, status: true, date: true },
      orderBy: { date: 'desc' },
    }),
    ]);

    const electionTier = (activeElection?.tier || 'PRESIDENTIAL') as 'LOCAL' | 'STATE' | 'PRESIDENTIAL';

    const [
      totalAgents, onlineAgents, totalIncidents, pendingIncidents,
      criticalIncidents, quarantinedIncidents, securityAlerts,
      operationalAlerts, unreadAlerts, pollingUnits, sosCount,
    ] = await Promise.all([
      db.user.count({ where: { tenantId, role: 'FIELD_AGENT' } }),
      db.user.count({ where: { tenantId, role: 'FIELD_AGENT', isOnline: true } }),
      db.incident.count({ where: { tenantId } }),
      db.incident.count({ where: { tenantId, status: 'PENDING' } }),
      db.incident.count({ where: { tenantId, severity: 'CRITICAL' } }),
      db.incident.count({ where: { tenantId, isQuarantined: true } }),
      db.alert.count({ where: { tenantId, type: 'SECURITY' } }),
      db.alert.count({ where: { tenantId, type: 'OPERATIONAL' } }),
      db.alert.count({ where: { tenantId, isRead: false } }),
      db.pollingUnit.findMany({
        where: activeElection ? { electionId: activeElection.id } : {},
      }),
      db.incident.count({ where: { tenantId, type: 'VIOLENCE', severity: 'CRITICAL' } }),
    ]);

    const totalRegistered = pollingUnits.reduce((s, p) => s + p.registeredVoters, 0);
    const totalVotes = pollingUnits.reduce((s, p) => s + p.totalVotes, 0);
    const avgTurnout = pollingUnits.length ? Math.round((totalVotes / totalRegistered) * 10000) / 100 : 0;
    const flaggedUnits = pollingUnits.filter(p => p.status === 'FLAGGED').length;
    const openUnits = pollingUnits.filter(p => p.status === 'OPEN').length;
    const closedUnits = pollingUnits.filter(p => p.status === 'CLOSED').length;

    // Aggregation key depends on election tier
    const aggKey = electionTier === 'LOCAL' ? 'ward' : 'state';
    const agg: Record<string, { units: number; votes: number; registered: number; turnout: number }> = {};
    for (const pu of pollingUnits) {
      const key = pu[aggKey] || 'Unknown';
      if (!agg[key]) agg[key] = { units: 0, votes: 0, registered: 0, turnout: 0 };
      agg[key].units++;
      agg[key].votes += pu.totalVotes;
      agg[key].registered += pu.registeredVoters;
    }
    for (const s of Object.keys(agg)) {
      agg[s].turnout = Math.round((agg[s].votes / agg[s].registered) * 10000) / 100;
    }

    // ── Trend computation (hour-over-hour deltas) ─────────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Trend: online agents seen in the last hour (same query gives current count)
    const prevOnlineAgents = await db.user.count({
      where: { tenantId, role: 'FIELD_AGENT', isOnline: true, lastSeenAt: { gte: oneHourAgo } },
    });
    // Trend: incidents created before one hour ago
    const prevIncidents = await db.incident.count({ where: { tenantId, submittedAt: { lt: oneHourAgo } } });

    // Turnout trend: compare current snapshot vs units NOT updated in the last hour.
    // This properly measures the delta in vote totals over the past hour.
    const prevVotes = await db.pollingUnit.aggregate({
      where: activeElection
        ? { electionId: activeElection.id, updatedAt: { lt: oneHourAgo } }
        : { updatedAt: { lt: oneHourAgo } },
      _sum: { totalVotes: true, registeredVoters: true },
    });

    const currentOnlineAgents = onlineAgents;
    const trendOnlineAgents = prevOnlineAgents > 0
      ? Math.round(((currentOnlineAgents - prevOnlineAgents) / prevOnlineAgents) * 1000) / 10
      : currentOnlineAgents > 0 ? 100 : 0;

    const trendIncidents = prevIncidents > 0
      ? Math.round(((totalIncidents - prevIncidents) / prevIncidents) * 1000) / 10
      : totalIncidents > 0 ? 100 : 0;

    const prevTotalVotes = prevVotes._sum.totalVotes || 0;
    const prevTotalRegistered = prevVotes._sum.registeredVoters || 0;
    const prevAvgTurnout = prevTotalRegistered > 0
      ? Math.round((prevTotalVotes / prevTotalRegistered) * 10000) / 100
      : 0;
    const trendTurnout = prevAvgTurnout > 0
      ? Math.round(((avgTurnout - prevAvgTurnout) / prevAvgTurnout) * 1000) / 10
      : avgTurnout > 0 ? 100 : 0;

    // Rename stateAgg for backward compat (frontend uses this key)
    const stateAgg = agg;

    // Parse mapBounds
    let mapBounds = null;
    if (tenant?.mapBounds && tenant.mapBounds !== 'null') {
      try { mapBounds = JSON.parse(tenant.mapBounds); } catch { /* ignore */ }
    }

    return NextResponse.json({
      mapBounds,
      electionInfo: {
        tier: electionTier,
        title: activeElection?.title || 'No Active Election',
        status: activeElection?.status || 'NONE',
        date: activeElection?.date || null,
      },
      kpis: {
        totalAgents, onlineAgents, totalIncidents, pendingIncidents,
        criticalIncidents, quarantinedIncidents, securityAlerts, operationalAlerts,
        unreadAlerts, sosCount,
      },
      trends: {
        onlineAgents: { value: Math.abs(trendOnlineAgents), up: trendOnlineAgents >= 0 },
        incidents: { value: Math.abs(trendIncidents), up: trendIncidents >= 0 },
        turnout: { value: Math.abs(trendTurnout), up: trendTurnout >= 0 },
      },
      election: {
        totalPollingUnits: pollingUnits.length,
        openUnits, closedUnits, flaggedUnits,
        totalRegistered, totalVotes, avgTurnout,
        stateAgg,
      },
      pollingUnits: pollingUnits.map(p => ({
        id: p.id, name: p.name, code: p.code, state: p.state, lga: p.lga,
        lat: p.latitude, lng: p.longitude,
        registered: p.registeredVoters, votes: p.totalVotes,
        turnout: p.turnout, status: p.status,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}