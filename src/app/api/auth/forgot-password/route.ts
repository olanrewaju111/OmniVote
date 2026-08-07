import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { sendEmail, passwordResetHtml, buildResetLink } from '@/lib/email';

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

    // Resolve tenant slug for branded reset link
    const tenant = user.tenantId
      ? await db.tenant.findUnique({ where: { id: user.tenantId }, select: { slug: true } })
      : null;

    // Generate reset token (expires in 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    // Store reset token in audit log
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

    // Send reset email (fire-and-forget — don't block response)
    const resetLink = buildResetLink(resetToken, tenant?.slug || undefined);
    const firstName = user.name?.split(' ')[0] || 'User';
    const html = passwordResetHtml(firstName, resetLink);

    sendEmail({
      to: user.email,
      subject: 'OmniVote — Password Reset Request',
      html,
    }).catch(() => {/* already logged inside sendEmail */});

    return NextResponse.json({
      success: true,
      message: 'If an account exists, a reset link has been sent.',
    });
  } catch {
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}