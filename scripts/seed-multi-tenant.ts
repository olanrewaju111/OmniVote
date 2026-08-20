import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rand = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;

const FNAMES = ['Adebayo','Chukwuemeka','Fatima','Ibrahim','Olufunke','Emeka','Aisha','Olumide','Ngozi','Yusuf','Blessing','Kola','Amara','Sani','Tolu','Hauwa','Obinna','Zainab','Segun','Chioma','Uchenna','Mustapha','Bimpe','Damilola','Khalid','Adaeze','Gbenga','Halima','Nnamdi','Rashida'];
const LNAMES = ['Okafor','Abubakar','Okonkwo','Mohammed','Adeyemi','Eze','Balogun','Ibrahim','Chukwu','Ogunleye','Ahmed','Nwosu','Bello','Adesanya','Ogbonna','Oyelaran','Tinubu','Atiku','Obi','Kwankwaso'];

const DESCS = [
  'Long queues observed. Estimated wait time exceeds 2 hours.',
  'BVAS device malfunction. INEC officials restarting the system.',
  'Voter intimidation — armed men stationed near the entrance.',
  'Ballot box stuffing witnessed. Three persons inserting multiple ballots.',
  'Electoral materials arrived 3 hours late.',
  'Peaceful environment. High voter turnout among young voters.',
  'Rain causing minor disruption. Voters remain determined.',
  'Security personnel maintaining order. No incidents reported.',
  'Suspected vote buying activity near the polling unit.',
  'Unauthorized persons within the voting perimeter.',
  'Power outage affecting BVAS charging. Generator deployed.',
  'Elderly and disabled voters given priority. Good inclusive practice.',
  'Party agents in heated argument. Police intervention needed.',
  'Card reader rejecting many PVCs. Distribution issues suspected.',
  'Unusually low turnout compared to registration numbers.',
  'Gunshots heard near the station. Voters dispersing in panic.',
  'AI-Generated media detected: Inconsistent shadows and digital artifacts. Quarantined.',
  'Coordinated report pattern: 12 identical reports from same IP range. CIB investigation.',
  'Geolocation anomaly: Report from 8km outside assigned geofence.',
  'Snatched ballot box reported. Voters chased away.',
  'Multiple voting detected — same individual seen voting twice.',
  'Bribery: Party agent distributing cash near PU entrance.',
  'Underage voting observed — several minors in the queue.',
  'Materials arrived early. Voting commenced on schedule.',
];

const STATES_FULL = ['Lagos', 'Abuja FCT', 'Rivers', 'Kano', 'Oyo', 'Enugu', 'Kaduna', 'Delta', 'Ogun', 'Borno', 'Akwa Ibom', 'Edo', 'Plateau', 'Anambra', 'Kwara'];

const LGAS_FULL: Record<string, string[]> = {
  'Lagos': ['Lagos Island', 'Ikeja', 'Surulere', 'Eti-Osa', 'Alimosho', 'Badagry'],
  'Abuja FCT': ['Municipal', 'Bwari', 'Gwagwalada', 'Kuje', 'Abaji', 'Kwali'],
  'Rivers': ['Port Harcourt', 'Obio-Akpor', 'Eleme', 'Ikwerre', 'Ogba-Egbema', 'Degema'],
  'Kano': ['Kano Municipal', 'Nassarawa', 'Fagge', 'Dala', 'Gwale', 'Tarauni'],
  'Oyo': ['Ibadan North', 'Ibadan South', 'Oyo West', 'Ogbomoso', 'Ibarapa', 'Saki'],
  'Enugu': ['Enugu North', 'Enugu South', 'Nsukka', 'Nkanu', 'Udi', 'Awgu'],
  'Kaduna': ['Kaduna North', 'Kaduna South', 'Zaria', 'Igabi', 'Chikun', 'Kajuru'],
  'Delta': ['Warri North', 'Warri South', 'Asaba', 'Ughelli', 'Sapele', 'Okpe'],
  'Ogun': ['Abeokuta North', 'Abeokuta South', 'Ijebu-Ode', 'Sagamu', 'Ota', 'Ilaro'],
  'Borno': ['Maiduguri', 'Konduga', 'Jere', 'Biu', 'Gwoza', 'Dikwa'],
  'Akwa Ibom': ['Uyo', 'Eket', 'Ikot Ekpene', 'Oron', 'Obolo', 'Ibiono'],
  'Edo': ['Benin City', 'Oredo', 'Ikpoba-Okha', 'Egor', 'Uhunmwonde', 'Ovia'],
  'Plateau': ['Jos North', 'Jos South', 'Barkin Ladi', 'Pankshin', 'Shendam', 'Wase'],
  'Anambra': ['Awka', 'Onitsha', 'Nnewi', 'Ekwulobia', 'Oko', 'Aguleri'],
  'Kwara': ['Ilorin West', 'Ilorin East', 'Offa', 'Jebba', 'Patigi', 'Lafiagi'],
};

