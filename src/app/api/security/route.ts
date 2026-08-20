import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { safeParse } from '@/lib/safe-parse';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';
import { logAudit, extractIp } from '@/lib/audit';

// GET /api/security?tenantId=X&severity=X&eventType=X
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

    // RBAC: only SUPER_ADMIN, TENANT_ADMIN, TRUST_SAFETY can access security events
    const ALLOWED_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'TRUST_SAFETY'];
    if (!ALLOWED_ROLES.includes(authUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const url = new URL(req.url || "", "http://localhost");
    const severity = url.searchParams.get('severity');
    const eventType = url.searchParams.get('eventType');
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    const where: Record<string, unknown> = { tenantId };
    if (severity) where.severity = severity;
    if (eventType) where.eventType = eventType;

    const [events, total, bySeverity, byType, unresolved, criticalUnresolved] = await Promise.all([
      db.securityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.securityEvent.count({ where: { tenantId } }),
      db.securityEvent.groupBy({ by: ['severity'], where: { tenantId }, _count: { severity: true } }),
      db.securityEvent.groupBy({ by: ['eventType'], where: { tenantId }, _count: { eventType: true } }),
      db.securityEvent.count({ where: { tenantId, resolved: false } }),
      db.securityEvent.count({ where: { tenantId, severity: 'CRITICAL', resolved: false } }),
    ]);

    // User trust scores
    const users = await db.user.findMany({
      where: { tenantId },
      select: { id: true, name: true, email: true, role: true, deviceTrustScore: true, biometricRiskScore: true, isLocked: true, lastSecurityAuditAt: true },
    });

    // Tenant security settings
    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { encryptionEnabled: true, twoFactorEnabled: true, sessionTimeoutMin: true, ipWhitelist: true, dataRetentionDays: true, auditLogRetentionDays: true } });

    return NextResponse.json({
      events: events.map(e => ({ ...e, metadata: safeParse(e.metadata) })),
      counts: {
        total,
        unresolved,
        criticalUnresolved,
        bySeverity: Object.fromEntries(bySeverity.map(g => [g.severity, g._count.severity])),
        byType: Object.fromEntries(byType.map(g => [g.eventType, g._count.eventType])),
      },
      users: users.map(u => ({ ...u, ipWhitelist: safeParse(tenant?.ipWhitelist, []) })),
      policies: tenant
        ? {
            encryptionEnabled: tenant.encryptionEnabled,
            twoFactorEnabled: tenant.twoFactorEnabled,
            sessionTimeoutMin: tenant.sessionTimeoutMin,
            ipWhitelist: safeParse(tenant.ipWhitelist),
            dataRetentionDays: tenant.dataRetentionDays,
            auditLogRetentionDays: tenant.auditLogRetentionDays,
          }
        : null,
      securityScore: Math.max(0, 100 - criticalUnresolved * 10 - (unresolved - criticalUnresolved) * 2),
    });
  } catch (err) {
    console.error('Security events error:', err);
    return NextResponse.json({ error: 'Failed to fetch security data' }, { status: 500 });
  }
}

// POST /api/security — log a security event or update policy
export async function POST(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    // RBAC: only SUPER_ADMIN, TENANT_ADMIN, TRUST_SAFETY can perform security actions
    const ALLOWED_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'TRUST_SAFETY'];
    if (!ALLOWED_ROLES.includes(authUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const { action, ...data } = body;

    // Additional restriction: LOCK_USER, UNLOCK_USER, UPDATE_POLICY require TENANT_ADMIN or SUPER_ADMIN
    const SENSITIVE_ACTIONS = ['LOCK_USER', 'UNLOCK_USER', 'UPDATE_POLICY'];
    if (SENSITIVE_ACTIONS.includes(action) && authUser.role === 'TRUST_SAFETY') {
      return NextResponse.json({ error: 'Insufficient permissions for this action' }, { status: 403 });
    }

    if (action === 'LOG_EVENT') {
      const { eventType, severity, userId, description, ipAddress, userAgent, metadata } = data;
      if (!eventType || !description) {
        return NextResponse.json({ error: 'eventType and description are required' }, { status: 400 });
      }
      const event = await db.securityEvent.create({
        data: {
          tenantId,
          userId: userId || null,
          eventType,
          severity: severity || 'INFO',
          description,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: JSON.stringify(metadata || {}),
        },
      });
      void logAudit({
        userId: authUser.userId,
        action: 'LOG_SECURITY_EVENT',
        entityType: 'SecurityEvent',
        entityId: event.id,
        metadata: { eventType, severity },
        ipAddress: extractIp(req),
      });
      return NextResponse.json({ event }, { status: 201 });
    }

    if (action === 'UPDATE_POLICY') {
      const { encryptionEnabled, twoFactorEnabled, sessionTimeoutMin, ipWhitelist, dataRetentionDays } = data;
      const updateData: Record<string, unknown> = {};
      if (typeof encryptionEnabled === 'boolean') updateData.encryptionEnabled = encryptionEnabled;
      if (typeof twoFactorEnabled === 'boolean') updateData.twoFactorEnabled = twoFactorEnabled;
      if (typeof sessionTimeoutMin === 'number') updateData.sessionTimeoutMin = sessionTimeoutMin;
      if (typeof ipWhitelist === 'string') updateData.ipWhitelist = ipWhitelist;
      if (typeof dataRetentionDays === 'number') updateData.dataRetentionDays = dataRetentionDays;

      await db.tenant.update({ where: { id: tenantId }, data: updateData });
      void logAudit({
        userId: authUser.userId,
        action: 'UPDATE_SECURITY_POLICY',
        entityType: 'Tenant',
        entityId: tenantId,
        metadata: updateData,
        ipAddress: extractIp(req),
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'RESOLVE_EVENT') {
      const { eventId, resolvedById } = data;
      if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 });
      await db.securityEvent.update({
        where: { id: eventId, tenantId },
        data: { resolved: true, resolvedById: resolvedById || null, resolvedAt: new Date() },
      });
      void logAudit({
        userId: authUser.userId,
        action: 'RESOLVE_SECURITY_EVENT',
        entityType: 'SecurityEvent',
        entityId: eventId,
        ipAddress: extractIp(req),
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'LOCK_USER') {
      const { userId: targetUserId, reason } = data;
      if (!targetUserId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
      await db.user.update({
        where: { id: targetUserId, tenantId },
        data: { isLocked: true, lockedAt: new Date(), lockedReason: reason || 'Manual lock by admin' },
      });
      void logAudit({
        userId: authUser.userId,
        action: 'LOCK_USER',
        entityType: 'User',
        entityId: targetUserId,
        metadata: { reason },
        ipAddress: extractIp(req),
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'UNLOCK_USER') {
      const { userId: targetUserId } = data;
      if (!targetUserId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
      await db.user.update({
        where: { id: targetUserId, tenantId },
        data: { isLocked: false, lockedAt: null, lockedReason: null },
      });
      void logAudit({
        userId: authUser.userId,
        action: 'UNLOCK_USER',
        entityType: 'User',
        entityId: targetUserId,
        ipAddress: extractIp(req),
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action. Use: LOG_EVENT, UPDATE_POLICY, RESOLVE_EVENT, LOCK_USER, UNLOCK_USER' }, { status: 400 });
  } catch (err) {
    console.error('Security POST error:', err);
    return NextResponse.json({ error: 'Failed to process security action' }, { status: 500 });
  }
}