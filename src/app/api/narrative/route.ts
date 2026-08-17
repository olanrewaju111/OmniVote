import { NextResponse } from 'next/server';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';
import { randomUUID } from 'crypto';

// ─── Sample Data (Nigerian Presidential Election) ────────────────────────

const KEY_MESSAGES = [
  {
    id: 'km-001',
    title: 'BVAS Accreditation Data Confirms Strong Turnout in South-West',
    body: 'Early BVAS accreditation figures from Lagos, Oyo, and Ogun show voter turnout exceeding 45% by midday. This aligns with our pre-election projections and suggests strong democratic participation in the region.',
    category: 'LEADING' as const,
    priority: 1,
    isActive: true,
    createdAt: '2025-02-25T08:15:00.000Z',
  },
  {
    id: 'km-002',
    title: 'INEC Results Viewing Portal Performance Stable',
    body: 'The IReV portal has maintained 99.2% uptime since polls opened. Upload latency from northern states is within acceptable thresholds at 3.2 seconds average. No evidence of systematic manipulation.',
    category: 'LEADING' as const,
    priority: 2,
    isActive: true,
    createdAt: '2025-02-25T07:45:00.000Z',
  },
  {
    id: 'km-003',
    title: 'Debunking: No Evidence of Mass Voter Intimidation in the South-East',
    body: 'Social media claims of widespread voter intimidation in Anambra and Enugu have been investigated by our field agents. Only 3 isolated incidents reported out of 4,200 polling units monitored. Claims are exaggerated and lack evidentiary support.',
    category: 'COUNTER' as const,
    priority: 1,
    isActive: true,
    createdAt: '2025-02-25T09:30:00.000Z',
  },
  {
    id: 'km-004',
    title: 'Counter-Narrative: Vote Buying Allegations in Kano Lack Credible Evidence',
    body: 'While isolated reports of cash distribution near polling units in Kano Municipal have surfaced, our OSINT team has verified only 2 of 14 viral videos. The remainder are recycled content from 2019 and 2023 elections. Do not amplify unverified claims.',
    category: 'COUNTER' as const,
    priority: 2,
    isActive: true,
    createdAt: '2025-02-25T10:00:00.000Z',
  },
  {
    id: 'km-005',
    title: 'Every Vote Counts — Protecting the Integrity of the Ballot',
    body: 'Nigerian democracy thrives when citizens exercise their franchise peacefully. Our 12,000+ field agents are deployed across the federation to ensure transparency. Stay vigilant, report incidents, and trust the process.',
    category: 'MOTIVATIONAL' as const,
    priority: 1,
    isActive: true,
    createdAt: '2025-02-25T06:00:00.000Z',
  },
  {
    id: 'km-006',
    title: 'Security Forces Maintaining Neutrality — Confirmed by Field Reports',
    body: 'Across 1,847 polling units in the North-West zone, security personnel have maintained professional conduct. Only 2 incidents of partisan behavior reported, both under investigation. The narrative of widespread military interference is not supported by data.',
    category: 'LEADING' as const,
    priority: 3,
    isActive: true,
    createdAt: '2025-02-25T11:00:00.000Z',
  },
  {
    id: 'km-007',
    title: 'Stand Firm — Your Vote is Your Voice',
    body: 'Despite attempts to sow despair through disinformation, turnout in the South-South region has been remarkable. Rivers and Delta states are reporting queues even after official closing time. Democracy prevails.',
    category: 'MOTIVATIONAL' as const,
    priority: 2,
    isActive: false,
    createdAt: '2025-02-25T14:30:00.000Z',
  },
  {
    id: 'km-008',
    title: 'Clarification: BVAS Machine Failures Are Within Historical Norms',
    body: 'Reports of 47 BVAS machine failures across 176,846 polling units represent a 0.027% failure rate — consistent with INEC’s technical preparedness assessment. Replacement machines were deployed within 45 minutes average response time.',
    category: 'COUNTER' as const,
    priority: 3,
    isActive: true,
    createdAt: '2025-02-25T12:15:00.000Z',
  },
];

