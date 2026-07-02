import { db } from '../src/lib/db';

// Dynamic tenant lookup (works after seed.ts + seed-multi-tenant.ts)
let TENANTS: { id: string; name: string }[] = [];

async function loadTenants() {
  TENANTS = await db.tenant.findMany({ select: { id: true, name: true } });
  console.log(`Found ${TENANTS.length} tenants:`, TENANTS.map(t => t.name).join(', '));
}

const PLATFORMS = ['X', 'FACEBOOK', 'YOUTUBE', 'TIKTOK', 'NEWS', 'INSTAGRAM'];
const CATEGORIES = ['ELECTION_NEWS', 'DISINFORMATION', 'HATE_SPEECH', 'VIOLENCE', 'RALLY', 'OPINION_POLL', 'FACT_CHECK', 'CIB_SUSPECT', 'BOT_ACTIVITY'];
const SENTIMENTS = ['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED'];
const STATES = ['Lagos', 'Abuja FCT', 'Kano', 'Rivers', 'Enugu', 'Borno', 'Oyo', 'Delta', 'Kaduna', 'Anambra'];
const PARTIES = ['APC', 'PDP', 'LP', 'NNPP', 'SDP'];

const OSINT_CONTENT = [
  { content: 'BREAKING: INEC announces postponement of presidential election to February 25th due to logistical challenges across 6 states. Official statement expected by 6pm.', category: 'ELECTION_NEWS', sentiment: 'MIXED' },
  { content: '🚨 FAKE NEWS ALERT: Viral message claims polling units in Lagos Island have been relocated to_unknown venues. INEC has NOT made any such announcement. Do NOT share this message. #NigeriaDecides2023', category: 'DISINFORMATION', sentiment: 'NEGATIVE', isFakeNews: true },
  { content: 'Massive turnout at the APC campaign rally in Lagos. Tens of thousands of supporters gathered at Teslim Balogun Stadium. #NigeriaDecides', category: 'RALLY', sentiment: 'POSITIVE', party: 'APC' },
  { content: 'Reports of voter intimidation in Kano. Voters allege thugs are preventing opposition supporters from accessing polling units. Security agencies deployed.', category: 'VIOLENCE', sentiment: 'NEGATIVE' },
  { content: 'Latest opinion poll shows tight race: APC 38%, PDP 35%, LP 18%, Others 9%. Margin of error: ±3%. Conducted by NOI Polls.', category: 'OPINION_POLL', sentiment: 'NEUTRAL' },
  { content: 'Coordinated bot network detected spreading identical pro-government narratives across 500+ accounts. Pattern analysis shows synchronized posting every 15 minutes. CIB score: 0.87', category: 'CIB_SUSPECT', sentiment: 'NEGATIVE', isBotSuspect: true, cibScore: 0.87 },
  { content: 'FACT CHECK: Claim that INEC Chairman is resigning is FALSE. Prof. Mahmood Yakubu has not made any such announcement. Source: INEC official Twitter handle.', category: 'FACT_CHECK', sentiment: 'NEUTRAL', isVerified: true },
  { content: 'Hate speech alert: inflammatory statements targeting ethnic groups at political rally in Enugu. AI audio analysis detects dehumanizing language. Flagged for Trust & Safety review.', category: 'HATE_SPEECH', sentiment: 'NEGATIVE' },
  { content: 'PDP presidential candidate promises to unify the country and restore economic prosperity during town hall in Abuja. Detailed policy proposals on agriculture and education.', category: 'ELECTION_NEWS', sentiment: 'POSITIVE', party: 'PDP' },
  { content: 'Suspicious spike in anti-LP content from 200 newly created accounts. All posting same narrative template with minor variations. Virality score: 82/100.', category: 'BOT_ACTIVITY', sentiment: 'NEGATIVE', isBotSuspect: true, viralityScore: 82 },
  { content: 'INEC distributes BVAS machines to all 774 LGAs ahead of Saturday\'s election. Commission assures readiness. Training of ad-hoc staff completed in 95% of centers.', category: 'ELECTION_NEWS', sentiment: 'POSITIVE', isVerified: true },
  { content: 'Video claiming to show ballot box stuffing in Rivers State is actually from 2019 elections in Kenya. Deepfake analysis confirms temporal and geographic mismatch.', category: 'DISINFORMATION', sentiment: 'NEGATIVE', isFakeNews: true },
  { content: 'Obi-dient movement trends #1 on Nigerian Twitter for 5th consecutive day. Engagement metrics show 2.3M+ interactions. Demographic skew: 18-34 age group.', category: 'ELECTION_NEWS', sentiment: 'POSITIVE', party: 'LP' },
  { content: 'Security alert: Reports of armed groups spotted near polling unit storage facilities in Borno. Military deployment requested. Situation being monitored.', category: 'VIOLENCE', sentiment: 'NEGATIVE' },
  { content: 'AI-generated image of INEC chairman endorsing a candidate circulating on WhatsApp. C2PA verification FAILS. Image metadata shows Midjourney generation signature.', category: 'DISINFORMATION', sentiment: 'NEGATIVE', isFakeNews: true, cibScore: 0.62 },
];

