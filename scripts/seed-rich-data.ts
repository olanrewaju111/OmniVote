/**
 * Comprehensive seed script that populates ALL 3 tenants with rich sample data:
 * - Election results with detailed party breakdowns and notes
 * - Incidents with varied types, severities, media URLs (images, videos, voice notes)
 * - Text reports with realistic Nigerian election observation content
 * - Agent messages (simulated engagement history)
 *
 * Run: npx tsx scripts/seed-rich-data.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rand = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pickN = <T>(a: T[], n: number) => {
  const shuffled = [...a].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, a.length));
};

// ─── Simulated Media URLs ────────────────────────────────────────────
// In production these would be real S3/Cloudinary URLs.
// Here we use placeholder paths that the Media Gallery UI can render.

const SAMPLE_IMAGES = [
  'https://omnivote-media.storage.amazonaws.com/field/pu_001_bvas_screen.jpg',
  'https://omnivote-media.storage.amazonaws.com/field/pu_002_queue_line.jpg',
  'https://omnivote-media.storage.amazonaws.com/field/pu_003_voter_card.jpg',
  'https://omnivote-media.storage.amazonaws.com/field/pu_004_ballot_box.jpg',
  'https://omnivote-media.storage.amazonaws.com/field/pu_005_security_post.jpg',
  'https://omnivote-media.storage.amazonaws.com/field/pu_006_incident_scene.jpg',
  'https://omnivote-media.storage.amazonaws.com/field/pu_007_materials_arrival.jpg',
  'https://omnivote-media.storage.amazonaws.com/field/pu_008_voting_proceeds.jpg',
  'https://omnivote-media.storage.amazonaws.com/field/pu_009_party_agents.jpg',
  'https://omnivote-media.storage.amazonaws.com/field/pu_010_inec_official.jpg',
  'https://omnivote-media.storage.amazonaws.com/evidence/ballot_stuffing_01.jpg',
  'https://omnivote-media.storage.amazonaws.com/evidence/intimidation_02.jpg',
  'https://omnivote-media.storage.amazonaws.com/evidence/violence_altercation.jpg',
  'https://omnivote-media.storage.amazonaws.com/evidence/snatched_box_01.jpg',
  'https://omnivote-media.storage.amazonaws.com/evidence/bribery_cash_01.jpg',
  'https://omnivote-media.storage.amazonaws.com/evidence/deepfake_suspect_01.mp4_frame.jpg',
  'https://omnivote-media.storage.googleapis.com/drone/aerial_view_lagos_01.jpg',
  'https://omnivote-media.storage.googleapis.com/drone/aerial_view_kano_01.jpg',
];

const SAMPLE_VIDEOS = [
  'https://omnivote-media.storage.googleapis.com/field/pu_001_bvas_operation.mp4',
  'https://omnivote-media.storage.googleapis.com/field/pu_002_voting_process.mp4',
  'https://omnivote-media.storage.googleapis.com/evidence/ballot_stuffing_clip.mp4',
  'https://omnivote-media.storage.googleapis.com/evidence/violence_clip_01.mp4',
  'https://omnivote-media.storage.googleapis.com/evidence/intimidation_clip.mp4',
  'https://omnivote-media.storage.googleapis.com/evidence/deepfake_analysis.mp4',
  'https://omnivote-media.storage.googleapis.com/field/queue_timelapse.mp4',
  'https://omnivote-media.storage.googleapis.com/field/result_sorting.mp4',
];

const SAMPLE_VOICE = [
  'https://omnivote-media.storage.googleapis.com/voice/agent_001_situation_report.mp3',
  'https://omnivote-media.storage.googleapis.com/voice/agent_002_urgent_update.m4a',
  'https://omnivote-media.storage.googleapis.com/voice/agent_003_violence_report.mp3',
  'https://omnivote-media.storage.googleapis.com/voice/agent_004_logistics_issue.m4a',
  'https://omnivote-media.storage.googleapis.com/voice/agent_005_bvas_malfunction.mp3',
  'https://omnivote-media.storage.googleapis.com/voice/agent_006_peaceful_voting.m4a',
  'https://omnivote-media.storage.googleapis.com/voice/agent_007_materials_delayed.mp3',
  'https://omnivote-media.storage.googleapis.com/voice/agent_008_high_turnout.m4a',
];

// ─── Rich Incident Descriptions ──────────────────────────────────────

const RICH_DESCRIPTIONS = [
  {
    type: 'OBSERVATION',
    descs: [
      'Long queues observed at PU 003. Estimated wait time exceeds 2 hours. Elderly voters struggling to stand. INEC officials have provided chairs but insufficient. Weather is hot and sunny. Agent recommends shade provision.',
      'High voter turnout among first-time voters (18-25 age bracket). Enthusiasm is palpable. Queue management is orderly with support from NYSC corpers. No issues with BVAS accreditation so far.',
      'Rain started at 10:45 AM causing temporary disruption. Voters took shelter under nearby canopies. Voting resumed after 20 minutes. Approximately 150 voters were in queue when rain started.',
      'Peaceful voting environment. All party agents present and cooperative. BVAS functioning normally. Security personnel (2 police officers, 1 civil defense) maintaining order. No incidents observed.',
      'Notably low turnout compared to 2023 elections. Only 87 out of 850 registered voters have been accredited as of 11:30 AM. Potential causes: voter apathy, relocation, or misinformation about date.',
    ],
  },
  {
    type: 'VIOLENCE',
    descs: [
      'Gunshots heard 200 meters from polling unit at approximately 09:15 AM. Voters began dispersing in panic. Security personnel (police) moved toward the source. Three voters sustained minor injuries in the stampede. Ambulance called.',
      'Physical altercation between supporters of two major parties near the voting area. Chairs and tables overturned. Police used teargas to disperse the crowd. Voting suspended for 35 minutes. Calm has been restored.',
      'Group of armed thugs arrived in 2 SUVs and attempted to snatch ballot box. Security personnel repelled them after brief scuffle. One security officer injured. Reinforcement requested. Voting resumed under heavier security.',
      'Political thugs chased away INEC ad-hoc staff at PU 012. BVAS device nearly taken. Military patrol passing by intervened. Staff relocated to a safer spot. Voting resumed after 45 minutes delay.',
    ],
  },
  {
    type: 'INTIMIDATION',
    descs: [
      'Three men in military camouflage (unverified) stationed at the entrance of the polling unit, questioning voters about their choice. Voters visibly intimidated. Police notified but yet to respond. Multiple voters turned back without voting.',
      'Community leader (Baale) openly directing voters to vote for a specific party. His supporters are recording voters who refuse to comply. INEC presiding officer reluctant to confront the Baale due to local power dynamics.',
      'Party agent standing too close to the voting cubicle, attempting to see how voters are marking their ballots. When confronted, he claimed he was "just observing." Repeated warnings have been issued. INEC official monitoring the situation.',
      'Employer of factory workers in the area reportedly threatened to sack workers who do not vote for a particular candidate. Workers confirmed this on condition of anonymity. Labour union has been notified.',
    ],
  },
  {
    type: 'BALLOT_STUFFING',
    descs: [
      'Caught on camera: INEC ad-hoc staff thumb-printing multiple ballots for one party while pretending the BVAS was malfunctioning. Video evidence secured. The staff member has been confronted by party agents. Police at scene.',
      'Party agent observed inserting 8 pre-thumbprinted ballots into the ballot box during a brief distraction when the presiding officer stepped away. Other party agents raised alarm. The ballots in question have been identified and may be separated during counting.',
      'Suspicious pile of 50 already-folded ballot papers found in a nylon bag near the INEC voting area. Papers appear pre-thumbprinted for one party. INEC official has secured the bag as evidence. Police investigating.',
    ],
  },
  {
    type: 'LOGISTICS',
    descs: [
      'Electoral materials arrived 3 hours late (scheduled for 7:00 AM, arrived at 10:05 AM). Reason given: vehicle breakdown. BVAS device battery was at 15% on arrival. Generator has been deployed for charging. Voters growing restless.',
      'BVAS device has malfunctioned three times in the past hour. Each restart takes 8-10 minutes. INEC technical support called but no response after 45 minutes. Accreditation queue is growing significantly.',
      ' Voting cubicle constructed with transparent material — voters\' choices are visible from outside. INEC official has been notified and promised to rectify with cardboard. Issue partially resolved.',
      'Only 2 out of 4 expected INEC ad-hoc staff reported for duty. Remaining staff managing but voting is slow. No explanation given for absence of other staff. Contacted INEC LGA office.',
    ],
  },
  {
    type: 'DEEPFAKE_SUSPECT',
    descs: [
      'AI-generated image circulating on WhatsApp showing INEC chairman announcing election cancellation. Image analysis reveals inconsistent shadow angles, digitally smoothed edges, and metadata manipulation. C2PA verification failed. Quarantined for further investigation.',
      'Video clip showing a prominent politician allegedly admitting to rigging. AI analysis: voice clone detected (87% confidence), lip-sync artifacts visible at 0:14 and 0:27, inconsistent background lighting. Deepfake signature matches known disinformation campaign patterns.',
      'Audio recording purporting to be from INEC headquarters directing staff to manipulate results. Spectral analysis reveals synthetic voice patterns. No matching authentic sample found. Being referred to Trust & Safety team for forensic review.',
    ],
  },
  {
    type: 'CIB_DETECTED',
    descs: [
      'Coordinated inauthentic behavior detected: 47 identical incident reports submitted within 3 minutes from 12 different accounts, all using the same IP range (102.89.xx.xx). Reports contain identical phrasing with minor name variations. Pattern consistent with bot deployment.',
      'Cluster of 15 new accounts registered in the last 2 hours, all with similar naming patterns (first_name.lastnameNNN@domain). All accounts simultaneously submitted reports from the same geolocation. Accounts quarantined pending investigation.',
      'Social media monitoring flagged coordinated posts claiming violence at non-existent polling units. 230+ posts across X, Facebook, WhatsApp groups using identical text. Purpose appears to be creating panic and suppressing voter turnout in specific LGAs.',
    ],
  },
  {
    type: 'GEO_ANOMALY',
    descs: [
      'Agent submitted a report from coordinates 8.5km outside their assigned polling unit geofence. GPS coordinates show location in a neighboring LGA. Possible GPS spoofing or agent is not at assigned location. Agent\'s last 3 reports also show anomalous locations.',
      'Report submitted from coordinates that fall inside a body of water (Lagos Lagoon). GPS module may be malfunctioning. Agent contacted but has not responded. Last known valid location was 45 minutes ago.',
      'Multiple reports from different agents show identical GPS coordinates (6.4521, 3.3914), but the agents are assigned to polling units 5km apart. Suggests GPS module cloning or device sharing. All involved devices flagged for review.',
    ],
  },
  {
    type: 'BRIBERY',
    descs: [
      'Party agent distributing N2,000 cash to voters near the PU entrance. Photo and video evidence captured. Voters are given coded ballot papers to prove they voted as directed. Police at scene appear to be looking the other way.',
      'Voters who show a specific party\'s ballot paper stub after voting are being given food parcels at a nearby compound. Operation appears well-organized with a queue system. Estimated 50+ voters have gone through as of 12:30 PM.',
      'Mobile money transfers of N5,000 being sent to voters who can show proof of voting for a particular party. Transaction screenshots being shared in a WhatsApp group. EFCC has been notified.',
    ],
  },
  {
    type: 'SNATCHED_BALLOT',
    descs: [
      'Ballot box snatched by 4 masked men on 2 motorcycles at 1:15 PM, just before closing. They fled toward the expressway. Police gave chase. Ballot box contained approximately 280 cast votes. INEC official has documented the incident. Rerun may be required.',
      'Attempted ballot box snatching foiled by vigilant voters and security personnel. One suspect apprehended with injuries. Second suspect escaped on foot. Ballot box secured. Voting continued. Police taking suspect to station.',
    ],
  },
  {
    type: 'MULTIPLE_VOTING',
    descs: [
      'Same individual identified voting at two different polling units within 30 minutes. Facial recognition from submitted photos matches. Individual appears to be working with a syndicate — 3 other individuals showing similar patterns. All identities documented.',
      'Voter caught with multiple PVCs (4 cards) attempting to vote serially. Claims they belong to family members who are "not available." PVCs have been confiscated. INEC official and police investigating.',
    ],
  },
  {
    type: 'UNDERAGE_VOTING',
    descs: [
      'Group of 7 minors (estimated ages 12-16) observed in the voting queue with PVCs. When questioned, they claimed to be 18 but could not provide valid identification. INEC presiding officer has turned them away but more are arriving.',
      'Community leader brought 12 underage voters claiming they are "eligible." PVCs appear genuine but facial features suggest minors. INEC official refusing accreditation. Tension rising as community supporters gather.',
    ],
  },
];

// ─── Party Configurations per Tenant ─────────────────────────────────

const PRESIDENTIAL_PARTIES = [
  { party: 'APC', name: 'All Progressives Congress', votes: 0, color: '#008751' },
  { party: 'PDP', name: 'Peoples Democratic Party', votes: 0, color: '#CE1126' },
  { party: 'LP', name: 'Labour Party', votes: 0, color: '#2196F3' },
  { party: 'NNPP', name: 'New Nigeria Peoples Party', votes: 0, color: '#FF9800' },
  { party: 'ADC', name: 'African Democratic Congress', votes: 0, color: '#9C27B0' },
  { party: 'SDP', name: 'Social Democratic Party', votes: 0, color: '#E91E63' },
  { party: 'APGA', name: 'All Progressives Grand Alliance', votes: 0, color: '#4CAF50' },
  { party: 'Others', name: 'Other Parties', votes: 0, color: '#607D8B' },
];

const GOVERNORSHIP_PARTIES = [
  { party: 'APC', name: 'All Progressives Congress', votes: 0, color: '#008751' },
  { party: 'PDP', name: 'Peoples Democratic Party', votes: 0, color: '#CE1126' },
  { party: 'LP', name: 'Labour Party', votes: 0, color: '#2196F3' },
  { party: 'NNPP', name: 'New Nigeria Peoples Party', votes: 0, color: '#FF9800' },
  { party: 'ADC', name: 'African Democratic Congress', votes: 0, color: '#9C27B0' },
];

const LOCAL_PARTIES = [
  { party: 'APC', name: 'All Progressives Congress', votes: 0, color: '#008751' },
  { party: 'PDP', name: 'Peoples Democratic Party', votes: 0, color: '#CE1126' },
  { party: 'LP', name: 'Labour Party', votes: 0, color: '#2196F3' },
  { party: 'AA', name: 'Action Alliance', votes: 0, color: '#FF5722' },
];

// ─── Result Notes ────────────────────────────────────────────────────

const RESULT_NOTES = [
  'BVAS accreditation went smoothly. Long queue but orderly process.',
  'Minor delay in materials arrival (25 mins). Voting commenced without further issues.',
  'BVAS malfunctioned twice. Had to restart both times. Total delay: 18 minutes.',
  'High turnout of young voters. Enthusiasm was high throughout the day.',
  'Security was adequate. 2 police officers, 1 civil defense present.',
  'Rain interrupted voting for 15 minutes. Canopy was provided by a nearby shop owner.',
  'Party agents were cooperative. No disputes during vote counting.',
  'One incident of attempted voter intimidation was quickly resolved by security.',
  'INEC officials were professional and efficient. Process completed ahead of schedule.',
  'BVAS battery ran low. Generator was used to charge. Minor delay.',
  'Late arrival of electoral materials caused initial agitation among voters.',
  'Voter education materials were available. First-time voters found the process easy.',
  'Observation team noted minor irregularities in the queue management process.',
  'Peaceful election. All stakeholders commend the process.',
  'Vote counting was transparent. All party agents signed the result sheet.',
  'BVAS uploaded results successfully to INEC server. Physical copy also available.',
  'Minor scuffle between party agents over voter identification. Resolved amicably.',
  'PWD voters were given priority access. Good inclusive practice observed.',
  'Incident of multiple voting attempted but was quickly detected and prevented.',
  'Total votes cast slightly exceed accredited voters — discrepancy of 3 votes being investigated.',
];

// ─── Helper Functions ────────────────────────────────────────────────

function generateMediaUrls(type: string, severity: string): string {
  const urls: string[] = [];
  // Most incidents get 1-3 images
  const numImages = rand(1, 3);
  urls.push(...pickN(SAMPLE_IMAGES, numImages));

  // Medium+ severity may have video
  if (['MEDIUM', 'HIGH', 'CRITICAL'].includes(severity) && Math.random() > 0.4) {
    urls.push(pick(SAMPLE_VIDEOS));
  }

  // All incidents get a voice note (field agents often send voice reports)
  if (Math.random() > 0.3) {
    urls.push(pick(SAMPLE_VOICE));
  }
  // Security/tech incidents more likely to have video
  if (['DEEPFAKE_SUSPECT', 'CIB_DETECTED', 'BALLOT_STUFFING', 'VIOLENCE'].includes(type)) {
    urls.push(pick(SAMPLE_VIDEOS));
    urls.push(...pickN(SAMPLE_IMAGES, rand(1, 2)));
  }

  return JSON.stringify([...new Set(urls)]);
}

function generatePartyResults(parties: { party: string; name: string; votes: number; color: string }[], validVotes: number) {
  const shuffled = parties.map(p => ({ ...p, votes: rand(5, Math.floor(validVotes * 0.4)) }));
  const total = shuffled.reduce((s, p) => s + p.votes, 0);
  return shuffled.map(p => ({ ...p, votes: Math.round(p.votes / total * validVotes) }))
    .sort((a, b) => b.votes - a.votes);
}

function getDescForType(type: string): string {
  const group = RICH_DESCRIPTIONS.find(g => g.type === type);
  return group ? pick(group.descs) : pick(RICH_DESCRIPTIONS[0].descs);
}

// ─── Seed Functions per Tenant ──────────────────────────────────────

async function seedTenantData(
  tenantId: string,
  parties: { party: string; name: string; votes: number; color: string }[],
  config: { resultsTarget: number; incidentsTarget: number; messagesTarget: number }
) {
  const agents = await db.user.findMany({
    where: { tenantId, role: 'FIELD_AGENT' },
    select: { id: true, name: true, email: true },
  });
  const admins = await db.user.findMany({
    where: { tenantId, role: { in: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ANALYST'] } },
    select: { id: true, name: true },
  });
  const pus = await db.pollingUnit.findMany({
    where: { election: { tenantId } },
    select: { id: true, name: true, code: true, state: true, lga: true, ward: true, latitude: true, longitude: true, registeredVoters: true },
  });

  if (agents.length === 0 || pus.length === 0) {
    console.log(`    Skipping ${tenantId} — no agents (${agents.length}) or PUs (${pus.length})`);
    return;
  }

  // Check existing counts
  const existingResults = await db.electionResult.count({ where: { tenantId } });
  const existingIncidents = await db.incident.count({ where: { tenantId } });
  const existingMessages = await db.agentMessage.count({ where: { tenantId } });

  console.log(`    Tenant ${tenantId}: ${agents.length} agents, ${pus.length} PUs`);
  console.log(`      Existing: ${existingResults} results, ${existingIncidents} incidents, ${existingMessages} messages`);

  // ─── 1. ELECTION RESULTS ───────────────────────────────────────
  const resultsToCreate = Math.max(0, config.resultsTarget - existingResults);
  console.log(`      Creating ${resultsToCreate} results...`);

  for (let i = 0; i < resultsToCreate; i++) {
    const pu = pick(pus);
    const agent = pick(agents);
    const reg = pu.registeredVoters || rand(200, 1200);
    const turnout = Math.random() * 0.45 + 0.2;
    const accredited = Math.floor(reg * turnout);
    const validVotes = rand(Math.floor(accredited * 0.7), accredited);
    const rejected = rand(2, Math.floor(validVotes * 0.08));
    const totalCast = validVotes + rejected;

    const partyResults = generatePartyResults(parties, validVotes);
    const notes = pick(RESULT_NOTES);
    const hasIncident = Math.random() > 0.75;

    await db.electionResult.create({
      data: {
        tenantId, pollingUnitId: pu.id, reportedById: agent.id,
        accreditedVoters: accredited,
        totalValidVotes: validVotes,
        rejectedBallots: rejected,
        totalVotesCast: totalCast,
        partyResults: JSON.stringify(partyResults),
        bvasUsed: Math.random() > 0.08,
        materialsArrivedOnTime: Math.random() > 0.15,
        securityPresent: Math.random() > 0.1,
        violenceOccurred: hasIncident,
        notes: `${notes} — Reported by ${agent.name}`,
        verified: Math.random() > 0.6,
        verifiedById: Math.random() > 0.6 ? pick(admins).id : null,
        submittedAt: new Date(Date.now() - rand(120000, 14400000)),
      },
    });

    // Auto-close the PU
    await db.pollingUnit.update({
      where: { id: pu.id },
      data: { status: pick(['CLOSED', 'CLOSED', 'CLOSED', 'FLAGGED']), totalVotes: totalCast, turnout: Math.round(turnout * 100) / 100 },
    });
  }

  // ─── 2. INCIDENTS WITH MEDIA ──────────────────────────────────
  const incidentsToCreate = Math.max(0, config.incidentsTarget - existingIncidents);
  console.log(`      Creating ${incidentsToCreate} incidents...`);

  const incidentTypes = RICH_DESCRIPTIONS.map(r => r.type);

  for (let i = 0; i < incidentsToCreate; i++) {
    const agent = pick(agents);
    const pu = pick(pus);
    const type = pick(incidentTypes);
    const isSecurity = ['DEEPFAKE_SUSPECT', 'CIB_DETECTED', 'GEO_ANOMALY'].includes(type);
    const isSevere = ['VIOLENCE', 'SNATCHED_BALLOT', 'BALLOT_STUFFING'].includes(type);

    const severity = isSevere ? pick(['HIGH', 'CRITICAL'])
      : isSecurity ? pick(['HIGH', 'CRITICAL'])
      : pick(['LOW', 'LOW', 'MEDIUM', 'MEDIUM', 'HIGH']);

    const status = isSecurity ? 'QUARANTINED'
      : severity === 'CRITICAL' ? pick(['ESCALATED', 'PENDING'])
      : pick(['PENDING', 'PENDING', 'REVIEWED', 'REVIEWED', 'ESCALATED', 'DISMISSED']);

    const desc = getDescForType(type);
    const mediaUrls = generateMediaUrls(type, severity);
    const gpsAnomaly = type === 'GEO_ANOMALY' ? true : Math.random() > 0.92;

    const inc = await db.incident.create({
      data: {
        tenantId,
        pollingUnitId: pu.id,
        reportedById: agent.id,
        type,
        severity,
        status,
        description: desc,
        mediaUrls,
        gpsLatitude: gpsAnomaly ? pu.latitude + (Math.random() - 0.5) * 0.15 : pu.latitude + (Math.random() - 0.5) * 0.02,
        gpsLongitude: gpsAnomaly ? pu.longitude + (Math.random() - 0.5) * 0.15 : pu.longitude + (Math.random() - 0.5) * 0.02,
        gpsAnomaly,
        aiSummary: isSecurity
          ? `AI ANALYSIS: ${type.replace(/_/g, ' ')} detected. Confidence: ${rand(85, 99)}%. Pattern matches known threat signatures. Automated quarantine applied.`
          : `Incident at ${pu.name} (${pu.lga}, ${pu.state}). Type: ${type.replace(/_/g, ' ')}. Severity: ${severity}. ${severity === 'HIGH' || severity === 'CRITICAL' ? 'Requires immediate attention.' : 'Under review.'}`,
        aiFlags: JSON.stringify(isSecurity
          ? ['SECURITY_ALERT', 'AI_FLAGGED', 'FORENSIC_REVIEW_NEEDED']
          : severity === 'HIGH' ? ['PRIORITY_REVIEW', 'ESCALATION_CANDIDATE']
          : severity === 'CRITICAL' ? ['SOS', 'IMMEDIATE_ESCALATION', 'NOTIFY_COMMAND']
          : Math.random() > 0.7 ? ['REVIEW_NEEDED'] : []),
        isQuarantined: status === 'QUARANTINED',
        c2paVerified: Math.random() > 0.5,
        submittedAt: new Date(Date.now() - rand(60000, 14400000)),
        reviewedAt: status !== 'PENDING' ? new Date(Date.now() - rand(0, 3600000)) : null,
        reviewedById: status !== 'PENDING' ? pick(admins).id : null,
      },
    });

    // Create alert for significant incidents
    if (severity === 'HIGH' || severity === 'CRITICAL' || isSevere || isSecurity) {
      await db.alert.create({
        data: {
          tenantId,
          incidentId: inc.id,
          type: isSecurity ? 'SECURITY' : 'OPERATIONAL',
          category: severity === 'CRITICAL' ? 'CRITICAL' : severity === 'HIGH' ? 'WARNING' : 'INFO',
          title: `[${type.replace(/_/g, ' ')}] ${pu.name}`,
          description: desc.substring(0, 200),
          isRead: Math.random() > 0.5,
          createdAt: inc.submittedAt,
        },
      });
    }
  }

  // ─── 3. AGENT MESSAGES (engagement history) ───────────────────
  const messagesToCreate = Math.max(0, config.messagesTarget - existingMessages);
  console.log(`      Creating ${messagesToCreate} agent messages...`);

  const engagementTemplates = {
    IDLE_DETECTION: [
      { subject: 'Activity Check — No Recent Reports', body: 'Our system shows no reports from you in the last 60 minutes. Please confirm your status and submit any observations from your polling unit. Your coverage is critical.' },
      { subject: 'Are You Still at Your Post?', body: 'You have been idle for over 90 minutes. Please check in immediately with your current situation report. If you have moved from your assigned PU, notify your supervisor.' },
      { subject: 'Coverage Gap Alert', body: 'No data received from your assigned polling unit in the past 2 hours. Other agents in your LGA have submitted reports. Please submit your observation report now.' },
    ],
    NO_DATA: [
      { subject: 'First Report Reminder', body: 'You have not submitted any reports since deployment. Please submit your initial situation report including: materials arrival time, BVAS status, voter queue status, and security presence.' },
      { subject: 'Data Submission Required', body: 'Your polling unit has zero submitted reports. All agents are expected to submit at minimum an hourly status update. Please submit your report now via the OmniVote app.' },
      { subject: 'Missing Results Alert', body: 'Your assigned PU shows no election results submitted. If voting has concluded at your unit, please submit the results immediately including the official result sheet.' },
    ],
    INCIDENT_FOLLOWUP: [
      { subject: 'Follow-up Required: Critical Incident', body: 'The critical incident you reported requires additional information. Please provide: 1) Names of security personnel on scene, 2) Current situation status, 3) Any additional photos or video evidence.' },
      { subject: 'Verification Request: Violence Report', body: 'Your violence report has been escalated to the command center. Please confirm the current status — has the situation been resolved? Are voters able to continue voting safely?' },
      { subject: 'Additional Evidence Needed', body: 'The incident you reported needs more documentation. Please capture: wide-angle photos of the scene, a 30-second video walkthrough, and statements from any witnesses.' },
    ],
    INFRACTION_REMINDER: [
      { subject: 'Report Quality Notice', body: 'Your recent reports have been flagged for incomplete data. Please ensure all reports include: GPS coordinates, photos, and detailed descriptions. Template reports may be quarantined.' },
      { subject: 'Geofence Violation Warning', body: 'Your last 3 reports were submitted from outside your assigned polling unit geofence. Please remain at your assigned location and submit reports from the correct position.' },
      { subject: 'Protocol Reminder: Evidence Collection', body: 'Reminder: All incident reports must include photographic evidence. Voice-only reports should be followed up with photos within 15 minutes. Please adhere to the reporting protocol.' },
    ],
    SCHEDULED_CHECKIN: [
      { subject: 'Hourly Check-in Required', body: 'This is your scheduled hourly check-in. Please respond with: 1) Current voter queue length, 2) BVAS accreditation count so far, 3) Any incidents or observations, 4) Security status.' },
      { subject: 'Midday Status Update', body: 'Please provide a midday situation report. Include: voting progress, turnout estimate, any incidents since your last report, and whether materials/logistics are adequate.' },
      { subject: 'Pre-Closing Checklist', body: 'As voting approaches closing time, please prepare: 1) Final accreditation count, 2) Total ballots issued, 3) Any remaining incidents, 4) Readiness for vote counting.' },
    ],
    MANUAL: [
      { subject: 'New Assignment Update', body: 'You have been reassigned to a new polling unit. Please acknowledge this message and proceed to the new location. Your new PU details will be sent via WhatsApp.' },
      { subject: 'Safety Advisory', body: 'Security intelligence indicates potential unrest in your area. Please exercise caution, maintain communication, and be prepared to relocate if necessary. Emergency contact: 0800-OmniVote.' },
      { subject: 'INEC Schedule Change', body: 'Please note: INEC has announced an extension of voting hours by 2 hours. Adjust your schedule accordingly and continue monitoring.' },
    ],
  };

  const channels = ['IN_APP', 'WHATSAPP', 'SMS', 'PUSH'] as const;
  const triggerTypes = Object.keys(engagementTemplates);

  for (let i = 0; i < messagesToCreate; i++) {
    const agent = pick(agents);
    const trigger = pick(triggerTypes) as keyof typeof engagementTemplates;
    const template = pick(engagementTemplates[trigger]);
    const channel = pick([...channels]);
    const admin = pick(admins);
    const priority = trigger === 'IDLE_DETECTION' || trigger === 'NO_DATA' ? pick(['NORMAL', 'HIGH'])
      : trigger === 'INCIDENT_FOLLOWUP' ? pick(['HIGH', 'URGENT'])
      : trigger === 'INFRACTION_REMINDER' ? pick(['NORMAL', 'HIGH'])
      : pick(['LOW', 'NORMAL']);

    const statusRoll = Math.random();
    const status = statusRoll < 0.15 ? 'FAILED'
      : statusRoll < 0.3 ? 'PENDING'
      : statusRoll < 0.55 ? 'SENT'
      : statusRoll < 0.8 ? 'DELIVERED'
      : 'READ';

    const hasResponse = status === 'DELIVERED' || status === 'READ' ? Math.random() > 0.6 : false;
    const responseTexts = [
      'Acknowledged. Currently at PU. No issues to report. Will submit formal report shortly.',
      'Received. There was a brief delay due to network issues. Submitting report now.',
      'I am at my assigned PU. BVAS is functioning. About 200 voters accredited so far.',
      'Yes, I am active. Just submitted my report. Network is slow in this area.',
      'Situation is calm here. No incidents. Will continue monitoring.',
      'I need backup. There are armed men nearby. Requesting immediate security reinforcement.',
      'Cannot submit report — BVAS has no network connection. Trying alternative network.',
      'All clear. Voting proceeding smoothly. High turnout among young people.',
      null,
    ];

    const idleMinutes = trigger === 'IDLE_DETECTION' ? rand(30, 180) : null;
    const metadata: Record<string, unknown> = {};
    if (idleMinutes) metadata.idleMinutes = idleMinutes;
    if (trigger === 'NO_DATA') metadata.lastReportDate = new Date(Date.now() - rand(3600000, 86400000)).toISOString();
    if (trigger === 'INCIDENT_FOLLOWUP') metadata.relatedIncidentType = pick(incidentTypes);

    await db.agentMessage.create({
      data: {
        tenantId,
        agentId: agent.id,
        sentById: Math.random() > 0.2 ? admin.id : null, // some are system-auto
        channel,
        triggerType: trigger,
        subject: template.subject,
        body: template.body,
        priority,
        status,
        deliveredAt: ['DELIVERED', 'READ'].includes(status) ? new Date(Date.now() - rand(60000, 1800000)) : null,
        readAt: status === 'READ' ? new Date(Date.now() - rand(30000, 900000)) : null,
        responseText: hasResponse ? pick(responseTexts) : null,
        respondedAt: hasResponse ? new Date(Date.now() - rand(60000, 600000)) : null,
        metadata: JSON.stringify(metadata),
        createdAt: new Date(Date.now() - rand(300000, 10800000)),
      },
    });
  }

  // Update some agent lastSeenAt to create "idle" agents
  const idleAgents = pickN(agents, Math.max(2, Math.floor(agents.length * 0.3)));
  for (const agent of idleAgents) {
    await db.user.update({
      where: { id: agent.id },
      data: {
        isOnline: Math.random() > 0.5,
        lastSeenAt: new Date(Date.now() - rand(1800000, 7200000)), // 30 min to 2 hours ago
      },
    });
  }

  // Set some agents as truly offline (no data for hours)
  const offlineAgents = pickN(agents.filter(a => !idleAgents.find(ia => ia.id === a.id)), Math.max(1, Math.floor(agents.length * 0.15)));
  for (const agent of offlineAgents) {
    await db.user.update({
      where: { id: agent.id },
      data: {
        isOnline: false,
        lastSeenAt: new Date(Date.now() - rand(7200000, 28800000)), // 2 to 8 hours ago
      },
    });
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Seeding Rich Electoral Data for All Tenants ===\n');

  const tenants = await db.tenant.findMany({ where: { isActive: true }, select: { id: true, name: true, slug: true } });

  for (const tenant of tenants) {
    console.log(`\n▶ ${tenant.name} (${tenant.slug})`);

    if (tenant.slug === 'presidential') {
      await seedTenantData(tenant.id, PRESIDENTIAL_PARTIES, {
        resultsTarget: 80,
        incidentsTarget: 60,
        messagesTarget: 40,
      });
    } else if (tenant.slug === 'governorship') {
      await seedTenantData(tenant.id, GOVERNORSHIP_PARTIES, {
        resultsTarget: 50,
        incidentsTarget: 45,
        messagesTarget: 35,
      });
    } else if (tenant.slug === 'local-gov') {
      await seedTenantData(tenant.id, LOCAL_PARTIES, {
        resultsTarget: 25,
        incidentsTarget: 30,
        messagesTarget: 20,
      });
    } else {
      console.log('    Skipping unknown tenant');
    }
  }

  // ─── Summary ──────────────────────────────────────────────────
  console.log('\n\n=== FINAL SUMMARY ===');
  const allTenants = await db.tenant.findMany({
    include: {
      _count: { select: { users: true, elections: true, incidents: true, results: true, alerts: true, agentMessages: true } },
    },
  });

  for (const t of allTenants) {
    const puCount = await db.pollingUnit.count({ where: { election: { tenantId: t.id } } });
    const mediaCount = await db.incident.findMany({
      where: { tenantId: t.id, mediaUrls: { not: '[]' } },
      select: { mediaUrls: true },
    });
    const totalMediaItems = mediaCount.reduce((sum, inc) => {
      try { return sum + JSON.parse(inc.mediaUrls || '[]').length; } catch { return sum; }
    }, 0);

    console.log(`\n  ${t.name} (${t.slug}):`);
    console.log(`    Users: ${t._count.users} | Elections: ${t._count.elections} | Polling Units: ${puCount}`);
    console.log(`    Results: ${t._count.results} | Incidents: ${t._count.incidents} | Alerts: ${t._count.alerts}`);
    console.log(`    Agent Messages: ${t._count.agentMessages} | Media Items: ${totalMediaItems}`);
  }

  await db.$disconnect();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });