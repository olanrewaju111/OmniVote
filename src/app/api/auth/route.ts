import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  verifyPassword,
  createToken,
  createSessionCookie,
  deleteSessionCookie,
  getAuthUser,
} from '@/lib/auth';

// ─── SQLite-backed login rate limiter ───────────────────────────────────
// Uses the database for persistence across server restarts.
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window

async function isRateLimited(email: string): Promise<{ limited: boolean; retryAfterMs?: number }> {
  try {
    const record = await db.rateLimitRecord.findUnique({ where: { email: email.toLowerCase() } });
    if (!record) return { limited: false };

    const now = Date.now();
    if (record.lockedUntil && record.lockedUntil.getTime() > now) {
      return { limited: true, retryAfterMs: record.lockedUntil.getTime() - now };
    }
    if (now - record.firstAttempt.getTime() > ATTEMPT_WINDOW_MS) {
      await db.rateLimitRecord.deleteMany({ where: { email: email.toLowerCase() } });
      return { limited: false };
    }
    return { limited: false };
  } catch {
    // If DB is unreachable, allow the request (fail open)
    return { limited: false };
  }
}

async function recordFailedAttempt(email: string): Promise<void> {
  try {
    const key = email.toLowerCase();
    const now = new Date();
    const existing = await db.rateLimitRecord.findUnique({ where: { email: key } });

    if (!existing) {
      await db.rateLimitRecord.create({
        data: { email: key, attemptCount: 1, firstAttempt: now, lockedUntil: null },
      });
    } else {
      const newCount = existing.attemptCount + 1;
      const lockedUntil = newCount >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;
      await db.rateLimitRecord.update({
        where: { email: key },
        data: { attemptCount: newCount, lockedUntil },
      });
    }
  } catch {
    // Non-fatal: rate limiting should never block login
  }
}

async function clearAttempts(email: string): Promise<void> {
  try {
    await db.rateLimitRecord.deleteMany({ where: { email: email.toLowerCase() } });
  } catch {
    // Non-fatal
  }
}

// ─── POST /api/auth — Login ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { email, password, tenantSlug } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Rate limiting check
    const rateCheck = await isRateLimited(email);
    if (rateCheck.limited) {
      const retryAfterSecs = Math.ceil((rateCheck.retryAfterMs || 0) / 1000);
      return NextResponse.json(
        { error: `Too many failed login attempts. Try again in ${retryAfterSecs} seconds.` },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSecs) },
        },
      );
    }

    // Find user — if tenantSlug provided, scope to that tenant for security
    const whereClause = tenantSlug
      ? { email, tenant: { slug: tenantSlug, isActive: true } }
      : { email };
    const user = await db.user.findFirst({
      where: whereClause,
      select: {
        id: true, email: true, name: true, role: true,
        tenantId: true, passwordHash: true, isLocked: true,
      },
    });

    if (!user) {
      await recordFailedAttempt(email);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.isLocked) {
      return NextResponse.json({ error: 'Account is locked. Contact your administrator.' }, { status: 403 });
    }

    // Verify password — for dev seed users with default "changeme" hash,
    // accept password "password" or "changeme" in dev mode
    const isDevMode = process.env.NODE_ENV !== 'production';
    let passwordValid = false;
    if (user.passwordHash === 'changeme') {
      passwordValid = isDevMode
        ? (password === 'password' || password === 'changeme')
        : await verifyPassword(password, user.passwordHash);
    } else {
      passwordValid = await verifyPassword(password, user.passwordHash);
    }

    if (!passwordValid) {
      await recordFailedAttempt(email);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Successful login — clear rate limit counter
    await clearAttempts(email);

    const tenant = await db.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Update last seen and set online status
    await db.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date(), isOnline: true },
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
export async function DELETE(req: NextRequest) {
  try {
    // Set user offline on logout if we can identify them
    const authUser = await getAuthUser(req);
    if (authUser) {
      await db.user.update({
        where: { id: authUser.userId },
        data: { isOnline: false },
      }).catch(() => { /* non-critical */ });
    }
  } catch {
    // Continue with cookie clear even if DB update fails
  }

  const cookie = deleteSessionCookie();
  const response = NextResponse.json({ success: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}