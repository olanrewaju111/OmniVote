import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });

const STATES = ['Lagos', 'Abuja FCT', 'Rivers', 'Kano', 'Oyo', 'Enugu', 'Kaduna', 'Delta', 'Ogun', 'Borno', 'Akwa Ibom', 'Edo', 'Plateau', 'Anambra', 'Kwara'];

const LGAS: Record<string, string[]> = {
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
  'SOS - Agent surrounded by hostile individuals. Extraction needed.',
  'Gunshots heard near the station. Voters dispersing in panic.',
  'AI-Generated media detected: Inconsistent shadows and digital artifacts. Quarantined.',
  'Coordinated report pattern: 12 identical reports from same IP range. CIB investigation.',
  'Geolocation anomaly: Report from 8km outside assigned geofence.',
];

const FNAMES = ['Adebayo','Chukwuemeka','Fatima','Ibrahim','Olufunke','Emeka','Aisha','Olumide','Ngozi','Yusuf','Blessing','Kola','Amara','Sani','Tolu','Hauwa','Obinna','Zainab','Segun','Chioma'];
const LNAMES = ['Okafor','Abubakar','Okonkwo','Mohammed','Adeyemi','Eze','Balogun','Ibrahim','Chukwu','Ogunleye','Ahmed','Nwosu','Bello','Adesanya','Ogbonna'];

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rand = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;

async function seed() {
  console.log('Seeding...');

  const tenant = await db.tenant.create({
    data: { name: 'Nigeria Election Watch', slug: 'new', primaryColor: '#10b981', domain: 'monitor.nigeriaelectionwatch.org', isActive: true },
  });

  const users: { id: string; name: string; role: string }[] = [];
  for (let i = 0; i < 40; i++) {
    const fn = pick(FNAMES), ln = pick(LNAMES);
    const role = i === 0 ? 'SUPER_ADMIN' : i === 1 ? 'ANALYST' : i === 2 ? 'TRUST_SAFETY' : 'FIELD_AGENT';
    const u = await db.user.create({
      data: { email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@new.org`, name: `${fn} ${ln}`, role, tenantId: tenant.id, isOnline: Math.random() > 0.3, lastSeenAt: new Date(Date.now() - rand(60000, 3600000)) },
    });
    users.push({ id: u.id, name: u.name, role: u.role });
  }

  const election = await db.election.create({
    data: { tenantId: tenant.id, title: '2025 General Elections', tier: 'PRESIDENTIAL', status: 'ACTIVE', date: new Date('2025-10-24T08:00:00Z') },
  });

  const pus: { id: string; state: string; lga: string; lat: number; lng: number; reg: number; votes: number; turnout: number; status: string; name: string }[] = [];
  let idx = 1;
  for (const state of STATES) {
    for (const lga of (LGAS[state] || [])) {
      const n = rand(2, 4);
      for (let w = 0; w < n; w++) {
        const reg = rand(200, 2500);
        const to = Math.round((Math.random() * 0.5 + 0.2) * 100) / 100;
        const p = await db.pollingUnit.create({
          data: {
            electionId: election.id, name: `${lga} Ward ${w+1} Unit ${rand(1,15)}`,
            code: `${state.substring(0,3).toUpperCase().replace(/ /g,'')}-${lga.substring(0,3).toUpperCase().replace(/ /g,'')}-${String(idx).padStart(3,'0')}`,
            state, lga, ward: `Ward ${w+1}`,
            latitude: 6.5 + (Math.random()-0.3)*8, longitude: 3.5 + (Math.random()-0.1)*6,
            registeredVoters: reg, totalVotes: Math.floor(reg * to), turnout: to,
            status: pick(['OPEN','OPEN','OPEN','CLOSED','FLAGGED']),
          },
        });
        pus.push({ id: p.id, state, lga, lat: p.latitude, lng: p.longitude, reg, votes: p.totalVotes, turnout: p.turnout, status: p.status, name: p.name });
        idx++;
      }
    }
  }

  const agents = users.filter(u => u.role === 'FIELD_AGENT');
  const types = ['OBSERVATION','VIOLENCE','INTIMIDATION','BALLOT_STUFFING','LOGISTICS','DEEPFAKE_SUSPECT','CIB_DETECTED','GEO_ANOMALY'];
  const sevs = ['LOW','LOW','MEDIUM','MEDIUM','HIGH','CRITICAL'];

  for (let i = 0; i < 80; i++) {
    const agent = pick(agents), pu = pick(pus), type = pick(types);
    const sev = (type==='VIOLENCE'||type==='SOS'||type==='DEEPFAKE_SUSPECT'||type==='CIB_DETECTED'||type==='GEO_ANOMALY') ? pick(['HIGH','CRITICAL']) : pick(sevs);
    const isSec = ['DEEPFAKE_SUSPECT','CIB_DETECTED','GEO_ANOMALY'].includes(type);
    const status = isSec ? 'QUARANTINED' : sev==='CRITICAL' ? pick(['ESCALATED','PENDING']) : pick(['PENDING','PENDING','REVIEWED','ESCALATED','DISMISSED']);
    const desc = pick(DESCS);

    const inc = await db.incident.create({
      data: {
        tenantId: tenant.id, pollingUnitId: pu.id, reportedById: agent.id,
        type, severity: sev, status, description: desc,
        gpsLatitude: pu.lat + (Math.random()-0.5)*0.02, gpsLongitude: pu.lng + (Math.random()-0.5)*0.02,
        gpsAnomaly: type==='GEO_ANOMALY' ? true : Math.random()>0.9,
        aiSummary: isSec ? `AI detected ${type}. Confidence: ${rand(88,99)}%. ${status==='QUARANTINED'?'Quarantined.':'Review needed.'}` : `Incident at ${pu.name}. ${sev} severity.`,
        aiFlags: JSON.stringify(isSec ? ['SECURITY_ALERT','AI_FLAGGED'] : sev==='HIGH' ? ['PRIORITY_REVIEW'] : []),
        isQuarantined: status==='QUARANTINED', c2paVerified: Math.random()>0.6,
        submittedAt: new Date(Date.now() - rand(60000, 7200000)),
        reviewedAt: status!=='PENDING' ? new Date(Date.now() - rand(0, 1800000)) : null,
      },
    });

    await db.alert.create({
      data: {
        tenantId: tenant.id, incidentId: inc.id,
        type: isSec ? 'SECURITY' : 'OPERATIONAL',
        category: sev==='CRITICAL' ? 'CRITICAL' : sev==='HIGH' ? 'WARNING' : 'INFO',
        title: `[${type.replace(/_/g,' ')}] ${pu.name}`,
        description: desc.substring(0, 100) + '...',
        isRead: Math.random()>0.5,
        createdAt: inc.submittedAt,
      },
    });
  }

  // Standalone alerts
  for (let i = 0; i < 8; i++) {
    await db.alert.create({
      data: {
        tenantId: tenant.id,
        type: i < 3 ? 'SECURITY' : 'OPERATIONAL',
        category: i < 2 ? 'CRITICAL' : i < 4 ? 'WARNING' : 'INFO',
        title: i < 2 ? `SOS - Agent ${pick(agents).name}` : i < 4 ? 'Elevated submission rate detected' : i < 6 ? 'AI: Deepfake batch analysis completed' : 'System: AI transcription degraded',
        description: 'Automated system alert.',
        isRead: Math.random()>0.6,
        createdAt: new Date(Date.now() - rand(60000, 3600000)),
      },
    });
  }

  console.log(`Done! ${users.length} users, ${pus.length} PUs, 80+ incidents.`);
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });