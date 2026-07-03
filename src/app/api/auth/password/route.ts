import { getAuthUser, verifyPassword, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(req: NextRequest) {
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

  // 9. Return success
  return NextResponse.json({ success: true, message: 'Password updated' });
}