import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { logAudit, extractIp } from '@/lib/audit';

const BROADCAST_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST', 'TRUST_SAFETY'] as const;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!BROADCAST_ROLES.includes(session.role as typeof BROADCAST_ROLES[number])) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { title, body, priority, targetRole, channel, includeSummary } = await req.json();

    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    const tenantId = session.tenantId;

    // Determine recipients
    const whereClause: Record<string, unknown> = { tenantId, isLocked: false };
    if (targetRole && targetRole !== 'ALL') {
      whereClause.role = targetRole;
    }

    const recipients = await db.user.findMany({
      where: whereClause,
      select: { id: true, name: true, role: true, phone: true },
    });

    // Create agent messages for each recipient
    const now = new Date();

    let sentCount = 0;
    for (const recipient of recipients) {
      await db.agentMessage.create({
        data: {
          tenantId,
          agentId: recipient.id,
          sentById: session.userId,
          channel: channel === 'ALL' ? 'IN_APP' : (channel || 'IN_APP'),
          triggerType: 'MANUAL',
          subject: title,
          body: includeSummary ? `${body}\n\n---\nElection Summary attached` : body,
          priority: priority || 'NORMAL',
          status: 'DELIVERED',
          deliveredAt: now,
          createdAt: now,
          updatedAt: now,
          metadata: JSON.stringify({ type: 'BROADCAST', targetRole, includeSummary }),
        },
      });
      sentCount++;
    }

    // Audit log
    void logAudit({
      userId: session.userId,
      action: 'SEND_BROADCAST',
      entityType: 'AgentMessage',
      metadata: {
        title,
        priority,
        targetRole,
        channel,
        recipientCount: sentCount,
      },
      ipAddress: extractIp(req),
    });

    return NextResponse.json({
      success: true,
      sentCount,
      broadcastId: `broadcast-${Date.now()}`,
    });
  } catch (error) {
    console.error('[broadcast] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = session.tenantId;

    // Get recent broadcasts (agent messages with BROADCAST type)
    const broadcasts = await db.agentMessage.findMany({
      where: {
        tenantId,
        triggerType: 'MANUAL',
        subject: { not: '' },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        subject: true,
        body: true,
        priority: true,
        status: true,
        createdAt: true,
        sentBy: { select: { name: true, role: true } },
        agent: { select: { name: true, role: true } },
      },
    });

    return NextResponse.json({ broadcasts });
  } catch (error) {
    console.error('[broadcast] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
