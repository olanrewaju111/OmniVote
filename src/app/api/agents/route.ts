import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';
import { logAudit, extractIp } from '@/lib/audit';

// GET /api/agents — list all users with details
export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || 'ALL';

    const where: Record<string, unknown> = { tenantId };
    if (role !== 'ALL') where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const users = await db.user.findMany({
      where,
      select: {
        id: true, email: true, name: true, role: true,
        isOnline: true, lastSeenAt: true, createdAt: true,
        _count: { select: { incidents: true, auditLogs: true } },
      },
      orderBy: { role: 'asc' },
    });

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

// POST /api/agents — add a new agent
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, role } = body;

    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Name, email, and role are required' }, { status: 400 });
    }

    const validRoles = ['FIELD_AGENT', 'ANALYST', 'TRUST_SAFETY', 'TENANT_ADMIN'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Resolve tenant from request
    const { id: tenantId, error: tenantError } = await resolveTenant(req);
    if (tenantError) return tenantError;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    // Check for duplicate email
    const existing = await db.user.findFirst({
      where: { email, tenantId },
    });
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }

    const user = await db.user.create({
      data: {
        name,
        email,
        role,
        tenantId,
        isOnline: false,
      },
      select: { id: true, email: true, name: true, role: true, isOnline: true },
    });

    // Audit log
    void logAudit({
      userId: authUser.userId,
      action: 'CREATE_USER',
      entityType: 'User',
      entityId: user.id,
      metadata: { name, email, role },
      ipAddress: extractIp(req),
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create agent';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/agents — toggle agent status, remote wipe, etc.
export async function PATCH(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const body = await req.json();
    const { userId, action } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId and action are required' }, { status: 400 });
    }

    // Find user scoped to tenant
    const user = await db.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let updated;

    switch (action) {
      case 'TOGGLE_ONLINE':
        updated = await db.user.update({
          where: { id: userId },
          data: { isOnline: !user.isOnline, lastSeenAt: !user.isOnline ? new Date() : null },
          select: { id: true, email: true, name: true, role: true, isOnline: true },
        });
        void logAudit({ userId: authUser.userId, action: 'TOGGLE_USER_ONLINE', entityType: 'User', entityId: userId, metadata: { isOnline: !user.isOnline }, ipAddress: extractIp(req) });
        break;

      case 'SET_OFFLINE':
        updated = await db.user.update({
          where: { id: userId },
          data: { isOnline: false, lastSeenAt: null },
          select: { id: true, email: true, name: true, role: true, isOnline: true },
        });
        void logAudit({ userId: authUser.userId, action: 'SET_USER_OFFLINE', entityType: 'User', entityId: userId, ipAddress: extractIp(req) });
        break;

      case 'REMOTE_WIPE':
        // Remote wipe: marks device offline and logs the action. Actual MDM wipe requires a mobile device management integration (e.g. Firebase, Microsoft Intune).
        updated = await db.user.update({
          where: { id: userId },
          data: { isOnline: false, lastSeenAt: null },
          select: { id: true, email: true, name: true, role: true, isOnline: true },
        });
        void logAudit({ userId: authUser.userId, action: 'REMOTE_WIPE', entityType: 'User', entityId: userId, metadata: { targetName: user.name, targetEmail: user.email }, ipAddress: extractIp(req) });
        break;

      case 'CHANGE_ROLE':
        if (!body.newRole) return NextResponse.json({ error: 'newRole is required' }, { status: 400 });
        const validRoles = ['FIELD_AGENT', 'ANALYST', 'TRUST_SAFETY', 'TENANT_ADMIN'];
        if (!validRoles.includes(body.newRole)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        updated = await db.user.update({
          where: { id: userId },
          data: { role: body.newRole },
          select: { id: true, email: true, name: true, role: true, isOnline: true },
        });
        void logAudit({ userId: authUser.userId, action: 'CHANGE_USER_ROLE', entityType: 'User', entityId: userId, metadata: { from: user.role, to: body.newRole }, ipAddress: extractIp(req) });
        break;

      case 'DELETE': {
        // Prevent self-deletion
        if (userId === authUser.userId) {
          return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
        }
        // Prevent deleting SUPER_ADMIN accounts (only another SUPER_ADMIN can, via tenant mgmt)
        if (user.role === 'SUPER_ADMIN' && authUser.role !== 'SUPER_ADMIN') {
          return NextResponse.json({ error: 'Cannot delete a SUPER_ADMIN' }, { status: 403 });
        }
        // Check for related incidents - can't delete users with reports
        const incidentCount = await db.incident.count({ where: { reportedById: userId } });
        if (incidentCount > 0) {
          return NextResponse.json({
            error: `Cannot delete: this user has ${incidentCount} incident report(s). Deactivate instead.`,
          }, { status: 409 });
        }
        // Delete audit logs first (FK constraint), then the user
        await db.auditLog.deleteMany({ where: { userId } });
        await db.user.delete({ where: { id: userId } });
        void logAudit({ userId: authUser.userId, action: 'DELETE_USER', entityType: 'User', entityId: userId, metadata: { name: user.name }, ipAddress: extractIp(req) });
        return NextResponse.json({ success: true, message: `Agent "${user.name}" has been removed` });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ user: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Action failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}