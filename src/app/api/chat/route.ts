import { NextResponse } from 'next/server';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';
import { randomUUID } from 'crypto';

// ─── Sample Chat Messages ───────────────────────────────────────────────

const SAMPLE_MESSAGES = [
  {
    id: 'chat-001',
    senderId: 'usr-sys-01',
    senderName: 'System',
    senderRole: 'SYSTEM',
    body: '🔔 Election Day operations activated. All teams are now on monitored status. Field agents in 36 states + FCT are reporting in.',
    createdAt: '2025-02-25T06:00:00.000Z',
    isSystem: true,
  },
  {
    id: 'chat-002',
    senderId: 'usr-admin-01',
    senderName: 'Amina Bello',
    senderRole: 'TENANT_ADMIN',
    body: 'Good morning everyone. Situation Room is live. Priority today: real-time incident tracking and rapid narrative response. Stay sharp.',
    createdAt: '2025-02-25T06:05:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-003',
    senderId: 'usr-analyst-01',
    senderName: 'Chidi Okonkwo',
    senderRole: 'ANALYST',
    body: 'OSINT team is up. We\'re tracking 47 social media keywords across X, Facebook, WhatsApp, and Telegram. First spike detected: #NigeriaDecides is trending at #1 nationally.',
    createdAt: '2025-02-25T06:12:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-004',
    senderId: 'usr-field-01',
    senderName: 'Emeka Nwosu',
    senderRole: 'FIELD_AGENT',
    body: 'Anambra zone reporting in. 340 of 348 polling units confirmed operational. 8 units in Awka South have delayed opening — INEC officials cite late material deployment.',
    createdAt: '2025-02-25T07:30:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-005',
    senderId: 'usr-ts-01',
    senderName: 'Fatima Yusuf',
    senderRole: 'TRUST_SAFETY',
    body: '⚠️ Flagged: Viral video claiming ballot box snatching in Abia State. Running C2PA metadata check now. Preliminary analysis suggests this may be recycled 2019 content. Do NOT amplify until verified.',
    createdAt: '2025-02-25T07:45:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-006',
    senderId: 'usr-analyst-01',
    senderName: 'Chidi Okonkwo',
    senderRole: 'ANALYST',
    body: 'BVAS accreditation dashboard showing strong numbers in Lagos — 38% of registered voters accredited by 9am. That\'s ahead of 2023 pace by about 6 percentage points.',
    createdAt: '2025-02-25T08:15:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-007',
    senderId: 'usr-field-02',
    senderName: 'Babatunde Adeyemi',
    senderRole: 'FIELD_AGENT',
    body: 'Lagos Island LCDA — long queues at PU 034. BVAS functioning normally. Estimated wait time: 2.5 hours. Voters are patient and orderly.',
    createdAt: '2025-02-25T08:30:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-008',
    senderId: 'usr-ts-01',
    senderName: 'Fatima Yusuf',
    senderRole: 'TRUST_SAFETY',
    body: 'CONFIRMED: The Abia video is from 2019. C2PA provenance data shows original capture date of Feb 23, 2019. We\'ve flagged it for platform removal requests.',
    createdAt: '2025-02-25T08:50:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-009',
    senderId: 'usr-field-03',
    senderName: 'Hauwa Ibrahim',
    senderRole: 'FIELD_AGENT',
    body: 'Kano Municipal — 3 polling units temporarily disrupted by suspected political thugs. Police RRS deployed. Voting resumed at PU 012 and PU 045 after 25 minutes. PU 078 still being secured.',
    createdAt: '2025-02-25T09:20:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-010',
    senderId: 'usr-admin-01',
    senderName: 'Amina Bello',
    senderRole: 'TENANT_ADMIN',
    body: '@Hauwa thanks for the rapid report. Please file a formal incident via the app so we can track it. @Fatima — can we get a rapid narrative out on the Kano situation before it gets distorted online?',
    createdAt: '2025-02-25T09:25:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-011',
    senderId: 'usr-ts-01',
    senderName: 'Fatima Yusuf',
    senderRole: 'TRUST_SAFETY',
    body: 'On it. Drafting holding statement now. Key angle: 3 out of 8,847 wards affected. That\'s 0.03%. We frame as isolated, swiftly resolved, and not representative of the overall process.',
    createdAt: '2025-02-25T09:30:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-012',
    senderId: 'usr-analyst-01',
    senderName: 'Chidi Okonkwo',
    senderRole: 'ANALYST',
    body: 'IReV upload rate looking healthy — 62% of closed PUs have uploaded results. Latency is averaging 2.8 seconds. This is significantly better than 2023 at the same point.',
    createdAt: '2025-02-25T10:00:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-013',
    senderId: 'usr-field-04',
    senderName: 'Obinna Eze',
    senderRole: 'FIELD_AGENT',
    body: 'Rivers State update: Port Harcourt City LGA — voting peaceful so far. Turnout appears moderate. One BVAS malfunction at PU 089 in Ward 14, replacement unit arrived in 32 minutes.',
    createdAt: '2025-02-25T10:15:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-014',
    senderId: 'usr-admin-01',
    senderName: 'Amina Bello',
    senderRole: 'TENANT_ADMIN',
    body: 'Midday sitrep in 30 minutes. All zonal leads please prepare your summaries. Focus areas: turnout trends, incident counts by severity, and any emerging disinformation themes.',
    createdAt: '2025-02-25T11:30:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-015',
    senderId: 'usr-field-05',
    senderName: 'Abdullahi Musa',
    senderRole: 'FIELD_AGENT',
    body: 'Borno State — Maiduguri MMC. Turnout is lower than expected due to security concerns in some outskirts. However, polling units in GRA and downtown areas are seeing decent queues. Military escort for electoral officials is working well.',
    createdAt: '2025-02-25T11:45:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-016',
    senderId: 'usr-ts-01',
    senderName: 'Fatima Yusuf',
    senderRole: 'TRUST_SAFETY',
    body: 'New coordinated inauthentic behavior detected: 23 accounts on X pushing the narrative that INEC has "shut down the IReV server." This is false — we can confirm the server is operational. Reporting to X Trust & Safety.',
    createdAt: '2025-02-25T12:00:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-017',
    senderId: 'usr-analyst-01',
    senderName: 'Chidi Okonkwo',
    senderRole: 'ANALYST',
    body: 'Quick PVT update from our parallel vote tabulation in Oyo, Edo, and FCT. Early numbers are still within our pre-election model\'s confidence interval. Nothing anomalous yet. Will have more data after 2pm when more PUs close.',
    createdAt: '2025-02-25T12:30:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-018',
    senderId: 'usr-field-02',
    senderName: 'Babatunde Adeyemi',
    senderRole: 'FIELD_AGENT',
    body: 'Lagos update: Polls are closing at PU 034. BVAS accreditation final count: 847 out of 1,200 registered. That\'s 70.6% turnout. Result sheet is being posted publicly now. Photos uploading.',
    createdAt: '2025-02-25T13:05:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-019',
    senderId: 'usr-admin-01',
    senderName: 'Amina Bello',
    senderRole: 'TENANT_ADMIN',
    body: 'Excellent work from everyone so far. Keeping this channel focused on operational updates. Social media engagement and public comms go to the #narrative channel. Continue to file formal incidents for anything above LOW severity.',
    createdAt: '2025-02-25T13:15:00.000Z',
    isSystem: false,
  },
  {
    id: 'chat-020',
    senderId: 'usr-field-03',
    senderName: 'Hauwa Ibrahim',
    senderRole: 'FIELD_AGENT',
    body: 'Kano update: PU 078 has resumed voting. Total disruption was 45 minutes. Filed incident INC-2025-0447. No injuries reported. Voters who were in queue were allowed to vote after accreditation verification.',
    createdAt: '2025-02-25T13:30:00.000Z',
    isSystem: false,
  },
];

