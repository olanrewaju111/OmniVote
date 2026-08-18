import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';
import { broadcastChat } from '@/lib/ws-broadcast';

// ─── Seed Messages (auto-seeded once per tenant when chat is empty) ──────

const SEED_MESSAGES = [
  { senderRole: 'SYSTEM', body: '🔔 Election Day operations activated. All teams are now on monitored status. Field agents in 36 states + FCT are reporting in.', createdAt: '2025-02-25T06:00:00.000Z', isSystem: true },
  { senderRole: 'TENANT_ADMIN', body: 'Good morning everyone. Situation Room is live. Priority today: real-time incident tracking and rapid narrative response. Stay sharp.', createdAt: '2025-02-25T06:05:00.000Z', isSystem: false },
  { senderRole: 'ANALYST', body: "OSINT team is up. We're tracking 47 social media keywords across X, Facebook, WhatsApp, and Telegram. First spike detected: #NigeriaDecides is trending at #1 nationally.", createdAt: '2025-02-25T06:12:00.000Z', isSystem: false },
  { senderRole: 'FIELD_AGENT', body: 'Anambra zone reporting in. 340 of 348 polling units confirmed operational. 8 units in Awka South have delayed opening — INEC officials cite late material deployment.', createdAt: '2025-02-25T07:30:00.000Z', isSystem: false },
  { senderRole: 'TRUST_SAFETY', body: '⚠️ Flagged: Viral video claiming ballot box snatching in Abia State. Running C2PA metadata check now. Preliminary analysis suggests this may be recycled 2019 content. Do NOT amplify until verified.', createdAt: '2025-02-25T07:45:00.000Z', isSystem: false },
  { senderRole: 'ANALYST', body: "BVAS accreditation dashboard showing strong numbers in Lagos — 38% of registered voters accredited by 9am. That's ahead of 2023 pace by about 6 percentage points.", createdAt: '2025-02-25T08:15:00.000Z', isSystem: false },
  { senderRole: 'FIELD_AGENT', body: 'Lagos Island LCDA — long queues at PU 034. BVAS functioning normally. Estimated wait time: 2.5 hours. Voters are patient and orderly.', createdAt: '2025-02-25T08:30:00.000Z', isSystem: false },
  { senderRole: 'TRUST_SAFETY', body: "CONFIRMED: The Abia video is from 2019. C2PA provenance data shows original capture date of Feb 23, 2019. We've flagged it for platform removal requests.", createdAt: '2025-02-25T08:50:00.000Z', isSystem: false },
  { senderRole: 'FIELD_AGENT', body: 'Kano Municipal — 3 polling units temporarily disrupted by suspected political thugs. Police RRS deployed. Voting resumed at PU 012 and PU 045 after 25 minutes. PU 078 still being secured.', createdAt: '2025-02-25T09:20:00.000Z', isSystem: false },
  { senderRole: 'TENANT_ADMIN', body: '@Hauwa thanks for the rapid report. Please file a formal incident via the app so we can track it. @Fatima — can we get a rapid narrative out on the Kano situation before it gets distorted online?', createdAt: '2025-02-25T09:25:00.000Z', isSystem: false },
  { senderRole: 'TRUST_SAFETY', body: "On it. Drafting holding statement now. Key angle: 3 out of 8,847 wards affected. That's 0.03%. We frame as isolated, swiftly resolved, and not representative of the overall process.", createdAt: '2025-02-25T09:30:00.000Z', isSystem: false },
  { senderRole: 'ANALYST', body: 'IReV upload rate looking healthy — 62% of closed PUs have uploaded results. Latency is averaging 2.8 seconds. This is significantly better than 2023 at the same point.', createdAt: '2025-02-25T10:00:00.000Z', isSystem: false },
  { senderRole: 'FIELD_AGENT', body: 'Rivers State update: Port Harcourt City LGA — voting peaceful so far. Turnout appears moderate. One BVAS malfunction at PU 089 in Ward 14, replacement unit arrived in 32 minutes.', createdAt: '2025-02-25T10:15:00.000Z', isSystem: false },
  { senderRole: 'TENANT_ADMIN', body: 'Midday sitrep in 30 minutes. All zonal leads please prepare your summaries. Focus areas: turnout trends, incident counts by severity, and any emerging disinformation themes.', createdAt: '2025-02-25T11:30:00.000Z', isSystem: false },
  { senderRole: 'FIELD_AGENT', body: 'Borno State — Maiduguri MMC. Turnout is lower than expected due to security concerns in some outskirts. However, polling units in GRA and downtown areas are seeing decent queues. Military escort for electoral officials is working well.', createdAt: '2025-02-25T11:45:00.000Z', isSystem: false },
  { senderRole: 'TRUST_SAFETY', body: 'New coordinated inauthentic behavior detected: 23 accounts on X pushing the narrative that INEC has \"shut down the IReV server.\" This is false — we can confirm the server is operational. Reporting to X Trust & Safety.', createdAt: '2025-02-25T12:00:00.000Z', isSystem: false },
  { senderRole: 'ANALYST', body: "Quick PVT update from our parallel vote tabulation in Oyo, Edo, and FCT. Early numbers are still within our pre-election model's confidence interval. Nothing anomalous yet. Will have more data after 2pm when more PUs close.", createdAt: '2025-02-25T12:30:00.000Z', isSystem: false },
  { senderRole: 'FIELD_AGENT', body: "Lagos update: Polls are closing at PU 034. BVAS accreditation final count: 847 out of 1,200 registered. That's 70.6% turnout. Result sheet is being posted publicly now. Photos uploading.", createdAt: '2025-02-25T13:05:00.000Z', isSystem: false },
  { senderRole: 'TENANT_ADMIN', body: 'Excellent work from everyone so far. Keeping this channel focused on operational updates. Social media engagement and public comms go to the #narrative channel. Continue to file formal incidents for anything above LOW severity.', createdAt: '2025-02-25T13:15:00.000Z', isSystem: false },
  { senderRole: 'FIELD_AGENT', body: 'Kano update: PU 078 has resumed voting. Total disruption was 45 minutes. Filed incident INC-2025-0447. No injuries reported. Voters who were in queue were allowed to vote after accreditation verification.', createdAt: '2025-02-25T13:30:00.000Z', isSystem: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

async function resolveSenderForRole(tenantId: string, role: string): Promise<string> {
  const user = await db.user.findFirst({ where: { tenantId, role }, select: { id: true } });
  if (user) return user.id;
  const anyUser = await db.user.findFirst({ where: { tenantId }, select: { id: true } });
  return anyUser?.id ?? '';
}

async function seedChatMessages(tenantId: string): Promise<void> {
  const roleCache = new Map<string, string>();
  async function getSenderId(role: string): Promise<string> {
    if (roleCache.has(role)) return roleCache.get(role)!;
    const id = await resolveSenderForRole(tenantId, role);
    roleCache.set(role, id);
    return id;
  }
  const records = await Promise.all(
    SEED_MESSAGES.map(async (msg) => ({
      tenantId,
      senderId: await getSenderId(msg.senderRole),
      body: msg.body,
      isSystem: msg.isSystem,
      createdAt: new Date(msg.createdAt),
    })),
  );
  await db.chatMessage.createMany({ data: records });
}

// ─── GET ─────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const url = new URL(req.url || '', 'http://localhost');
    const since = url.searchParams.get('since');

    // Auto-seed if empty
    const count = await db.chatMessage.count({ where: { tenantId } });
    if (count === 0) await seedChatMessages(tenantId);

    const where: Record<string, unknown> = { tenantId };
    if (since) where.createdAt = { gt: new Date(since) };

    const messages = await db.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: { sender: { select: { id: true, name: true, role: true, isOnline: true } } },
    });

    const onlineUsers = await db.user.findMany({
      where: { tenantId, isOnline: true },
      select: { id: true, name: true, role: true, isOnline: true },
    });

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id, senderId: m.senderId, senderName: m.sender.name,
        senderRole: m.sender.role, body: m.body,
        createdAt: m.createdAt.toISOString(), isSystem: m.isSystem,
      })),
      onlineUsers,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch chat data' }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const body = await req.json();
    const { body: messageBody } = body;
    if (!messageBody || typeof messageBody !== 'string' || messageBody.trim().length === 0)
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
    if (messageBody.length > 2000)
      return NextResponse.json({ error: 'Message body must not exceed 2000 characters' }, { status: 400 });

    const message = await db.chatMessage.create({
      data: { tenantId, senderId: authUser.userId, body: messageBody.trim(), isSystem: false },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });

    const msg = {
      id: message.id, senderId: message.senderId, senderName: message.sender.name,
      senderRole: message.sender.role, body: message.body,
      createdAt: message.createdAt.toISOString(), isSystem: message.isSystem,
    };

    // Broadcast via WebSocket for real-time delivery
    broadcastChat(tenantId, 'new_message', msg).catch(() => {});

    return NextResponse.json({ success: true, message: msg }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
