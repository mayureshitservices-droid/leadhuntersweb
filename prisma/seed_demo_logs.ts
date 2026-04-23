import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seed: Starting demo call logs seeding...');

  // 1. Find or create a Business Owner
  let owner = await prisma.user.findFirst({
    where: { role: 'BUSINESS_OWNER' }
  });

  if (!owner) {
    owner = await prisma.user.create({
      data: {
        name: 'Demo Owner',
        email: 'owner@example.com',
        role: 'BUSINESS_OWNER',
        status: 'Active'
      }
    });
    console.log('Seed: Created demo owner');
  }

  // 2. Find or create a Telecaller
  let telecaller = await prisma.user.findFirst({
    where: { role: 'TELECALLER' }
  });

  if (!telecaller) {
    telecaller = await prisma.user.create({
      data: {
        name: 'Demo Telecaller',
        email: 'telecaller@example.com',
        role: 'TELECALLER',
        status: 'Active',
        device_id: 'demo_device_123'
      }
    });
    console.log('Seed: Created demo telecaller');
  }

  // 3. Ensure assignment
  await prisma.telecallerAssignment.upsert({
    where: {
      telecaller_id_business_owner_id: {
        telecaller_id: telecaller.id,
        business_owner_id: owner.id
      }
    },
    update: {},
    create: {
      telecaller_id: telecaller.id,
      business_owner_id: owner.id
    }
  });

  // 4. Create Leads
  const leadData = [
    { name: 'John Doe', phone: '9876543210', status: 'INTERESTED' },
    { name: 'Jane Smith', phone: '9123456789', status: 'ORDERED' },
    { name: 'Alice Brown', phone: '9988776655', status: 'REMIND_LATER' },
    { name: 'Bob Wilson', phone: '9554433221', status: 'LOST' },
    { name: 'Charlie Davis', phone: '9001122334', status: 'PENDING' }
  ];

  const createdLeads = [];
  for (const l of leadData) {
    const lead = await prisma.lead.upsert({
      where: {
        business_owner_id_phone: {
          business_owner_id: owner.id,
          phone: l.phone
        }
      },
      update: { status: l.status as any },
      create: {
        name: l.name,
        phone: l.phone,
        status: l.status as any,
        business_owner_id: owner.id,
        telecaller_id: telecaller.id
      }
    });
    createdLeads.push(lead);
  }
  console.log(`Seed: Created/Updated ${createdLeads.length} leads`);

  // 5. Create Call Logs
  const outcomes = ['ANSWERED', 'INTERESTED', 'ORDERED', 'BOOKED', 'REMIND_LATER', 'LOST'];
  const notes = [
    'Client is interested in the premium plan.',
    'Placed an order for 5 units.',
    'Asked to call back on Monday morning.',
    'Not interested, too expensive.',
    'Connected, but busy. Will call again.',
    'Confirmed booking for next week.'
  ];

  for (let i = 0; i < 15; i++) {
    const randomLead = createdLeads[Math.floor(Math.random() * createdLeads.length)];
    const randomOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    const randomNote = notes[Math.floor(Math.random() * notes.length)];
    const randomDuration = Math.floor(Math.random() * 300) + 10; // 10s to 310s

    await prisma.callLog.create({
      data: {
        lead_id: randomLead.id,
        telecaller_id: telecaller.id,
        duration_seconds: randomDuration,
        status: randomOutcome,
        notes: randomNote,
        created_at: new Date(Date.now() - Math.floor(Math.random() * 86400000)) // Random time in last 24h
      }
    });
  }

  console.log('Seed: Created 15 demo call logs');
  console.log('Seed: Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