// Lagos-specific LGAs for Governorship
const LAGOS_LGAS = ['Lagos Island', 'Ikeja', 'Surulere', 'Eti-Osa', 'Alimosho', 'Badagry', 'Agege', 'Ifako-Ijaiye', 'Kosofe', 'Amuwo-Odofin', 'Apapa', 'Lagos Mainland', 'Mushin', 'Oshodi-Isolo'];

// Lagos Island wards for Local Gov
const LAGOS_ISLAND_WARDS = ['Ward A (Lagos Island East)', 'Ward B (Lagos Island West)', 'Ward C (Obalende)', 'Ward D (Ikoyi)', 'Ward E (Lafiaji)', 'Ward F (Eko Atlantic)'];

const INCIDENT_TYPES = ['OBSERVATION','VIOLENCE','INTIMIDATION','BALLOT_STUFFING','LOGISTICS','DEEPFAKE_SUSPECT','CIB_DETECTED','GEO_ANOMALY','BRIBERY','SNATCHED_BALLOT','MULTIPLE_VOTING','UNDERAGE_VOTING'];

async function createUser(tenantId: string, role: string, email: string, name: string, isOnline = false) {
  return db.user.create({
    data: {
      email, name, role, tenantId,
      passwordHash: 'changeme', // dev seed — bcrypt of 'password'
      isOnline: isOnline || Math.random() > 0.3,
      lastSeenAt: new Date(Date.now() - rand(60000, 3600000)),
    },
  });
}

async function seedIncidents(tenantId: string, agents: { id: string }[], pus: { id: string; name: string; lat: number; lng: number }[], count: number) {
  const sevs = ['LOW','LOW','MEDIUM','MEDIUM','HIGH','CRITICAL'];
  for (let i = 0; i < count; i++) {
    const agent = pick(agents);
    const pu = pick(pus);
    const type = pick(INCIDENT_TYPES);
    const sev = (type==='VIOLENCE'||type==='SNATCHED_BALLOT'||type==='DEEPFAKE_SUSPECT'||type==='CIB_DETECTED'||type==='GEO_ANOMALY') ? pick(['HIGH','CRITICAL']) : pick(sevs);
    const isSec = ['DEEPFAKE_SUSPECT','CIB_DETECTED','GEO_ANOMALY'].includes(type);
    const status = isSec ? 'QUARANTINED' : sev==='CRITICAL' ? pick(['ESCALATED','PENDING']) : pick(['PENDING','PENDING','REVIEWED','ESCALATED','DISMISSED']);
    const desc = pick(DESCS);

    const inc = await db.incident.create({
      data: {
        tenantId, pollingUnitId: pu.id, reportedById: agent.id,
        type, severity: sev, status, description: desc,
        gpsLatitude: pu.lat + (Math.random()-0.5)*0.02,
        gpsLongitude: pu.lng + (Math.random()-0.5)*0.02,
        gpsAnomaly: type==='GEO_ANOMALY' ? true : Math.random()>0.9,
        aiSummary: isSec ? `AI detected ${type}. Confidence: ${rand(88,99)}%.` : `Incident at ${pu.name}. ${sev} severity.`,
        aiFlags: JSON.stringify(isSec ? ['SECURITY_ALERT','AI_FLAGGED'] : sev==='HIGH' ? ['PRIORITY_REVIEW'] : []),
        isQuarantined: status==='QUARANTINED',
        c2paVerified: Math.random()>0.6,
        submittedAt: new Date(Date.now() - rand(60000, 7200000)),
        reviewedAt: status!=='PENDING' ? new Date(Date.now() - rand(0, 1800000)) : null,
      },
    });

    if (sev === 'HIGH' || sev === 'CRITICAL' || type === 'VIOLENCE' || type === 'BALLOT_STUFFING') {
      await db.alert.create({
        data: {
          tenantId, incidentId: inc.id,
          type: isSec ? 'SECURITY' : 'OPERATIONAL',
          category: sev==='CRITICAL' ? 'CRITICAL' : sev==='HIGH' ? 'WARNING' : 'INFO',
          title: `[${type.replace(/_/g,' ')}] ${pu.name}`,
          description: desc.substring(0, 120),
          isRead: Math.random()>0.5,
          createdAt: inc.submittedAt,
        },
      });
    }
  }
}

