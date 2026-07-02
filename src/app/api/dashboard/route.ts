import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';

export async function GET(req: Request) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    // Fetch the active election for this tenant
    const activeElection = await db.election.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'UPCOMING'] } },
      select: { id: true, title: true, tier: true, status: true, date: true },
      orderBy: { date: 'desc' },
    });

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

    // Rename stateAgg for backward compat (frontend uses this key)
    const stateAgg = electionTier === 'LOCAL' ? agg : agg;

    return NextResponse.json({
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