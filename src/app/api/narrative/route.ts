import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';

// ─── Seed Data (auto-seeded once per tenant) ───────────────────────────

const SEED_KEY_MESSAGES = [
  { title: 'BVAS Accreditation Data Confirms Strong Turnout in South-West', body: 'Early BVAS accreditation figures from Lagos, Oyo, and Ogun show voter turnout exceeding 45% by midday. This aligns with our pre-election projections and suggests strong democratic participation in the region.', category: 'LEADING', priority: 1, isActive: true },
  { title: 'INEC Results Viewing Portal Performance Stable', body: 'The IReV portal has maintained 99.2% uptime since polls opened. Upload latency from northern states is within acceptable thresholds at 3.2 seconds average. No evidence of systematic manipulation.', category: 'LEADING', priority: 2, isActive: true },
  { title: 'Debunking: No Evidence of Mass Voter Intimidation in the South-East', body: 'Social media claims of widespread voter intimidation in Anambra and Enugu have been investigated by our field agents. Only 3 isolated incidents reported out of 4,200 polling units monitored. Claims are exaggerated and lack evidentiary support.', category: 'COUNTER', priority: 1, isActive: true },
  { title: 'Counter-Narrative: Vote Buying Allegations in Kano Lack Credible Evidence', body: 'While isolated reports of cash distribution near polling units in Kano Municipal have surfaced, our OSINT team has verified only 2 of 14 viral videos. The remainder are recycled content from 2019 and 2023 elections. Do not amplify unverified claims.', category: 'COUNTER', priority: 2, isActive: true },
  { title: 'Every Vote Counts — Protecting the Integrity of the Ballot', body: 'Nigerian democracy thrives when citizens exercise their franchise peacefully. Our 12,000+ field agents are deployed across the federation to ensure transparency. Stay vigilant, report incidents, and trust the process.', category: 'MOTIVATIONAL', priority: 1, isActive: true },
  { title: 'Security Forces Maintaining Neutrality — Confirmed by Field Reports', body: 'Across 1,847 polling units in the North-West zone, security personnel have maintained professional conduct. Only 2 incidents of partisan behavior reported, both under investigation. The narrative of widespread military interference is not supported by data.', category: 'LEADING', priority: 3, isActive: true },
  { title: 'Stand Firm — Your Vote is Your Voice', body: 'Despite attempts to sow despair through disinformation, turnout in the South-South region has been remarkable. Rivers and Delta states are reporting queues even after official closing time. Democracy prevails.', category: 'MOTIVATIONAL', priority: 2, isActive: false },
  { title: 'Clarification: BVAS Machine Failures Are Within Historical Norms', body: 'Reports of 47 BVAS machine failures across 176,846 polling units represent a 0.027% failure rate — consistent with INEC\'s technical preparedness assessment. Replacement machines were deployed within 45 minutes average response time.', category: 'COUNTER', priority: 3, isActive: true },
];

