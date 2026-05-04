import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  const boPasswordHash = await bcrypt.hash('owner123', 10);
  const tcPasswordHash = await bcrypt.hash('tc123', 10);

  // 1. Create Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@leadhunters.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@leadhunters.com',
      password_hash: passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  // 2. Create Mock Business Owner
  const owner = await prisma.user.upsert({
    where: { email: 'owner@business.com' },
    update: {},
    create: {
      name: 'Acme Corp',
      email: 'owner@business.com',
      password_hash: boPasswordHash,
      role: 'BUSINESS_OWNER',
    },
  });

  // 3. Create Telecallers
  const telecallers = [];
  const tcData = [
    { name: 'John Doe', email: 'john@tc.com', alias: 'John_Work' },
    { name: 'Jane Smith', email: 'jane@tc.com', alias: 'Jane_Office' },
    { name: 'Bob Wilson', email: 'bob@tc.com', alias: 'Bob_Remote' }
  ];

  for (const data of tcData) {
    const tc = await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        name: data.name,
        email: data.email,
        password_hash: tcPasswordHash,
        role: 'TELECALLER',
        device_alias: data.alias,
        status: 'Active'
      },
    });
    telecallers.push(tc);

    // Assign to Owner
    await prisma.telecallerAssignment.upsert({
      where: {
        telecaller_id_business_owner_id: {
          telecaller_id: tc.id,
          business_owner_id: owner.id
        }
      },
      update: {},
      create: {
        telecaller_id: tc.id,
        business_owner_id: owner.id
      }
    });
  }

  // 4. Create Leads
  const leads = [];
  const leadData = [
    { name: 'Alice Johnson', phone: '9876543210', status: 'PENDING' },
    { name: 'Charlie Brown', phone: '9876543211', status: 'INTERESTED' },
    { name: 'David Miller', phone: '9876543212', status: 'BOOKED' },
    { name: 'Eve Davis', phone: '9876543213', status: 'REJECTED' },
    { name: 'Frank Moore', phone: '9876543214', status: 'CB_REQUEST' },
    { name: 'Grace Taylor', phone: '9876543215', status: 'BANK_PTP' },
    { name: 'Henry White', phone: '9876543216', status: 'NOT_REACHABLE' },
    { name: 'Ivy Green', phone: '9876543217', status: 'MISSED' },
    { name: 'Jack Black', phone: '9876543218', status: 'PENDING' },
    { name: 'Kathy Wood', phone: '9876543219', status: 'ALREADY_PAID' }
  ];

  for (let i = 0; i < leadData.length; i++) {
    const data = leadData[i];
    const lead = await prisma.lead.upsert({
      where: {
        business_owner_id_phone: {
          business_owner_id: owner.id,
          phone: data.phone
        }
      },
      update: {
        status: data.status as any
      },
      create: {
        business_owner_id: owner.id,
        name: data.name,
        phone: data.phone,
        status: data.status as any,
        telecaller_id: i < 7 ? telecallers[i % telecallers.length].id : null, // Assign some, leave some
        additional_data: {
          City: 'Mumbai',
          Source: 'Google Ads',
          Industry: 'Real Estate'
        }
      }
    });
    leads.push(lead);
  }

  // 5. Create Call Logs
  const outcomes = ['CB_REQUEST', 'LEFT_MSG', 'BANK_PTP', 'PTP', 'NOT_REACHABLE', 'RNR', 'BUSY', 'INTERESTED'];
  for (let i = 0; i < 20; i++) {
    const lead = leads[i % leads.length];
    const tc = telecallers[i % telecallers.length];
    if (!lead.telecaller_id) continue; // Only for assigned leads

    await prisma.callLog.create({
      data: {
        lead_id: lead.id,
        telecaller_id: tc.id,
        duration_seconds: Math.floor(Math.random() * 300) + 10,
        call_status: 'COMPLETED',
        outcome: outcomes[Math.floor(Math.random() * outcomes.length)],
        notes: `Sample call log entry #${i + 1}`,
        local_log_id: `LOG_${Date.now()}_${i}`,
        created_at: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)) // Randomly in last 7 days
      }
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
