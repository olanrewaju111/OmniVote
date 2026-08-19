import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { notificationRouter } from '@/lib/notification-router';
import type { RoutingRule } from '@/lib/notification-router/types';

/**
 * GET /api/notifications/rules — List all routing rules.
 * SUPER_ADMIN and TENANT_ADMIN can view rules.
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(authUser.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const rules = notificationRouter.getRules();
  const stats = notificationRouter.getStats();
  return NextResponse.json({ rules, stats });
}

/**
 * POST /api/notifications/rules — Add or update a routing rule.
 * SUPER_ADMIN only.
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (authUser.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only SUPER_ADMIN can modify rules' }, { status: 403 });
  }

  let rule: RoutingRule;
  try {
    rule = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!rule.id || !rule.name || !rule.channels || rule.channels.length === 0) {
    return NextResponse.json({ error: 'Rule must have id, name, and at least one channel' }, { status: 400 });
  }

  notificationRouter.addRule(rule);
 return NextResponse.json({ success: true, rule });
}

/**
 * DELETE /api/notifications/rules?id=rule-id — Remove a routing rule.
 * SUPER_ADMIN only.
 */
export async function DELETE(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (authUser.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only SUPER_ADMIN can modify rules' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url || 'http://localhost');
  const ruleId = searchParams.get('id');

  if (!ruleId) {
    return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
  }

  const removed = notificationRouter.removeRule(ruleId);
  if (!removed) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}