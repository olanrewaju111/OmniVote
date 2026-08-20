import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getRunbook } from '@/lib/sre';

async function requireAuth(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  return null;
}

/**
 * GET /api/runbooks/[id] — Get a specific runbook by ID.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAuth(_request);
  if (authErr) return authErr;

  const { id } = await params;
  const runbook = getRunbook(id);

  if (!runbook) {
    return NextResponse.json(
      { error: `Runbook ${id} not found` },
      { status: 404 }
    );
  }

  return NextResponse.json(runbook);
}