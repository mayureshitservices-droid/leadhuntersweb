import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const logs = await prisma.callLog.findMany({
    take: 5,
    orderBy: { created_at: 'desc' },
    select: { id: true, local_log_id: true, outcome: true, created_at: true }
  });
  console.log(JSON.stringify(logs, null, 2));
  await prisma.$disconnect();
}
main();
