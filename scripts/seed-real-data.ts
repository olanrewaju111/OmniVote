/**
 * Comprehensive real-data seeder for OmniVote testing
 * Populates empty tables and enriches existing data with realistic Nigerian election context.
 * 
 * Tables populated:
 *   - AuditLog (~200 entries)
 *   - AgentMessage (~250 WhatsApp messages)
 *   - CampaignMessage (~150 campaign SMS/WhatsApp dispatches)
 *   - Additional realistic incidents (enriched descriptions, media URLs)
 *   - Additional alerts with richer content
 *   - More polling units with real Nigerian locations
 *   - Agent check-ins with realistic patterns
 */
import { PrismaClient, Prisma } from '@prisma/client';

const db = new PrismaClient();

// ─── Nigerian realistic data pools ───────────────────────────────────────────

const NIGERIAN_STATES = [
  { state: 'Lagos', lga: 'Lagos Island', lat: 6.4541, lng: 3.3947 },
  { state: 'Lagos', lga: 'Eti-Osa', lat: 6.4350, lng: 3.4800 },
  { state: 'Lagos', lga: 'Ikeja', lat: 6.5954, lng: 3.3420 },
  { state: 'Lagos', lga: 'Surulere', lat: 6.4900, lng: 3.3510 },
  { state: 'Lagos', lga: 'Alimosho', lat: 6.6000, lng: 3.2800 },
  { state: 'Lagos', lga: 'Kosofe', lat: 6.5500, lng: 3.3700 },
  { state: 'Lagos', lga: 'Agege', lat: 6.6200, lng: 3.3300 },
  { state: 'Lagos', lga: 'Ifako-Ijaiye', lat: 6.6300, lng: 3.3500 },
  { state: 'Abuja', lga: 'Municipal Area Council', lat: 9.0579, lng: 7.4951 },
  { state: 'Abuja', lga: 'Bwari', lat: 9.2500, lng: 7.3000 },
  { state: 'Abuja', lga: 'Gwagwalada', lat: 8.9500, lng: 7.0500 },
  { state: 'Abuja', lga: 'Kuje', lat: 8.8900, lng: 7.2200 },
  { state: 'Rivers', lga: 'Port Harcourt', lat: 4.8156, lng: 7.0498 },
  { state: 'Rivers', lga: 'Obio-Akpor', lat: 4.8300, lng: 7.0200 },
  { state: 'Rivers', lga: 'Eleme', lat: 4.7700, lng: 7.0800 },
  { state: 'Kano', lga: 'Kano Municipal', lat: 12.0022, lng: 8.5920 },
  { state: 'Kano', lga: 'Nassarawa', lat: 12.0300, lng: 8.5500 },
  { state: 'Kano', lga: 'Fagge', lat: 12.0000, lng: 8.5800 },
  { state: 'Oyo', lga: 'Ibadan North', lat: 7.3900, lng: 3.9000 },
  { state: 'Oyo', lga: 'Ibadan South', lat: 7.3700, lng: 3.9100 },
  { state: 'Enugu', lga: 'Enugu North', lat: 6.4400, lng: 7.5000 },
  { state: 'Enugu', lga: 'Enugu South', lat: 6.4200, lng: 7.4800 },
  { state: 'Kaduna', lga: 'Kaduna North', lat: 10.6100, lng: 7.4300 },
  { state: 'Kaduna', lga: 'Kaduna South', lat: 10.5700, lng: 7.4400 },
  { state: 'Delta', lga: 'Warri South', lat: 5.5200, lng: 5.7500 },
  { state: 'Delta', lga: 'Asaba', lat: 6.2000, lng: 6.7300 },
  { state: 'Anambra', lga: 'Awka South', lat: 6.2100, lng: 7.0700 },
  { state: 'Anambra', lga: 'Onitsha North', lat: 6.1600, lng: 6.7800 },
  { state: 'Borno', lga: 'Maiduguri', lat: 11.8400, lng: 13.1500 },
  { state: 'Borno', lga: 'Jere', lat: 11.9000, lng: 13.1000 },
];

const PHONE_PREFIXES = ['0802','0803','0804','0805','0806','0807','0808','0809','0810','0811','0812','0813','0814','0815','0816','0817','0818','0901','0902','0903','0905','0906','0907','0908','0909','0912','0913','0915','0916','0701','0702','0703','0704','0705','0706','0707','0708','0709','0911'];

function randomPhone(): string {
  const prefix = PHONE_PREFIXES[Math.floor(Math.random() * PHONE_PREFIXES.length)];
  const suffix = String(Math.floor(Math.random() * 10000000)).padStart(7, '0');
  return '+234' + prefix.slice(1) + suffix;
}

function randomIp(): string {
  return `${Math.floor(Math.random()*223)+1}.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*256)}`;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(randomInt(6, 22), randomInt(0, 59), randomInt(0, 59));
  return d;
}

function hoursAgo(hours: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  d.setMinutes(randomInt(0, 59), randomInt(0, 59));
  return d;
}

// ─── Seeding functions ──────────────────────────────────────────────────────

