import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  // Reset all SUPER_ADMIN users to 'changeme' plaintext hash (dev mode accepts 'password')
  const result = await p.user.updateMany({
    where: { role: 'SUPER_ADMIN', passwordHash: { not: 'changeme' } },
    data: { passwordHash: 'changeme' },
  });
  console.log(`Reset ${result.count} SUPER_ADMIN password hashes to 'changeme'`);

  // Verify
  const users = await p.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { email: true, passwordHash: true },
  });
  users.forEach(u => console.log(`  ${u.email} → ${u.passwordHash}`));
}
main().catch(console.error);
