import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenant } from '@/lib/tenant';
import { getAuthUser } from '@/lib/auth';
import { requireTenantMatch } from '@/lib/rbac';
import { logAudit, extractIp } from '@/lib/audit';

// ─── Seed Data (generic election content, dynamically timestamped) ───

function buildSeedKeyMessages(): Array<{ title: string; body: string; category: string; priority: number; isActive: boolean }> {
  return [
    { title: 'Accreditation Data Confirms Strong Early Turnout', body: 'Early accreditation figures from monitored polling units show voter turnout tracking above pre-election projections. This indicates strong democratic participation and well-organized election logistics.', category: 'LEADING', priority: 1, isActive: true },
    { title: 'Results Viewing Portal Performance Stable', body: 'The results viewing portal has maintained high uptime since polls opened. Upload latency from remote areas is within acceptable thresholds. No evidence of systematic manipulation detected.', category: 'LEADING', priority: 2, isActive: true },
    { title: 'Debunking: Claims of Widespread Voter Intimidation Are Exaggerated', body: 'Social media claims of widespread voter intimidation have been investigated by field agents. Only a small fraction of monitored polling units reported incidents. Most viral claims lack evidentiary support.', category: 'COUNTER', priority: 1, isActive: true },
    { title: 'Counter-Narrative: Vote Buying Allegations Lack Credible Evidence', body: 'While isolated reports of cash distribution near polling units have surfaced, verification teams confirmed only a minority of viral videos. The remainder are recycled content from previous elections.', category: 'COUNTER', priority: 2, isActive: true },
    { title: 'Every Vote Counts — Protecting the Integrity of the Ballot', body: 'Democracy thrives when citizens exercise their franchise peacefully. Field agents are deployed across all monitored areas to ensure transparency. Stay vigilant, report incidents, and trust the process.', category: 'MOTIVATIONAL', priority: 1, isActive: true },
    { title: 'Security Forces Maintaining Neutrality — Confirmed by Field Reports', body: 'Across monitored polling units, security personnel have maintained professional conduct. Only isolated incidents of partisan behavior reported. The narrative of widespread interference is not supported by data.', category: 'LEADING', priority: 3, isActive: true },
    { title: 'Stand Firm — Your Vote is Your Voice', body: 'Despite attempts to sow despair through disinformation, turnout in key areas has been remarkable. Voters are demonstrating commitment to the democratic process.', category: 'MOTIVATIONAL', priority: 2, isActive: false },
    { title: 'Clarification: Equipment Failures Within Historical Norms', body: 'Reports of equipment failures represent a small percentage of total deployed units. Replacement units were deployed within acceptable response times.', category: 'COUNTER', priority: 3, isActive: true },
  ];
}

function buildSeedTalkingPoints(): Array<{ body: string; priority: number; isActive: boolean }> {
  return [
    { body: 'Accreditation rate is tracking higher than previous election cycles.\n\nContext: Use when discussing voter enthusiasm.', priority: 1, isActive: true },
    { body: 'Results upload completion rate is progressing well for closed polling units.\n\nContext: Highlights improved technological infrastructure.', priority: 2, isActive: true },
    { body: 'Only a small fraction of monitored wards have reported electoral violence.\n\nContext: Critical for pushing back against narratives of widespread violence.', priority: 3, isActive: true },
    { body: 'A viral video claiming irregularities has been confirmed as recycled content from a previous election.\n\nContext: Use when countering misinformation.', priority: 4, isActive: true },
    { body: 'Turnout in some areas is lower than projected but within confidence intervals.\n\nContext: Frame as data observation, not alarm.', priority: 5, isActive: true },
    { body: 'No political party has filed a formal complaint as of midday on election day.\n\nContext: Strong signal of process credibility.', priority: 6, isActive: true },
    { body: 'International observer missions have issued no adverse preliminary statements.\n\nContext: Reinforces narrative of a well-conducted election.', priority: 7, isActive: true },
    { body: 'Claims of server compromise are technically unfounded.\n\nContext: Technical counter-narrative for debunking hacking allegations.', priority: 8, isActive: true },
    { body: 'Youth engagement is at historic highs.\n\nContext: Positive framing for social media.', priority: 9, isActive: true },
    { body: 'Voter registration rate reached a historic high.\n\nContext: Baseline stat for all voter engagement narratives.', priority: 10, isActive: false },
  ];
}

