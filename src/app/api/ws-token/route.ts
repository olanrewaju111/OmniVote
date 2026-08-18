import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * POST /api/ws-token
 * 
 * Returns a short-lived JWT token that the client can use to authenticate
 * the WebSocket connection. The token contains userId, role, tenantId, name.
 * Valid for 30 seconds only — should be used immediately for WS handshake.
 */
export async function POST() {
  const payload = await getSession();
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
  if (!secret.length) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // Look up user name from DB
  const user = await db.user.findUnique({ where: { id: payload.userId }, select: { name: true } });
  const name = user?.name || 'Unknown';

  const token = await new SignJWT({
    userId: payload.userId,
    role: payload.role,
    tenantId: payload.tenantId,
    name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30s')
    .sign(secret);

  return NextResponse.json({
    token,
    wsUrl: process.env.WS_URL || `ws://localhost:3003`,
  });
}