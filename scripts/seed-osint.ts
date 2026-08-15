/**
 * Seed OSINT posts for all tenants so the OSINT Monitor tab isn't empty.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const PLATFORMS = ['X', 'FACEBOOK', 'YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'WHATSAPP_CHANNEL', 'NEWS', 'RSS'];
const CATEGORIES = ['ELECTION_NEWS', 'DISINFORMATION', 'HATE_SPEECH', 'VIOLENCE', 'RALLY', 'OPINION_POLL', 'FACT_CHECK', 'CIB_SUSPECT', 'BOT_ACTIVITY', 'GENERAL'];
const SENTIMENTS = ['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED'];

const POSTS: { platform: string; author: string; followers: number; content: string; category: string; sentiment: string; fake: boolean; bot: boolean; cib: number; virality: number; state?: string }[] = [
  // ELECTION_NEWS
  { platform: 'X', author: '@BBCNigeria', followers: 2800000, content: 'BREAKING: INEC declares voting concluded across 774 LGAs. Collation of results has begun at state level centers. Official results expected within 48 hours. #NigeriaDecides2027', category: 'ELECTION_NEWS', sentiment: 'NEUTRAL', fake: false, bot: false, cib: 0, virality: 92, state: 'Abuja' },
  { platform: 'NEWS', author: 'Premium Times', followers: 1500000, content: 'Presidential election: APC leads in early results from 12 states, PDP challenges collation process in Rivers and Bayelsa. Full coverage on our live blog.', category: 'ELECTION_NEWS', sentiment: 'MIXED', fake: false, bot: false, cib: 0, virality: 78, state: 'Lagos' },
  { platform: 'X', author: '@channelstv', followers: 3200000, content: 'UPDATE: BVAS accreditation rate at 78% nationwide. INEC Chairman assures Nigerians that results will be transmitted electronically in real-time. #Election2027', category: 'ELECTION_NEWS', sentiment: 'POSITIVE', fake: false, bot: false, cib: 0, virality: 65 },
  { platform: 'FACEBOOK', author: 'Nigeria Election Watch', followers: 450000, content: 'Live updates from polling units across Lagos. Reports of large voter turnout in Eti-Osa and Ikeja. Security personnel deployed to all flashpoint LGAs.', category: 'ELECTION_NEWS', sentiment: 'POSITIVE', fake: false, bot: false, cib: 0, virality: 45 },

  // DISINFORMATION
  { platform: 'WHATSAPP_CHANNEL', author: 'Unknown Forward', followers: 0, content: 'URGENT: The military has taken over INEC headquarters. All results are being manipulated. Share this widely before they shut down internet! This is not a drill!', category: 'DISINFORMATION', sentiment: 'NEGATIVE', fake: true, bot: false, cib: 0.8, virality: 88, state: 'Kano' },
  { platform: 'X', author: '@NigeriaTruth777', followers: 25000, content: 'PROOF: Video shows INEC official stuffing ballot boxes for APC in Lagos Island. This is systematic rigging! The election is compromised! #RiggedElection', category: 'DISINFORMATION', sentiment: 'NEGATIVE', fake: true, bot: false, cib: 0.65, virality: 72, state: 'Lagos' },
  { platform: 'FACEBOOK', author: 'Patriotic Nigerians Forum', followers: 180000, content: 'FAKE NEWS CHECK: A viral post claims the presidential candidate conceded defeat. This is FALSE. No official concession has been made. The candidate campaign has confirmed they are awaiting official results.', category: 'FACT_CHECK', sentiment: 'NEUTRAL', fake: false, bot: false, cib: 0, virality: 55, state: 'Abuja' },
  { platform: 'TIKTOK', author: '@naija_gist2027', followers: 95000, content: 'They dont want you to see this! Leaked results showing LP won in 18 states but INEC is hiding it! Watch before they delete this video!', category: 'DISINFORMATION', sentiment: 'NEGATIVE', fake: true, bot: true, cib: 0.9, virality: 95, state: 'Lagos' },

  // HATE_SPEECH / VIOLENCE
  { platform: 'X', author: '@warrior_ethnic1', followers: 8000, content: 'If they steal this election, every [ethnic slur] in our state will pay. We will not accept another 4 years of suffering. Enough is enough!', category: 'HATE_SPEECH', sentiment: 'NEGATIVE', fake: false, bot: false, cib: 0.3, virality: 42, state: 'Kaduna' },
  { platform: 'FACEBOOK', author: 'Youth Vanguard Group', followers: 35000, content: 'BREAKING: Gunshots fired at polling unit in Maiduguri. Voters fleeing. INEC officials evacuated. Security forces deploying reinforcements. #BornoElection', category: 'VIOLENCE', sentiment: 'NEGATIVE', fake: false, bot: false, cib: 0, virality: 68, state: 'Borno' },
  { platform: 'X', author: '@SituationalRoomNG', followers: 600000, content: 'Confirmed: Thugs snatched ballot box at Ward 3, Unit 7 in Port Harcourt. Police have arrested 2 suspects. Voting temporarily suspended in the affected unit.', category: 'VIOLENCE', sentiment: 'NEGATIVE', fake: false, bot: false, cib: 0, virality: 74, state: 'Rivers' },

  // RALLY / OPINION
  { platform: 'YOUTUBE', author: 'AIT Live', followers: 890000, content: 'LIVE: Final campaign rally in Lagos. Estimated crowd of 500,000 at Teslim Balogun Stadium. All major party candidates present for final addresses before election day.', category: 'RALLY', sentiment: 'POSITIVE', fake: false, bot: false, cib: 0, virality: 61, state: 'Lagos' },
  { platform: 'INSTAGRAM', author: '@obidient_movement', followers: 1200000, content: 'Our final opinion poll shows 47% support for LP, 31% APC, 19% PDP. This will be the biggest upset in Nigerian electoral history. #Obidient2027', category: 'OPINION_POLL', sentiment: 'POSITIVE', fake: false, bot: false, cib: 0, virality: 82, state: 'Lagos' },
  { platform: 'X', author: '@NOIElections', followers: 420000, content: 'LATEST: Situation Room reports 742 incidents across 28 states. Major categories: logistics delays (31%), voter intimidation (22%), BVAS malfunction (18%). Full dashboard: situationroom.ng', category: 'ELECTION_NEWS', sentiment: 'NEUTRAL', fake: false, bot: false, cib: 0, virality: 57 },

  // BOT_ACTIVITY / CIB_SUSPECT
  { platform: 'X', author: '@MegaForNigeria', followers: 450000, content: 'APC is winning landslide! Results coming in strong across all regions. The people have spoken! Nigeria is moving forward! #APCVictory2027', category: 'CIB_SUSPECT', sentiment: 'POSITIVE', fake: false, bot: true, cib: 0.92, virality: 85, state: 'Lagos' },
  { platform: 'X', author: '@GreenHopeNG', followers: 380000, content: 'We reject these manipulated results! PDP won fairly! International observers must intervene now! This is daylight robbery! #PDPVictory', category: 'CIB_SUSPECT', sentiment: 'NEGATIVE', fake: false, bot: true, cib: 0.88, virality: 80, state: 'Abuja' },
  { platform: 'X', author: '@NaijaUpdates247', followers: 520000, content: 'APC is winning landslide! Results coming in strong across all regions. The people have spoken! Nigeria is moving forward!', category: 'BOT_ACTIVITY', sentiment: 'POSITIVE', fake: false, bot: true, cib: 0.95, virality: 79 },
  { platform: 'X', author: '@PDPTruthTeller', followers: 410000, content: 'We reject these manipulated results! PDP won fairly! International observers must intervene now!', category: 'BOT_ACTIVITY', sentiment: 'NEGATIVE', fake: false, bot: true, cib: 0.93, virality: 76 },
  { platform: 'X', author: '@NaijaUpdates247', followers: 520000, content: 'Breaking: BVAS malfunction reported in 47 polling units across Anambra. INEC deploying replacement devices. Voters asked to remain patient. #NigeriaDecides', category: 'BOT_ACTIVITY', sentiment: 'NEUTRAL', fake: false, bot: true, cib: 0.87, virality: 71, state: 'Anambra' },

  // GENERAL / OTHER
  { platform: 'FACEBOOK', author: 'INEC Official', followers: 2500000, content: 'PUBLIC NOTICE: The commission reminds all political parties and their agents that the results viewing portal (iReV) is live. All accredited party agents can verify results at their polling units. #NigeriaDecides2027', category: 'GENERAL', sentiment: 'NEUTRAL', fake: false, bot: false, cib: 0, virality: 50, state: 'Abuja' },
  { platform: 'X', author: '@USinNigeria', followers: 120000, content: 'The United States commends Nigerians for the peaceful conduct of the presidential election so far. We urge all parties to pursue any grievances through legal channels. #Democracy', category: 'GENERAL', sentiment: 'POSITIVE', fake: false, bot: false, cib: 0, virality: 38 },
  { platform: 'RSS', author: 'Reuters Africa', followers: 5000000, content: 'Nigerias presidential election draws to a close with mixed reports of violence and high turnout. International observer missions say the process was largely credible despite isolated incidents.', category: 'ELECTION_NEWS', sentiment: 'MIXED', fake: false, bot: false, cib: 0, virality: 89 },
  { platform: 'TIKTOK', author: '@lagos_voter', followers: 12000, content: 'Just voted at Ward 4 Unit 12 in Surulere! Process was smooth, BVAS worked perfectly. No issues at all. If you havent voted yet, go now! #MyPVCMyPower', category: 'GENERAL', sentiment: 'POSITIVE', fake: false, bot: false, cib: 0, virality: 33, state: 'Lagos' },
  { platform: 'X', author: '@EUinNigeria', followers: 200000, content: 'EU Election Observation Mission preliminary statement: The election was well-administered in most areas. We note concerns about violence in 3 states and will issue a final report within 60 days.', category: 'GENERAL', sentiment: 'NEUTRAL', fake: false, bot: false, cib: 0, virality: 44, state: 'Abuja' },
];

async function seed() {
  const tenants = await db.tenant.findMany({ select: { id: true, name: true, slug: true } });
  console.log(`Found ${tenants.length} tenants`);

  let totalCreated = 0;
  for (const tenant of tenants) {
    // Create variations with slight content modifications per tenant
    const tenantPosts = POSTS.map((p, i) => {
      const hoursAgo = Math.floor(Math.random() * 12);
      const publishedAt = new Date(Date.now() - hoursAgo * 3600000 - Math.random() * 3600000);
      return {
        tenantId: tenant.id,
        platform: p.platform,
        postId: `${p.platform.toLowerCase()}-${tenant.slug}-${i + 1}`,
        author: p.author,
        authorFollowers: p.followers,
        content: p.state ? p.content : `[${tenant.slug.toUpperCase()}] ${p.content}`,
        mediaUrls: JSON.stringify([]),
        url: null,
        sentiment: p.sentiment,
        category: p.category,
        isVerified: !p.fake && Math.random() > 0.6,
        isFakeNews: p.fake,
        isBotSuspect: p.bot,
        cibScore: p.cib,
        aiSummary: p.fake
          ? `AI flagged: Content matches known disinformation patterns. CIB score: ${p.cib}. Confidence: ${85 + Math.floor(Math.random() * 14)}%.`
          : p.bot
            ? `Bot behavior detected: High post frequency, low engagement ratio, copy-paste content patterns. CIB score: ${p.cib}.`
            : null,
        aiFlags: JSON.stringify(
          p.fake
            ? ['disinformation_pattern', 'unverified_claim', 'emotional_language']
            : p.bot
              ? ['bot_velocity', 'copy_paste_cluster', 'low_engagement_ratio']
              : p.virality > 70
                ? ['viral_spike', 'high_engagement']
                : []
        ),
        viralityScore: p.virality + Math.floor(Math.random() * 10 - 5),
        engagement: JSON.stringify({
          likes: Math.floor(p.virality * 120 + Math.random() * 5000),
          shares: Math.floor(p.virality * 30 + Math.random() * 2000),
          comments: Math.floor(p.virality * 15 + Math.random() * 1000),
          views: Math.floor(p.virality * 5000 + Math.random() * 50000),
        }),
        keywords: JSON.stringify(
          p.category === 'DISINFORMATION'
            ? ['fake', 'rigged', 'manipulated', 'leaked']
            : p.category === 'VIOLENCE'
              ? ['gunshots', 'snatched', 'thugs', 'police']
              : p.category === 'ELECTION_NEWS'
                ? ['INEC', 'results', 'voting', 'BVAS']
                : ['election', 'nigeria', 'vote']
        ),
        location: p.state || 'Nigeria',
        language: 'en',
        publishedAt,
      };
    });

    const result = await db.osintPost.createMany({ data: tenantPosts });
    totalCreated += result.count;
    console.log(`  ${tenant.name}: ${result.count} OSINT posts created`);
  }

  console.log(`\nDone! ${totalCreated} total OSINT posts seeded across ${tenants.length} tenants.`);
  await db.$disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });
