/**
 * tenant-stats.ts — Tenant Data Statistics Engine
 *
 * Aggregates record counts, storage estimates, and growth trends
 * per tenant. Used for admin dashboards and capacity planning.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface EntityStat {
  entityType: string;
  tableName: string;
  count: number;
  avgBytesPerRow?: number;
  estimatedSizeKb?: number;
}

export interface TenantDataStats {
  tenantId: string;
  tenantName: string;
  totalRecords: number;
  estimatedSizeKb: number;
  entities: EntityStat[];
  topEntities: Array<{ entityType: string; count: number }>;
  computedAt: string;
}

/**
 * Approximate row sizes in bytes for SQLite table estimates.
 * Used when we can't run ANALYZE or pg_total_relation_size.
 */
const APPROX_ROW_BYTES: Record<string, number> = {
  Incident: 500,
  ElectionResult: 400,
  AuditLog: 300,
  SecurityEvent: 350,
  OsintPost: 600,
  PvtSubmission: 500,
  Alert: 200,
  CampaignEvent: 400,
  VoterSuppressionReport: 500,
  AgentCheckIn: 250,
  CampaignMessage: 200,
  ChatMessage: 150,
  AgentMessage: 300,
  EvidenceDossier: 800,
  GeofenceZone: 300,
  HoneypotUnit: 500,
  FlashpointForecast: 400,
  WargameScenario: 1000,
  AccessibilityReport: 400,
  StegoScanResult: 500,
  ResultComparison: 400,
  DeadMansSwitch: 200,
  KeyMessage: 300,
  NarrativeTimeline: 300,
  ScheduledReport: 200,
  ContactList: 200,
  Campaign: 400,
};

/**
 * Entity table names and their Prisma model names.
 */
const AUDIT_ENTITIES: Array<{ entityType: string; model: string }> = [
  { entityType: 'incidents', model: 'Incident' },
  { entityType: 'results', model: 'ElectionResult' },
  { entityType: 'audit-logs', model: 'AuditLog' },
  { entityType: 'security-events', model: 'SecurityEvent' },
  { entityType: 'osint', model: 'OsintPost' },
  { entityType: 'pvt', model: 'PvtSubmission' },
  { entityType: 'alerts', model: 'Alert' },
  { entityType: 'campaign-events', model: 'CampaignEvent' },
  { entityType: 'voter-suppression', model: 'VoterSuppressionReport' },
  { entityType: 'agent-checkins', model: 'AgentCheckIn' },
  { entityType: 'campaign-messages', model: 'CampaignMessage' },
  { entityType: 'chat-messages', model: 'ChatMessage' },
  { entityType: 'agent-messages', model: 'AgentMessage' },
  { entityType: 'evidence', model: 'EvidenceDossier' },
  { entityType: 'geofence', model: 'GeofenceZone' },
  { entityType: 'honeypot', model: 'HoneypotUnit' },
  { entityType: 'flashpoint', model: 'FlashpointForecast' },
  { entityType: 'wargame', model: 'WargameScenario' },
  { entityType: 'accessibility', model: 'AccessibilityReport' },
  { entityType: 'stego-scans', model: 'StegoScanResult' },
  { entityType: 'result-comparisons', model: 'ResultComparison' },
  { entityType: 'dead-man-switches', model: 'DeadMansSwitch' },
  { entityType: 'key-messages', model: 'KeyMessage' },
  { entityType: 'narrative-timelines', model: 'NarrativeTimeline' },
  { entityType: 'scheduled-reports', model: 'ScheduledReport' },
  { entityType: 'contact-lists', model: 'ContactList' },
  { entityType: 'campaigns', model: 'Campaign' },
];

/**
 * Get data statistics for a specific tenant.
 */
export async function getTenantDataStats(tenantId: string): Promise<TenantDataStats> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  const tenantName = tenant?.name || tenantId;

  const entities: EntityStat[] = [];
  let totalRecords = 0;
  let totalSizeKb = 0;

  for (const entity of AUDIT_ENTITIES) {
    try {
      const result: Array<{ c: number }> = await db.$queryRawUnsafe(
        `SELECT COUNT(*) as c FROM ${entity.model} WHERE tenantId = ?`,
        tenantId
      );
      const count = result[0]?.c || 0;
      const avgBytes = APPROX_ROW_BYTES[entity.model] || 300;
      const estimatedSizeKb = Math.round((count * avgBytes) / 1024);

      entities.push({
        entityType: entity.entityType,
        tableName: entity.model,
        count,
        avgBytesPerRow: avgBytes,
        estimatedSizeKb,
      });

      totalRecords += count;
      totalSizeKb += estimatedSizeKb;
    } catch (err) {
      logger.error({
        message: `Stats query failed for ${entity.entityType}`,
        module: 'AUDIT_STATS',
        entityType: entity.entityType,
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Top 5 entities by record count
  const topEntities = entities
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(e => ({ entityType: e.entityType, count: e.count }));

  return {
    tenantId,
    tenantName,
    totalRecords,
    estimatedSizeKb: totalSizeKb,
    entities,
    topEntities,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Get data statistics for ALL tenants. Super-admin view.
 */
export async function getAllTenantStats(): Promise<TenantDataStats[]> {
  const tenants = await db.tenant.findMany({
    select: { id: true },
    where: { isActive: true },
  });

  const results: TenantDataStats[] = [];
  for (const tenant of tenants) {
    const stats = await getTenantDataStats(tenant.id);
    results.push(stats);
  }

  // Sort by total records descending
  return results.sort((a, b) => b.totalRecords - a.totalRecords);
}

/**
 * Get a global summary across all tenants.
 */
export async function getGlobalStats(): Promise<{
  totalTenants: number;
  totalRecords: number;
  totalSizeKb: number;
  entityTotals: Array<{ entityType: string; count: number }>;
}> {
  const allStats = await getAllTenantStats();

  const entityMap = new Map<string, number>();
  let totalRecords = 0;
  let totalSizeKb = 0;

  for (const ts of allStats) {
    totalRecords += ts.totalRecords;
    totalSizeKb += ts.estimatedSizeKb;
    for (const e of ts.entities) {
      entityMap.set(e.entityType, (entityMap.get(e.entityType) || 0) + e.count);
    }
  }

  const entityTotals = Array.from(entityMap.entries())
    .map(([entityType, count]) => ({ entityType, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalTenants: allStats.length,
    totalRecords,
    totalSizeKb,
    entityTotals,
  };
}