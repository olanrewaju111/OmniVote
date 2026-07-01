import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const tenant = await db.tenant.findFirst({ where: { slug: 'new' } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const user = await db.user.findFirst({
      where: { email, tenantId: tenant.id },
      select: { id: true, email: true, name: true, role: true, isOnline: true },
    });

    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    // Get counts for the user's role context
    const agents = await db.user.count({ where: { tenantId: tenant.id, role: 'FIELD_AGENT' } });
    const onlineAgents = await db.user.count({ where: { tenantId: tenant.id, role: 'FIELD_AGENT', isOnline: true } });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantName: tenant.name,
      },
      meta: { totalAgents: agents, onlineAgents },
    });
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}

// Return all users for the login screen (demo only)
export async function GET() {
  try {
    const tenant = await db.tenant.findFirst({ where: { slug: 'new' } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const users = await db.user.findMany({
      where: { tenantId: tenant.id },
      select: { email: true, name: true, role: true, isOnline: true },
      orderBy: { role: 'asc' },
    });

    return NextResponse.json({
      tenant: { name: tenant.name, slug: tenant.slug },
      users,
    });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}