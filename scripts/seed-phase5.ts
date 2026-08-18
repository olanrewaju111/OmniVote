import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Phase 5: Real-Time Situational Awareness & Advanced Reporting...');

  // Get all tenants
  const tenants = await db.tenant.findMany();
  console.log(`Found ${tenants.length} tenants`);

  for (const tenant of tenants) {
    console.log(`\n📦 Seeding Phase 5 for: ${tenant.name} (${tenant.slug})`);

    // Get users for this tenant
    const users = await db.user.findMany({ where: { tenantId: tenant.id } });
    const fieldAgents = users.filter(u => u.role === 'FIELD_AGENT');
    const admins = users.filter(u => u.role === 'TENANT_ADMIN' || u.role === 'SUPER_ADMIN');

    // Get elections for this tenant
    const elections = await db.election.findMany({ where: { tenantId: tenant.id } });
    const election = elections[0];
    if (!election) {
      console.log('  ⏭️  No election found, skipping');
      continue;
    }

    // Get polling units
    const pus = await db.pollingUnit.findMany({
      where: { electionId: election.id },
      take: 20,
    });

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // ── 1. Additional Chat Messages for Team Chat ──
    console.log('  💬 Adding chat messages...');
    const chatBodies = [
      'All field agents in Lagos mainland, please check in immediately',
      'We are seeing a spike in violence reports from Rivers State',
      'PVT results from Ward 3 are showing significant deviations from official counts',
      'OSINT team has flagged 12 new disinformation posts in the last hour',
      'Honeypot unit in Kano has been triggered — potential result manipulation detected',
      'Security briefing: All agents should maintain radio silence on social media',
      'Flashpoint forecast updated: Borno and Yobe now at CRITICAL risk level',
      'Geofence zone Delta-1 has 3 agents with missed check-ins',
      'PVT coverage has reached 67% — ahead of schedule for this hour',
      'Evidence dossier #EVD-0042 has been certified and is ready for legal review',
      'Media team: please prioritize verification of the alleged ballot box photo from Abuja',
      'WhatsApp bridge is connected — outbound campaign messages are being delivered',
      'Dead-man switch for Agent Adewale (Zone Lagos-3) has escalated to level 2',
      'All analysts: please review the narrative timeline for consistency before broadcast',
      'Turnout in Enugu is tracking 12% above the 2019 baseline — good news',
    ];

    for (let i = 0; i < Math.min(chatBodies.length, users.length); i++) {
      await db.chatMessage.create({
        data: {
          tenantId: tenant.id,
          senderId: users[i % users.length].id,
          body: chatBodies[i],
          createdAt: new Date(now.getTime() - (chatBodies.length - i) * 4 * 60 * 1000),
        },
      });
    }
    console.log(`  ✅ ${Math.min(chatBodies.length, users.length)} chat messages seeded`);

    // ── 2. Additional OSINT Posts (more recent) ──
    console.log('  🌐 Adding recent OSINT posts...');
    const platforms = ['X', 'FACEBOOK', 'WHATSAPP_CHANNEL', 'TIKTOK', 'INSTAGRAM'];
    const osintContents = [
      { content: 'BREAKING: Reports of ballot snatching at PU 003 in Surulere, Lagos. Voters are being turned away. #NigeriaDecides #Lagos', category: 'VIOLENCE', sentiment: 'NEGATIVE' },
      { content: 'I just voted at my polling unit in Wuse 2, Abuja. Process was smooth and peaceful. BVAS worked perfectly! #NigeriaDecides', category: 'ELECTION_NEWS', sentiment: 'POSITIVE' },
      { content: 'This election is rigged! INEC is manipulating results in favor of APC. Share this widely! 🚨', category: 'DISINFORMATION', sentiment: 'NEGATIVE' },
      { content: 'Video shows armed men at a collation center in Port Harcourt. Situation tense. #RiversState', category: 'VIOLENCE', sentiment: 'NEGATIVE' },
      { content: 'PDP agents have been arrested for trying to bribe INEC officials at PU 012 in Kano. #KanoDecides', category: 'ELECTION_NEWS', sentiment: 'MIXED' },
      { content: ' turnout is very low in the southeast compared to 2019. What is going on? #VoterApathy', category: 'OPINION_POLL', sentiment: 'NEUTRAL' },
      { content: 'Multiple accounts sharing the exact same message about INEC server manipulation. Coordinated campaign detected. #CIB', category: 'CIB_SUSPECT', sentiment: 'NEGATIVE' },
      { content: 'LP party agents report that results sheets (Form EC8A) are being filled before voting at several units in Anambra', category: 'DISINFORMATION', sentiment: 'NEGATIVE' },
    ];

    for (let i = 0; i < osintContents.length; i++) {
      await db.osintPost.create({
        data: {
          tenantId: tenant.id,
          platform: platforms[i % platforms.length],
          postId: `osint-phase5-${tenant.slug}-${i}`,
          author: `@user_${Math.floor(Math.random() * 9000 + 1000)}`,
          authorFollowers: Math.floor(Math.random() * 50000) + 100,
          content: osintContents[i].content,
          sentiment: osintContents[i].sentiment,
          category: osintContents[i].category,
          isFakeNews: osintContents[i].category === 'DISINFORMATION',
          isBotSuspect: osintContents[i].category === 'CIB_SUSPECT',
          cibScore: osintContents[i].category === 'CIB_SUSPECT' ? 0.85 : Math.random() * 0.3,
          viralityScore: Math.floor(Math.random() * 80) + 20,
          engagement: JSON.stringify({ likes: Math.floor(Math.random() * 2000), shares: Math.floor(Math.random() * 500), comments: Math.floor(Math.random() * 300) }),
          publishedAt: new Date(now.getTime() - (osintContents.length - i) * 8 * 60 * 1000),
          ingestedAt: new Date(now.getTime() - (osintContents.length - i) * 5 * 60 * 1000),
          keywords: JSON.stringify(['nigeria', 'election', 'voting', 'inec']),
          location: ['Lagos', 'Abuja', 'Rivers', 'Kano', 'Enugu', 'Anambra'][i % 6],
        },
      });
    }
    console.log(`  ✅ ${osintContents.length} OSINT posts seeded`);

    // ── 3. Additional Security Events ──
    console.log('  🛡️ Adding security events...');
    const secEventTypes = ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'SUSPICIOUS_ACTIVITY', 'BRUTE_FORCE', 'API_ABUSE'];
    const secDescriptions = [
      'Admin login from new device in Lagos',
      'Failed login attempt from unknown IP (185.x.x.x)',
      'Multiple login failures detected for analyst account',
      'Unusual API call pattern from user session — possible data scraping',
      'Session token reused after logout — potential session hijacking',
    ];

    for (let i = 0; i < secDescriptions.length; i++) {
      await db.securityEvent.create({
        data: {
          tenantId: tenant.id,
          userId: i < admins.length ? admins[i].id : null,
          eventType: secEventTypes[i],
          severity: i === 2 ? 'WARNING' : i === 4 ? 'CRITICAL' : 'INFO',
          ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
          description: secDescriptions[i],
          metadata: JSON.stringify({ source: 'seed-phase5' }),
          resolved: i < 3,
          resolvedById: i < 2 && admins.length > 0 ? admins[0].id : null,
          resolvedAt: i < 2 ? new Date(now.getTime() - 30 * 60 * 1000) : null,
          createdAt: new Date(now.getTime() - (secDescriptions.length - i) * 10 * 60 * 1000),
        },
      });
    }
    console.log(`  ✅ ${secDescriptions.length} security events seeded`);

    // ── 4. Additional Agent Check-Ins ──
    console.log('  📍 Adding agent check-ins...');
    const geofenceZones = await db.geofenceZone.findMany({
      where: { tenantId: tenant.id, isActive: true },
      take: 5,
    });

    for (let i = 0; i < Math.min(8, fieldAgents.length, geofenceZones.length * 2); i++) {
      const zone = geofenceZones[i % geofenceZones.length];
      const agent = fieldAgents[i % fieldAgents.length];
      await db.agentCheckIn.create({
        data: {
          tenantId: tenant.id,
          agentId: agent.id,
          geofenceZoneId: zone.id,
          status: i === 6 ? 'SOS_TRIGGERED' : 'CHECKED_IN',
          latitude: zone.centerLat + (Math.random() - 0.5) * 0.01,
          longitude: zone.centerLng + (Math.random() - 0.5) * 0.01,
          isInsideZone: i !== 5,
          batteryLevel: Math.floor(Math.random() * 80) + 15,
          networkType: ['4G', '3G', '5G', 'WiFi'][i % 4],
          accuracyMeters: Math.floor(Math.random() * 30) + 5,
          notes: i === 6 ? 'SOS: Armed men sighted near collation center' : i === 5 ? 'Outside zone — moved to assist nearby unit' : 'Routine check-in',
          checkedInAt: new Date(now.getTime() - (8 - i) * 7 * 60 * 1000),
          checkedOutAt: i < 4 ? new Date(now.getTime() - (8 - i) * 7 * 60 * 1000 + 30 * 60 * 1000) : null,
        },
      });
    }
    console.log(`  ✅ ${Math.min(8, fieldAgents.length, geofenceZones.length * 2)} check-ins seeded`);

    // ── 5. Additional Alerts ──
    console.log('  🔔 Adding recent alerts...');
    const newAlerts = [
      { title: 'SOS Triggered', description: 'Agent in Geofence Zone Delta-1 has triggered SOS', type: 'SECURITY', category: 'SOS' },
      { title: 'Honeypot Deviation', description: 'Honeypot unit in Kano shows 23% result deviation', type: 'SECURITY', category: 'CRITICAL' },
      { title: 'OSINT Spike', description: '400% increase in election-related posts from Rivers State', type: 'OPERATIONAL', category: 'WARNING' },
      { title: 'PVT Anomaly Detected', description: 'PVT results from 5 polling units in Lagos show >10% deviation', type: 'OPERATIONAL', category: 'WARNING' },
      { title: 'CIB Campaign Detected', description: 'Coordinated inauthentic behavior cluster detected on X/Twitter', type: 'SECURITY', category: 'CRITICAL' },
    ];

    for (let i = 0; i < newAlerts.length; i++) {
      await db.alert.create({
        data: {
          tenantId: tenant.id,
          type: newAlerts[i].type,
          category: newAlerts[i].category,
          title: newAlerts[i].title,
          description: newAlerts[i].description,
          isRead: i > 2,
          createdAt: new Date(now.getTime() - (newAlerts.length - i) * 12 * 60 * 1000),
        },
      });
    }
    console.log(`  ✅ ${newAlerts.length} alerts seeded`);
  }

  console.log('\n✅ Phase 5 seeding complete!');
  console.log('   - Activity Stream: Unified real-time event stream across all modules');
  console.log('   - Situational KPI: Live-updating metrics on Overview dashboard');
  console.log('   - Enhanced SSE: 10 event types with 3s polling interval');
  console.log('   - Reports Center: Templates + Scheduled Reports + Generate tabs');
  console.log('   - New API routes: /api/activity-feed, /api/report-templates, /api/scheduled-reports');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
