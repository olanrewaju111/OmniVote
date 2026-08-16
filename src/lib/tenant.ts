import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * Resolve tenant from request. Requires tenantId as query param.
 * Returns an error if tenantId is missing or tenant not found — never
 * silently falls back to a different tenant (prevents cross-tenant data leaks).
 */
export async function resolveTenant(req: Request): Promise<{ id: string; error?: NextResponse }> {
  const url = new URL(req.url || "", "http://localhost");
  const tenantId = url.searchParams.get('tenantId');

  if (!tenantId) {
    return { id: '', error: NextResponse.json({ error: 'tenantId query parameter is required' }, { status: 400 }) };
  }

  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { id: '', error: NextResponse.json({ error: 'Tenant not found' }, { status: 404 }) };
  return { id: tenant.id };
}
