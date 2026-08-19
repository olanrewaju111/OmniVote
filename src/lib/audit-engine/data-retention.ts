/**
 * data-retention.ts — Automated Data Retention Engine
 *
 * Computes what data is eligible for deletion based on each tenant's
 * dataRetentionDays setting. Provides per-entity counts, a dry-run mode,
 * and an execution mode that performs the actual deletions.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface RetentionEligible {
  entityType: string;
  tableName: string;
  totalCount: number;
  eligibleCount: number;
  cutoffDate: Date;
}

export interface RetentionResult {
  tenantId: string;
  tenantName: string;
  retentionDays: number;
  scanned: RetentionEligible[];
  deleted: Array<{
    entityType: string;
    tableName: string;
    rowsDeleted: number;
  }>;
  totalScanned: number;
  totalDeleted: number;
  executedAt: string;
  durationMs: number;
}

/**
 * Entity tables that support time-based retention.
 * Each entry maps a Prisma model to its timestamp column.
 */
const RETENTION_ENTITIES: Array<{
  entityType: string;
  model: string;
  dateField: string;
}> = [
  { entityType: 'incidents', model: 'Incident', dateField: 'submittedAt' },
  { entityType: 'audit-logs', model: 'AuditLog', dateField: 'createdAt' },
  { entityType: 'security-events', model: 'SecurityEvent', dateField: 'createdAt' },
  { entityType: 'osint', model: 'OsintPost', dateField: 'ingestedAt' },
  { entityType: 'pvt', model: 'PvtSubmission', dateField: 'submittedAt' },
  { entityType: 'alerts', model: 'Alert', dateField: 'createdAt' },
  { entityType: 'campaign-events', model: 'CampaignEvent', dateField: 'createdAt' },
  { entityType: 'voter-suppression', model: 'VoterSuppressionReport', dateField: 'createdAt' },
  { entityType: 'agent-checkins', model: 'AgentCheckIn', dateField: 'checkedInAt' },
  { entityType: 'campaign-messages', model: 'CampaignMessage', dateField: 'createdAt' },
  { entityType: 'chat-messages', model: 'ChatMessage', dateField: 'createdAt' },
];

/**
 * Scan a tenant's data to find records eligible for retention cleanup.
 * If `execute` is false, only returns counts (dry-run).
 */
export async function runRetention(
  tenantId: string,
  retentionDays: number,
  execute: boolean = false
): Promise<RetentionResult> {
  const start = Date.now();
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // Fetch tenant name for reporting
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  const tenantName = tenant?.name || tenantId;

  const scanned: RetentionEligible[] = [];
  const deleted: RetentionResult['deleted'] = [];
  let totalScanned = 0;
  let totalDeleted = 0;

  for (const entity of RETENTION_ENTITIES) {
    try {
      // Use raw SQL for flexible date comparisons in SQLite
      const cutoffIso = cutoffDate.toISOString();

      // Count total records for this entity/tenant
      const countAllResult: Array<{ c: number }> = await db.$queryRawUnsafe(
        `SELECT COUNT(*) as c FROM ${entity.model} WHERE tenantId = ?`,
        tenantId
      );
      const totalCount = countAllResult[0]?.c || 0;

      // Count eligible records (older than cutoff)
      const countEligibleResult: Array<{ c: number }> = await db.$queryRawUnsafe(
        `SELECT COUNT(*) as c FROM ${entity.model} WHERE tenantId = ? AND ${entity.dateField} < ?`,
        tenantId,
        cutoffIso
      );
      const eligibleCount = countEligibleResult[0]?.c || 0;

      scanned.push({
        entityType: entity.entityType,
        tableName: entity.model,
        totalCount,
        eligibleCount,
        cutoffDate,
      });
      totalScanned += totalCount;

      // Execute deletion if requested
      if (execute && eligibleCount > 0) {
        const deleteResult: Array<{ c: number }> = await db.$queryRawUnsafe(
          `DELETE FROM ${entity.model} WHERE tenantId = ? AND ${entity.dateField} < ?`,
          tenantId,
          cutoffIso
        );
        const rowsDeleted = deleteResult[0]?.c || 0;
        deleted.push({
          entityType: entity.entityType,
          tableName: entity.model,
          rowsDeleted,
        });
        totalDeleted += rowsDeleted;
      }
    } catch (err) {
      logger.error({
        message: `Retention scan failed for ${entity.entityType}`,
        module: 'RETENTION',
        entityType: entity.entityType,
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      scanned.push({
        entityType: entity.entityType,
        tableName: entity.model,
        totalCount: -1,
        eligibleCount: -1,
        cutoffDate,
      });
    }
  }

  const result: RetentionResult = {
    tenantId,
    tenantName,
    retentionDays,
    scanned,
    deleted,
    totalScanned,
    totalDeleted,
    executedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };

  logger.info({
    message: `Retention ${execute ? 'executed' : 'scanned'}`,
    module: 'RETENTION',
    tenantId,
    retentionDays,
    totalScanned,
    totalEligible: scanned.reduce((s, e) => s + Math.max(0, e.eligibleCount), 0),
    totalDeleted,
    durationMs: result.durationMs,
  });

  return result;
}

/**
 * Run retention for ALL tenants. Useful for a nightly cron job.
 */
export async function runRetentionForAllTenants(execute: boolean = false): Promise<RetentionResult[]> {
  const tenants = await db.tenant.findMany({
    select: { id: true, name: true, dataRetentionDays: true },
    where: { isActive: true },
  });

  const results: RetentionResult[] = [];
  for (const tenant of tenants) {
    const result = await runRetention(tenant.id, tenant.dataRetentionDays, execute);
    results.push(result);
  }
  return results;
}