const TALKING_POINTS = [
  {
    id: 'tp-001',
    point: 'BVAS accreditation rate in Lagos is tracking 8% higher than 2023 general elections.',
    category: 'LEADING',
    context: 'Use when discussing voter enthusiasm in the South-West. Cite INEC’s real-time accreditation dashboard as source.',
    isActive: true,
  },
  {
    id: 'tp-002',
    point: 'IReV upload completion rate is at 78% for polling units that have closed voting.',
    category: 'LEADING',
    context: 'Highlights INEC’s improved technological infrastructure compared to previous cycles.',
    isActive: true,
  },
  {
    id: 'tp-003',
    point: 'Only 12 out of 8,809 wards have reported any form of electoral violence.',
    category: 'LEADING',
    context: 'Critical for pushing back against narratives of widespread electoral violence. Always qualify with “based on verified reports.”',
    isActive: true,
  },
  {
    id: 'tp-004',
    point: 'The viral video claiming ballot box snatching in Abia is from 2019 — confirmed via C2PA metadata analysis.',
    category: 'COUNTER',
    context: 'Use when countering misinformation. Reference our OSINT team’s verification pipeline and C2PA provenance check.',
    isActive: true,
  },
  {
    id: 'tp-005',
    point: 'Turnout in the North-East is lower than projected but within confidence intervals.',
    category: 'LEADING',
    context: 'Frame as data observation, not alarm. Cite security situation in Borno and Yobe as contextual factors.',
    isActive: true,
  },
  {
    id: 'tp-006',
    point: 'No political party has filed a formal complaint with INEC as of 2pm on election day.',
    category: 'LEADING',
    context: 'Strong signal of process credibility. Contrast with 2023 when multiple parties had filed by this time.',
    isActive: true,
  },
  {
    id: 'tp-007',
    point: 'International observer missions (EU, AU, ECOWAS) have issued no adverse preliminary statements.',
    category: 'LEADING',
    context: 'Reinforces narrative of a well-conducted election. Useful for media engagements.',
    isActive: true,
  },
  {
    id: 'tp-008',
    point: 'Claims of INEC server compromise are technically unfounded — the IReV uses air-gapped transmission.',
    category: 'COUNTER',
    context: 'Technical counter-narrative for debunking hacking allegations. Coordinate with IT security team for detailed briefings.',
    isActive: true,
  },
  {
    id: 'tp-009',
    point: 'Nigerian youth engagement is at historic highs — 18-35 age group constitutes 52% of early voters.',
    category: 'MOTIVATIONAL',
    context: 'Positive framing for social media. Pair with visuals of young voters at polling stations.',
    isActive: true,
  },
  {
    id: 'tp-010',
    point: 'PVC collection rate reached 89.4% — highest in Nigerian electoral history.',
    category: 'MOTIVATIONAL',
    context: 'Baseline stat for all voter engagement narratives. Shows institutional progress by INEC.',
    isActive: false,
  },
];

