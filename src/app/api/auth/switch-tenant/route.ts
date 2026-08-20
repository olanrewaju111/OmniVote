/**
 * POST /api/auth/switch-tenant
 *
 * Allows a SUPER_ADMIN to switch their active tenant context.
 * Issues a new JWT with the new tenantId and returns fresh tenant data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, createToken, createSessionCookie } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/security/security-logger';
import { requireCsrf } from '@/lib/security/csrf-enforce';

export async function POST(req: NextRequest) {
    // CSRF protection
    const csrfErr = requireCsrf(req);
    if (csrfErr) return csrfErr;

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (authUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only SUPER_ADMIN can switch tenants' }, { status: 403 });
    }

    const { tenantId } = await req.json();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Verify the target tenant exists and is active
    const targetTenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, isActive: true },
    });

    if (!targetTenant || !targetTenant.isActive) {
      return NextResponse.json({ error: 'Tenant not found or inactive' }, { status: 404 });
    }

    // Issue a new JWT with the new tenant context
    const token = await createToken({
      userId: authUser.userId,
      email: authUser.email,
      role: authUser.role,
      tenantId: targetTenant.id,
    });

    const sessionCookie = createSessionCookie(token);

    // Fetch fresh data for the new tenant
    const [agents, onlineAgents] = await Promise.all([
      db.user.count({ where: { tenantId: targetTenant.id, role: 'FIELD_AGENT' } }),
      db.user.count({ where: { tenantId: targetTenant.id, role: 'FIELD_AGENT', isOnline: true } }),
    ]);

    const activeElection = await db.election.findFirst({
      where: { tenantId: targetTenant.id, status: { in: ['ACTIVE', 'UPCOMING'] } },
      select: { tier: true, title: true, status: true, date: true },
      orderBy: { date: 'desc' },
    });

    // Get all available tenants for the switcher UI
    const availableTenants = await db.tenant.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, primaryColor: true },
      orderBy: { name: 'asc' },
    });

    // Look up the user record for name/email
    const userRecord = await db.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, email: true, name: true },
    });

    logSecurityEvent({
      type: 'TENANT_SWITCH',
      severity: 'info',
      userId: authUser.userId,
      tenantId: targetTenant.id,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown',
      details: { fromTenantId: authUser.tenantId, toTenantId: targetTenant.id, toTenantSlug: targetTenant.slug },
    });

    const response = NextResponse.json({
      user: {
        id: authUser.userId,
        email: userRecord?.email || authUser.email,
        name: userRecord?.name || 'Super Admin',
        role: 'SUPER_ADMIN',
        tenantId: targetTenant.id,
        tenantName: targetTenant.name,
        tenantSlug: targetTenant.slug,
      },
      electionInfo: activeElection ? {
        tier: activeElection.tier,
        title: activeElection.title,
        status: activeElection.status,
        date: activeElection.date,
      } : null,
      meta: { totalAgents: agents, onlineAgents },
      availableTenants,
    });

    response.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.options);
    return response;
  } catch {
    return NextResponse.json({ error: 'Failed to switch tenant' }, { status: 500 });
  }
}
