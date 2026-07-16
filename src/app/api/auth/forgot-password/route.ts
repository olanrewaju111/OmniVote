import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

// POST /api/auth/forgot-password — request a password reset
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: { email },
      select: { id: true, email: true, name: true, tenantId: true },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    // Generate reset token (expires in 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    // Store reset token (in a real app, this would be Redis or a separate table)
    // For now, we store it in the user's metadata via audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'User',
        entityId: user.id,
        metadata: JSON.stringify({ resetToken, expiresAt: resetExpires.toISOString(), email: user.email }),
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
      },
    });

    // In production, send email via SMTP/SendGrid/etc.
    // For now, log the reset token for demo purposes
    console.log(`[PASSWORD RESET] Email: ${user.email}, Token: ${resetToken}, Expires: ${resetExpires.toISOString()}`);

    return NextResponse.json({
      success: true,
      message: 'If an account exists, a reset link has been sent.',
    });
  } catch {
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}