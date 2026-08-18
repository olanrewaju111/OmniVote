import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// GET /api/activity-feed?tenantId=...&type=ALL|incident|alert|pvt|osint|security|chat|checkin&limit=50&offset=0
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
      ? ['incidents', 'alerts', 'osint', 'securityEvents', 'pvtSubmissions', 'chatMessages', 'agentCheckIns', 'honeypotUnits']
      : {
          incident: ['incidents'],
          alert: ['alerts'],
          pvt: ['pvtSubmissions'],
          osint: ['osintPosts'],
          security: ['securityEvents'],
          chat: ['chatMessages'],
          checkin: ['agentCheckIns'],
          honeypot: ['honeypotUnits'],
          result: ['electionResults', 'pvtSubmissions'],
        }[type] ?? ['incidents'];

    for (const table of typesToFetch) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results: any[] = await (db as any)[table].findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...fetchWindow,
        });
        for (const r of results) {
          events.push({
            ...r,
            _sourceTable: table,
            _eventType: mapTableToType(table),
          });
        }
      } catch {
        // Table might not exist or query might fail — skip
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
    electionResults: 'result',
  };
  return map[table] ?? 'incident';
}