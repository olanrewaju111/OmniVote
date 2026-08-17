import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const tenants = await p.tenant.findMany({ select: { id: true, name: true, slug: true } });
  console.log('=== TENANTS ===');
  for (const t of tenants) {
    const users = await p.user.count({ where: { tenantId: t.id } });
    const elections = await p.election.count({ where: { tenantId: t.id } });
    const pus = await p.pollingUnit.count({ where: { election: { tenantId: t.id } } });
    const incidents = await p.incident.count({ where: { tenantId: t.id } });
    const results = await p.electionResult.count({ where: { tenantId: t.id } });
    const alerts = await p.alert.count({ where: { tenantId: t.id } });
    const osint = await p.osintPost.count({ where: { tenantId: t.id } });
    const messages = await p.agentMessage.count({ where: { tenantId: t.id } });
    const audit = 0; // AuditLog has no tenantId
    const campaigns = await p.campaign.count({ where: { tenantId: t.id } });
    const pvt = await p.pvtSubmission.count({ where: { tenantId: t.id } });
    const geofences = await p.geofenceZone.count({ where: { tenantId: t.id } });
    const securityEvents = await p.securityEvent.count({ where: { tenantId: t.id } });
    console.log(`  ${t.name} (${t.slug}):`);
    console.log(`    Users: ${users} | Elections: ${elections} | PUs: ${pus} | Incidents: ${incidents} | Results: ${results}`);
    console.log(`    Alerts: ${alerts} | OSINT: ${osint} | Messages: ${messages} | Audit: ${audit}`);
    console.log(`    Campaigns: ${campaigns} | PVT: ${pvt} | Geofences: ${geofences} | Security: ${securityEvents}`);
  }

  // Verify test accounts
  console.log('\n=== TEST ACCOUNTS ===');
  const testAccounts = [
    'admin@presidential.omnivote.ng',
    'tenant@presidential.omnivote.ng',
    'analyst@presidential.omnivote.ng',
    'field@presidential.omnivote.ng',
    'admin@governorship.omnivote.ng',
    'admin@localgov.omnivote.ng',
  ];
  for (const email of testAccounts) {
    const user = await p.user.findFirst({ where: { email }, include: { tenant: { select: { slug: true } } } });
    if (user) {
      const hasBcryptHash = user.passwordHash.startsWith('$2');
      console.log(`  ${user.role.padEnd(14)} ${email.padEnd(40)} tenant=${user.tenant.slug} bcrypt=${hasBcryptHash}`);
    } else {
      console.log(`  NOT FOUND: ${email}`);
    }
  }

  await p.$disconnect();
}
main();
