import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const hash = await bcrypt.hash('password', 12);
console.log('Generated hash:', hash.substring(0, 30) + '...');

const users = await db.user.findMany({ where: { passwordHash: 'changeme' } });
console.log(`Found ${users.length} users with plaintext passwordHash`);

for (const u of users) {
  await db.user.update({ where: { id: u.id }, data: { passwordHash: hash } });
  console.log(`  Fixed: ${u.email}`);
}

await db.$disconnect();
console.log('Done!');
