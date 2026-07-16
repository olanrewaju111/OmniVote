import { NextRequest, NextResponse } from "next/server";
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const [userCount, incidentCount, tenantCount, alertCount] = await Promise.all([
    db.user.count(),
    db.incident.count(),
    db.tenant.count(),
    db.alert.count(),
  ]);
  return NextResponse.json({
    name: 'OmniVote API',
    version: '1.0.0',
    status: 'operational',
    endpoints: 31,
    stats: { users: userCount, incidents: incidentCount, tenants: tenantCount, alerts: alertCount },
    timestamp: new Date().toISOString(),
  });
}