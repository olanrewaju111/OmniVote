import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { logAudit, extractIp } from '@/lib/audit';
import { safeParse } from '@/lib/safe-parse';

// POST /api/auth/register — complete registration with an invite token
export async function POST(req: NextRequest) {
  try {
    const { inviteToken, name, password } = await req.json();

    if (!inviteToken || !name || !password) {
      return NextResponse.json({ error: 'inviteToken, name, and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Look up the invite token in AuditLog (action='USER_INVITE', metadata contains the token)
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);

    const inviteLogs = await db.auditLog.findMany({
      where: {
        action: 'USER_INVITE',
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Find the matching invite log
    let matchedLog: typeof inviteLogs[0] | null = null;
    for (const log of inviteLogs) {
      const meta = safeParse<Record<string, string>>(log.metadata);
      if (meta && meta.inviteToken === inviteToken) {
        matchedLog = log;
        break;
      }
    }

    if (!matchedLog) {
      return NextResponse.json({ error: 'Invalid or expired invite token' }, { status: 400 });
    }

    // Get the user that was created for this invite
    const userId = matchedLog.entityId;
    if (!userId) {
      return NextResponse.json({ error: 'Invalid invite: no user associated' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found for this invite' }, { status: 400 });
    }

    if (user.passwordHash !== 'INVITE_PENDING') {
      return NextResponse.json({ error: 'This invitation has already been used' }, { status: 400 });
    }

    // Hash the password and update the user
    const hashedPassword = await hashPassword(password);
    await db.user.update({
      where: { id: userId },
      data: {
        name,
        passwordHash: hashedPassword,
        isLocked: false,
      },
    });

    void logAudit({
      userId,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: userId,
      metadata: { email: user.email },
      ipAddress: extractIp(req),
    });

    return NextResponse.json({ success: true, message: 'Registration complete' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to complete registration';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