// ============================================================
// TENANT 1: PRESIDENTIAL (update existing)
// ============================================================
async function seedPresidential(tenantId: string) {
  console.log('  Seeding Presidential election data...');

  // Ensure election exists
  const existing = await db.election.findFirst({ where: { tenantId } });
  if (!existing) {
    await db.election.create({
      data: { tenantId, title: '2027 Presidential Election', tier: 'PRESIDENTIAL', status: 'ACTIVE', date: new Date('2027-02-21T08:00:00Z') },
    });
  } else {
    await db.election.update({ where: { id: existing.id }, data: { title: '2027 Presidential Election', tier: 'PRESIDENTIAL', status: 'ACTIVE', date: new Date('2027-02-21T08:00:00Z') } });
  }

  // Create specific personas if they don't exist
  const existingUsers = await db.user.findMany({ where: { tenantId }, select: { email: true } });
  const emails = new Set(existingUsers.map(u => u.email));

  const personas = [
    { role: 'SUPER_ADMIN', email: 'admin@presidential.omnivote.ng', name: 'Aisha Bello' },
    { role: 'TENANT_ADMIN', email: 'tenant@presidential.omnivote.ng', name: 'Chukwuemeka Okafor' },
    { role: 'ANALYST', email: 'analyst@presidential.omnivote.ng', name: 'Fatima Abubakar' },
    { role: 'TRUST_SAFETY', email: 'trust@presidential.omnivote.ng', name: 'Olufunke Adeyemi' },
    { role: 'FIELD_AGENT', email: 'field@presidential.omnivote.ng', name: 'Blessing Ogunleye', online: true },
    { role: 'FIELD_AGENT', email: 'field2@presidential.omnivote.ng', name: 'Segun Balogun', online: true },
  ];

  const agents: { id: string }[] = [];
  for (const p of personas) {
    if (!emails.has(p.email)) {
      const u = await createUser(tenantId, p.role, p.email, p.name, p.online);
      if (p.role === 'FIELD_AGENT') agents.push({ id: u.id });
    } else {
      const u = await db.user.findFirst({ where: { email: p.email, tenantId }, select: { id: true, role: true } });
      if (u && u.role === 'FIELD_AGENT') agents.push({ id: u.id });
    }
  }

  // Also grab existing field agents
  const existingAgents = await db.user.findMany({ where: { tenantId, role: 'FIELD_AGENT' }, select: { id: true } });
  for (const a of existingAgents) {
    if (!agents.find(x => x.id === a.id)) agents.push(a);
  }

  // PU data already exists from original seed (269 PUs across 15 states)
  const pus = await db.pollingUnit.findMany({
    where: { election: { tenantId } },
    select: { id: true, name: true, latitude: true, longitude: true },
  });

  // Add some incidents
  await seedIncidents(tenantId, agents.length > 0 ? agents : existingAgents, pus, 20);

  console.log(`    Presidential: ${existingAgents.length} agents, ${pus.length} PUs`);
}

// ============================================================
// TENANT 2: GOVERNORSHIP (Lagos State)
// ============================================================
async function seedGovernorship() {
  console.log('  Creating Governorship tenant (Lagos State)...');

  const tenant = await db.tenant.create({
    data: { name: 'Lagos State Governorship Monitor', slug: 'governorship', primaryColor: '#f59e0b', isActive: true },
  });

  const election = await db.election.create({
    data: { tenantId: tenant.id, title: '2027 Lagos State Governorship Election', tier: 'STATE', status: 'ACTIVE', date: new Date('2027-03-15T08:00:00Z') },
  });

  // Users
  const agents: { id: string }[] = [];
  const personas = [
    { role: 'SUPER_ADMIN', email: 'admin@governorship.omnivote.ng', name: 'Gbenga Oyelaran' },
    { role: 'TENANT_ADMIN', email: 'tenant@governorship.omnivote.ng', name: 'Ngozi Eze' },
    { role: 'ANALYST', email: 'analyst@governorship.omnivote.ng', name: 'Obinna Nwosu' },
    { role: 'TRUST_SAFETY', email: 'trust@governorship.omnivote.ng', name: 'Halima Bello' },
    { role: 'FIELD_AGENT', email: 'field@governorship.omnivote.ng', name: 'Tolu Adesanya', online: true },
    { role: 'FIELD_AGENT', email: 'field2@governorship.omnivote.ng', name: 'Khalid Ahmed', online: true },
    { role: 'FIELD_AGENT', email: 'field3@governorship.omnivote.ng', name: 'Adaeze Ogbonna', online: true },
    { role: 'FIELD_AGENT', email: 'field4@governorship.omnivote.ng', name: 'Uchenna Chukwu', online: false },
    { role: 'FIELD_AGENT', email: 'field5@governorship.omnivote.ng', name: 'Rashida Ibrahim', online: true },
  ];

  for (const p of personas) {
    const u = await createUser(tenant.id, p.role, p.email, p.name, p.online);
    if (p.role === 'FIELD_AGENT') agents.push({ id: u.id });
  }

  // Add more random agents (use index to ensure unique emails)
  for (let i = 0; i < 15; i++) {
    const fn = FNAMES[i % FNAMES.length], ln = LNAMES[(i * 3) % LNAMES.length];
    const u = await createUser(tenant.id, 'FIELD_AGENT', `${fn.toLowerCase()}.${ln.toLowerCase()}.gov@omnivote.ng`, `${fn} ${ln}`);
    agents.push({ id: u.id });
  }
  // Polling units across Lagos LGAs
  const pus: { id: string; name: string; lat: number; lng: number }[] = [];
  let idx = 1;
  for (const lga of LAGOS_LGAS) {
    const numWards = rand(2, 4);
    for (let w = 0; w < numWards; w++) {
      const numUnits = rand(1, 3);
      for (let u = 0; u < numUnits; u++) {
        const reg = rand(300, 1800);
        const to = Math.round((Math.random() * 0.5 + 0.25) * 100) / 100;
        const p = await db.pollingUnit.create({
          data: {
            electionId: election.id,
            name: `${lga} Ward ${w+1} Unit ${rand(1,20)}`,
            code: `LAG-${lga.substring(0,3).toUpperCase()}-${String(idx).padStart(3,'0')}`,
            state: 'Lagos', lga, ward: `Ward ${w+1}`,
            latitude: 6.35 + (Math.random()-0.5)*0.4,
            longitude: 3.35 + (Math.random()-0.5)*0.5,
            registeredVoters: reg,
            totalVotes: Math.floor(reg * to),
            turnout: to,
            status: pick(['OPEN','OPEN','OPEN','CLOSED','FLAGGED']),
          },
        });
        pus.push({ id: p.id, name: p.name, lat: p.latitude, lng: p.longitude });
        idx++;
      }
    }
  }

  await seedIncidents(tenant.id, agents, pus, 25);

  // Add a few results
  const partyResults = [
    { party: 'APC', name: 'APC', votes: rand(80, 200), color: '#008751' },
    { party: 'PDP', name: 'PDP', votes: rand(50, 150), color: '#CE1126' },
    { party: 'LP', name: 'LP', votes: rand(30, 120), color: '#2196F3' },
    { party: 'NNPP', name: 'NNPP', votes: rand(10, 60), color: '#FF9800' },
    { party: 'ADC', name: 'ADC', votes: rand(5, 30), color: '#9C27B0' },
  ];

  for (let i = 0; i < 8; i++) {
    const pu = pus[i % pus.length];
    const agent = agents[i % agents.length];
    const accredited = rand(200, 600);
    const validVotes = rand(150, accredited);
    const rejected = rand(3, 20);
    const totalCast = validVotes + rejected;
    const shuffled = partyResults.map(pr => ({ ...pr, votes: rand(20, Math.floor(validVotes * 0.4)) }));
    const total = shuffled.reduce((s, p) => s + p.votes, 0);
    const scaled = shuffled.map(pr => ({ ...pr, votes: Math.round(pr.votes / total * validVotes) }));

    await db.electionResult.create({
      data: {
        tenantId: tenant.id, pollingUnitId: pu.id, reportedById: agent.id,
        accreditedVoters: accredited, totalValidVotes: validVotes, rejectedBallots: rejected, totalVotesCast: totalCast,
        partyResults: JSON.stringify(scaled),
        bvasUsed: Math.random() > 0.1, materialsArrivedOnTime: Math.random() > 0.2,
        securityPresent: Math.random() > 0.15, violenceOccurred: Math.random() > 0.85,
        submittedAt: new Date(Date.now() - rand(300000, 3600000)),
      },
    });
  }

  console.log(`    Governorship: ${agents.length} agents, ${pus.length} PUs`);
  return tenant.id;
}

// ============================================================
// TENANT 3: LOCAL GOVERNMENT (Lagos Island LGA)
// ============================================================
async function seedLocalGov() {
  console.log('  Creating Local Government tenant (Lagos Island LGA)...');

  const tenant = await db.tenant.create({
    data: { name: 'Lagos Island LGA Election Monitor', slug: 'local-gov', primaryColor: '#06b6d4', isActive: true },
  });

  const election = await db.election.create({
    data: { tenantId: tenant.id, title: '2027 Lagos Island LGA Chairmanship Election', tier: 'LOCAL', status: 'ACTIVE', date: new Date('2027-04-12T08:00:00Z') },
  });

  // Users
  const agents: { id: string }[] = [];
  const personas = [
    { role: 'SUPER_ADMIN', email: 'admin@localgov.omnivote.ng', name: 'Damilola Tinubu' },
    { role: 'TENANT_ADMIN', email: 'tenant@localgov.omnivote.ng', name: 'Emeka Eze' },
    { role: 'ANALYST', email: 'analyst@localgov.omnivote.ng', name: 'Amara Nwosu' },
    { role: 'TRUST_SAFETY', email: 'trust@localgov.omnivote.ng', name: 'Mustapha Bello' },
    { role: 'FIELD_AGENT', email: 'field@localgov.omnivote.ng', name: 'Hauwa Mohammed', online: true },
    { role: 'FIELD_AGENT', email: 'field2@localgov.omnivote.ng', name: 'Nnamdi Okafor', online: true },
    { role: 'FIELD_AGENT', email: 'field3@localgov.omnivote.ng', name: 'Bimpe Adesanya', online: true },
  ];

  for (const p of personas) {
    const u = await createUser(tenant.id, p.role, p.email, p.name, p.online);
    if (p.role === 'FIELD_AGENT') agents.push({ id: u.id });
  }

  // Add more agents (use index to ensure unique emails)
  for (let i = 0; i < 8; i++) {
    const fn = FNAMES[i % FNAMES.length], ln = LNAMES[(i * 3) % LNAMES.length];
    const u = await createUser(tenant.id, 'FIELD_AGENT', `${fn.toLowerCase()}.${ln.toLowerCase()}.lga@omnivote.ng`, `${fn} ${ln}`);
    agents.push({ id: u.id });
  }
  // Polling units in Lagos Island wards
  const pus: { id: string; name: string; lat: number; lng: number }[] = [];
  let idx = 1;
  for (const ward of LAGOS_ISLAND_WARDS) {
    const numUnits = rand(3, 6);
    for (let u = 0; u < numUnits; u++) {
      const reg = rand(200, 1200);
      const to = Math.round((Math.random() * 0.4 + 0.3) * 100) / 100;
      const p = await db.pollingUnit.create({
        data: {
          electionId: election.id,
          name: `${ward} Unit ${rand(1,25)}`,
          code: `LAG-LI-${String(idx).padStart(3,'0')}`,
          state: 'Lagos', lga: 'Lagos Island', ward,
          latitude: 6.44 + (Math.random()-0.5)*0.06,
          longitude: 3.39 + (Math.random()-0.5)*0.06,
          registeredVoters: reg,
          totalVotes: Math.floor(reg * to),
          turnout: to,
          status: pick(['OPEN','OPEN','OPEN','CLOSED','FLAGGED','OPEN']),
        },
      });
      pus.push({ id: p.id, name: p.name, lat: p.latitude, lng: p.longitude });
      idx++;
    }
  }

  await seedIncidents(tenant.id, agents, pus, 15);

  // Add results
  const partyResults = [
    { party: 'APC', name: 'APC', votes: 0, color: '#008751' },
    { party: 'PDP', name: 'PDP', votes: 0, color: '#CE1126' },
    { party: 'LP', name: 'LP', votes: 0, color: '#2196F3' },
  ];

  for (let i = 0; i < 5; i++) {
    const pu = pus[i % pus.length];
    const agent = agents[i % agents.length];
    const accredited = rand(150, 500);
    const validVotes = rand(100, accredited);
    const rejected = rand(2, 15);
    const totalCast = validVotes + rejected;
    const shuffled = partyResults.map(pr => ({ ...pr, votes: rand(15, Math.floor(validVotes * 0.45)) }));
    const total = shuffled.reduce((s, p) => s + p.votes, 0);
    const scaled = shuffled.map(pr => ({ ...pr, votes: Math.round(pr.votes / total * validVotes) }));

    await db.electionResult.create({
      data: {
        tenantId: tenant.id, pollingUnitId: pu.id, reportedById: agent.id,
        accreditedVoters: accredited, totalValidVotes: validVotes, rejectedBallots: rejected, totalVotesCast: totalCast,
        partyResults: JSON.stringify(scaled),
        bvasUsed: Math.random() > 0.1, materialsArrivedOnTime: Math.random() > 0.15,
        securityPresent: Math.random() > 0.1, violenceOccurred: Math.random() > 0.9,
        submittedAt: new Date(Date.now() - rand(300000, 3600000)),
      },
    });
  }

  console.log(`    Local Gov: ${agents.length} agents, ${pus.length} PUs`);
  return tenant.id;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('=== Multi-Tenant Seed ===\n');

  // 1. Update existing tenant to be Presidential
  const existingTenant = await db.tenant.findFirst({ where: { slug: 'new' } });
  if (existingTenant) {
    await db.tenant.update({
      where: { id: existingTenant.id },
      data: { name: 'Presidential Election Watch', slug: 'presidential' },
    });
    console.log('  Updated existing tenant → Presidential Election Watch (slug: presidential)');
    await seedPresidential(existingTenant.id);
  }

  // 2. Check if governorship already exists
  let govExists = await db.tenant.findFirst({ where: { slug: 'governorship' } });
  if (!govExists) {
    await seedGovernorship();
  } else {
    console.log('  Governorship tenant already exists, skipping');
  }

  // 3. Check if local-gov already exists
  let localExists = await db.tenant.findFirst({ where: { slug: 'local-gov' } });
  if (!localExists) {
    await seedLocalGov();
  } else {
    console.log('  Local Gov tenant already exists, skipping');
  }

  // Summary
  const tenants = await db.tenant.findMany({ include: { _count: { select: { users: true, elections: true, incidents: true, results: true, alerts: true } } } });
  console.log('\n=== Summary ===');
  for (const t of tenants) {
    const puCount = await db.pollingUnit.count({ where: { election: { tenantId: t.id } } });
    console.log(`  ${t.name} (${t.slug}): ${t._count.users} users, ${t._count.elections} elections, ${puCount} PUs, ${t._count.incidents} incidents, ${t._count.results} results`);
  }

  await db.$disconnect();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });