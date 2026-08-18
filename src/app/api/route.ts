import { NextResponse } from "next/server";

/**
 * GET /api — Public API info endpoint.
 *
 * SECURITY NOTE: This endpoint intentionally does NOT expose any entity counts
 * (users, incidents, tenants, alerts) as that would leak operational intelligence
 * to unauthenticated observers. Only public, non-sensitive metadata is returned.
 */
export async function GET() {
  return NextResponse.json({
    name: 'OmniVote API',
    version: '1.0.0',
    status: 'operational',
    endpoints: 31,
    timestamp: new Date().toISOString(),
  });
}