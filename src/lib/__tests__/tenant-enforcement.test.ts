/**
 * Tenant enforcement — unit tests
 * Phase 20: Per-tenant session timeout and IP whitelist
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enforceSessionTimeout, enforceIpWhitelist } from '@/lib/tenant-enforcement';

// Mock the DB module
vi.mock('@/lib/db', () => ({
  db: {
    tenant: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock security logger
vi.mock('@/lib/security/security-logger', () => ({
  logSecurityEvent: vi.fn(),
}));

import { db } from '@/lib/db';

const mockAuthUser = {
  userId: 'user-1',
  email: 'test@test.com',
  role: 'ANALYST',
  tenantId: 'tenant-1',
};

describe('enforceSessionTimeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows when no iat provided', async () => {
    const result = await enforceSessionTimeout(mockAuthUser);
    expect(result.allowed).toBe(true);
  });

  it('allows when session is within timeout', async () => {
    const fiveMinAgo = Math.floor(Date.now() / 1000) - 300;
    (db.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      sessionTimeoutMin: 60,
    });

    const result = await enforceSessionTimeout(mockAuthUser, fiveMinAgo);
    expect(result.allowed).toBe(true);
    expect(db.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      select: { sessionTimeoutMin: true },
    });
  });

  it('blocks when session exceeds tenant timeout', async () => {
    const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
    (db.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      sessionTimeoutMin: 60,
    });

    const result = await enforceSessionTimeout(mockAuthUser, twoHoursAgo);
    expect(result.allowed).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.reason).toContain('60 minutes');
  });

  it('allows when tenant not found (DB error)', async () => {
    const fiveMinAgo = Math.floor(Date.now() / 1000) - 300;
    (db.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await enforceSessionTimeout(mockAuthUser, fiveMinAgo);
    expect(result.allowed).toBe(true);
  });

  it('allows when DB throws (graceful degradation)', async () => {
    const fiveMinAgo = Math.floor(Date.now() / 1000) - 300;
    (db.tenant.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));

    const result = await enforceSessionTimeout(mockAuthUser, fiveMinAgo);
    expect(result.allowed).toBe(true);
  });

  it('uses boundary correctly (exact timeout)', async () => {
    // Session issued exactly 60 min ago with 60 min timeout
    const exactly60MinAgo = Math.floor(Date.now() / 1000) - 3600;
    (db.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      sessionTimeoutMin: 60,
    });

    const result = await enforceSessionTimeout(mockAuthUser, exactly60MinAgo);
    // sessionAge > timeoutMs, so it should be blocked (just barely)
    expect(result.allowed).toBe(false);
  });
});

describe('enforceIpWhitelist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows when no client IP', async () => {
    const result = await enforceIpWhitelist(mockAuthUser, null);
    expect(result.allowed).toBe(true);
  });

  it('allows when whitelist is empty', async () => {
    (db.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ipWhitelist: '[]',
    });

    const result = await enforceIpWhitelist(mockAuthUser, '192.168.1.100');
    expect(result.allowed).toBe(true);
  });

  it('allows when IP is in whitelist (exact match)', async () => {
    (db.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ipWhitelist: '["192.168.1.100", "10.0.0.1"]',
    });

    const result = await enforceIpWhitelist(mockAuthUser, '192.168.1.100');
    expect(result.allowed).toBe(true);
  });

  it('blocks when IP is not in whitelist', async () => {
    (db.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ipWhitelist: '["10.0.0.1", "10.0.0.2"]',
    });

    const result = await enforceIpWhitelist(mockAuthUser, '192.168.1.100');
    expect(result.allowed).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.reason).toContain('IP address');
  });

  it('allows when IP matches CIDR range', async () => {
    (db.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ipWhitelist: '["10.0.0.0/8"]',
    });

    const result = await enforceIpWhitelist(mockAuthUser, '10.123.45.67');
    expect(result.allowed).toBe(true);
  });

  it('blocks when IP does not match CIDR range', async () => {
    (db.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ipWhitelist: '["10.0.0.0/8"]',
    });

    const result = await enforceIpWhitelist(mockAuthUser, '192.168.1.1');
    expect(result.allowed).toBe(false);
  });

  it('allows when tenant not found', async () => {
    (db.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await enforceIpWhitelist(mockAuthUser, '1.2.3.4');
    expect(result.allowed).toBe(true);
  });

  it('allows when DB throws', async () => {
    (db.tenant.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));

    const result = await enforceIpWhitelist(mockAuthUser, '1.2.3.4');
    expect(result.allowed).toBe(true);
  });

  it('handles /32 CIDR as exact match', async () => {
    (db.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ipWhitelist: '["10.0.0.5/32"]',
    });

    const result = await enforceIpWhitelist(mockAuthUser, '10.0.0.5');
    expect(result.allowed).toBe(true);
  });

  it('handles /0 CIDR as match all', async () => {
    (db.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ipWhitelist: '["0.0.0.0/0"]',
    });

    const result = await enforceIpWhitelist(mockAuthUser, '255.255.255.255');
    expect(result.allowed).toBe(true);
  });
});
