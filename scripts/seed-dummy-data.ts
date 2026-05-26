import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seed() {
  console.log('Starting seed process...');
  
  // 1. Find or create a Business Owner
  let owner = await prisma.user.findFirst({ where: { role: 'BUSINESS_OWNER' } });
  if (!owner) {
    owner = await prisma.user.create({
      data: {
        name: 'Demo Owner',
        email: 'owner@demo.com',
        role: 'BUSINESS_OWNER',
        status: 'Active'
      }
    });
    console.log('Created dummy Business Owner');
  } else {
    console.log(`Using existing Business Owner: ${owner.name}`);
  }

  // 2. Find or create a Telecaller
  let telecaller = await prisma.user.findFirst({ where: { role: 'TELECALLER' } });
  if (!telecaller) {
    telecaller = await prisma.user.create({
      data: {
        name: 'Demo Telecaller',
        role: 'TELECALLER',
        device_alias: 'TC-01',
        status: 'Active'
      }
    });
    console.log('Created dummy Telecaller');
  } else {
    console.log(`Using existing Telecaller: ${telecaller.name}`);
  }

  // 3. Create 30 Leads and Call Logs
  console.log('Creating 30 dummy leads and call logs...');
  for (let i = 1; i <= 30; i++) {
    const lead = await prisma.lead.upsert({
      where: {
        business_owner_id_phone: {
          business_owner_id: owner.id,
          phone: `999000${i.toString().padStart(4, '0')}`
        }
      },
      update: {},
      create: {
        business_owner_id: owner.id,
        telecaller_id: telecaller.id,
        name: `Dummy Customer ${i}`,
        phone: `999000${i.toString().padStart(4, '0')}`,
        status: 'ANSWERED',
        file_name: 'Dummy Seed'
      }
    });

    await prisma.callLog.create({
      data: {
        lead_id: lead.id,
        telecaller_id: telecaller.id,
        duration_seconds: Math.floor(Math.random() * 300) + 15, // random duration between 15s and 315s
        call_status: 'ANSWERED',
        outcome: i % 3 === 0 ? 'INTERESTED' : (i % 2 === 0 ? 'PENDING' : 'NOT_REACHABLE'),
        notes: `This is a dummy call log ${i} for testing pagination.`,
        created_at: new Date(Date.now() - i * 60000) // spread out in time
      }
    });
  }

  console.log('Successfully seeded 30 dummy call logs and leads!');
  await prisma.$disconnect();
}

seed().catch(e => {
  console.error(e);
  process.exit(1);
});
