import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// Type-safe table mapping — each key maps to the correct Prisma model
const TABLE_QUERIES: Record<string, (where: Record<string, unknown>, options: object) => Promise<unknown[]>> = {
  incidents: (w, o) => db.incident.findMany({ where: w, ...o }),
  alerts: (w, o) => db.alert.findMany({ where: w, ...o }),
  osintPosts: (w, o) => db.osintPost.findMany({ where: w, ...o }),
  securityEvents: (w, o) => db.securityEvent.findMany({ where: w, ...o }),
  pvtSubmissions: (w, o) => db.pvtSubmission.findMany({ where: w, ...o }),
  chatMessages: (w, o) => db.chatMessage.findMany({ where: w, ...o }),
  agentCheckIns: (w, o) => db.agentCheckIn.findMany({ where: w, ...o }),
  honeypotUnits: (w, o) => db.honeypotUnit.findMany({ where: w, ...o }),
  electionResult: (w, o) => db.electionResult.findMany({ where: w, ...o }),
};

// GET /api/activity-feed?tenantId=...&type=ALL|incident|alert|pvt|osint|security|chat|checkin|result&limit=50&offset=0
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
    const type = searchParams.get('type') || 'ALL';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = { tenantId };
    const events: Array<Record<string, unknown>> = [];

    const fetchWindow = { take: Math.ceil(limit / 6), skip: 0 };

    // Fetch from multiple tables and merge by time
    const typesToFetch = type === 'ALL'
      ? ['incidents', 'alerts', 'osintPosts', 'securityEvents', 'pvtSubmissions', 'chatMessages', 'agentCheckIns', 'honeypotUnits', 'electionResult']
      : {
          incident: ['incidents'],
          alert: ['alerts'],
          pvt: ['pvtSubmissions'],
          osint: ['osintPosts'],
          security: ['securityEvents'],
          chat: ['chatMessages'],
          checkin: ['agentCheckIns'],
          honeypot: ['honeypotUnits'],
          result: ['electionResult', 'pvtSubmissions'],
        }[type] ?? ['incidents'];

    for (const table of typesToFetch) {
      const query = TABLE_QUERIES[table];
      if (!query) continue; // unknown table — skip safely
      try {
        const results = await query(where, { orderBy: { createdAt: 'desc' }, ...fetchWindow });
        for (const r of results) {
          events.push({
            ...(r as Record<string, unknown>),
            _sourceTable: table,
            _eventType: mapTableToType(table),
          });
        }
      } catch {
        // Query might fail — skip this table gracefully
      }
    }

    // Sort by createdAt desc, paginate, and return
    events.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
    const paginated = events.slice(offset, offset + limit);

    // Include sender info for chat messages
    const chatIds = paginated.filter(e => e._sourceTable === 'chatMessages').map(e => e.senderId as string);
    const users = chatIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: chatIds } },
          select: { id: true, name: true, role: true },
        })
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const enriched = paginated.map(e => ({
      ...e,
      sender: e._sourceTable === 'chatMessages' && e.senderId
        ? userMap.get(e.senderId as string) ?? null
        : undefined,
    }));

    return NextResponse.json({
      events: enriched,
      total: events.length,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[activity-feed] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function mapTableToType(table: string): string {
  const map: Record<string, string> = {
    incidents: 'incident',
    alerts: 'alert',
    osintPosts: 'osint',
    securityEvents: 'security',
    pvtSubmissions: 'pvt',
    chatMessages: 'chat',
    agentCheckIns: 'checkin',
    honeypotUnits: 'honeypot',
    electionResult: 'result',
  };
  return map[table] ?? 'incident';
}