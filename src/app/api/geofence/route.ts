import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { safeParse } from '@/lib/safe-parse';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';
import { logAudit, extractIp } from '@/lib/audit';

// GET /api/geofence?tenantId=X
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

    const [zones, checkIns, switches, agents] = await Promise.all([
      db.geofenceZone.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      db.agentCheckIn.findMany({
        where: { tenantId },
        orderBy: { checkedInAt: 'desc' },
        take: 200,
      }),
      db.deadMansSwitch.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
      }),
      db.user.findMany({
        where: { tenantId },
        select: { id: true, name: true, role: true, isOnline: true, lastSeenAt: true, isLocked: true, biometricRiskScore: true, deviceTrustScore: true },
      }),
    ]);

    const parsedZones = zones.map(z => ({
      ...z,
      pollingUnitIds: safeParse(z.pollingUnitIds),
      assignedAgentIds: safeParse(z.assignedAgentIds),
    }));

    // Agent map for name lookups
    const agentMap = new Map(agents.map(a => [a.id, a]));

    // Enrich check-ins with agent names
    const parsedCheckIns = checkIns.map(c => ({
      ...c,
      agentName: agentMap.get(c.agentId)?.name || 'Unknown',
      zoneName: zones.find(z => z.id === c.geofenceZoneId)?.name || 'Unknown',
    }));

    // Enrich switches
    const parsedSwitches = switches.map(s => ({
      ...s,
      agentName: agentMap.get(s.agentId)?.name || 'Unknown',
      zoneName: s.geofenceZoneId ? zones.find(z => z.id === s.geofenceZoneId)?.name || 'Unknown' : null,
      isOverdue: s.isActive && new Date(s.checkInDeadline) < new Date(),
    }));

    // Counts
    const activeZones = zones.filter(z => z.isActive).length;
    const activeSwitches = switches.filter(s => s.isActive).length;
    const overdueSwitches = switches.filter(s => s.isActive && new Date(s.checkInDeadline) < new Date()).length;
    const escalatedSwitches = switches.filter(s => s.escalationLevel >= 2).length;
    const sosTriggered = switches.filter(s => s.autoSOSTriggered).length;
    const checkedInNow = checkIns.filter(c => c.status === 'CHECKED_IN').length;
    const sosCheckIns = checkIns.filter(c => c.status === 'SOS_TRIGGERED').length;

    // Build agent safety summary
    const agentSafety = agents.filter(a => a.role === 'FIELD_AGENT').map(a => {
      const agentSwitch = switches.find(s => s.agentId === a.id && s.isActive);
      const latestCheckIn = checkIns.find(c => c.agentId === a.id);
      return {
        id: a.id,
        name: a.name,
        isOnline: a.isOnline,
        lastSeenAt: a.lastSeenAt,
        isLocked: a.isLocked,
        biometricRiskScore: a.biometricRiskScore,
        deviceTrustScore: a.deviceTrustScore,
        hasActiveSwitch: !!agentSwitch,
        switchEscalation: agentSwitch?.escalationLevel || 0,
        isOverdue: agentSwitch ? new Date(agentSwitch.checkInDeadline) < new Date() : false,
        lastCheckInAt: latestCheckIn?.checkedInAt || null,
        lastCheckInStatus: latestCheckIn?.status || null,
      };
    });

    return NextResponse.json({
      zones: parsedZones,
      checkIns: parsedCheckIns,
      switches: parsedSwitches,
      agentSafety,
      counts: {
        totalZones: zones.length,
        activeZones,
        activeSwitches,
        overdueSwitches,
        escalatedSwitches,
        sosTriggered,
        checkedInNow,
        sosCheckIns,
        totalFieldAgents: agents.filter(a => a.role === 'FIELD_AGENT').length,
      },
    });
  } catch (err) {
    console.error('Geofence error:', err);
    return NextResponse.json({ error: 'Failed to fetch geofence data' }, { status: 500 });
  }
}

