import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

// PATCH /api/incidents/[id] — update incident status, severity, AI review, quarantine
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

    // Only ANALYST+, TRUST_SAFETY, and TENANT_ADMIN can update incidents
    const canUpdate = ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'].includes(authUser.role);
    if (!canUpdate) {
      return NextResponse.json({ error: 'Only analysts and admins can update incidents' }, { status: 403 });
    }

    // Fetch existing incident (tenant-scoped)
    const existing = await db.incident.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    // --- Status transitions ---
    const validStatuses = ['PENDING', 'REVIEWED', 'ESCALATED', 'DISMISSED', 'QUARANTINED'];
    if (body.status !== undefined) {
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updates.status = body.status;
      // Set reviewedAt when transitioning away from PENDING
      if (existing.status === 'PENDING' && body.status !== 'PENDING') {
        updates.reviewedAt = new Date();
        updates.reviewedById = authUser.userId;
      }
    }

    // --- Severity update ---
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (body.severity !== undefined) {
      if (!validSeverities.includes(body.severity)) {
        return NextResponse.json(
          { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
          { status: 400 }
        );
      }
      updates.severity = body.severity;
    }

    // --- AI review fields (ANALYST / TRUST_SAFETY only) ---
    if (body.aiSummary !== undefined) {
      if (!['SUPER_ADMIN', 'ANALYST', 'TRUST_SAFETY'].includes(authUser.role)) {
        return NextResponse.json({ error: 'Only analysts can set AI review fields' }, { status: 403 });
      }
      updates.aiSummary = body.aiSummary;
    }
    if (body.aiFlags !== undefined) {
      if (!['SUPER_ADMIN', 'ANALYST', 'TRUST_SAFETY'].includes(authUser.role)) {
        return NextResponse.json({ error: 'Only analysts can set AI review fields' }, { status: 403 });
      }
      updates.aiFlags = typeof body.aiFlags === 'string' ? body.aiFlags : JSON.stringify(body.aiFlags);
    }

    // --- Quarantine toggle (TRUST_SAFETY / SUPER_ADMIN only) ---
    if (body.isQuarantined !== undefined) {
      if (!['SUPER_ADMIN', 'TRUST_SAFETY'].includes(authUser.role)) {
        return NextResponse.json({ error: 'Only trust & safety can toggle quarantine' }, { status: 403 });
      }
      updates.isQuarantined = body.isQuarantined;
      if (body.isQuarantined) {
        updates.status = 'QUARANTINED';
      }
    }

    // --- C2PA verification toggle (TRUST_SAFETY / SUPER_ADMIN only) ---
    if (body.c2paVerified !== undefined) {
      if (!['SUPER_ADMIN', 'TRUST_SAFETY'].includes(authUser.role)) {
        return NextResponse.json({ error: 'Only trust & safety can verify C2PA' }, { status: 403 });
      }
      updates.c2paVerified = body.c2paVerified;
    }

    // --- Description update ---
    if (body.description !== undefined) {
      updates.description = body.description;
    }

    // --- Assign to polling unit ---
    if (body.pollingUnitId !== undefined) {
      updates.pollingUnitId = body.pollingUnitId || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await db.incident.update({
      where: { id },
      data: updates,
      include: {
        reporter: { select: { id: true, name: true, role: true } },
        pollingUnit: { select: { id: true, name: true, code: true, state: true, lga: true } },
      },
    });

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          userId: authUser.userId,
          action: 'INCIDENT_UPDATED',
          entityType: 'Incident',
          entityId: id,
          metadata: JSON.stringify({
            changedFields: Object.keys(updates),
            previousStatus: existing.status,
            newStatus: updates.status || existing.status,
          }),
        },
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      incident: {
        id: updated.id,
        type: updated.type,
        severity: updated.severity,
        status: updated.status,
        description: updated.description,
        gpsLat: updated.gpsLatitude,
        gpsLng: updated.gpsLongitude,
        gpsAnomaly: updated.gpsAnomaly,
        aiSummary: updated.aiSummary,
        aiFlags: updated.aiFlags ? JSON.parse(updated.aiFlags) : [],
        isQuarantined: updated.isQuarantined,
        c2paVerified: updated.c2paVerified,
        submittedAt: updated.submittedAt,
        reviewedAt: updated.reviewedAt,
        reporter: updated.reporter,
        pollingUnit: updated.pollingUnit,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update incident';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/incidents/[id] — soft-delete by dismissing (TENANT_ADMIN+ only)
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
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    if (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Only admins can delete incidents' }, { status: 403 });
    }

    const existing = await db.incident.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    await db.incident.update({
      where: { id },
      data: { status: 'DISMISSED', reviewedAt: new Date(), reviewedById: authUser.userId },
    });

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          userId: authUser.userId,
          action: 'INCIDENT_DISMISSED',
          entityType: 'Incident',
          entityId: id,
          metadata: JSON.stringify({ previousStatus: existing.status }),
        },
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ success: true, message: 'Incident dismissed' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to dismiss incident';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}