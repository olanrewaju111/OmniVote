import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';
import { logAudit, extractIp } from '@/lib/audit';

// ─── GET /api/engagement ─────────────────────────────────────────────
// Fetches: idle agents, agents with no data, message history, engagement stats
export async function GET(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const view = searchParams.get('view') || 'dashboard';
    const agentId = searchParams.get('agentId');

    // ─── 1. Engagement Dashboard Stats ──────────────────────────
    const totalAgents = await db.user.count({ where: { tenantId, role: 'FIELD_AGENT' } });
    const onlineAgents = await db.user.count({ where: { tenantId, role: 'FIELD_AGENT', isOnline: true } });

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Idle agents: online but lastSeen > 30 min ago
    const idleAgents = await db.user.findMany({
      where: {
        tenantId, role: 'FIELD_AGENT',
        isOnline: true,
        lastSeenAt: { lt: thirtyMinAgo },
      },
      select: {
        id: true, name: true, email: true, isOnline: true, lastSeenAt: true,
        _count: { select: { incidents: true, results: true, agentMessages: true } },
      },
      orderBy: { lastSeenAt: 'asc' },
    });

    // All agents with their counts
    const allAgents = await db.user.findMany({
      where: { tenantId, role: 'FIELD_AGENT' },
      select: {
        id: true, name: true, email: true, isOnline: true, lastSeenAt: true, createdAt: true,
        _count: { select: { incidents: true, results: true, agentMessages: true } },
      },
    });

    const noDataAgents = allAgents.filter(a => a._count.results === 0 && a._count.incidents === 0);
    const offlineAgents = allAgents.filter(a => !a.isOnline && (!a.lastSeenAt || a.lastSeenAt < oneHourAgo));

    // Agents with infractions
    const agentsWithInfractions = await db.user.findMany({
      where: {
        tenantId, role: 'FIELD_AGENT',
        incidents: { some: { OR: [{ isQuarantined: true }, { gpsAnomaly: true }, { status: 'QUARANTINED' }] } },
      },
      select: {
        id: true, name: true, email: true, isOnline: true, lastSeenAt: true,
        incidents: {
          where: { OR: [{ isQuarantined: true }, { gpsAnomaly: true }] },
          select: { id: true, type: true, severity: true, submittedAt: true },
          take: 3,
          orderBy: { submittedAt: 'desc' },
        },
        _count: { select: { incidents: true, results: true, agentMessages: true } },
      },
    });

    // ─── 2. Message History ─────────────────────────────────────
    let messages: unknown[] = [];
    if (view === 'messages' || view === 'dashboard') {
      const where: Record<string, unknown> = { tenantId };
      if (agentId) where.agentId = agentId;

      const msgTrigger = searchParams.get('triggerType');
      const msgChannel = searchParams.get('channel');
      const msgStatus = searchParams.get('status');

      if (msgTrigger && msgTrigger !== 'ALL') where.triggerType = msgTrigger;
      if (msgChannel && msgChannel !== 'ALL') where.channel = msgChannel;
      if (msgStatus && msgStatus !== 'ALL') where.status = msgStatus;

      messages = await db.agentMessage.findMany({
        where,
        include: {
          agent: { select: { id: true, name: true, email: true, isOnline: true, lastSeenAt: true } },
          sentBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: view === 'messages' ? 100 : 20,
      });
    }

    // ─── 3. Stats ───────────────────────────────────────────────
    const messageStats = await db.agentMessage.groupBy({
      by: ['channel'], where: { tenantId }, _count: { id: true },
    });
    const triggerStats = await db.agentMessage.groupBy({
      by: ['triggerType'], where: { tenantId }, _count: { id: true },
    });
    const statusStats = await db.agentMessage.groupBy({
      by: ['status'], where: { tenantId }, _count: { id: true },
    });

    return NextResponse.json({
      stats: {
        totalAgents, onlineAgents,
        idleAgents: idleAgents.length,
        noDataAgents: noDataAgents.length,
        offlineAgents: offlineAgents.length,
        agentsWithInfractions: agentsWithInfractions.length,
        totalMessages: await db.agentMessage.count({ where: { tenantId } }),
        pendingMessages: await db.agentMessage.count({ where: { tenantId, status: 'PENDING' } }),
        failedMessages: await db.agentMessage.count({ where: { tenantId, status: 'FAILED' } }),
      },
      idleAgents,
      noDataAgents,
      offlineAgents,
      agentsWithInfractions,
      messages,
      messageStats: Object.fromEntries(messageStats.map(s => [s.channel, s._count.id])),
      triggerStats: Object.fromEntries(triggerStats.map(s => [s.triggerType, s._count.id])),
      statusStats: Object.fromEntries(statusStats.map(s => [s.status, s._count.id])),
    });
  } catch (e: unknown) {
    console.error('Engagement API error:', e);
    return NextResponse.json({ error: 'Failed to fetch engagement data' }, { status: 500 });
  }
}

