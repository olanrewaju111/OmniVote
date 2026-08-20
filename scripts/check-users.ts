import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const users = await p.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { email: true, name: true, role: true, passwordHash: true, tenant: { select: { slug: true, name: true, isActive: true } } },
  });
  console.log(JSON.stringify(users, null, 2));
  const count = await p.user.count();
  console.log('Total users:', count);
}
main().catch(e => console.error(e)).finally(() => p[Symbol.asyncDispose]());
