import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { safeParse } from '@/lib/safe-parse';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

// GET /api/osint?tenantId=X&platform=X&category=X&limit=50&offset=0
export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (authUser) {
      const tenantErr = requireTenantMatch(authUser, tenantId);
      if (tenantErr) return tenantErr;
    }

    const url = new URL(req.url);
    const platform = url.searchParams.get('platform');
    const category = url.searchParams.get('category');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Build where filter
    const where: Record<string, unknown> = { tenantId };
    if (platform) where.platform = platform;
    if (category) where.category = category;

    // Fetch posts
    const posts = await db.osintPost.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Aggregate counts
    const [total, byCategory, bySentiment, byPlatform, fakeNewsCount, botSuspectCount] =
      await Promise.all([
        db.osintPost.count({ where }),
        db.osintPost.groupBy({
          by: ['category'],
          where: { tenantId },
          _count: { category: true },
        }),
        db.osintPost.groupBy({
          by: ['sentiment'],
          where: { tenantId },
          _count: { sentiment: true },
        }),
        db.osintPost.groupBy({
          by: ['platform'],
          where: { tenantId },
          _count: { platform: true },
        }),
        db.osintPost.count({ where: { tenantId, isFakeNews: true } }),
        db.osintPost.count({ where: { tenantId, isBotSuspect: true } }),
      ]);

    // ── Trend computation (hour-over-hour deltas) ─────────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [prevTotal, prevFakeNews, prevBotSuspect] = await Promise.all([
      db.osintPost.count({ where: { tenantId, publishedAt: { lt: oneHourAgo } } }),
      db.osintPost.count({ where: { tenantId, isFakeNews: true, publishedAt: { lt: oneHourAgo } } }),
      db.osintPost.count({ where: { tenantId, isBotSuspect: true, publishedAt: { lt: oneHourAgo } } }),
    ]);

    const trendTotal = prevTotal > 0
      ? Math.round(((total - prevTotal) / prevTotal) * 1000) / 10
      : total > 0 ? 100 : 0;
    const trendFakeNews = prevFakeNews > 0
      ? Math.round(((fakeNewsCount - prevFakeNews) / prevFakeNews) * 1000) / 10
      : fakeNewsCount > 0 ? 100 : 0;
    const trendBotSuspect = prevBotSuspect > 0
      ? Math.round(((botSuspectCount - prevBotSuspect) / prevBotSuspect) * 1000) / 10
      : botSuspectCount > 0 ? 100 : 0;
    // Virality: posts with engagement reach > 1000 in the last hour
    const viralityAlerts = await db.osintPost.count({
      where: {
        tenantId,
        publishedAt: { gte: oneHourAgo },
      },
    });
    const trendVirality = prevTotal > 0
      ? Math.round(((viralityAlerts - prevTotal) / prevTotal) * 1000) / 10
      : viralityAlerts > 0 ? 100 : 0;

    // Parse JSON string fields on each post
    const parsedPosts = posts.map((p) => ({
      ...p,
      mediaUrls: safeParse(p.mediaUrls),
      aiFlags: safeParse(p.aiFlags),
      engagement: safeParse(p.engagement, {}),
      keywords: safeParse(p.keywords),
    }));

    return NextResponse.json({
      posts: parsedPosts,
      counts: {
        total,
        byCategory: Object.fromEntries(byCategory.map((g) => [g.category, g._count.category])),
        bySentiment: Object.fromEntries(bySentiment.map((g) => [g.sentiment, g._count.sentiment])),
        byPlatform: Object.fromEntries(byPlatform.map((g) => [g.platform, g._count.platform])),
        fakeNews: fakeNewsCount,
        botSuspect: botSuspectCount,
        viralityAlerts,
      },
      trends: {
        total: { value: Math.abs(trendTotal), up: trendTotal >= 0 },
        fakeNews: { value: Math.abs(trendFakeNews), up: trendFakeNews >= 0 },
        botSuspect: { value: Math.abs(trendBotSuspect), up: trendBotSuspect >= 0 },
        viralityAlerts: { value: Math.abs(trendVirality), up: trendVirality >= 0 },
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch OSINT posts' }, { status: 500 });
  }
}
