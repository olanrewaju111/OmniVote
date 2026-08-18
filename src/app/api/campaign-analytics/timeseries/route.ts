import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// GET /api/campaign-analytics/timeseries?tenantId=...&days=7
// Returns daily sent/response counts for the last N days from CampaignMessage table.
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

    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7', 10), 1), 30);

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    // Build daily breakdown using raw query for SQLite date truncation
    const dailyRaw: { day: string; sent: bigint; responded: bigint }[] =
      await db.$queryRawUnsafe(`
        SELECT
          strftime('%Y-%m-%d', sentAt) as day,
          COUNT(*) as sent,
          SUM(CASE WHEN status = 'RESPONDED' THEN 1 ELSE 0 END) as responded
        FROM CampaignMessage
        WHERE tenantId = ? AND sentAt >= ?
        GROUP BY strftime('%Y-%m-%d', sentAt)
        ORDER BY day ASC
      `, tenantId, since.toISOString());

    // Fill in missing days with zeros
    const result: { date: string; sent: number; responded: number }[] = [];
    const dayMap = new Map(dailyRaw.map(r => [r.day, r]));

    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const row = dayMap.get(key);
      result.push({
        date: d.toLocaleDateString('en-US', { weekday: 'short' }),
        sent: Number(row?.sent ?? 0),
        responded: Number(row?.responded ?? 0),
      });
    }

    return NextResponse.json({ timeseries: result });
  } catch (err) {
    console.error('[campaign-analytics/timeseries] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
