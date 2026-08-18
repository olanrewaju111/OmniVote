import { db } from './db';

interface AuditParams {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Fire-and-forget audit log entry. Does not block the calling route.
 * Errors are logged to console but never thrown.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: JSON.stringify(params.metadata ?? {}),
        ipAddress: params.ipAddress || 'unknown',
      },
    });
  } catch (err) {
    console.error('[audit] Failed to log:', err);
  }
}

/** Helper to extract IP from request */
export function extractIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || req.headers.get('x-real-ip') 
    || 'unknown';
}
