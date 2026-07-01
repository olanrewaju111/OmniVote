import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * Resolve tenant from request. Accepts tenantId as query param.
 * Falls back to first tenant only if no tenantId provided (shouldn't happen in normal flow).
 */
export async function resolveTenant(req: Request): Promise<{ id: string; error?: NextResponse }> {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenantId');

  if (tenantId) {
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return { id: '', error: NextResponse.json({ error: 'Tenant not found' }, { status: 404 }) };
    return { id: tenant.id };
  }

  // No tenantId provided — find first active tenant
  const tenant = await db.tenant.findFirst({ where: { isActive: true } });
  if (!tenant) return { id: '', error: NextResponse.json({ error: 'No active tenant' }, { status: 404 }) };
  return { id: tenant.id };
}