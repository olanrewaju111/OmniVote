import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

// GET /api/elections — list elections for tenant (or all for SUPER_ADMIN)
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

    const where: Record<string, unknown> = authUser.role === 'SUPER_ADMIN' ? {} : { tenantId };
    const { searchParams } = new URL(req.url || "", "http://localhost");
    const status = searchParams.get('status');
    const tier = searchParams.get('tier');
    if (status) where.status = status;
    if (tier) where.tier = tier;

    const elections = await db.election.findMany({
      where,
      include: {
        _count: { select: { pollingUnits: true } },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({
      elections: elections.map(e => ({
        id: e.id,
        tenantId: e.tenantId,
        title: e.title,
        tier: e.tier,
        status: e.status,
        date: e.date,
        pollingUnitCount: e._count.pollingUnits,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch elections' }, { status: 500 });
  }
}

// POST /api/elections — create a new election (SUPER_ADMIN, TENANT_ADMIN)
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

    if (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Only admins can create elections' }, { status: 403 });
    }

    const body = await req.json();
    const { title, tier, status, date } = body;

    if (!title || !date) {
      return NextResponse.json({ error: 'title and date are required' }, { status: 400 });
    }

    const validTiers = ['LOCAL', 'STATE', 'PRESIDENTIAL'];
    const validStatuses = ['UPCOMING', 'ACTIVE', 'COMPLETED'];
    if (tier && !validTiers.includes(tier)) {
      return NextResponse.json({ error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` }, { status: 400 });
    }
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const election = await db.election.create({
      data: {
        tenantId,
        title,
        tier: tier || 'LOCAL',
        status: status || 'UPCOMING',
        date: new Date(date),
      },
    });

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          userId: authUser.userId,
          action: 'ELECTION_CREATED',
          entityType: 'Election',
          entityId: election.id,
          metadata: JSON.stringify({ title, tier: tier || 'LOCAL', status: status || 'UPCOMING' }),
        },
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ success: true, election }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create election';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}