function buildSeedTimeline(): Array<{ title: string; description: string; type: string; timestamp: Date }> {
  const now = Date.now();
  return [
    { title: 'Pre-Election Briefing: Final Situation Assessment', description: 'All zones reported green status. Field agents confirmed deployed. Equipment tested and verified.', type: 'MILESTONE', timestamp: new Date(now - 12 * 3600_000) },
    { title: 'Polls Open', description: 'Election authority confirmed polls opened on time across most polling units. Minor delays reported in a small number of units.', type: 'MILESTONE', timestamp: new Date(now - 6 * 3600_000) },
    { title: 'Disinformation Spike Detected', description: 'OSINT flagged coordinated social media campaign making unverifiable claims. Rapid response team deployed.', type: 'INCIDENT_RESPONSE', timestamp: new Date(now - 5 * 3600_000) },
    { title: 'Strategy Shift: Amplify Turnout Narrative', description: 'Based on strong early accreditation numbers, shifted primary narrative to emphasize high voter enthusiasm.', type: 'STRATEGY_SHIFT', timestamp: new Date(now - 4 * 3600_000) },
    { title: 'Isolated Security Incident Reported', description: 'Field agents reported a polling unit disruption. Security response deployed. Voting resumed shortly after.', type: 'INCIDENT_RESPONSE', timestamp: new Date(now - 3 * 3600_000) },
    { title: 'Counter-Narrative Deployed', description: 'After verification, confirmed the incident was isolated. Deployed counter-narrative emphasizing that most polling units reported no incidents.', type: 'STRATEGY_SHIFT', timestamp: new Date(now - 2 * 3600_000) },
    { title: 'Midday Assessment: Election Progressing Smoothly', description: 'Comprehensive midday review shows strong percentage of polling units reporting active voting. Most incidents classified as LOW severity.', type: 'MILESTONE', timestamp: new Date(now - 1 * 3600_000) },
  ];
}

async function seedNarrativeData(tenantId: string, userId: string): Promise<void> {
  const keyMessages = buildSeedKeyMessages();
  const talkingPoints = buildSeedTalkingPoints();
  const timeline = buildSeedTimeline();

  await db.keyMessage.createMany({
    data: [
      ...keyMessages.map(m => ({ tenantId, title: m.title, body: m.body, category: m.category, priority: m.priority, isActive: m.isActive, createdBy: userId })),
      ...talkingPoints.map(tp => ({ tenantId, title: '', body: tp.body, category: 'TALKING_POINT', priority: tp.priority, isActive: tp.isActive, createdBy: userId })),
    ],
  });
  await db.narrativeTimeline.createMany({
    data: timeline.map(t => ({ tenantId, title: t.title, description: t.description, type: t.type, timestamp: t.timestamp, createdBy: userId })),
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

    void logAudit({ userId: authUser.userId, action: 'CREATE_KEY_MESSAGE', entityType: 'KeyMessage', entityId: message.id, metadata: { title, category, priority }, ipAddress: extractIp(req) });

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
    void logAudit({ userId: authUser.userId, action: 'UPDATE_KEY_MESSAGE', entityType: 'KeyMessage', entityId: messageId, metadata: { isActive }, ipAddress: extractIp(req) });
    return NextResponse.json({ success: true, message: { id: updated.id, title: updated.title, body: updated.body, category: updated.category, priority: updated.priority, isActive: updated.isActive, createdAt: updated.createdAt.toISOString() } });
  } catch {
    return NextResponse.json({ error: 'Failed to update key message' }, { status: 500 });
  }
}
