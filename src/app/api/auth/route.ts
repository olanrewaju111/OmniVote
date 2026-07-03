import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  verifyPassword,
  createToken,
  createSessionCookie,
  deleteSessionCookie,
  getAuthUser,
} from '@/lib/auth';

// ─── POST /api/auth — Login ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Find user across ALL tenants
    const user = await db.user.findFirst({
      where: { email },
      select: {
        id: true, email: true, name: true, role: true,
        tenantId: true, passwordHash: true, isLocked: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.isLocked) {
      return NextResponse.json({ error: 'Account is locked. Contact your administrator.' }, { status: 403 });
    }

    // Verify password — for dev seed users with default "changeme" hash,
    // accept any non-empty password during development
    const isDevMode = process.env.NODE_ENV !== 'production';
    let passwordValid = false;
    if (user.passwordHash === 'changeme') {
      // Seed user: accept password "password" or "changeme" in dev, any in prod
      passwordValid = isDevMode
        ? (password === 'password' || password === 'changeme')
        : await verifyPassword(password, user.passwordHash);
    } else {
      passwordValid = await verifyPassword(password, user.passwordHash);
    }

    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Update last seen
    await db.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    // Get counts for the user's tenant context
    const [agents, onlineAgents] = await Promise.all([
      db.user.count({ where: { tenantId: tenant.id, role: 'FIELD_AGENT' } }),
      db.user.count({ where: { tenantId: tenant.id, role: 'FIELD_AGENT', isOnline: true } }),
    ]);

    // Get the tenant's active election type
    const activeElection = await db.election.findFirst({
      where: { tenantId: tenant.id, status: { in: ['ACTIVE', 'UPCOMING'] } },
      select: { tier: true, title: true, status: true, date: true },
      orderBy: { date: 'desc' },
    });

    // Create JWT token
    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: tenant.id,
    });

    // Set httpOnly session cookie
    const sessionCookie = createSessionCookie(token);

    const response = NextResponse.json({
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

    response.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.options);
    return response;
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}

// ─── GET /api/auth — Return tenants list (login screen) ────────────────────
// Only returns tenant names/slugs/colors — NOT user emails
export async function GET(req: NextRequest) {
  try {
    // Check if already authenticated — return current session
    const existingUser = await getAuthUser(req);
    if (existingUser) {
      const user = await db.user.findUnique({
        where: { id: existingUser.userId },
        select: { id: true, email: true, name: true, role: true, tenantId: true },
      });
      if (user) {
        const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } });
        if (tenant) {
          return NextResponse.json({
            authenticated: true,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              tenantId: tenant.id,
              tenantName: tenant.name,
              tenantSlug: tenant.slug,
            },
          });
        }
      }
    }

    // Not authenticated — return only tenant list (no user data)
    const tenants = await db.tenant.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, primaryColor: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ authenticated: false, tenants });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// ─── DELETE /api/auth — Logout ──────────────────────────────────────────────
export async function DELETE() {
  const cookie = deleteSessionCookie();
  const response = NextResponse.json({ success: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}