const SEED_TALKING_POINTS = [
  { body: 'BVAS accreditation rate in Lagos is tracking 8% higher than 2023 general elections.\n\nContext: Use when discussing voter enthusiasm in the South-West. Cite INEC\'s real-time accreditation dashboard as source.', priority: 1, isActive: true },
  { body: 'IReV upload completion rate is at 78% for polling units that have closed voting.\n\nContext: Highlights INEC\'s improved technological infrastructure compared to previous cycles.', priority: 2, isActive: true },
  { body: 'Only 12 out of 8,809 wards have reported any form of electoral violence.\n\nContext: Critical for pushing back against narratives of widespread electoral violence. Always qualify with "based on verified reports."', priority: 3, isActive: true },
  { body: 'The viral video claiming ballot box snatching in Abia is from 2019 — confirmed via C2PA metadata analysis.\n\nContext: Use when countering misinformation. Reference our OSINT team\'s verification pipeline and C2PA provenance check.', priority: 4, isActive: true },
  { body: 'Turnout in the North-East is lower than projected but within confidence intervals.\n\nContext: Frame as data observation, not alarm. Cite security situation in Borno and Yobe as contextual factors.', priority: 5, isActive: true },
  { body: 'No political party has filed a formal complaint with INEC as of 2pm on election day.\n\nContext: Strong signal of process credibility. Contrast with 2023 when multiple parties had filed by this time.', priority: 6, isActive: true },
  { body: 'International observer missions (EU, AU, ECOWAS) have issued no adverse preliminary statements.\n\nContext: Reinforces narrative of a well-conducted election. Useful for media engagements.', priority: 7, isActive: true },
  { body: 'Claims of INEC server compromise are technically unfounded — the IReV uses air-gapped transmission.\n\nContext: Technical counter-narrative for debunking hacking allegations. Coordinate with IT security team for detailed briefings.', priority: 8, isActive: true },
  { body: 'Nigerian youth engagement is at historic highs — 18-35 age group constitutes 52% of early voters.\n\nContext: Positive framing for social media. Pair with visuals of young voters at polling stations.', priority: 9, isActive: true },
  { body: 'PVC collection rate reached 89.4% — highest in Nigerian electoral history.\n\nContext: Baseline stat for all voter engagement narratives. Shows institutional progress by INEC.', priority: 10, isActive: false },
];

const SEED_TIMELINE = [
  { title: 'Pre-Election Briefing: Final Situation Assessment', description: 'All zones reported green status. 11,847 field agents confirmed deployed. BVAS devices tested and verified across all 176,846 polling units.', type: 'MILESTONE', timestamp: '2025-02-24T18:00:00.000Z' },
  { title: 'Polls Open — Nationwide', description: 'INEC confirmed polls opened at 8:30am local time across most polling units. Minor delays reported in 234 units due to late arrival of materials.', type: 'MILESTONE', timestamp: '2025-02-25T06:30:00.000Z' },
  { title: 'Disinformation Spike Detected: \"Pre-Filled Ballot Sheets\"', description: 'OSINT flagged coordinated social media campaign claiming pre-filled ballot sheets were discovered in Rivers State. Rapid response team deployed to verify.', type: 'INCIDENT_RESPONSE', timestamp: '2025-02-25T07:15:00.000Z' },
  { title: 'Strategy Shift: Amplify Turnout Narrative', description: 'Based on strong early accreditation numbers from the South-West and South-South, shifted primary narrative to emphasize high voter enthusiasm and democratic participation.', type: 'STRATEGY_SHIFT', timestamp: '2025-02-25T08:45:00.000Z' },
  { title: 'Security Incident: Thugs Disrupt Voting in Kano', description: 'Field agents reported 3 polling units in Kano Municipal LGA temporarily disrupted. Police rapid response deployed. Voting resumed within 30 minutes.', type: 'INCIDENT_RESPONSE', timestamp: '2025-02-25T09:20:00.000Z' },
  { title: 'Counter-Narrative Deployed: Debunking Kano Violence Claims', description: 'After verification, confirmed the Kano incident was isolated. Deployed counter-narrative emphasizing that 99.7% of polling units reported no incidents.', type: 'STRATEGY_SHIFT', timestamp: '2025-02-25T10:30:00.000Z' },
  { title: 'Midday Assessment: Election Progressing Smoothly', description: 'Comprehensive midday review shows 89% of polling units reporting active voting. 672 incidents reported nationwide, 89% classified as LOW severity.', type: 'MILESTONE', timestamp: '2025-02-25T12:00:00.000Z' },
];