const ONLINE_USERS = [
  { id: 'usr-admin-01', name: 'Amina Bello', role: 'TENANT_ADMIN', isOnline: true },
  { id: 'usr-analyst-01', name: 'Chidi Okonkwo', role: 'ANALYST', isOnline: true },
  { id: 'usr-ts-01', name: 'Fatima Yusuf', role: 'TRUST_SAFETY', isOnline: true },
  { id: 'usr-field-01', name: 'Emeka Nwosu', role: 'FIELD_AGENT', isOnline: true },
  { id: 'usr-field-02', name: 'Babatunde Adeyemi', role: 'FIELD_AGENT', isOnline: true },
  { id: 'usr-field-03', name: 'Hauwa Ibrahim', role: 'FIELD_AGENT', isOnline: true },
  { id: 'usr-field-04', name: 'Obinna Eze', role: 'FIELD_AGENT', isOnline: true },
  { id: 'usr-field-05', name: 'Abdullahi Musa', role: 'FIELD_AGENT', isOnline: true },
  { id: 'usr-analyst-02', name: 'Tunde Bakare', role: 'ANALYST', isOnline: false },
  { id: 'usr-field-06', name: 'Grace Okon', role: 'FIELD_AGENT', isOnline: true },
  { id: 'usr-ts-02', name: 'Musa Aliyu', role: 'TRUST_SAFETY', isOnline: false },
];

// In-memory store for new messages
const newMessages: Array<{
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  body: string;
  createdAt: string;
  isSystem: boolean;
}> = [];

// ─── GET ─────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const url = new URL(req.url || '', 'http://localhost');
    const since = url.searchParams.get('since');

    // Combine sample and new messages
    const allMessages = [...SAMPLE_MESSAGES, ...newMessages];

    // Filter by `since` timestamp if provided (delta sync)
    const filteredMessages = since
      ? allMessages.filter((m) => new Date(m.createdAt) > new Date(since))
      : allMessages;

    // Sort by creation time
    filteredMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return NextResponse.json({
      messages: filteredMessages,
      onlineUsers: ONLINE_USERS,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch chat data' }, { status: 500 });
  }
}

// ─── POST — Send a new message ──────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    const body = await req.json();
    const { body: messageBody } = body;

    if (!messageBody || typeof messageBody !== 'string' || messageBody.trim().length === 0) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
    }

    if (messageBody.length > 2000) {
      return NextResponse.json({ error: 'Message body must not exceed 2000 characters' }, { status: 400 });
    }

    const message = {
      id: `chat-${randomUUID().slice(0, 8)}`,
      senderId: authUser.userId,
      senderName: authUser.email.split('@')[0], // fallback name from email
      senderRole: authUser.role,
      body: messageBody.trim(),
      createdAt: new Date().toISOString(),
      isSystem: false,
    };

    newMessages.push(message);

    return NextResponse.json({ success: true, message }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
