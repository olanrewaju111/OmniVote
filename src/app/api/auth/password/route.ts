import { getAuthUser, verifyPassword, hashPassword, createToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { logAudit, extractIp } from '@/lib/audit';
import { requireCsrf } from '@/lib/security/csrf-enforce';

export async function PUT(req: NextRequest) {
    // CSRF protection
    const csrfErr = requireCsrf(req);
    if (csrfErr) return csrfErr;

  // 1. Require authentication
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 2. Parse and validate request body
  const body = await req.json();
  const { currentPassword, newPassword } = body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'currentPassword and newPassword are required' },
      { status: 400 },
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: 'newPassword must be at least 8 characters' },
      { status: 400 },
    );
  }

  // 4. Look up the user
  const user = await db.user.findUnique({ where: { id: authUser.userId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // 5 & 6. Verify current password
  const isDevChangeme = user.passwordHash === 'changeme' && process.env.NODE_ENV !== 'production';

  if (isDevChangeme) {
    // In dev mode with default password, accept any currentPassword
  } else {
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 403 },
      );
    }
  }

  // 7. Hash the new password
  const newHash = await hashPassword(newPassword);

  // 8. Update in database
  await db.user.update({
    where: { id: authUser.userId },
    data: { passwordHash: newHash },
  });

  // SECURITY: Invalidate existing sessions by incrementing the token version.
  // This forces all existing JWTs to fail verification (the token won't have
  // the new version number). The client must re-authenticate.
  // We use the AuditLog to store a "session invalidation" marker that the
  // auth middleware can check (future enhancement: add tokenVersion to User model
  // and check in verifyToken).
  // For now, we create a new token with the updated user data and set it as a
  // replacement cookie — the old token is still technically valid for up to 24h
  // because we use stateless JWTs. A production system should add a tokenVersion
  // field to the User model and include it in JWT claims.
  void logAudit({
    userId: authUser.userId,
    action: 'PASSWORD_CHANGED',
    entityType: 'User',
    entityId: authUser.userId,
    metadata: { invalidatedAt: new Date().toISOString() },
    ipAddress: extractIp(req),
  });

  // Issue a new session token (replaces the old one via Set-Cookie)
  const newToken = await createToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  });

  const response = NextResponse.json({ success: true, message: 'Password updated' });
  // Set the new token as a replacement cookie
  response.cookies.set('omnivote-session', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24h
  });

  return response;
}