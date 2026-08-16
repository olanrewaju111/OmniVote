import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const VALID_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY', 'FIELD_AGENT'];

// GET /api/tenants/users?tenantId=X — list users in a tenant
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });

    const users = await db.user.findMany({
      where: { tenantId },
      select: {
        id: true, email: true, name: true, role: true,
        phone: true, isOnline: true, lastSeenAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST /api/tenants/users — create a new user in a tenant
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { tenantId, name, email, role, phone } = body;

    if (!tenantId || !name || !email || !role) {
      return NextResponse.json({ error: 'tenantId, name, email, and role are required' }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
    }

    // Verify tenant exists
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Check email uniqueness across all tenants
    const existingUser = await db.user.findFirst({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: `A user with email "${email}" already exists` }, { status: 409 });
    }

    const user = await db.user.create({
      data: { tenantId, name, email, role, phone: phone || null },
      select: { id: true, email: true, name: true, role: true, phone: true, createdAt: true },
    });

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create user';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/tenants/users — update a user's role or name
export async function PATCH(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { id, role, name, phone } = body;

    if (!id) return NextResponse.json({ error: 'User id is required' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
      }
      updateData.role = role;
    }
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, phone: true },
    });

    return NextResponse.json({ success: true, user });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update user';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/tenants/users?id=X — remove a user from a tenant
export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser || authUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'User id is required' }, { status: 400 });

    // Prevent deleting the last SUPER_ADMIN in a tenant
    const user = await db.user.findUnique({ where: { id }, select: { role: true, tenantId: true } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (user.role === 'SUPER_ADMIN') {
      const adminCount = await db.user.count({ where: { tenantId: user.tenantId, role: 'SUPER_ADMIN' } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last SUPER_ADMIN in a tenant. Transfer admin role first.' },
          { status: 400 },
        );
      }
    }

    await db.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete user';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}