const AUTHOR_NAMES = ['@NigeriaElectionWatch', '@INECOfficial', '@PremiumTimesNG', '@ChannelsTV', '@BBCNewsAfrica', '@SaharaReporters', '@DailyTrust', '@TheCableNG', '@APCNigeria', '@PDPNigeria', '@LabourPartyNG', '@CivicMonitorNG', '@ElectionAlertNG', '@FactCheckNigeria', '@PeaceCorpNG', '@HumanRightsNG', '@DemocracyWatchNG', '@VoterEducationNG', '@SecurityMonitorNG', '@MediaSpaceNG'];

async function seedOsint() {
  console.log('Seeding OSINT posts...');
  const posts = [];
  
  for (const tenant of TENANTS) {
    for (let i = 0; i < 25; i++) {
      const item = OSINT_CONTENT[i % OSINT_CONTENT.length];
      const platform = PLATFORMS[i % PLATFORMS.length];
      const hoursAgo = Math.floor(Math.random() * 72);
      const publishedAt = new Date(Date.now() - hoursAgo * 3600000);
      
      posts.push({
        tenantId: tenant.id,
        platform,
        postId: `post_${tenant.id}_${i}`,
        author: AUTHOR_NAMES[i % AUTHOR_NAMES.length],
        authorFollowers: Math.floor(Math.random() * 500000) + 1000,
        content: item.content,
        mediaUrls: JSON.stringify(i % 3 === 0 ? [`https://s3.amazonaws.com/omnivote/osint_${i}.jpg`] : []),
        url: i % 4 === 0 ? `https://example.com/post/${i}` : null,
        sentiment: item.sentiment || SENTIMENTS[i % SENTIMENTS.length],
        category: item.category,
        isVerified: item.isVerified || false,
        isFakeNews: item.isFakeNews || false,
        isBotSuspect: item.isBotSuspect || false,
        cibScore: item.cibScore || Math.random() * 0.3,
        aiSummary: i % 2 === 0 ? `AI Analysis: Post ${item.category === 'DISINFORMATION' ? 'contains potentially misleading claims requiring fact-check verification' : 'aligned with verified election reporting standards'}. Engagement pattern ${Math.random() > 0.5 ? 'organic' : 'shows signs of amplification'}.` : null,
        aiFlags: JSON.stringify(i % 5 === 0 ? ['viral_spike', 'sentiment_shift'] : i % 7 === 0 ? ['copy_paste_cluster', 'coordinated_timing'] : []),
        viralityScore: item.viralityScore || Math.floor(Math.random() * 80) + 10,
        engagement: JSON.stringify({
          likes: Math.floor(Math.random() * 10000),
          shares: Math.floor(Math.random() * 5000),
          comments: Math.floor(Math.random() * 2000),
          views: Math.floor(Math.random() * 100000) + 1000,
        }),
        keywords: JSON.stringify(['election', 'Nigeria', 'voting', 'INEC', 'polling'].slice(0, 3 + Math.floor(Math.random() * 3))),
        location: STATES[i % STATES.length],
        language: 'en',
        publishedAt,
      });
    }
  }

  for (const post of posts) {
    await db.osintPost.create({ data: post });
  }
  console.log(`  Created ${posts.length} OSINT posts`);
}

