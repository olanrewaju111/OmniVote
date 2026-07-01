import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const tenant = await db.tenant.findFirst({ where: { slug: 'new' } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const [
      totalAgents,
      onlineAgents,
      totalIncidents,
      pendingIncidents,
      criticalIncidents,
      quarantinedIncidents,
      securityAlerts,
      operationalAlerts,
      unreadAlerts,
      pollingUnits,
      sosCount,
    ] = await Promise.all([
      db.user.count({ where: { tenantId: tenant.id, role: 'FIELD_AGENT' } }),
      db.user.count({ where: { tenantId: tenant.id, role: 'FIELD_AGENT', isOnline: true } }),
      db.incident.count({ where: { tenantId: tenant.id } }),
      db.incident.count({ where: { tenantId: tenant.id, status: 'PENDING' } }),
      db.incident.count({ where: { tenantId: tenant.id, severity: 'CRITICAL' } }),
      db.incident.count({ where: { tenantId: tenant.id, isQuarantined: true } }),
      db.alert.count({ where: { tenantId: tenant.id, type: 'SECURITY' } }),
      db.alert.count({ where: { tenantId: tenant.id, type: 'OPERATIONAL' } }),
      db.alert.count({ where: { tenantId: tenant.id, isRead: false } }),
      db.pollingUnit.findMany({ where: { electionId: { in: (await db.election.findMany({ where: { tenantId: tenant.id }, select: { id: true } })).map(e => e.id) } } }),
      db.incident.count({ where: { tenantId: tenant.id, type: 'VIOLENCE', severity: 'CRITICAL' } }),
    ]);

    const totalRegistered = pollingUnits.reduce((s, p) => s + p.registeredVoters, 0);
    const totalVotes = pollingUnits.reduce((s, p) => s + p.totalVotes, 0);
    const avgTurnout = pollingUnits.length ? Math.round((totalVotes / totalRegistered) * 10000) / 100 : 0;
    const flaggedUnits = pollingUnits.filter(p => p.status === 'FLAGGED').length;
    const openUnits = pollingUnits.filter(p => p.status === 'OPEN').length;
    const closedUnits = pollingUnits.filter(p => p.status === 'CLOSED').length;

    // State-level aggregation
    const stateAgg: Record<string, { units: number; votes: number; registered: number; turnout: number }> = {};
    for (const pu of pollingUnits) {
      if (!stateAgg[pu.state]) stateAgg[pu.state] = { units: 0, votes: 0, registered: 0, turnout: 0 };
      stateAgg[pu.state].units++;
      stateAgg[pu.state].votes += pu.totalVotes;
      stateAgg[pu.state].registered += pu.registeredVoters;
    }
    for (const s of Object.keys(stateAgg)) {
      stateAgg[s].turnout = Math.round((stateAgg[s].votes / stateAgg[s].registered) * 10000) / 100;
    }

    return NextResponse.json({
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