import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    // Find user across ALL tenants (not just one)
    const user = await db.user.findFirst({
      where: { email },
      select: { id: true, email: true, name: true, role: true, isOnline: true, tenantId: true },
    });

    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Get counts for the user's tenant context
    const agents = await db.user.count({ where: { tenantId: tenant.id, role: 'FIELD_AGENT' } });
    const onlineAgents = await db.user.count({ where: { tenantId: tenant.id, role: 'FIELD_AGENT', isOnline: true } });

    // Get the tenant's active election type
    const activeElection = await db.election.findFirst({
      where: { tenantId: tenant.id, status: { in: ['ACTIVE', 'UPCOMING'] } },
      select: { tier: true, title: true, status: true, date: true },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
      },
      electionInfo: activeElection ? {
        tier: activeElection.tier,
        title: activeElection.title,
        status: activeElection.status,
        date: activeElection.date,
      } : null,
      meta: { totalAgents: agents, onlineAgents },
    });
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}

// Return ALL tenants and their users for the login screen
export async function GET() {
  try {
    const tenants = await db.tenant.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, primaryColor: true },
      orderBy: { name: 'asc' },
    });

    const allUsers = await db.user.findMany({
      select: { email: true, name: true, role: true, isOnline: true, tenantId: true },
      orderBy: { role: 'asc' },
    });

    return NextResponse.json({ tenants, users: allUsers });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}