async function seedCampaigns() {
  console.log('Seeding campaigns and contacts...');
  
  const adminUsers = await db.user.findMany({
    where: { role: { in: ['SUPER_ADMIN', 'TENANT_ADMIN'] } },
    select: { id: true, tenantId: true },
  });
  
  const adminByTenant: Record<string, string> = {};
  for (const u of adminUsers) {
    if (!adminByTenant[u.tenantId]) adminByTenant[u.tenantId] = u.id;
  }

  for (const tenant of TENANTS) {
    const adminId = adminByTenant[tenant.id];
    if (!adminId) continue;

    // Create contact lists
    const contactLists = [
      { name: 'Ward 5 Volunteers', segment: 'VOLUNTEERS', count: 245 },
      { name: 'Party Members - Lagos', segment: 'PARTY_MEMBERS', count: 1850 },
      { name: 'Polling Agents', segment: 'POLLING_AGENTS', count: 890 },
      { name: 'GOTV Subscribers', segment: 'SUBSCRIBERS', count: 5200 },
    ];

    const listIds: string[] = [];
    for (const cl of contactLists) {
      const list = await db.contactList.create({
        data: {
          tenantId: tenant.id,
          name: cl.name,
          segment: cl.segment,
          description: `${cl.segment} contact list for ${tenant.name}`,
          contactCount: cl.count,
          totalUploaded: cl.count,
          optedOutCount: Math.floor(cl.count * 0.03),
          consentVerified: true,
          uploadedById: adminId,
        },
      });
      listIds.push(list.id);
    }

    // Create campaigns
    const campaignTemplates = [
      { name: 'GOTV Push - Election Day', template: '🗳️ ELECTION DAY REMINDER\n\nYour polling unit is open from 8:00 AM - 2:00 PM.\n\nRemember to bring your PVC and stay in line!\n\nVote wisely. Your voice matters.\n\n#NigeriaDecides', status: 'COMPLETED' },
      { name: 'Fact-Check: False Polling Info', template: '⚠️ FACT-CHECK ALERT\n\nA viral message claiming polling locations have changed is FALSE.\n\n✅ Your assigned polling unit remains the same.\n✅ INEC has NOT made any changes.\n\nVerify at: inec.gov.ng\n\nDo NOT share unverified information.', status: 'COMPLETED' },
      { name: 'Rally Invitation - Lagos', template: '🎉 CAMPAIGN RALLY\n\nJoin us for our final rally!\n\n📍 Tafawa Balewa Square, Lagos\n📅 Saturday, Feb 20, 2023\n🕐 10:00 AM\n\nCome early! Bring your friends.\n\n#Hope2023', status: 'SCHEDULED' },
      { name: 'Voter Education Series', template: '📚 VOTER EDUCATION\n\nDid you know?\n\n• BVAS is used for accreditation\n• You can only vote at your registered unit\n• Your vote is secret\n• Report any violence to 0700-CALL-INEC\n\nStay informed. Stay safe.\n\n#VoterEd', status: 'DRAFT' },
    ];

    for (let i = 0; i < campaignTemplates.length; i++) {
      const ct = campaignTemplates[i];
      const listId = listIds[i % listIds.length];
      const list = contactLists[i % contactLists.length];
      const totalRecip = list.count;
      const sent = ct.status === 'COMPLETED' ? totalRecip : ct.status === 'SCHEDULED' ? 0 : 0;
      const delivered = ct.status === 'COMPLETED' ? Math.floor(totalRecip * 0.95) : 0;
      const read = ct.status === 'COMPLETED' ? Math.floor(totalRecip * 0.72) : 0;
      const failed = ct.status === 'COMPLETED' ? Math.floor(totalRecip * 0.02) : 0;
      const optOut = ct.status === 'COMPLETED' ? Math.floor(totalRecip * 0.04) : 0;

      await db.campaign.create({
        data: {
          tenantId: tenant.id,
          name: ct.name,
          templateName: ct.name,
          templateBody: ct.template,
          templateStatus: ct.status === 'DRAFT' ? 'DRAFT' : 'APPROVED',
          contactListId: listId,
          segment: contactLists[i % contactLists.length].segment,
          status: ct.status,
          channel: 'WHATSAPP',
          scheduledAt: ct.status === 'SCHEDULED' ? new Date(Date.now() + 48 * 3600000) : null,
          startedAt: ct.status === 'COMPLETED' ? new Date(Date.now() - 24 * 3600000) : null,
          completedAt: ct.status === 'COMPLETED' ? new Date(Date.now() - 12 * 3600000) : null,
          createdBy: adminId,
          rateLimitPerMin: 1000,
          totalRecipients: totalRecip,
          sentCount: sent,
          deliveredCount: delivered,
          readCount: read,
          failedCount: failed,
          optOutCount: optOut,
          consentEnforced: true,
          wabaCompliant: true,
        },
      });
    }
  }
  console.log('  Created contact lists and campaigns');
}

