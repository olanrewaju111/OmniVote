import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logAudit, extractIp } from '@/lib/audit';

// POST /api/auth/invite — invite a new user (SUPER_ADMIN or TENANT_ADMIN)
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Only SUPER_ADMIN or TENANT_ADMIN can invite users' }, { status: 403 });
    }

    const { email, name, role, tenantId } = await req.json();

    if (!email || !name || !role) {
      return NextResponse.json({ error: 'email, name, and role are required' }, { status: 400 });
    }

    const validRoles = ['FIELD_AGENT', 'ANALYST', 'TRUST_SAFETY', 'TENANT_ADMIN'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, { status: 400 });
    }

    const targetTenantId = tenantId || authUser.tenantId;

    // Check for duplicate email
    const existing = await db.user.findFirst({ where: { email, tenantId: targetTenantId } });
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists in this tenant' }, { status: 409 });
    }

    // Generate 32-char random invite token
    const inviteToken = randomBytes(16).toString('hex');

    // Create user in pending state
    const user = await db.user.create({
      data: {
        email,
        name,
        role,
        tenantId: targetTenantId,
        passwordHash: 'INVITE_PENDING',
        isLocked: true,
      },
    });

    // Store invite token in AuditLog
    void logAudit({
      userId: authUser.userId,
      action: 'USER_INVITE',
      entityType: 'User',
      entityId: user.id,
      metadata: { inviteToken, email, invitedRole: role },
      ipAddress: extractIp(req),
    });

    // In a real app, would send an email with the invite link containing the token
    return NextResponse.json({ success: true, message: 'Invitation sent' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create invitation';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
