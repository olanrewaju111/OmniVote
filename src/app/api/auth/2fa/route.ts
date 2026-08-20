import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { generateSecret, generateTOTP, verifyTOTP, generateOTPAuthURI } from '@/lib/totp';
import { logAudit, extractIp } from '@/lib/audit';
import { requireCsrf } from '@/lib/security/csrf-enforce';

// Temporary pending 2FA secrets (userId → { secret, uri, expires })
const pendingSecrets = new Map<string, { secret: string; uri: string; expires: number }>();
const PENDING_TTL = 5 * 60 * 1000; // 5 minutes

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingSecrets) {
    if (val.expires < now) pendingSecrets.delete(key);
  }
}, 60_000);

export const dynamic = 'force-dynamic';

// GET /api/auth/2fa — Check 2FA status
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: authUser.userId }, select: { twoFactorSecret: true } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({ enabled: !!user.twoFactorSecret && user.twoFactorSecret !== '' });
  } catch (err) {
    console.error('[2fa] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/auth/2fa — Step 1: Generate new TOTP secret (doesn't save yet)
export async function POST(req: NextRequest) {
    // CSRF protection
    const csrfErr = requireCsrf(req);
    if (csrfErr) return csrfErr;

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: authUser.userId }, select: { email: true } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const secret = generateSecret();
    const uri = generateOTPAuthURI(user.email, secret);

    // Store temporarily — user must verify before we persist
    pendingSecrets.set(authUser.userId, { secret, uri, expires: Date.now() + PENDING_TTL });

    void logAudit({ userId: authUser.userId, action: '2FA_ENROLLMENT_STARTED', entityType: 'User', ipAddress: extractIp(req) });

    return NextResponse.json({ secret, uri });
  } catch (err) {
    console.error('[2fa] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/auth/2fa — Step 2: Verify code and enable 2FA
export async function PATCH(req: NextRequest) {
    // CSRF protection
    const csrfErr = requireCsrf(req);
    if (csrfErr) return csrfErr;

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json();
    const { code, secret } = body;
    if (!code || !secret) {
      return NextResponse.json({ error: 'Code and secret are required' }, { status: 400 });
    }

    // Verify the pending secret matches (or allow direct verification)
    const pending = pendingSecrets.get(authUser.userId);
    if (pending && pending.secret !== secret) {
      return NextResponse.json({ error: 'Secret mismatch. Please start enrollment again.' }, { status: 400 });
    }

    if (!verifyTOTP(secret, code)) {
      return NextResponse.json({ error: 'Invalid verification code. Please try again.' }, { status: 400 });
    }

    // Save the secret to the user record
    await db.user.update({
      where: { id: authUser.userId },
      data: { twoFactorSecret: secret },
    });

    // Clean up pending secret
    pendingSecrets.delete(authUser.userId);

    void logAudit({ userId: authUser.userId, action: '2FA_ENABLED', entityType: 'User', ipAddress: extractIp(req) });

    return NextResponse.json({ enabled: true });
  } catch (err) {
    console.error('[2fa] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/auth/2fa — Disable 2FA (requires current code)
export async function DELETE(req: NextRequest) {
    // CSRF protection
    const csrfErr = requireCsrf(req);
    if (csrfErr) return csrfErr;

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const user = await db.user.findUnique({
      where: { id: authUser.userId },
      select: { twoFactorSecret: true },
    });
    if (!user || !user.twoFactorSecret) {
      return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 });
    }

    const body = await req.json();
    const { code } = body;
    if (!code) {
      return NextResponse.json({ error: 'Current 2FA code is required to disable' }, { status: 400 });
    }

    if (!verifyTOTP(user.twoFactorSecret, code)) {
      return NextResponse.json({ error: 'Invalid code. 2FA was not disabled.' }, { status: 400 });
    }

    await db.user.update({
      where: { id: authUser.userId },
      data: { twoFactorSecret: '' },
    });

    void logAudit({ userId: authUser.userId, action: '2FA_DISABLED', entityType: 'User', ipAddress: extractIp(req) });

    return NextResponse.json({ enabled: false });
  } catch (err) {
    console.error('[2fa] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
