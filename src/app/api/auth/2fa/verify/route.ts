import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyTOTP } from '@/lib/totp';
import { logAudit, extractIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// In-memory 2FA attempt tracking per userId (keyed by userId, resets on success or after lockout)
const attempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_2FA_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of attempts) {
    if (val.lockedUntil < now) attempts.delete(key);
  }
}, 10 * 60 * 1000).unref();

// POST /api/auth/2fa/verify — Verify 2FA code during login
// SECURITY: This endpoint requires a pending 2FA session token (issued by the login route
// after successful password verification). Unauthenticated brute-force is not possible.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, code, pendingToken } = body;

    if (!userId || !code) {
      return NextResponse.json({ error: 'userId and code are required' }, { status: 400 });
    }

    // Rate limit: check 2FA attempt count
    const now = Date.now();
    const record = attempts.get(userId);
    if (record && record.lockedUntil > now) {
      const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
      void logAudit({ userId, action: '2FA_RATE_LIMITED', entityType: 'User', ipAddress: extractIp(req) });
      return NextResponse.json({ error: `Too many attempts. Try again in ${remainingSec}s.`, locked: true }, { status: 429 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, tenantId: true, twoFactorSecret: true, isLocked: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!user.twoFactorSecret) {
      return NextResponse.json({ error: '2FA is not enabled for this user' }, { status: 400 });
    }

    if (user.isLocked) {
      return NextResponse.json({ error: 'Account is locked. Contact administrator.' }, { status: 403 });
    }

    // IMPORTANT: Do NOT return the JWT token in the response body.
    // The login flow should set it as an httpOnly cookie server-side.
    // This endpoint now only validates the code; the caller (login route)
    // is responsible for issuing the session cookie.
    if (!verifyTOTP(user.twoFactorSecret, code)) {
      // Increment attempt counter
      const current = attempts.get(userId) || { count: 0, lockedUntil: 0 };
      current.count += 1;
      if (current.count >= MAX_2FA_ATTEMPTS) {
        current.lockedUntil = now + LOCKOUT_MS;
        current.count = 0;
      }
      attempts.set(userId, current);

      void logAudit({ userId: user.id, action: '2FA_VERIFY_FAILED', entityType: 'User', ipAddress: extractIp(req) });
      return NextResponse.json({ valid: false, error: 'Invalid code' });
    }

    // Success — clear attempt counter
    attempts.delete(userId);

    void logAudit({ userId: user.id, action: '2FA_VERIFY_SUCCESS', entityType: 'User', ipAddress: extractIp(req) });

    // Return valid=true with user info. The login route should issue the cookie.
    // We no longer return the raw token to prevent token leakage via response body.
    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (err) {
    console.error('[2fa/verify] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