async function seedNarrativeData(tenantId: string, userId: string): Promise<void> {
  await db.keyMessage.createMany({
    data: [
      ...SEED_KEY_MESSAGES.map(m => ({ tenantId, title: m.title, body: m.body, category: m.category, priority: m.priority, isActive: m.isActive, createdBy: userId })),
      ...SEED_TALKING_POINTS.map(tp => ({ tenantId, title: '', body: tp.body, category: 'TALKING_POINT', priority: tp.priority, isActive: tp.isActive, createdBy: userId })),
    ],
  });
  await db.narrativeTimeline.createMany({
    data: SEED_TIMELINE.map(t => ({ tenantId, title: t.title, description: t.description, type: t.type, timestamp: new Date(t.timestamp), createdBy: userId })),
  });
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

    // Auto-seed if empty
    const kmCount = await db.keyMessage.count({ where: { tenantId } });
    if (kmCount === 0) await seedNarrativeData(tenantId, authUser.userId);

    const allMessages = await db.keyMessage.findMany({
      where: { tenantId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    const timeline = await db.narrativeTimeline.findMany({
      where: { tenantId },
      orderBy: { timestamp: 'desc' },
    });

    const keyMessages = allMessages
      .filter(m => m.category !== 'TALKING_POINT')
      .map(m => ({ id: m.id, title: m.title, body: m.body, category: m.category, priority: m.priority, isActive: m.isActive, createdAt: m.createdAt.toISOString() }));

    const talkingPoints = allMessages
      .filter(m => m.category === 'TALKING_POINT' && m.isActive)
      .map(m => ({
        id: m.id,
        point: m.body.split('\n\nContext: ')[0] ?? m.body,
        category: 'LEADING',
        context: m.body.split('\n\nContext: ')[1] ?? '',
        isActive: m.isActive,
      }));

    const narrativeTimeline = timeline.map(t => ({
      id: t.id, timestamp: t.timestamp.toISOString(), title: t.title, description: t.description, type: t.type,
    }));

    return NextResponse.json({ keyMessages, talkingPoints, narrativeTimeline });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch narrative data' }, { status: 500 });
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

    if (!['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'].includes(authUser.role))
      return NextResponse.json({ error: 'Only admins and analysts can create key messages' }, { status: 403 });

    const body = await req.json();
    const { title, body: messageBody, category, priority } = body;
    if (!title || !messageBody || !category || priority === undefined)
      return NextResponse.json({ error: 'title, body, category, and priority are required' }, { status: 400 });
    if (!['LEADING', 'COUNTER', 'MOTIVATIONAL'].includes(category))
      return NextResponse.json({ error: 'Invalid category. Must be one of: LEADING, COUNTER, MOTIVATIONAL' }, { status: 400 });
    if (typeof priority !== 'number' || priority < 1 || priority > 10)
      return NextResponse.json({ error: 'priority must be a number between 1 and 10' }, { status: 400 });

    const message = await db.keyMessage.create({
      data: { tenantId, title, body: messageBody, category, priority, isActive: true, createdBy: authUser.userId },
    });

    return NextResponse.json({ success: true, message: { id: message.id, title: message.title, body: message.body, category: message.category, priority: message.priority, isActive: message.isActive, createdAt: message.createdAt.toISOString() } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create key message' }, { status: 500 });
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────

export async function PATCH(req: Request) {
  try {
    const { id: tenantId, error } = await resolveTenant(req);
    if (error) return error;
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const tenantErr = requireTenantMatch(authUser, tenantId);
    if (tenantErr) return tenantErr;

    if (!['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'].includes(authUser.role))
      return NextResponse.json({ error: 'Only admins and analysts can update key messages' }, { status: 403 });

    const body = await req.json();
    const { messageId, isActive } = body;
    if (!messageId || isActive === undefined)
      return NextResponse.json({ error: 'messageId and isActive are required' }, { status: 400 });
    if (typeof isActive !== 'boolean')
      return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });

    const existing = await db.keyMessage.findFirst({ where: { id: messageId, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    const updated = await db.keyMessage.update({ where: { id: messageId }, data: { isActive } });
    return NextResponse.json({ success: true, message: { id: updated.id, title: updated.title, body: updated.body, category: updated.category, priority: updated.priority, isActive: updated.isActive, createdAt: updated.createdAt.toISOString() } });
  } catch {
    return NextResponse.json({ error: 'Failed to update key message' }, { status: 500 });
  }
}
