import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

// POST /api/auth/reset-password — reset password using token
export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();
    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Find the reset token in audit logs
    const resetLog = await db.auditLog.findFirst({
      where: {
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'User',
        metadata: { contains: token },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetLog) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }

    const meta = JSON.parse(resetLog.metadata) as { resetToken: string; expiresAt: string; email: string };
    if (meta.resetToken !== token) {
      return NextResponse.json({ error: 'Invalid reset token' }, { status: 400 });
    }
    if (new Date(meta.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Reset token has expired' }, { status: 400 });
    }

    // Update password
    const passwordHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: resetLog.userId },
      data: { passwordHash },
    });

    // Invalidate all existing sessions by creating a log entry
    await db.auditLog.create({
      data: {
        userId: resetLog.userId,
        action: 'PASSWORD_RESET_COMPLETED',
        entityType: 'User',
        entityId: resetLog.userId,
        metadata: JSON.stringify({ email: meta.email }),
      },
    });

    return NextResponse.json({ success: true, message: 'Password has been reset. Please log in with your new password.' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Reset failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}