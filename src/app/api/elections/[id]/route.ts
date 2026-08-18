import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';
import { logAudit, extractIp } from '@/lib/audit';

// PATCH /api/elections/[id] — update election (SUPER_ADMIN, TENANT_ADMIN)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    if (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Only admins can update elections' }, { status: 403 });
    }

    const existing = await db.election.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Election not found' }, { status: 404 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.tier !== undefined) {
      const validTiers = ['LOCAL', 'STATE', 'PRESIDENTIAL'];
      if (!validTiers.includes(body.tier)) {
        return NextResponse.json({ error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` }, { status: 400 });
      }
      updates.tier = body.tier;
    }
    if (body.status !== undefined) {
      const validStatuses = ['UPCOMING', 'ACTIVE', 'COMPLETED'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
      }
      updates.status = body.status;
    }
    if (body.date !== undefined) updates.date = new Date(body.date);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await db.election.update({
      where: { id },
      data: updates,
      include: { _count: { select: { pollingUnits: true } } },
    });

    // Audit log
    void logAudit({
      userId: authUser.userId,
      action: 'UPDATE_ELECTION',
      entityType: 'Election',
      entityId: id,
      metadata: { changedFields: Object.keys(updates) },
      ipAddress: extractIp(req),
    });

    return NextResponse.json({ success: true, election: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update election';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/elections/[id] — delete election (SUPER_ADMIN only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (authUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only SUPER_ADMIN can delete elections' }, { status: 403 });
    }

    const existing = await db.election.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Election not found' }, { status: 404 });
    }

    // Check for dependent polling units
    const puCount = await db.pollingUnit.count({ where: { electionId: id } });
    if (puCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete election with ${puCount} polling units. Delete or reassign them first.` },
        { status: 409 }
      );
    }

    await db.election.delete({ where: { id } });

    // Audit log
    void logAudit({
      userId: authUser.userId,
      action: 'DELETE_ELECTION',
      entityType: 'Election',
      entityId: id,
      metadata: { title: existing.title },
      ipAddress: extractIp(req),
    });

    return NextResponse.json({ success: true, message: 'Election deleted' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete election';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}