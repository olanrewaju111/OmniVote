import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Tenant Isolation Security Tests ─────────────────────────────────────────
// These tests verify multi-tenant data isolation through static analysis
// (source code pattern matching) to avoid DB/JWT dependencies.

describe('Tenant Isolation', () => {
  // Mock JWT_SECRET before any imports that need it
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', 'test-secret-for-isolation-tests');
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('requireTenantMatch', () => {
    async function getRbac() {
      return import('../rbac');
    }

    it('allows SUPER_ADMIN to access any tenant', async () => {
      const { requireTenantMatch } = await getRbac();
      const superAdmin = { userId: '1', role: 'SUPER_ADMIN', tenantId: 'tenant-a' };
      const result = requireTenantMatch(superAdmin, 'tenant-b');
      expect(result).toBeNull();
    });

    it('allows user accessing their own tenant', async () => {
      const { requireTenantMatch } = await getRbac();
      const user = { userId: '2', role: 'FIELD_AGENT', tenantId: 'tenant-a' };
      const result = requireTenantMatch(user, 'tenant-a');
      expect(result).toBeNull();
    });

    it('blocks user from accessing another tenant', async () => {
      const { requireTenantMatch } = await getRbac();
      const user = { userId: '3', role: 'FIELD_AGENT', tenantId: 'tenant-a' };
      const result = requireTenantMatch(user, 'tenant-b');
      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
      const body = await result!.json();
      expect(body.error).toContain('Tenant access denied');
    });

    it('blocks TENANT_ADMIN from accessing another tenant', async () => {
      const { requireTenantMatch } = await getRbac();
      const admin = { userId: '4', role: 'TENANT_ADMIN', tenantId: 'tenant-a' };
      const result = requireTenantMatch(admin, 'tenant-b');
      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });

    it('blocks ANALYST from accessing another tenant', async () => {
      const { requireTenantMatch } = await getRbac();
      const analyst = { userId: '5', role: 'ANALYST', tenantId: 'tenant-a' };
      const result = requireTenantMatch(analyst, 'tenant-b');
      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });

    it('blocks TRUST_SAFETY from accessing another tenant', async () => {
      const { requireTenantMatch } = await getRbac();
      const ts = { userId: '6', role: 'TRUST_SAFETY', tenantId: 'tenant-a' };
      const result = requireTenantMatch(ts, 'tenant-b');
      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });
  });

  describe('Security Fix Verification: POST /api/incidents', () => {
    it('should require authentication (no reporterId from body)', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.join(process.cwd(), 'src/app/api/incidents/route.ts');
      const source = fs.readFileSync(routePath, 'utf-8');

      // Find the POST handler block (from POST to end of file)
      const postStart = source.indexOf('export async function POST');
      expect(postStart).toBeGreaterThan(-1);
      const postBlock = source.slice(postStart, postStart + 800);
      expect(postBlock).toContain('getAuthUser');
      expect(postBlock).toContain('Authentication required');
      // Verify reporterId comes from authUser, not request body
      expect(postBlock).toContain('authUser.userId');
      expect(postBlock).toContain('authUser.tenantId');
      // Should NOT resolve tenant from body reporterId
      expect(postBlock).not.toContain("where: { id: reporterId }");
    });
  });

  describe('Security Fix Verification: POST /api/results', () => {
    it('should require authentication (no reporterId from body)', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.join(process.cwd(), 'src/app/api/results/route.ts');
      const source = fs.readFileSync(routePath, 'utf-8');

      const postStart = source.indexOf('export async function POST');
      expect(postStart).toBeGreaterThan(-1);
      const postBlock = source.slice(postStart, postStart + 800);
      expect(postBlock).toContain('getAuthUser');
      expect(postBlock).toContain('Authentication required');
      expect(postBlock).toContain('authUser.userId');
      expect(postBlock).toContain('authUser.tenantId');
      // Should NOT resolve tenant from body
      expect(postBlock).not.toContain("where: { id: reporterId }");
    });
  });

  describe('Middleware RBAC enforcement', () => {
    it('should restrict /api/tenants to SUPER_ADMIN only', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const mwPath = path.join(process.cwd(), 'src/middleware.ts');
      const source = fs.readFileSync(mwPath, 'utf-8');
      expect(source).toContain("'tenants': ['SUPER_ADMIN']");
      expect(source).toContain("'tenants/users': ['SUPER_ADMIN']");
      expect(source).toContain("'security': ['SUPER_ADMIN', 'TENANT_ADMIN', 'TRUST_SAFETY']");
    });
  });

  describe('Tenant data boundary checks', () => {
    it('GET /api/incidents always filters by tenantId', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.join(process.cwd(), 'src/app/api/incidents/route.ts');
      const source = fs.readFileSync(routePath, 'utf-8');
      const getStart = source.indexOf('export async function GET');
      const postStart = source.indexOf('export async function POST');
      const getBlock = source.slice(getStart, postStart);
      expect(getBlock).toContain('requireTenantMatch');
    });

    it('GET /api/results always filters by tenantId', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.join(process.cwd(), 'src/app/api/results/route.ts');
      const source = fs.readFileSync(routePath, 'utf-8');
      const getStart = source.indexOf('export async function GET');
      const postStart = source.indexOf('export async function POST');
      const getBlock = source.slice(getStart, postStart);
      expect(getBlock).toContain('requireTenantMatch');
    });

    it('GET /api/dashboard requires auth', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.join(process.cwd(), 'src/app/api/dashboard/route.ts');
      const source = fs.readFileSync(routePath, 'utf-8');
      expect(source).toContain('getAuthUser');
      expect(source).toContain('tenantId');
    });

    it('GET /api/agents requires auth', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.join(process.cwd(), 'src/app/api/agents/route.ts');
      const source = fs.readFileSync(routePath, 'utf-8');
      expect(source).toContain('getAuthUser');
    });

    it('GET /api/engagement requires auth', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const routePath = path.join(process.cwd(), 'src/app/api/engagement/route.ts');
      const source = fs.readFileSync(routePath, 'utf-8');
      expect(source).toContain('getAuthUser');
    });
  });
});
