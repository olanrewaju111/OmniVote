import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module before importing audit
vi.mock('../db', () => ({
  db: {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: '1' }),
    },
  },
}));

import { logAudit, extractIp } from '../audit';
import { db } from '../db';

// ─── extractIp ────────────────────────────────────────────────────────────

describe('extractIp', () => {
  it('extracts IP from x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(extractIp(req)).toBe('1.2.3.4');
  });

  it('trims the first IP from x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '  1.2.3.4  , 5.6.7.8' },
    });
    expect(extractIp(req)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '10.0.0.1' },
    });
    expect(extractIp(req)).toBe('10.0.0.1');
  });

  it('x-forwarded-for takes priority over x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '1.1.1.1',
        'x-real-ip': '2.2.2.2',
      },
    });
    expect(extractIp(req)).toBe('1.1.1.1');
  });

  it('returns unknown when no headers present', () => {
    const req = new Request('http://localhost');
    expect(extractIp(req)).toBe('unknown');
  });
});

// ─── logAudit ─────────────────────────────────────────────────────────────

describe('logAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls db.auditLog.create with correct data', async () => {
    await logAudit({
      userId: 'user-1',
      action: 'LOGIN',
      entityType: 'user',
      ipAddress: '1.2.3.4',
    });

    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        action: 'LOGIN',
        entityType: 'user',
        entityId: undefined,
        metadata: JSON.stringify({}),
        ipAddress: '1.2.3.4',
      },
    });
  });

  it('stringifies metadata', async () => {
    await logAudit({
      userId: 'user-1',
      action: 'UPDATE',
      entityType: 'election',
      entityId: 'election-1',
      metadata: { field: 'name', oldVal: 'A', newVal: 'B' },
    });

    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: JSON.stringify({ field: 'name', oldVal: 'A', newVal: 'B' }),
          entityId: 'election-1',
        }),
      }),
    );
  });

  it('defaults ipAddress to unknown', async () => {
    await logAudit({
      userId: 'user-1',
      action: 'VIEW',
      entityType: 'report',
    });

    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ipAddress: 'unknown',
          metadata: JSON.stringify({}),
        }),
      }),
    );
  });

  it('does not throw when DB call fails', async () => {
    (db.auditLog.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('DB down'),
    );

    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      logAudit({ userId: 'u', action: 'a', entityType: 'e' }),
    ).resolves.not.toThrow();
    spy.mockRestore();
  });
});
