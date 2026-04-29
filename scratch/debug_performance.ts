import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const ownerId = 'cb67eb31-d646-4681-8c25-3dee2704fd32';
  const telecallers = await prisma.user.findMany({
    where: { telecaller_assigns: { some: { business_owner_id: ownerId } } }
  });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const callLogsPerformance = await prisma.callLog.findMany({
    where: { lead: { business_owner_id: ownerId }, created_at: { gte: startOfMonth } },
    select: { telecaller_id: true, outcome: true, duration_seconds: true, created_at: true }
  });

  const perf: Record<string, any> = {};
  telecallers.forEach(tc => {
    perf[tc.id] = { id: tc.id, name: tc.name, daily: { total: 0, answered: 0, missed: 0, rejected: 0, talkTime: 0 }, monthly: { total: 0, answered: 0, missed: 0, rejected: 0, talkTime: 0 } };
  });

  callLogsPerformance.forEach(log => {
    if (!perf[log.telecaller_id]) return;
    const isToday = log.created_at >= startOfToday;
    const outcome = log.outcome?.toUpperCase() || 'UNKNOWN';
    
    // DEBUG: print outcome
    // console.log(`Outcome: ${outcome}`);

    perf[log.telecaller_id].monthly.total++;
    perf[log.telecaller_id].monthly.talkTime += log.duration_seconds;
    if (outcome.includes('ANSWERED')) perf[log.telecaller_id].monthly.answered++;
    else if (outcome.includes('MISSED')) perf[log.telecaller_id].monthly.missed++;
    else if (outcome.includes('REJECTED') || outcome.includes('CANCELLED')) perf[log.telecaller_id].monthly.rejected++;

    if (isToday) {
      perf[log.telecaller_id].daily.total++;
      perf[log.telecaller_id].daily.talkTime += log.duration_seconds;
      if (outcome.includes('ANSWERED')) perf[log.telecaller_id].daily.answered++;
      else if (outcome.includes('MISSED')) perf[log.telecaller_id].daily.missed++;
      else if (outcome.includes('REJECTED') || outcome.includes('CANCELLED')) perf[log.telecaller_id].daily.rejected++;
    }
  });

  console.log(JSON.stringify(perf, null, 2));
}

test()
  .finally(() => prisma.$disconnect());