// POST /api/geofence — create zone, check-in, or manage dead-man's switch
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
    const { action } = body;

    if (action === 'CREATE_ZONE') {
      const WRITE_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] as const;
      if (!WRITE_ROLES.includes(authUser.role as typeof WRITE_ROLES[number])) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      const { name, state, lga, centerLat, centerLng, radiusMeters, pollingUnitIds, assignedAgentIds, checkInIntervalMin, maxMissedCheckIns } = body;
      if (!name || !state || centerLat == null || centerLng == null || !radiusMeters) {
        return NextResponse.json({ error: 'name, state, centerLat, centerLng, radiusMeters required' }, { status: 400 });
      }
      const zone = await db.geofenceZone.create({
        data: {
          tenantId, name, state, lga: lga || null,
          centerLat, centerLng, radiusMeters,
          pollingUnitIds: JSON.stringify(pollingUnitIds || []),
          assignedAgentIds: JSON.stringify(assignedAgentIds || []),
          checkInIntervalMin: checkInIntervalMin || 60,
          maxMissedCheckIns: maxMissedCheckIns || 3,
        },
      });
      void logAudit({ userId: authUser.userId, action: 'CREATE_GEOFENCE_ZONE', entityType: 'GeofenceZone', entityId: zone.id, metadata: { name, state }, ipAddress: extractIp(req) });
      return NextResponse.json({ zone }, { status: 201 });
    }

    if (action === 'CHECK_IN') {
      const { agentId, geofenceZoneId, latitude, longitude, isInsideZone, batteryLevel, networkType, accuracyMeters, notes } = body;
      if (!agentId || !geofenceZoneId || latitude == null || longitude == null) {
        return NextResponse.json({ error: 'agentId, geofenceZoneId, latitude, longitude required' }, { status: 400 });
      }
      const checkIn = await db.agentCheckIn.create({
        data: {
          tenantId, agentId, geofenceZoneId, latitude, longitude,
          isInsideZone: isInsideZone ?? true,
          batteryLevel: batteryLevel ?? null,
          networkType: networkType || null,
          accuracyMeters: accuracyMeters ?? null,
          notes: notes || null,
          status: isInsideZone ? 'CHECKED_IN' : 'CHECKED_OUT',
        },
      });
      void logAudit({ userId: authUser.userId, action: 'AGENT_CHECK_IN', entityType: 'AgentCheckIn', entityId: checkIn.id, metadata: { agentId, geofenceZoneId, isInsideZone }, ipAddress: extractIp(req) });
      // Update dead-man's switch
      const existingSwitch = await db.deadMansSwitch.findFirst({
        where: { tenantId, agentId, geofenceZoneId, isActive: true },
      });
      if (existingSwitch) {
        const zone = await db.geofenceZone.findUnique({ where: { id: geofenceZoneId } });
        const interval = (zone?.checkInIntervalMin || 60) * 60000;
        await db.deadMansSwitch.update({
          where: { id: existingSwitch.id },
          data: {
            lastCheckInAt: new Date(),
            checkInDeadline: new Date(Date.now() + interval),
            missedCheckIns: 0,
            escalationLevel: 0,
          },
        });
      }
      return NextResponse.json({ checkIn }, { status: 201 });
    }

    if (action === 'TRIGGER_SOS') {
      const { agentId, geofenceZoneId, latitude, longitude } = body;
      if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });
      // Create SOS check-in
      const checkIn = await db.agentCheckIn.create({
        data: {
          tenantId, agentId, geofenceZoneId: geofenceZoneId || '',
          latitude: latitude || 0, longitude: longitude || 0,
          isInsideZone: false, status: 'SOS_TRIGGERED',
        },
      });
      // Mark dead-man's switch as SOS
      const existingSwitch = await db.deadMansSwitch.findFirst({
        where: { tenantId, agentId, isActive: true },
      });
      if (existingSwitch) {
        await db.deadMansSwitch.update({
          where: { id: existingSwitch.id },
          data: { escalationLevel: 3, autoSOSTriggered: true },
        });
      }
      return NextResponse.json({ checkIn, sosTriggered: true }, { status: 201 });
    }

    if (action === 'RESOLVE_SWITCH') {
      const WRITE_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] as const;
      if (!WRITE_ROLES.includes(authUser.role as typeof WRITE_ROLES[number])) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      const { switchId, resolvedById, notes } = body;
      if (!switchId) return NextResponse.json({ error: 'switchId required' }, { status: 400 });
      await db.deadMansSwitch.update({
        where: { id: switchId, tenantId },
        data: { isActive: false, resolvedAt: new Date(), resolvedById: resolvedById || null, resolvedNotes: notes || null },
      });
      void logAudit({ userId: authUser.userId, action: 'RESOLVE_DEAD_MANS_SWITCH', entityType: 'DeadMansSwitch', entityId: switchId, ipAddress: extractIp(req) });
      return NextResponse.json({ success: true });
    }

    if (action === 'TOGGLE_ZONE') {
      const WRITE_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] as const;
      if (!WRITE_ROLES.includes(authUser.role as typeof WRITE_ROLES[number])) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      const { zoneId, isActive } = body;
      if (!zoneId) return NextResponse.json({ error: 'zoneId required' }, { status: 400 });
      const zone = await db.geofenceZone.update({
        where: { id: zoneId, tenantId },
        data: { isActive: isActive ?? true },
      });
      void logAudit({ userId: authUser.userId, action: 'TOGGLE_GEOFENCE_ZONE', entityType: 'GeofenceZone', entityId: zoneId, metadata: { isActive }, ipAddress: extractIp(req) });
      return NextResponse.json({ zone });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Geofence POST error:', err);
    return NextResponse.json({ error: 'Failed to process geofence action' }, { status: 500 });
  }
}