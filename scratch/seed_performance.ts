import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const ownerId = 'cb67eb31-d646-4681-8c25-3dee2704fd32';
  const telecallerId = '873d3333-dde6-4917-9db4-6851f08b8bbe';
  const leadId = 'f15bdb58-c3a8-4259-80c7-3cfee41dfb20';

  console.log('Seeding performance data...');

  // Create 10 logs for Today
  const outcomes = ['ANSWERED', 'ANSWERED_CALL', 'MISSED', 'MISSED_CALL', 'REJECTED', 'CANCELLED', 'BUSY'];
  
  for (let i = 0; i < 20; i++) {
    const outcomeVal = outcomes[i % outcomes.length];
    await prisma.callLog.create({
      data: {
        lead_id: leadId,
        telecaller_id: telecallerId,
        duration_seconds: outcomeVal.includes('ANSWERED') ? Math.floor(Math.random() * 300) + 30 : 0,
        call_status: outcomeVal,
        outcome: null,
        created_at: new Date() // Today
      }
    });
  }

  // Create some logs for last week (This Month but not Today)
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 5);
  
  for (let i = 0; i < 10; i++) {
    const outcomeVal = outcomes[i % outcomes.length];
    await prisma.callLog.create({
      data: {
        lead_id: leadId,
        telecaller_id: telecallerId,
        duration_seconds: outcomeVal.includes('ANSWERED') ? Math.floor(Math.random() * 300) + 30 : 0,
        call_status: outcomeVal,
        outcome: null,
        created_at: lastWeek
      }
    });
  }

  console.log('Seeding complete.');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