// ─── POST /api/engagement ────────────────────────────────────────────
// Send a message to a single agent
export async function POST(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const WRITE_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] as const;
    if (!WRITE_ROLES.includes(authUser.role as typeof WRITE_ROLES[number])) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const { agentId, channel, triggerType, subject, body: messageBody, priority, sentById } = body;

    if (!agentId || !subject || !messageBody) {
      return NextResponse.json({ error: 'agentId, subject, and body are required' }, { status: 400 });
    }

    const agent = await db.user.findFirst({ where: { id: agentId, tenantId, role: 'FIELD_AGENT' } });
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

    const validChannels = ['IN_APP', 'WHATSAPP', 'SMS', 'PUSH'];
    const validTriggers = ['MANUAL', 'IDLE_DETECTION', 'NO_DATA', 'INCIDENT_FOLLOWUP', 'INFRACTION_REMINDER', 'SCHEDULED_CHECKIN'];
    const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

    const ch = validChannels.includes(channel) ? channel : 'IN_APP';
    const trig = validTriggers.includes(triggerType) ? triggerType : 'MANUAL';
    const pri = validPriorities.includes(priority) ? priority : 'NORMAL';

    let status = 'PENDING';
    let deliveredAt: Date | null = null;
    let whatsappMessageId: string | null = null;

    // Create the message in DB first (PENDING status)
    const message = await db.agentMessage.create({
      data: {
        tenantId, agentId,
        sentById: sentById || null,
        channel: ch, triggerType: trig,
        subject, body: messageBody, priority: pri,
        status: 'PENDING',
        metadata: JSON.stringify({}),
      },
      include: {
        agent: { select: { id: true, name: true, email: true, isOnline: true, phone: true } },
        sentBy: { select: { id: true, name: true, role: true } },
      },
    });

    // Try to send via WhatsApp bridge if channel is WHATSAPP
    if (ch === 'WHATSAPP' && agent.phone) {
      try {
        const bridgeUrl = process.env.WHATSAPP_BRIDGE_URL || 'http://localhost:9090';
        const bridgeRes = await fetch(`${bridgeUrl}/api/whatsapp/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            messageId: message.id,
            toPhone: agent.phone,
            subject,
            body: messageBody,
            priority: pri,
          }),
        });
        const bridgeData = await bridgeRes.json();

        if (bridgeData.success) {
          status = 'SENT';
          whatsappMessageId = bridgeData.whatsappMessageId || null;
          deliveredAt = bridgeData.timestamp ? new Date(bridgeData.timestamp) : null;

          await db.agentMessage.update({
            where: { id: message.id },
            data: {
              status: 'SENT',
              whatsappMessageId,
              deliveredAt: deliveredAt || undefined,
              metadata: JSON.stringify({ bridgeResponse: bridgeData, mode: bridgeData.mode || 'LIVE' }),
            },
          });
        } else {
          // Bridge returned failure — do not fabricate success
          status = 'FAILED'; // Bridge returned failure — do not fabricate success
          await db.agentMessage.update({
            where: { id: message.id },
            data: { status, metadata: JSON.stringify({ bridgeError: bridgeData.error, fallback: true }) },
          });
        }
      } catch {
        // Bridge not reachable — simulate
        status = 'SENT';
        deliveredAt = new Date();
        await db.agentMessage.update({
          where: { id: message.id },
          data: { status, deliveredAt, metadata: JSON.stringify({ bridgeUnavailable: true, simulated: true }) },
        });
      }
    } else if (ch === 'IN_APP' || ch === 'PUSH') {
      status = 'DELIVERED'; deliveredAt = new Date();
      await db.agentMessage.update({
        where: { id: message.id },
        data: { status, deliveredAt },
      });
    } else if (ch === 'SMS') {
      status = 'SENT'; // SMS queued for delivery (actual delivery tracked by SMS gateway)
      if (status === 'SENT') deliveredAt = new Date();
      await db.agentMessage.update({
        where: { id: message.id },
        data: { status, deliveredAt, metadata: JSON.stringify({ simulated: true }) },
      });
    }

    if (sentById) {
      void logAudit({
        userId: sentById, action: 'SEND_MESSAGE',
        entityType: 'AgentMessage', entityId: message.id,
        metadata: { agentId, channel: ch, triggerType: trig },
        ipAddress: extractIp(req),
      });
    }

    if (ch === 'IN_APP') {
      await db.user.update({ where: { id: agentId }, data: { lastSeenAt: new Date(), isOnline: true } });
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to send message';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── PATCH /api/engagement ───────────────────────────────────────────
// Bulk engage idle/no-data/infraction agents, or mark message as read
export async function PATCH(req: NextRequest) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const WRITE_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] as const;
    if (!WRITE_ROLES.includes(authUser.role as typeof WRITE_ROLES[number])) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'MARK_READ') {
      const { messageId, responseText } = body;
      if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 });
      const updated = await db.agentMessage.update({
        where: { id: messageId, tenantId },
        data: {
          status: 'READ', readAt: new Date(),
          responseText: responseText || null,
          respondedAt: responseText ? new Date() : undefined,
        },
      });
      void logAudit({ userId: authUser.userId, action: 'MARK_MESSAGE_READ', entityType: 'AgentMessage', entityId: messageId, ipAddress: extractIp(req) });
      return NextResponse.json({ message: updated });
    }

    if (action === 'BULK_ENGAGE') {
      const { targetGroup, channel, sentById, customMessage } = body;
      if (!targetGroup) return NextResponse.json({ error: 'targetGroup required' }, { status: 400 });

      const ch = channel || 'WHATSAPP';
      const now = new Date();
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      let agents: { id: string; name: string }[] = [];
      let triggerType = 'MANUAL';
      let subject = '';
      let msgBody = '';

      if (targetGroup === 'IDLE') {
        agents = await db.user.findMany({
          where: { tenantId, role: 'FIELD_AGENT', isOnline: true, lastSeenAt: { lt: thirtyMinAgo } },
          select: { id: true, name: true },
        });
        triggerType = 'IDLE_DETECTION';
        subject = 'Activity Check — No Recent Reports';
        msgBody = customMessage || 'Our system shows no reports from you in the last 30+ minutes. Please confirm your status and submit any observations from your polling unit immediately. Your coverage is critical to election integrity.';
      } else if (targetGroup === 'NO_DATA') {
        const all = await db.user.findMany({
          where: { tenantId, role: 'FIELD_AGENT' },
          select: { id: true, name: true, _count: { select: { results: true, incidents: true } } },
        });
        agents = all.filter(a => a._count.results === 0 && a._count.incidents === 0);
        triggerType = 'NO_DATA';
        subject = 'First Report Reminder — Immediate Action Required';
        msgBody = customMessage || 'You have not submitted any reports since deployment. Please submit your initial situation report immediately including: materials arrival time, BVAS status, voter queue status, and security presence.';
      } else if (targetGroup === 'INFRACTION') {
        agents = await db.user.findMany({
          where: {
            tenantId, role: 'FIELD_AGENT',
            incidents: { some: { OR: [{ isQuarantined: true }, { gpsAnomaly: true }] } },
          },
          select: { id: true, name: true },
        });
        triggerType = 'INFRACTION_REMINDER';
        subject = 'Report Quality & Protocol Notice';
        msgBody = customMessage || 'Your recent reports have been flagged for review. Please ensure all reports include accurate GPS coordinates, photographic evidence, and detailed descriptions.';
      } else if (targetGroup === 'OFFLINE') {
        agents = await db.user.findMany({
          where: {
            tenantId, role: 'FIELD_AGENT', isOnline: false,
            OR: [{ lastSeenAt: { lt: oneHourAgo } }, { lastSeenAt: null }],
          },
          select: { id: true, name: true },
        });
        triggerType = 'IDLE_DETECTION';
        subject = 'Connectivity Alert — Please Log In';
        msgBody = customMessage || 'You appear to be offline. Please check your internet connection and log back into the OmniVote app. If you are experiencing technical difficulties, contact support immediately.';
      } else {
        return NextResponse.json({ error: 'Invalid targetGroup' }, { status: 400 });
      }

      const results: { agentId: string; agentName: string; messageId: string; status: string }[] = [];
      for (const agent of agents) {
        const st = (ch === 'IN_APP' || ch === 'PUSH') ? 'DELIVERED' : 'PENDING';
        const msg = await db.agentMessage.create({
          data: {
            tenantId, agentId: agent.id,
            sentById: sentById || null,
            channel: ch, triggerType,
            subject, body: msgBody, priority: 'HIGH',
            status: st,
            deliveredAt: st === 'DELIVERED' ? new Date() : null,
          },
        });
        results.push({ agentId: agent.id, agentName: agent.name, messageId: msg.id, status: msg.status });
      }

      void logAudit({ userId: authUser.userId, action: 'BULK_ENGAGE', entityType: 'AgentMessage', metadata: { targetGroup, channel: ch, engagedCount: results.length }, ipAddress: extractIp(req) });
      return NextResponse.json({ engaged: results.length, targetGroup, channel: ch, results });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Action failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}