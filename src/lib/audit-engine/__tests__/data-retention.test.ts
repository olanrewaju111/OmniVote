/**
 * Unit tests for the data retention engine (pure logic, no DB).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB module entirely
vi.mock('@/lib/db', () => ({
  db: {
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ name: 'TestTenant' }),
      findMany: vi.fn().mockResolvedValue([
        { id: 't1', name: 'Tenant1', dataRetentionDays: 90 },
        { id: 't2', name: 'Tenant2', dataRetentionDays: 365 },
      ]),
    },
    $queryRawUnsafe: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { runRetention, runRetentionForAllTenants } from '../data-retention';
import { db } from '@/lib/db';

const mockQueryRaw = vi.mocked(db.$queryRawUnsafe);

describe('runRetention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns scanned results in dry-run mode', async () => {
    // 11 entities × 2 queries (total count + eligible count) = 22 calls
    // Return 500 total, 100 eligible for first entity; 2000/500 for second; 0 for rest
    mockQueryRaw
      .mockResolvedValueOnce([{ c: 500 }])   // Incident total
      .mockResolvedValueOnce([{ c: 100 }])   // Incident eligible
      .mockResolvedValueOnce([{ c: 2000 }])  // AuditLog total
      .mockResolvedValueOnce([{ c: 500 }])   // AuditLog eligible
      // Remaining 9 entities: 0/0
      .mockResolvedValue([{ c: 0 }]);

    const result = await runRetention('t1', 90, false);
    expect(result.tenantId).toBe('t1');
    expect(result.tenantName).toBe('TestTenant');
    expect(result.retentionDays).toBe(90);
    expect(result.totalScanned).toBe(2500);
    expect(result.totalDeleted).toBe(0); // dry-run
    expect(result.scanned.length).toBeGreaterThan(0);
    expect(result.deleted.length).toBe(0);
  });

  it('deletes records when execute=true', async () => {
    // Scanning phase: 2 entities with data, rest 0
    mockQueryRaw
      .mockResolvedValueOnce([{ c: 500 }])   // total
      .mockResolvedValueOnce([{ c: 100 }])   // eligible
      .mockResolvedValueOnce([{ c: 200 }])   // total
      .mockResolvedValueOnce([{ c: 50 }])    // eligible
      // Deletion phase: 2 DELETE calls
      .mockResolvedValueOnce([{ c: 50 }])    // deleted rows
      .mockResolvedValueOnce([{ c: 30 }])    // deleted rows
      // Remaining entities: 0
      .mockResolvedValue([{ c: 0 }]);

    const result = await runRetention('t1', 90, true);
    expect(result.totalDeleted).toBeGreaterThan(0);
  });

  it('gracefully handles query errors', async () => {
    mockQueryRaw
      .mockRejectedValueOnce(new Error('Table not found'))
      .mockRejectedValueOnce(new Error('Table not found'))
      // Other entities succeed
      .mockResolvedValue([{ c: 100 }]);

    const result = await runRetention('t1', 90, false);
    // First entity should have -1 counts (error sentinel)
    const failed = result.scanned.find(s => s.eligibleCount === -1);
    expect(failed).toBeDefined();
  });

  it('includes execution duration', async () => {
    mockQueryRaw.mockResolvedValue([{ c: 0 }]);

    const result = await runRetention('t1', 90, false);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.executedAt).toBeDefined();
  });

  it('returns zero counts for empty database', async () => {
    mockQueryRaw.mockResolvedValue([{ c: 0 }]);

    const result = await runRetention('t1', 90, false);
    expect(result.totalScanned).toBe(0);
    expect(result.totalDeleted).toBe(0);
  });
});

describe('runRetentionForAllTenants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs retention for all active tenants', async () => {
    mockQueryRaw.mockResolvedValue([{ c: 0 }]);

    const results = await runRetentionForAllTenants(false);
    expect(results.length).toBe(2);
    expect(results[0].tenantId).toBe('t1');
    expect(results[1].tenantId).toBe('t2');
  });
});