const NARRATIVE_TIMELINE = [
  {
    id: 'nt-001',
    timestamp: '2025-02-24T18:00:00.000Z',
    title: 'Pre-Election Briefing: Final Situation Assessment',
    description: 'All zones reported green status. 11,847 field agents confirmed deployed. BVAS devices tested and verified across all 176,846 polling units.',
    type: 'MILESTONE' as const,
  },
  {
    id: 'nt-002',
    timestamp: '2025-02-25T06:30:00.000Z',
    title: 'Polls Open — Nationwide',
    description: 'INEC confirmed polls opened at 8:30am local time across most polling units. Minor delays reported in 234 units due to late arrival of materials.',
    type: 'MILESTONE' as const,
  },
  {
    id: 'nt-003',
    timestamp: '2025-02-25T07:15:00.000Z',
    title: 'Disinformation Spike Detected: “Pre-Filled Ballot Sheets”',
    description: 'OSINT flagged coordinated social media campaign claiming pre-filled ballot sheets were discovered in Rivers State. Rapid response team deployed to verify. Investigation ongoing.',
    type: 'INCIDENT_RESPONSE' as const,
  },
  {
    id: 'nt-004',
    timestamp: '2025-02-25T08:45:00.000Z',
    title: 'Strategy Shift: Amplify Turnout Narrative',
    description: 'Based on strong early accreditation numbers from the South-West and South-South, shifted primary narrative to emphasize high voter enthusiasm and democratic participation.',
    type: 'STRATEGY_SHIFT' as const,
  },
  {
    id: 'nt-005',
    timestamp: '2025-02-25T09:20:00.000Z',
    title: 'Security Incident: Thugs Disrupt Voting in Kano',
    description: 'Field agents reported 3 polling units in Kano Municipal LGA temporarily disrupted. Police rapid response deployed. Voting resumed within 30 minutes. Narrative team prepared holding statement.',
    type: 'INCIDENT_RESPONSE' as const,
  },
  {
    id: 'nt-006',
    timestamp: '2025-02-25T10:30:00.000Z',
    title: 'Counter-Narrative Deployed: Debunking Kano Violence Claims',
    description: 'After verification, confirmed the Kano incident was isolated. Deployed counter-narrative across social channels emphasizing that 99.7% of polling units in the state reported no incidents.',
    type: 'STRATEGY_SHIFT' as const,
  },
  {
    id: 'nt-007',
    timestamp: '2025-02-25T12:00:00.000Z',
    title: 'Midday Assessment: Election Progressing Smoothly',
    description: 'Comprehensive midday review shows 89% of polling units reporting active voting. 672 incidents reported nationwide, 89% classified as LOW severity. IReV functioning normally.',
    type: 'MILESTONE' as const,
  },
];

// In-memory store for created messages (simulates DB persistence)
const createdMessages = new Map<string, (typeof KEY_MESSAGES)[number]>();

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

    // Merge sample data with any created messages
    const allMessages = [...KEY_MESSAGES, ...Array.from(createdMessages.values())];

    return NextResponse.json({
      keyMessages: allMessages,
      talkingPoints: TALKING_POINTS,
      narrativeTimeline: NARRATIVE_TIMELINE,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch narrative data' }, { status: 500 });
  }
}

// ─── POST — Create a new key message ─────────────────────────────────────

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

    // Only TENANT_ADMIN and ANALYST can create key messages
    if (!['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Only admins and analysts can create key messages' }, { status: 403 });
    }

    const body = await req.json();
    const { title, body: messageBody, category, priority } = body;

    if (!title || !messageBody || !category || priority === undefined) {
      return NextResponse.json({ error: 'title, body, category, and priority are required' }, { status: 400 });
    }

    const validCategories = ['LEADING', 'COUNTER', 'MOTIVATIONAL'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 },
      );
    }

    if (typeof priority !== 'number' || priority < 1 || priority > 10) {
      return NextResponse.json({ error: 'priority must be a number between 1 and 10' }, { status: 400 });
    }

    const newMessage = {
      id: `km-${randomUUID().slice(0, 8)}`,
      title,
      body: messageBody,
      category: category as 'LEADING' | 'COUNTER' | 'MOTIVATIONAL',
      priority,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    createdMessages.set(newMessage.id, newMessage);

    return NextResponse.json({ success: true, message: newMessage }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create key message' }, { status: 500 });
  }
}

// ─── PATCH — Toggle message active state ─────────────────────────────────

export async function PATCH(req: Request) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    if (!['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Only admins and analysts can update key messages' }, { status: 403 });
    }

    const body = await req.json();
    const { messageId, isActive } = body;

    if (!messageId || isActive === undefined) {
      return NextResponse.json({ error: 'messageId and isActive are required' }, { status: 400 });
    }

    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
    }

    // Look up in created messages first, then in sample data
    const created = createdMessages.get(messageId);
    if (created) {
      created.isActive = isActive;
      return NextResponse.json({ success: true, message: created });
    }

    const sample = KEY_MESSAGES.find((m) => m.id === messageId);
    if (!sample) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const updated = { ...sample, isActive };
    createdMessages.set(messageId, updated);

    return NextResponse.json({ success: true, message: updated });
  } catch {
    return NextResponse.json({ error: 'Failed to update key message' }, { status: 500 });
  }
}
