import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { safeParse } from '@/lib/safe-parse';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

// GET /api/campaign-events?tenantId=X&eventType=X&party=X&state=X
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

    const url = new URL(req.url || "", "http://localhost");
    const eventType = url.searchParams.get('eventType');
    const party = url.searchParams.get('party');
    const state = url.searchParams.get('state');

    // Build where filter
    const where: Record<string, unknown> = { tenantId };
    if (eventType) where.eventType = eventType;
    if (party) where.party = party;
    if (state) where.state = state;

    // Fetch events
    const events = await db.campaignEvent.findMany({
      where,
      orderBy: { eventDate: 'desc' },
    });

    // Batch-lookup reporter names
    const reporterIds = [...new Set(events.map((e) => e.reportedById).filter(Boolean))] as string[];
    const reporters = reporterIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: reporterIds } },
          select: { id: true, name: true },
        })
      : [];
    const reporterMap = new Map(reporters.map((u) => [u.id, u.name]));

    const parsedEvents = events.map((e) => ({
      id: e.id,
      tenantId: e.tenantId,
      eventType: e.eventType,
      title: e.title,
      description: e.description,
      party: e.party,
      state: e.state,
      lga: e.lga,
      venue: e.venue,
      latitude: e.latitude,
      longitude: e.longitude,
      estimatedCrowd: e.estimatedCrowd,
      reportedById: e.reportedById,
      reporterName: e.reportedById ? reporterMap.get(e.reportedById) ?? null : null,
      tone: e.tone,
      mediaUrls: safeParse(e.mediaUrls),
      aiFlags: safeParse(e.aiFlags),
      incidentCount: e.incidentCount,
      eventDate: e.eventDate,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    // Aggregate counts (always based on tenant, not filtered by query params)
    const [total, byType, byParty, byState, allEventsForFlags] = await Promise.all([
      db.campaignEvent.count({ where: { tenantId } }),
      db.campaignEvent.groupBy({
        by: ['eventType'],
        where: { tenantId },
        _count: { eventType: true },
      }),
      db.campaignEvent.groupBy({
        by: ['party'],
        where: { tenantId, party: { not: null } },
        _count: { party: true },
      }),
      db.campaignEvent.groupBy({
        by: ['state'],
        where: { tenantId },
        _count: { state: true },
      }),
      db.campaignEvent.findMany({
        where: { tenantId },
        select: { aiFlags: true },
      }),
    ]);

    // Count hate speech and state resource flags from aiFlags
    let hateSpeechFlags = 0;
    let stateResourceFlags = 0;
    for (const e of allEventsForFlags) {
      const flags: string[] = safeParse(e.aiFlags);
      if (flags.includes('hate_speech_detected')) hateSpeechFlags++;
      if (flags.includes('state_resources_detected')) stateResourceFlags++;
    }

    return NextResponse.json({
      events: parsedEvents,
      counts: {
        total,
        byType: Object.fromEntries(byType.map((g) => [g.eventType, g._count.eventType])),
        byParty: Object.fromEntries(byParty.map((g) => [g.party, g._count.party])),
        byState: Object.fromEntries(byState.map((g) => [g.state, g._count.state])),
        hateSpeechFlags,
        stateResourceFlags,
      },
    });
  } catch (err) {
    console.error('Campaign events error:', err);
    return NextResponse.json({ error: 'Failed to fetch campaign events' }, { status: 500 });
  }
}

// POST /api/campaign-events — log a new campaign event
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

    const WRITE_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] as const;
    if (!WRITE_ROLES.includes(authUser.role as typeof WRITE_ROLES[number])) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const {
      eventType,
      title,
      description,
      party,
      state,
      lga,
      venue,
      estimatedCrowd,
      tone,
      reportedById,
    } = body;

    if (!eventType || !title || !state) {
      return NextResponse.json(
        { error: 'eventType, title, and state are required' },
        { status: 400 },
      );
    }

    const event = await db.campaignEvent.create({
      data: {
        tenantId,
        eventType,
        title,
        description: description || '',
        party: party || null,
        state,
        lga: lga || null,
        venue: venue || null,
        latitude: null,
        longitude: null,
        estimatedCrowd: estimatedCrowd ? parseInt(String(estimatedCrowd), 10) : null,
        reportedById: reportedById || null,
        tone: tone || 'NEUTRAL',
        mediaUrls: '[]',
        aiFlags: '[]',
        incidentCount: 0,
        eventDate: new Date(),
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    console.error('Campaign event create error:', err);
    return NextResponse.json({ error: 'Failed to create campaign event' }, { status: 500 });
  }
}