async function seedAuditLogs() {
  console.log('Seeding AuditLog...');
  
  const users = await db.user.findMany({ select: { id: true, name: true, role: true, tenantId: true } });
  const tenantAdmins = users.filter(u => u.role === 'TENANT_ADMIN' || u.role === 'SUPER_ADMIN');
  const allUsers = users;

  const actions: { action: string; entityType?: string; desc: (u: typeof users[0]) => string }[] = [
    { action: 'USER_LOGIN', desc: u => `${u.name} logged in successfully` },
    { action: 'USER_LOGIN', desc: u => `${u.name} authenticated via mobile device` },
    { action: 'USER_LOGOUT', desc: u => `${u.name} ended session` },
    { action: 'INCIDENT_CREATE', entityType: 'Incident', desc: u => `${u.name} submitted a new incident report` },
    { action: 'INCIDENT_REVIEW', entityType: 'Incident', desc: u => `${u.name} reviewed and escalated an incident` },
    { action: 'INCIDENT_DISMISS', entityType: 'Incident', desc: u => `${u.name} dismissed a false-positive incident` },
    { action: 'INCIDENT_QUARANTINE', entityType: 'Incident', desc: u => `${u.name} quarantined a suspicious submission` },
    { action: 'ALERT_ACKNOWLEDGE', entityType: 'Alert', desc: u => `${u.name} acknowledged a security alert` },
    { action: 'ALERT_READ', entityType: 'Alert', desc: u => `${u.name} read operational alert` },
    { action: 'AGENT_CHECKIN', entityType: 'AgentCheckIn', desc: u => `${u.name} checked into assigned polling unit` },
    { action: 'AGENT_CHECKOUT', entityType: 'AgentCheckIn', desc: u => `${u.name} checked out from polling unit` },
    { action: 'USER_CREATE', entityType: 'User', desc: u => `${u.name} created a new field agent account` },
    { action: 'USER_UPDATE', entityType: 'User', desc: u => `${u.name} updated agent profile information` },
    { action: 'USER_LOCK', entityType: 'User', desc: u => `${u.name} locked a user account due to suspicious activity` },
    { action: 'USER_UNLOCK', entityType: 'User', desc: u => `${u.name} unlocked a user account` },
    { action: 'TENANT_UPDATE', entityType: 'Tenant', desc: u => `${u.name} updated tenant configuration settings` },
    { action: 'GEOFENCE_CREATE', entityType: 'GeofenceZone', desc: u => `${u.name} created a new geofence zone` },
    { action: 'CAMPAIGN_CREATE', entityType: 'Campaign', desc: u => `${u.name} launched a new voter awareness campaign` },
    { action: 'CAMPAIGN_SEND', entityType: 'CampaignMessage', desc: u => `${u.name} dispatched campaign messages to contact list` },
    { action: 'EXPORT_DATA', desc: u => `${u.name} exported incident report data` },
    { action: 'VIEW_DASHBOARD', desc: u => `${u.name} accessed the analytics dashboard` },
    { action: 'PASSWORD_CHANGE', entityType: 'User', desc: u => `${u.name} changed account password` },
    { action: 'SETTINGS_UPDATE', desc: u => `${u.name} modified system settings` },
    { action: 'PVT_SUBMIT', entityType: 'PvtSubmission', desc: u => `${u.name} submitted a parallel vote tabulation entry` },
    { action: 'RESULT_UPLOAD', entityType: 'ElectionResult', desc: u => `${u.name} uploaded polling unit results` },
    { action: 'DEAD_MANS_SWITCH_ACTIVATE', entityType: 'DeadMansSwitch', desc: u => `Dead man's switch triggered for ${u.name}` },
    { action: 'HONEYPOT_ALERT', entityType: 'HoneypotUnit', desc: u => `Honeypot polling unit flagged for ${u.name}` },
    { action: 'EVIDENCE_UPLOAD', entityType: 'EvidenceDossier', desc: u => `${u.name} uploaded evidence to incident dossier` },
    { action: 'STEGO_SCAN', entityType: 'StegoScanResult', desc: u => `${u.name} initiated steganography scan on media` },
  ];

  const auditEntries: Prisma.AuditLogCreateManyInput[] = [];
  
  for (let i = 0; i < 200; i++) {
    const user = randomFrom(allUsers);
    const actionDef = randomFrom(actions);
    const createdAt = daysAgo(randomInt(0, 14));
    
    auditEntries.push({
      userId: user.id,
      action: actionDef.action,
      entityType: actionDef.entityType || null,
      entityId: actionDef.entityType ? `temp_${Math.random().toString(36).slice(2, 10)}` : null,
      metadata: JSON.stringify({
        description: actionDef.desc(user),
        userAgent: randomFrom([
          'Mozilla/5.0 (Linux; Android 14) OmniVote/2.1.0',
          'Mozilla/5.0 (iPhone; iOS 17.5) OmniVote/2.1.0',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Safari/17.5',
          'OmniVote-FieldAgent-SDK/2.1.0 (Android)',
        ]),
        platform: randomFrom(['web', 'mobile_android', 'mobile_ios', 'field_agent_app']),
      }),
      ipAddress: randomIp(),
      createdAt,
    });
  }

  await db.auditLog.createMany({ data: auditEntries });
  console.log(`  Created ${auditEntries.length} audit log entries`);
}

