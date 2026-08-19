import { NextResponse } from 'next/server';
import { getRunbook } from '@/lib/sre';

/**
 * GET /api/runbooks/[id] — Get a specific runbook by ID.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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