import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const logs = await prisma.callLog.findMany({
    take: 5,
    orderBy: { created_at: 'desc' },
    include: { lead: true }
  });
  console.log(JSON.stringify(logs, null, 2));
  await prisma.$disconnect();
}
main();