async function seedAgentMessages() {
  console.log('Seeding AgentMessage...');
  
  const tenants = await db.tenant.findMany({ select: { id: true, name: true } });
  const fieldAgentsByTenant: Record<string, { id: string; name: string }[]> = {};
  const adminsByTenant: Record<string, { id: string; name: string }[]> = {};
  
  const allUsers = await db.user.findMany({ select: { id: true, name: true, role: true, tenantId: true } });
  for (const u of allUsers) {
    if (u.role === 'FIELD_AGENT') {
      if (!fieldAgentsByTenant[u.tenantId]) fieldAgentsByTenant[u.tenantId] = [];
      fieldAgentsByTenant[u.tenantId].push({ id: u.id, name: u.name });
    }
    if (u.role === 'TENANT_ADMIN' || u.role === 'ANALYST' || u.role === 'TRUST_SAFETY') {
      if (!adminsByTenant[u.tenantId]) adminsByTenant[u.tenantId] = [];
      adminsByTenant[u.tenantId].push({ id: u.id, name: u.name });
    }
  }

  // Realistic WhatsApp message templates
  const inboundMessages = [
    "I'm at PU 003 now. Voters are queuing peacefully. About 50 people in line.",
    "Please note: INEC officials arrived 30 minutes late. Voting started at 9:15 AM.",
    "BVAS machine is malfunctioning at my unit. Voters are getting restless. Please advise.",
    "Just witnessed ballot box snatching at PU 007 in Ward 4! They came in a black Toyota Hilux.",
    "SOS - Thugs are disrupting voting at my location. Need immediate security deployment.",
    "Everything is calm here. Turnout is lower than expected though, maybe 25% so far.",
    "Party agent for APC is harassing voters at the entrance. INEC officials seem powerless.",
    "The queue is very long now. Over 200 people waiting. Good sign for turnout.",
    "Rain just started here. Some voters are leaving the queue. About 30% have left.",
    "Materials arrived but there's a discrepancy in the ballot papers. Some are missing serial numbers.",
    "I've completed my PVT count. APC: 234, PDP: 189, LP: 56, NNPP: 12. Will upload photos shortly.",
    "Military personnel just arrived. They're maintaining order. Situation is calmer now.",
    "INEC ad-hoc staff are asking for bribes before accreditation. This is a serious issue.",
    "Voter intimidation reported - some guys in military camo (not real military) are standing near the booth.",
    "Power went off but BVAS has backup battery. Still functioning at 85% charge.",
    "There's a rumour going around that results have been pre-determined. Voters are angry.",
    "Collation centre update: Our agent says results are being tallied correctly so far.",
    "I can see vote buying happening openly. They're giving N5,000 near the church gate.",
    "PU 012 just closed. Turnout was about 62%. Results will be counted shortly.",
    "The police DPO just visited our polling unit. He spoke with party agents and restored order.",
    "Issue resolved - the BVAS was reset and is now working. Voting resumed at 10:45 AM.",
    "ThreeBVAS machines in this ward have failed. INEC is bringing replacements from the LGA headquarters.",
    "Elderly and disabled voters are being given priority. Good to see inclusive practices.",
    "Some political thugs tried to steal the result sheet but INEC officials locked it in the BVAS.",
    "I've uploaded 12 photos to the evidence folder. Includes shots of the queue and BVAS screen.",
    "A fight just broke out between APC and PDP supporters. Police are on their way.",
    "Voter apathy is real here. Only 15% turnout by 2 PM. Many registered voters didn't show up.",
    "Good news: The collation officer accepted our parallel results without issues.",
    "Correction to my earlier PVT: After recount, APC: 238, PDP: 191, LP: 58. Minor differences.",
    "I need a replacement phone. Mine fell and the screen is cracked. Can't take photos properly.",
    "The atmosphere is tense but peaceful. Party agents are watching each other closely.",
    "INEC has extended voting by 2 hours due to late start. Good decision.",
    "I saw a busload of people being brought in from outside the ward. Suspicious activity.",
    "Results counted and pasted at PU 005. Our PVT matches official count. No discrepancy.",
    "Security situation deteriorating in the next ward. I can hear gunshots in the distance.",
    "Requesting permission to relocate to PU 009. My current unit has completed voting.",
    "BVAS accreditation is slow. Only about 100 voters accredited in 2 hours.",
    "Fake news alert: Someone is sharing doctored result sheets on WhatsApp. I'll forward the screenshot.",
    "My battery is at 15%. I'll need to find a charging point soon. Will check back in 30 minutes.",
    "The NCOS (National Count Centre) is reporting results faster than expected. High turnout nationwide.",
    "Observation: Many first-time voters at my unit. Youth engagement is noticeably higher this cycle.",
    "Agent at the collation centre reports pressure from a political party to alter figures.",
    "I've been here since 7 AM. It's now 4 PM and voting is still ongoing. Strong turnout.",
    "Can confirm: The senatorial results for this district match our parallel vote tabulation.",
    "Note for HQ: The SPO (State Presiding Officer) has been cooperative. No issues.",
  ];

  const outboundMessages = [
    "Acknowledged. Maintain your position and document everything. Stay safe.",
    "HQ: Please upload photos immediately. We need visual evidence of the BVAS malfunction.",
    "Well noted. Security team has been alerted. Expect police deployment within 15 minutes.",
    "Good work on the PVT count. Please ensure photos of the official result sheet are clear and legible.",
    "WARNING: Do not engage with the thugs. Move to a safe distance and continue observing.",
    "Please verify: Is the INEC presiding officer present? What's their name and phone number?",
    "HQ Update: We're seeing similar BVAS issues in 3 other locations. INEC HQ has been notified.",
    "Your observation about vote buying has been logged as Incident #INC-2027-0451. Thank you.",
    "Good report. Please stay at your location until the result is officially pasted.",
    "CAUTION: The information about pre-determined results is unverified. Do not spread rumours.",
    "Confirmed: Police DPO Adebayo has been dispatched to your ward. ETA 10 minutes.",
    "Please send your GPS coordinates immediately so we can update your position on the tracker.",
    "HQ: Switch to the backup communication channel. We suspect your primary line may be compromised.",
    "Excellent work. Your evidence photos have been received and verified by the trust & safety team.",
    "Please take a break and recharge. We have another agent covering PU 012. Report back at 6 PM.",
    "ALERT: There are reports of violence in neighbouring wards. Be vigilant and ready to move.",
    "Your PVT data has been cross-checked with 2 other agents in the same ward. Figures are consistent.",
    "New assignment: After your unit closes, proceed to the collation centre and monitor the tallying.",
    "Do NOT relocate without authorization. Stay at your assigned unit until officially relieved.",
    "Received. The fake result sheets have been flagged and reported to INEC headquarters.",
    "Please conserve your battery. Switch off non-essential apps and reduce screen brightness.",
    "CONFIRMED: Your report about the busload of voters has been escalated to the Situation Room.",
    "Reminder: Submit your end-of-day report before 8 PM. Use the standard template.",
    "Great observation about youth turnout. Please include this in your end-of-day situation report.",
    "URGENT: The collation officer pressure report has been escalated. Legal team is reviewing.",
    "HQ appreciates your dedication. Please ensure you have transportation arranged for departure.",
    "Note: Do not share your PVT results on social media or personal WhatsApp groups.",
    "Stand down from SOS protocol. The situation has been assessed and security is sufficient.",
    "Please confirm: Has voting commenced at your unit? What time did INEC officials arrive?",
    "Your daily report is overdue. Please submit before end of day.",
    "New directive: All agents should verify the final vote count at their units before leaving.",
    "Thanks for the update on NCOS. Please continue monitoring and report any discrepancies.",
    "Good to hear the SPO is cooperative. Document their name for our post-election report.",
  ];

  const messageEntries: Prisma.AgentMessageCreateManyInput[] = [];
  
  for (const tenant of tenants) {
    const agents = fieldAgentsByTenant[tenant.id] || [];
    const admins = adminsByTenant[tenant.id] || [];
    if (agents.length === 0) continue;

    // Create 70-90 messages per tenant
    const msgCount = randomInt(70, 90);
    for (let i = 0; i < msgCount; i++) {
      const isInbound = Math.random() > 0.35; // 65% inbound from agents
      const agent = randomFrom(agents);
      const admin = admins.length > 0 ? randomFrom(admins) : null;
      const createdAt = hoursAgo(randomInt(0, 168)); // up to 7 days ago
      const deliveredAt = new Date(createdAt.getTime() + randomInt(500, 5000));
      const isRead = Math.random() > 0.25;
      const readAt = isRead ? new Date(deliveredAt.getTime() + randomInt(30000, 300000)) : null;

      const priority = Math.random() > 0.85 ? 'HIGH' : Math.random() > 0.5 ? 'MEDIUM' : 'LOW';
      const status = Math.random() > 0.9 ? 'FAILED' : Math.random() > 0.15 ? 'DELIVERED' : 'PENDING';
      
      const triggerTypes = ['MANUAL', 'SCHEDULED_CHECKIN', 'INCIDENT_RESPONSE', 'SOS_RESPONSE', 'ALERT_NOTIFICATION', 'PVT_REMINDER'];
      const triggerType = randomFrom(triggerTypes);

      if (isInbound) {
        // Message FROM field agent TO HQ
        const responseChance = Math.random();
        let responseText: string | undefined;
        let respondedAt: Date | undefined;
        if (responseChance > 0.5 && admin) {
          responseText = randomFrom(outboundMessages);
          respondedAt = new Date(createdAt.getTime() + randomInt(60000, 600000));
        }

        messageEntries.push({
          tenantId: tenant.id,
          agentId: agent.id,
          sentById: agent.id,
          channel: randomFrom(['WHATSAPP', 'IN_APP', 'SMS']),
          triggerType,
          subject: randomFrom([
            'Field Report', 'Incident Report', 'PVT Update', 'Security Alert',
            'SOS Emergency', 'Situation Report', 'BVAS Status', 'Voter Turnout Update',
            'Check-in Report', 'Evidence Upload', 'Collation Update', 'General Update',
          ]),
          body: randomFrom(inboundMessages),
          priority,
          status,
          deliveredAt: status === 'DELIVERED' ? deliveredAt : null,
          readAt,
          responseText,
          respondedAt,
          whatsappMessageId: `wamid_${Math.random().toString(36).slice(2, 20)}@s.whatsapp.net`,
          metadata: JSON.stringify({
            agentLocation: randomFrom(NIGERIAN_STATES).lga,
            batteryLevel: randomInt(5, 100),
            networkType: randomFrom(['4G', '3G', '2G', 'EDGE']),
            deviceType: randomFrom(['Android', 'iPhone']),
          }),
          createdAt,
          updatedAt: createdAt,
        });
      } else if (admin) {
        // Message FROM HQ TO field agent
        messageEntries.push({
          tenantId: tenant.id,
          agentId: agent.id,
          sentById: admin.id,
          channel: randomFrom(['WHATSAPP', 'IN_APP']),
          triggerType: randomFrom(['INCIDENT_RESPONSE', 'ALERT_NOTIFICATION', 'MANUAL', 'SCHEDULED_CHECKIN']),
          subject: randomFrom([
            'HQ Directive', 'Security Advisory', 'Instructions', 'Confirmation',
            'Alert Update', 'Reassignment', 'Equipment Guidance', 'Protocol Reminder',
          ]),
          body: randomFrom(outboundMessages),
          priority: Math.random() > 0.7 ? 'HIGH' : 'MEDIUM',
          status: Math.random() > 0.1 ? 'DELIVERED' : 'PENDING',
          deliveredAt: deliveredAt,
          readAt: isRead ? new Date(deliveredAt.getTime() + randomInt(30000, 300000)) : null,
          whatsappMessageId: `wamid_${Math.random().toString(36).slice(2, 20)}@s.whatsapp.net`,
          metadata: JSON.stringify({
            sentByRole: admin ? admins.find(a => a.id === admin.id)?.name || 'HQ Operator' : 'System',
            messageType: 'OUTBOUND_HQ',
          }),
          createdAt,
          updatedAt: createdAt,
        });
      }
    }
  }

  // Batch insert in chunks of 50
  for (let i = 0; i < messageEntries.length; i += 50) {
    await db.agentMessage.createMany({ data: messageEntries.slice(i, i + 50) });
  }
  console.log(`  Created ${messageEntries.length} agent messages`);
}

