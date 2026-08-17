import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const t = await p.tenant.count();
  const u = await p.user.count();
  const e = await p.election.count();
  const pu = await p.pollingUnit.count();
  const i = await p.incident.count();
  console.log(`Tenants: ${t} | Users: ${u} | Elections: ${e} | PollingUnits: ${pu} | Incidents: ${i}`);
  await p.$disconnect();
}
main();