async function seedCampaignEvents() {
  console.log('Seeding campaign events...');
  
  const eventTypes = ['RALLY', 'TOWN_HALL', 'DEBATE', 'PRESS_CONF', 'DOOR_TO_DOOR'];
  const tones = ['PEACEFUL', 'TENSE', 'HOSTILE', 'ENTHUSIASTIC'];
  const events = [
    { type: 'RALLY', title: 'APC Grand Rally - Lagos', party: 'APC', state: 'Lagos', venue: 'Tafawa Balewa Square', crowd: 45000, tone: 'ENTHUSIASTIC' },
    { type: 'RALLY', title: 'PDP Final Campaign - Abuja', party: 'PDP', state: 'Abuja FCT', venue: 'Eagle Square', crowd: 38000, tone: 'ENTHUSIASTIC' },
    { type: 'TOWN_HALL', title: 'LP Youth Forum', party: 'LP', state: 'Lagos', venue: 'Landmark Centre', crowd: 5000, tone: 'PEACEFUL' },
    { type: 'RALLY', title: 'NNPP Kano Rally', party: 'NNPP', state: 'Kano', venue: 'Sani Abacha Stadium', crowd: 32000, tone: 'TENSE' },
    { type: 'DEBATE', title: 'Governorship Debate - Rivers', party: null, state: 'Rivers', venue: 'ABC TV Studio', crowd: 200, tone: 'PEACEFUL' },
    { type: 'RALLY', title: 'PDP Enugu Rally', party: 'PDP', state: 'Enugu', venue: 'Nnamdi Azikiwe Stadium', crowd: 28000, tone: 'ENTHUSIASTIC' },
    { type: 'PRESS_CONF', title: 'INEC Pre-Election Briefing', party: null, state: 'Abuja FCT', venue: 'INEC HQ', crowd: 500, tone: 'PEACEFUL' },
    { type: 'TOWN_HALL', title: 'APC Women Forum - Kano', party: 'APC', state: 'Kano', venue: 'Government House', crowd: 3000, tone: 'PEACEFUL' },
    { type: 'RALLY', title: 'LP Mega Rally - Anambra', party: 'LP', state: 'Anambra', venue: 'Ekwueme Square', crowd: 52000, tone: 'ENTHUSIASTIC' },
    { type: 'DOOR_TO_DOOR', title: 'PDP Canvassing - Delta', party: 'PDP', state: 'Delta', venue: 'Various LGAs', crowd: 800, tone: 'PEACEFUL' },
  ];

  for (const tenant of TENANTS) {
    const users = await db.user.findMany({
      where: { tenantId: tenant.id, role: 'FIELD_AGENT' },
      select: { id: true },
      take: 5,
    });

    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const daysAgo = Math.floor(Math.random() * 30) + 1;
      await db.campaignEvent.create({
        data: {
          tenantId: tenant.id,
          eventType: e.type,
          title: e.title,
          description: `${e.party ? `${e.party} ${e.type.toLowerCase()}` : e.type} event in ${e.state}. ${e.tone === 'TENSE' ? 'Security concerns reported. AI flagged potential hate speech in some chants.' : e.tone === 'ENTHUSIASTIC' ? 'Large enthusiastic crowd. Peaceful atmosphere.' : 'Event proceeded calmly with no incidents.'}`,
          party: e.party,
          state: e.state,
          venue: e.venue,
          latitude: 6.5 + Math.random() * 6,
          longitude: 3 + Math.random() * 10,
          estimatedCrowd: e.crowd + Math.floor(Math.random() * 5000) - 2500,
          reportedById: users[i % users.length]?.id || null,
          tone: e.tone,
          mediaUrls: JSON.stringify(i % 2 === 0 ? [`https://s3.amazonaws.com/omnivote/event_${i}.jpg`, `https://s3.amazonaws.com/omnivote/event_${i}_2.jpg`] : []),
          aiFlags: JSON.stringify(
            e.tone === 'TENSE' ? ['hate_speech_detected', 'crowd_agitation'] :
            i % 5 === 0 ? ['state_resources_detected', 'large_crowd'] : []
          ),
          incidentCount: e.tone === 'TENSE' ? Math.floor(Math.random() * 3) + 1 : 0,
          eventDate: new Date(Date.now() - daysAgo * 86400000),
        },
      });
    }
  }
  console.log('  Created campaign events');
}

async function seedVoterSuppression() {
  console.log('Seeding voter suppression reports...');
  
  const reportTypes = ['FALSE_POLLING_INFO', 'INTIMIDATION_THREAT', 'VOTER_ID_BLOCKED', 'MATERIALS_WITHHELD', 'FAKE_SCHEDULE'];
  const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const statuses = ['PENDING', 'VERIFIED', 'DISMISSED', 'ESCALATED'];
  const reports = [
    { type: 'FALSE_POLLING_INFO', title: 'Fake INEC notice circulating in Lagos Island', desc: 'WhatsApp broadcast claims PU 034 has been moved to a different ward. INEC confirms no such change.', state: 'Lagos', lga: 'Lagos Island', severity: 'HIGH', source: 'OSINT', platform: 'WHATSAPP_CHANNEL', isDisinfo: true },
    { type: 'INTIMIDATION_THREAT', title: 'Threats against LP supporters in Kano', desc: 'Reports of thugs threatening voters at PU 012, Kano Municipal. Voters told not to come to polls.', state: 'Kano', lga: 'Kano Municipal', severity: 'CRITICAL', source: 'FIELD' },
    { type: 'VOTER_ID_BLOCKED', title: 'Voters denied accreditation in Enugu', desc: '20+ voters report being turned away despite having valid PVCs. Officials claim "system issues".', state: 'Enugu', lga: 'Enugu North', severity: 'HIGH', source: 'FIELD' },
    { type: 'MATERIALS_WITHHELD', title: 'BVAS machines not delivered to Rivers LGA', desc: '3 polling units in Obio/Akpor LGA report non-delivery of BVAS 2 days before election.', state: 'Rivers', lga: 'Obio/Akpor', severity: 'MEDIUM', source: 'FIELD' },
    { type: 'FAKE_SCHEDULE', title: 'Social media post claims election moved to March', desc: 'Coordinated posts across X and Facebook claiming presidential election rescheduled. INEC denies.', state: 'Abuja FCT', lga: null, severity: 'HIGH', source: 'OSINT', platform: 'X', isDisinfo: true },
    { type: 'INTIMIDATION_THREAT', title: 'Party agents blocking opposition in Borno', desc: 'APC agents reported preventing PDP and LP agents from entering PU 008 in Maiduguri.', state: 'Borno', lga: 'Maiduguri', severity: 'HIGH', source: 'FIELD' },
    { type: 'FALSE_POLLING_INFO', title: 'Fake polling unit list shared on TikTok', desc: 'Viral TikTok video shows fabricated list of polling units with wrong addresses. 500K+ views.', state: 'Oyo', lga: 'Ibadan North', severity: 'MEDIUM', source: 'OSINT', platform: 'TIKTOK', isDisinfo: true },
    { type: 'VOTER_ID_BLOCKED', title: 'Name missing from voter register in Delta', desc: 'Multiple voters with valid PVCs find their names missing from the official register at PU 045.', state: 'Delta', lga: 'Warri South', severity: 'MEDIUM', source: 'TIP_LINE' },
    { type: 'MATERIALS_WITHHELD', title: 'Ballot papers insufficient in Kaduna', desc: 'Reports of ballot paper shortage at 5 polling units in Kaduna North. Voters turned away.', state: 'Kaduna', lga: 'Kaduna North', severity: 'HIGH', source: 'FIELD' },
    { type: 'FAKE_SCHEDULE', title: 'SMS blast claims voting ends at 12 noon', desc: 'Bulk SMS sent to voters in Anambra claiming polls close at 12pm instead of 2pm.', state: 'Anambra', lga: 'Awka South', severity: 'CRITICAL', source: 'OSINT', platform: 'SMS', isDisinfo: true },
  ];

  for (const tenant of TENANTS) {
    const users = await db.user.findMany({
      where: { tenantId: tenant.id, role: 'FIELD_AGENT' },
      select: { id: true },
      take: 5,
    });

    for (let i = 0; i < reports.length; i++) {
      const r = reports[i];
      const hoursAgo = Math.floor(Math.random() * 96) + 1;
      await db.voterSuppressionReport.create({
        data: {
          tenantId: tenant.id,
          reportType: r.type,
          title: r.title,
          description: r.desc,
          state: r.state,
          lga: r.lga,
          source: r.source,
          platform: r.platform || null,
          severity: r.severity,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          isDisinformation: r.isDisinfo || false,
          affectedArea: `${r.lga ? `${r.lga}, ` : ''}${r.state}`,
          affectedVoters: Math.floor(Math.random() * 5000) + 50,
          evidenceUrls: JSON.stringify(i % 3 === 0 ? [`https://s3.amazonaws.com/omnivote/evidence_${i}.jpg`] : []),
          counterMeasure: Math.random() > 0.5 ? 'Fact-check bulletin drafted and sent via mobilization engine.' : null,
          aiAnalysis: `AI assessment: Report credibility ${Math.floor(Math.random() * 30) + 70}%. ${r.isDisinfo ? 'Disinformation pattern matches known templates. Cross-referenced with OSINT feed.' : 'Field report consistent with other reports from same region.'}`,
          reportedById: r.source === 'FIELD' ? users[i % users.length]?.id || null : null,
        },
      });
    }
  }
  console.log('  Created voter suppression reports');
}

async function main() {
  console.log('=== Seeding OSINT, Campaign, and Pre-Election Modules ===\n');
  
  const TENANTS_LOADED = await loadTenants();
  
  await seedOsint();
  await seedCampaigns();
  await seedCampaignEvents();
  await seedVoterSuppression();
  
  console.log('\n=== All modules seeded successfully ===');
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));