import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyTOTP, generateTOTP } from '@/lib/totp';
import { createToken } from '@/lib/auth';
import { logAudit, extractIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// POST /api/auth/2fa/verify — Verify 2FA code during login
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, code } = body;

    if (!userId || !code) {
      return NextResponse.json({ error: 'userId and code are required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, tenantId: true, twoFactorSecret: true, isLocked: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.twoFactorSecret) {
      return NextResponse.json({ error: '2FA is not enabled for this user' }, { status: 400 });
    }

    if (user.isLocked) {
      return NextResponse.json({ error: 'Account is locked. Contact administrator.' }, { status: 403 });
    }

    if (!verifyTOTP(user.twoFactorSecret, code)) {
      void logAudit({ userId: user.id, action: '2FA_VERIFY_FAILED', entityType: 'User', ipAddress: extractIp(req) });
      return NextResponse.json({ valid: false, error: 'Invalid code' });
    }

    // Generate session token
    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });

    void logAudit({ userId: user.id, action: '2FA_VERIFY_SUCCESS', entityType: 'User', ipAddress: extractIp(req) });

    return NextResponse.json({ valid: true, token });
  } catch (err) {
    console.error('[2fa/verify] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