async function seedCampaignMessages() {
  console.log('Seeding CampaignMessage...');
  
  const campaigns = await db.campaign.findMany({ select: { id: true, tenantId: true, name: true } });
  if (campaigns.length === 0) {
    console.log('  No campaigns found, skipping CampaignMessage seed');
    return;
  }

  const statuses = ['DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'READ', 'READ', 'READ', 'PENDING', 'FAILED'];
  const failedReasons = ['Invalid number', 'Number blocked', 'Network timeout', 'Carrier rejected', 'Spam complaint'];
  
  const messageEntries: Prisma.CampaignMessageCreateManyInput[] = [];
  
  for (const campaign of campaigns) {
    // 10-20 messages per campaign
    const count = randomInt(10, 20);
    for (let i = 0; i < count; i++) {
      const status = randomFrom(statuses);
      const sentAt = daysAgo(randomInt(0, 10));
      const isOptOut = Math.random() > 0.92;
      
      messageEntries.push({
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        phoneNumber: randomPhone(),
        status,
        sentAt: status !== 'PENDING' ? sentAt : null,
        deliveredAt: (status === 'DELIVERED' || status === 'READ') ? new Date(sentAt.getTime() + randomInt(2000, 15000)) : null,
        readAt: status === 'READ' ? new Date(sentAt.getTime() + randomInt(60000, 600000)) : null,
        failedReason: status === 'FAILED' ? randomFrom(failedReasons) : null,
        optOut: isOptOut,
        createdAt: sentAt,
      });
    }
  }

  await db.campaignMessage.createMany({ data: messageEntries });
  console.log(`  Created ${messageEntries.length} campaign messages`);
}

async function seedAdditionalIncidents() {
  console.log('Seeding additional realistic incidents...');
  
  const tenants = await db.tenant.findMany({ select: { id: true } });
  const allAgents = await db.user.findMany({ where: { role: 'FIELD_AGENT' }, select: { id: true, tenantId: true } });
  
  const realisticIncidents = [
    {
      type: 'BALLOT_BOX_SNATCHING', severity: 'CRITICAL',
      descriptions: [
        'Armed men in a black Toyota Hiace snatched the ballot box at PU 008, Ward 3. They fired warning shots into the air before fleeing towards the expressway. INEC officials and voters scattered. No casualties reported yet.',
        'Ballot box stolen at Unit 015 around 2:30 PM. Eyewitnesses say 4 men dressed in black attacked the polling station. Police patrol vehicle was seen pursuing them towards Oshodi road.',
        'Suspected political thugs snatched ballot box during sorting and counting phase. The INEC presiding officer was pushed to the ground. Voters gave chase but the attackers escaped on motorcycles.',
      ],
    },
    {
      type: 'VOTE_BUYING', severity: 'HIGH',
      descriptions: [
        'Open vote buying observed near the primary school gate. Agents of a major political party are distributing N5,000 in brown envelopes to voters after they show their voter card. INEC security seems unaware.',
        'Party agents are marking voters hands with permanent marker after paying them N3,000 each. The marking is to prevent double collection. This is happening at 3 separate points within 200m of the polling unit.',
        'A woman in traditional attire is coordinating vote buying operations from a white Mercedes Benz parked 50m from the polling station. She has 4 attendants distributing cash to voters in the queue.',
      ],
    },
    {
      type: 'BVAS_MALFUNCTION', severity: 'MEDIUM',
      descriptions: [
        'BVAS machine failed to accredit voters for the 3rd time today. The fingerprint reader is completely unresponsive. INEC technical support has been called but has not arrived after 45 minutes. About 200 voters are waiting.',
        'BVAS battery drained to 0% despite being charged overnight. No backup battery available. Voting has been suspended at this unit for over 1 hour. Voters are becoming agitated.',
        'BVAS is showing "Error Code E-4012: Device Not Registered" when attempting to upload results. The presiding officer has tried restarting the device 3 times without success.',
      ],
    },
    {
      type: 'VOTER_INTIMIDATION', severity: 'HIGH',
      descriptions: [
        'Men in military camouflage (suspected to be fake) are positioned at the entrance of the polling unit. They are selectively questioning voters about their political affiliation and turning away suspected opposition supporters.',
        'A community leader is threatening to withdraw development projects from voters who do not support a particular candidate. Several voters have reported feeling intimidated.',
        'Gunmen arrived at 10 AM and ordered everyone to vote for the incumbent or leave. They are patrolling the perimeter of the polling station. Voters are complying out of fear.',
      ],
    },
    {
      type: 'MULTIPLE_VOTING', severity: 'HIGH',
      descriptions: [
        'Caught on camera: A man accredited and voted at PU 003, then moved to PU 006 (same ward) and attempted to vote again using a different name. BVAS flagged the duplicate fingerprint.',
        'Three women were caught trying to vote multiple times using different voter cards with their photographs. The INEC presiding officer detained them and called the police.',
        'Parallel voting scheme discovered: A group of 10 people are moving between 4 polling units in Ward 7, using temporary voter cards. Security has been alerted.',
      ],
    },
    {
      type: 'DEEPFAKE_SUSPECT', severity: 'CRITICAL',
      descriptions: [
        'A viral video circulating on WhatsApp shows the INEC Chairman announcing election results 24 hours before collation is complete. AI analysis confirms the video is a deepfake with 97% confidence. Lip sync and audio artifacts detected.',
        'Deepfake audio clip of a prominent politician confessing to election rigging is being shared on social media. The audio has been analyzed and shows clear signs of AI voice synthesis. This could incite violence.',
        'Fabricated result sheet image showing landslide victory for one party is being shared as "leaked INEC document." Digital forensics reveals it was created with Photoshop - metadata shows creation date 2 days before the election.',
      ],
    },
    {
      type: 'SOS_TRIGGER', severity: 'CRITICAL',
      descriptions: [
        'SOS - Agent is trapped inside a classroom being used as a polling unit. Violent mob has surrounded the building. Windows are being broken. Police response needed immediately.',
        'Emergency: Our field agent at PU 022 reports being pursued by armed men after photographing vote buying. Agent is hiding in a nearby compound. Need immediate extraction.',
        'SOS activated: Agent reports gunfire at collation centre. Agent is taking cover behind a concrete barrier. Two people have been injured. Ambulance and police needed.',
      ],
    },
    {
      type: 'RESULTS_MANIPULATION', severity: 'CRITICAL',
      descriptions: [
        'Collation officer was seen altering figures on the result sheet under duress from armed men. Our agent managed to photograph both the original and altered figures. Original: APC 312, PDP 289. Altered: APC 412, PDP 189.',
        'Discrepancy detected: Official results uploaded to INEC server show 847 total votes, but our PVT count and agent photographs show only 612 accredited voters. Overvoting of 235 votes.',
        'The ward collation officer has refused to accept results from 3 polling units that show opposition leads. No official reason given. Results are being held at the LGA collation centre.',
      ],
    },
    {
      type: 'UNDERAGE_VOTING', severity: 'MEDIUM',
      descriptions: [
        'Multiple underage voters (estimated ages 14-17) were observed casting ballots at PU 009. BVAS should have flagged this but the INEC ad-hoc staff apparently bypassed the age verification step.',
        'Community leader brought approximately 30 minors to the polling unit, claiming they are 18+. Several clearly appear to be teenagers. BVAS biometrics should prevent this but fingerprints of minors may not be registered.',
      ],
    },
    {
      type: 'MATERIALS_LOGISTICS', severity: 'LOW',
      descriptions: [
        'Voting materials arrived 2 hours late at PU 014. INEC officials blamed bad road conditions and vehicle breakdown. Voters waited patiently but about 50 left before materials arrived.',
        'Ballot papers for one political party are missing from the materials. Only 4 out of 5 parties have their ballots. INEC presiding officer has contacted the LGA office for replacement.',
        'The INEC distribution vehicle broke down on the way to 5 polling units in this ward. Election materials are currently stuck at the LGA headquarters. Estimated delay: 3-4 hours.',
      ],
    },
  ];

  const incidentEntries: Prisma.IncidentCreateManyInput[] = [];
  
  for (const tenant of tenants) {
    const tenantAgents = allAgents.filter(a => a.tenantId === tenant.id);
    if (tenantAgents.length === 0) continue;

    for (const incidentType of realisticIncidents) {
      // Create 1-2 incidents per type per tenant
      const count = randomInt(1, 2);
      for (let i = 0; i < count; i++) {
        const desc = randomFrom(incidentType.descriptions);
        const loc = randomFrom(NIGERIAN_STATES);
        const status = randomFrom(['PENDING', 'REVIEWED', 'ESCALATED', 'QUARANTINED', 'DISMISSED']);
        const agent = randomFrom(tenantAgents);
        const submittedAt = hoursAgo(randomInt(1, 72));
        
        incidentEntries.push({
          tenantId: tenant.id,
          pollingUnitId: null,
          reportedById: agent.id,
          type: incidentType.type,
          severity: incidentType.severity,
          status,
          description: desc,
          mediaUrls: JSON.stringify([
            `https://evidence.omnivote.ng/${tenant.id}/${Math.random().toString(36).slice(2, 8)}.jpg`,
            `https://evidence.omnivote.ng/${tenant.id}/${Math.random().toString(36).slice(2, 8)}.mp4`,
          ]),
          gpsLatitude: loc.lat + (Math.random() - 0.5) * 0.05,
          gpsLongitude: loc.lng + (Math.random() - 0.5) * 0.05,
          gpsAnomaly: Math.random() > 0.85,
          aiSummary: `AI detected ${incidentType.type.replace(/_/g, ' ')} with ${Math.floor(Math.random() * 30 + 70)}% confidence. Location: ${loc.lga}, ${loc.state}. ${status === 'QUARANTINED' ? 'Quarantined for further review.' : 'Pending human verification.'}`,
          aiFlags: JSON.stringify([
            incidentType.severity === 'CRITICAL' ? 'CRITICAL_ALERT' : 'STANDARD_FLAG',
            Math.random() > 0.5 ? 'AI_FLAGGED' : 'MANUAL_REPORT',
            Math.random() > 0.7 ? 'GEO_VERIFIED' : 'GEO_UNVERIFIED',
            Math.random() > 0.8 ? 'MEDIA_ATTACHED' : 'TEXT_ONLY',
          ]),
          isQuarantined: status === 'QUARANTINED',
          c2paVerified: Math.random() > 0.7,
          submittedAt,
          reviewedAt: status !== 'PENDING' ? new Date(submittedAt.getTime() + randomInt(1800000, 7200000)) : null,
          reviewedById: status !== 'PENDING' ? tenantAgents.find(a => a.id !== agent.id)?.id || null : null,
        });
      }
    }
  }

  await db.incident.createMany({ data: incidentEntries });
  console.log(`  Created ${incidentEntries.length} additional incidents`);
}

async function seedAdditionalAlerts() {
  console.log('Seeding additional realistic alerts...');
  
  const tenants = await db.tenant.findMany({ select: { id: true } });
  
  const alertTemplates = [
    { type: 'SECURITY', category: 'THREAT', title: 'Armed Group Spotted Near Polling Unit', description: 'Reports of armed individuals in military camouflage sighted within 500m of multiple polling units in the area. Field agents advised to maintain distance and document from safe locations.' },
    { type: 'SECURITY', category: 'BREACH', title: 'Unauthorized Access to Collation Centre', description: 'An unidentified individual attempted to access the ward collation centre without proper credentials. Security personnel intervened and the individual fled.' },
    { type: 'OPERATIONAL', category: 'SYSTEM', title: 'BVAS Server Sync Delay', description: 'Widespread reports of BVAS devices failing to sync results to the INEC central server. Technical team investigating. Estimated 2-hour resolution time.' },
    { type: 'OPERATIONAL', category: 'LOGISTICS', title: 'Material Distribution Delay', description: 'Election materials for 12 polling units in the northern district have not arrived as of 9:30 AM. INEC logistics coordinator has been notified.' },
    { type: 'SECURITY', category: 'CYBER', title: 'Suspicious Login Attempt on Admin Panel', description: 'Multiple failed login attempts detected from IP addresses in Eastern Europe. Account lockout policy has been triggered. Two-factor authentication recommended.' },
    { type: 'OPERATIONAL', category: 'COMMS', title: 'WhatsApp Gateway Reconnection Issue', description: 'The tenant WhatsApp business API connection dropped at 14:22. Automatic reconnection attempted 3 times without success. Manual intervention required.' },
    { type: 'SECURITY', category: 'INTEL', title: 'OSINT: Coordinated Disinformation Campaign Detected', description: 'Our OSINT monitoring has detected a coordinated social media campaign spreading false election results. 47 accounts identified spreading identical content across Twitter, Facebook, and WhatsApp.' },
    { type: 'OPERATIONAL', category: 'PERSONNEL', title: 'Agent Check-in Overdue', description: '3 field agents in Zone B have not checked in for over 2 hours. Last known locations are within network coverage area. Attempting to reach via phone.' },
    { type: 'SECURITY', category: 'PHYSICAL', title: 'Polling Unit Vandalism Report', description: 'Voters at PU 016 report that election materials and furniture were damaged overnight. INEC is deploying replacement materials but voting will start late.' },
    { type: 'OPERATIONAL', category: 'DATA', title: 'PVT Data Upload Anomaly', description: 'Parallel vote tabulation data from 8 polling units shows unusual patterns suggesting possible data entry errors. Analyst team requested to verify.' },
    { type: 'SECURITY', category: 'THREAT', title: 'Bomb Threat at Collation Centre', description: 'An anonymous call was received claiming an explosive device was planted at the LGA collation centre. Police bomb squad has been deployed. Area evacuated as a precaution.' },
    { type: 'OPERATIONAL', category: 'SYSTEM', title: 'Dashboard Analytics Pipeline Delay', description: 'Real-time analytics dashboard is showing a 15-minute data lag. Engineering team identified a queue backup in the event processing pipeline.' },
  ];

  const alertEntries: Prisma.AlertCreateManyInput[] = [];
  
  for (const tenant of tenants) {
    for (const template of alertTemplates) {
      // Create 2-3 of each alert type per tenant
      const count = randomInt(2, 3);
      for (let i = 0; i < count; i++) {
        alertEntries.push({
          tenantId: tenant.id,
          incidentId: null,
          type: template.type,
          category: template.category,
          title: template.title,
          description: template.description,
          isRead: Math.random() > 0.4,
          createdAt: hoursAgo(randomInt(0, 120)),
        });
      }
    }
  }

  await db.alert.createMany({ data: alertEntries });
  console.log(`  Created ${alertEntries.length} additional alerts`);
}

async function seedAdditionalCheckIns() {
  console.log('Seeding additional agent check-ins...');
  
  const tenants = await db.tenant.findMany({ select: { id: true } });
  const geofences = await db.geofenceZone.findMany({ select: { id: true, tenantId: true } });
  const fieldAgents = await db.user.findMany({ where: { role: 'FIELD_AGENT' }, select: { id: true, tenantId: true } });

  const checkInEntries: Prisma.AgentCheckInCreateManyInput[] = [];
  const checkInStatuses = ['CHECKED_IN', 'CHECKED_OUT', 'SOS_TRIGGERED', 'MISSED_CHECKIN'];
  
  for (const agent of fieldAgents) {
    const agentGeofences = geofences.filter(g => g.tenantId === agent.tenantId);
    const loc = randomFrom(NIGERIAN_STATES);
    
    // 2-4 check-ins per agent
    const count = randomInt(2, 4);
    for (let i = 0; i < count; i++) {
      const status = randomFrom(checkInStatuses);
      const checkedInAt = hoursAgo(randomInt(1, 96));
      const gf = agentGeofences.length > 0 ? randomFrom(agentGeofences) : null;
      
      checkInEntries.push({
        tenantId: agent.tenantId,
        agentId: agent.id,
        geofenceZoneId: gf ? gf.id : 'default-geofence',
        status,
        latitude: loc.lat + (Math.random() - 0.5) * 0.03,
        longitude: loc.lng + (Math.random() - 0.5) * 0.03,
        isInsideZone: Math.random() > 0.15,
        batteryLevel: randomInt(8, 100),
        networkType: randomFrom(['5G', '4G', '3G', '2G', 'EDGE']),
        accuracyMeters: randomInt(3, 50) + Math.random() * 10,
        notes: status === 'SOS_TRIGGERED' 
          ? randomFrom(['Need immediate assistance', 'Surrounded by hostile group', 'Equipment failure, cannot communicate', 'Feeling unsafe, requesting extraction'])
          : status === 'MISSED_CHECKIN' 
            ? randomFrom(['Battery died', 'Lost network signal', 'Phone was damaged', 'Relocated to new area'])
            : randomFrom(['Arrived at assigned unit', 'All clear, voting proceeding normally', 'Minor delay due to crowd', 'PU setup complete, waiting for voters', 'Replacement BVAS arrived and configured']),
        checkedInAt,
        checkedOutAt: status === 'CHECKED_OUT' ? new Date(checkedInAt.getTime() + randomInt(3600000, 28800000)) : null,
      });
    }
  }

  await db.agentCheckIn.createMany({ data: checkInEntries });
  console.log(`  Created ${checkInEntries.length} additional check-ins`);
}

async function seedAdditionalPollingUnits() {
  console.log('Seeding additional polling units with real Nigerian locations...');
  
  const elections = await db.election.findMany({ select: { id: true, tenantId: true } });
  
  // Real Nigerian polling unit naming patterns
  const puNames = [
    'Central Primary School', 'Community Town Hall', 'LGA Secretariat Open Space',
    'St. Peter\'s Anglican Church Hall', 'Methodist Primary School', 'Muslim Community Centre',
    'Government Day Secondary School', 'Unity Primary School', 'Holy Family Catholic Church',
    'National Youth Service Corps Lodge', 'Local Government Health Centre', 'Village Square',
    'All Saints Primary School', 'Oba\'s Palace Courtyard', 'Market Square Open Space',
    'Federal Government College', 'Civil Defence Office Compound', 'Electoral Commission Office',
    'State Library Hall', 'Sports Complex Indoor Hall', 'Fire Service Station Yard',
    'Post Office Compound', 'Railway Station Hall', 'Women Development Centre',
  ];

  const puEntries: Prisma.PollingUnitCreateManyInput[] = [];
  let codeCounter = 500;
  
  for (const election of elections) {
    const existingCount = await db.pollingUnit.count({ where: { electionId: election.id } });
    const toAdd = randomInt(8, 15); // Add 8-15 more PUs per election
    
    for (let i = 0; i < toAdd; i++) {
      const loc = randomFrom(NIGERIAN_STATES);
      const ward = `Ward ${randomInt(1, 12)}`;
      const name = `${randomFrom(puNames)}, ${loc.lga}`;
      const code = `${loc.state.slice(0, 3).toUpperCase()}-${loc.lga.slice(0, 3).toUpperCase()}-${String(codeCounter++).padStart(3, '0')}`;
      const regVoters = randomInt(200, 3500);
      const turnout = Math.random() * 0.65 + 0.1;
      const totalVotes = Math.floor(regVoters * turnout);
      
      puEntries.push({
        electionId: election.id,
        name,
        code,
        state: loc.state,
        lga: loc.lga,
        ward,
        latitude: loc.lat + (Math.random() - 0.5) * 0.08,
        longitude: loc.lng + (Math.random() - 0.5) * 0.08,
        registeredVoters: regVoters,
        totalVotes,
        turnout: Math.round(turnout * 100) / 100,
        status: randomFrom(['OPEN', 'CLOSED', 'CLOSED', 'PENDING', 'DISPUTED']),
      });
    }
  }

  await db.pollingUnit.createMany({ data: puEntries });
  console.log(`  Created ${puEntries.length} additional polling units`);
}

async function enrichExistingUsers() {
  console.log('Enriching existing user profiles with phone numbers...');
  
  const usersWithoutPhone = await db.user.findMany({
    where: { OR: [{ phone: null }, { phone: '' }] },
    select: { id: true },
  });
  
  let updated = 0;
  for (const user of usersWithoutPhone) {
    await db.user.update({
      where: { id: user.id },
      data: {
        phone: randomPhone(),
        deviceFingerprint: `fp_${Math.random().toString(36).slice(2, 18)}`,
        deviceTrustScore: Math.round((Math.random() * 30 + 70) * 100) / 100,
        lastSecurityAuditAt: daysAgo(randomInt(0, 30)),
      },
    });
    updated++;
  }
  console.log(`  Updated ${updated} user profiles with phone numbers and device data`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== OmniVote Real Data Seeder ===\n');
  console.log('Current database state:');
  
  const tables = ['Tenant','User','Election','Incident','Alert','ElectionResult','AgentCheckIn','PollingUnit','AgentMessage','OsintPost','Campaign','ContactList','CampaignEvent','VoterSuppressionReport','AuditLog','CampaignMessage'];
  for (const t of tables) {
    try {
      const count = await (db as any)[t].count();
      console.log(`  ${t}: ${count}`);
    } catch {}
  }
  console.log('');

  try {
    // Step 1: Enrich existing data
    await enrichExistingUsers();
    
    // Step 2: Populate empty tables
    await seedAuditLogs();
    await seedAgentMessages();
    await seedCampaignMessages();
    
    // Step 3: Add more realistic data to existing tables
    await seedAdditionalIncidents();
    await seedAdditionalAlerts();
    await seedAdditionalCheckIns();
    await seedAdditionalPollingUnits();
    
    console.log('\n=== Final database state ===');
    for (const t of tables) {
      try {
        const count = await (db as any)[t].count();
        console.log(`  ${t}: ${count}`);
      } catch {}
    }
    
    console.log('\nSeeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });