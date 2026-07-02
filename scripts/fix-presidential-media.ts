import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({ log: ['error'] });
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rand = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pickN = <T>(a: T[], n: number) => { const s = [...a].sort(() => Math.random() - 0.5); return s.slice(0, Math.min(n, a.length)); };

const IMAGES = [
  'https://omnivote-media.storage.amazonaws.com/field/pu_001_bvas_screen.jpg',
  'https://omnivote-media.storage.amazonaws.com/field/pu_002_queue_line.jpg',
  'https://omnivote-media.storage.googleapis.com/field/pu_003_voter_card.jpg',
  'https://omnivote-media.storage.googleapis.com/field/pu_004_ballot_box.jpg',
  'https://omnivote-media.storage.googleapis.com/field/pu_005_security_post.jpg',
  'https://omnivote-media.storage.googleapis.com/field/pu_006_incident_scene.jpg',
  'https://omnivote-media.storage.googleapis.com/field/pu_007_materials_arrival.jpg',
  'https://omnivote-media.storage.googleapis.com/field/pu_008_voting_proceeds.jpg',
];
const VIDEOS = [
  'https://omnivote-media.storage.googleapis.com/field/pu_001_bvas_operation.mp4',
  'https://omnivote-media.storage.googleapis.com/evidence/violence_clip_01.mp4',
  'https://omnivote-media.storage.googleapis.com/field/queue_timelapse.mp4',
];
const VOICE = [
  'https://omnivote-media.storage.googleapis.com/voice/agent_001_situation_report.mp3',
  'https://omnivote-media.storage.googleapis.com/voice/agent_003_violence_report.mp3',
];

async function main() {
  // Fix presidential tenant incidents that have no media
  const presidential = await db.tenant.findFirst({ where: { slug: 'presidential' } });
  if (!presidential) { console.log('No presidential tenant'); process.exit(0); }

  const incidents = await db.incident.findMany({
    where: { tenantId: presidential.id, mediaUrls: '[]' },
    select: { id: true, type: true, severity: true },
  });

  console.log(`Updating ${incidents.length} presidential incidents with media...`);
  for (const inc of incidents) {
    const urls: string[] = [];
    urls.push(...pickN(IMAGES, rand(1, 3)));
    if (['MEDIUM', 'HIGH', 'CRITICAL'].includes(inc.severity)) urls.push(pick(VIDEOS));
    if (Math.random() > 0.3) urls.push(pick(VOICE));
    if (['DEEPFAKE_SUSPECT', 'CIB_DETECTED', 'BALLOT_STUFFING', 'VIOLENCE'].includes(inc.type)) urls.push(pick(VIDEOS));
    await db.incident.update({ where: { id: inc.id }, data: { mediaUrls: JSON.stringify([...new Set(urls)]) } });
  }
  console.log('Done.');
  await db.$disconnect();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });