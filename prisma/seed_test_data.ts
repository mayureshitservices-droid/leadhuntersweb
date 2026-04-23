import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const ownerId = 'e21bd45d-8379-4a78-b303-001f48ec986e'; // prisha motors
  const telecallerId = '5af043ce-526c-4319-9d0b-3a8ef15975e5'; // Xiaomi 23028RN4DI

  console.log('Seeding data for Owner:', ownerId);
  console.log('Seeding data for Telecaller:', telecallerId);

  // 1. Create 10 Mock Leads
  const leadsData = [
    { name: 'Amit Sharma', phone: '9876543210' },
    { name: 'Priya Verma', phone: '9822113344' },
    { name: 'Rahul Gupta', phone: '9911223344' },
    { name: 'Sonal Singh', phone: '9855667788' },
    { name: 'Vikram Mehta', phone: '9766554433' },
    { name: 'Anjali Desai', phone: '9122334455' },
    { name: 'Karan Johar', phone: '9555444333' },
    { name: 'Meera Nair', phone: '9222333444' },
    { name: 'Rohan Joshi', phone: '9333444555' },
    { name: 'Neha Kapoor', phone: '9444555666' },
  ];

  for (let i = 0; i < leadsData.length; i++) {
    const data = leadsData[i];
    
    // Upsert Lead
    const lead = await prisma.lead.upsert({
      where: { 
        business_owner_id_phone: { 
          business_owner_id: ownerId, 
          phone: data.phone 
        } 
      },
      update: { 
        telecaller_id: telecallerId,
        name: data.name,
        status: i < 5 ? 'ANSWERED' : 'PENDING'
      },
      create: {
        name: data.name,
        phone: data.phone,
        business_owner_id: ownerId,
        telecaller_id: telecallerId,
        status: i < 5 ? 'ANSWERED' : 'PENDING'
      }
    });

    console.log(`- Processed Lead: ${data.name} (${lead.id})`);

    // 2. Add Call Logs for the first 5 leads (Historical data)
    if (i < 5) {
       // Create a log for Today
       await prisma.callLog.create({
         data: {
           lead_id: lead.id,
           telecaller_id: telecallerId,
           duration_seconds: Math.floor(Math.random() * 120) + 30,
           status: 'ANSWERED',
           created_at: new Date() 
         }
       });

       // Create a log for Last Month (30 days ago) to show monthly growth
       const lastMonth = new Date();
       lastMonth.setDate(lastMonth.getDate() - 30);
       
       await prisma.callLog.create({
         data: {
           lead_id: lead.id,
           telecaller_id: telecallerId,
           duration_seconds: Math.floor(Math.random() * 180) + 60,
           status: 'ANSWERED',
           created_at: lastMonth
         }
       });
    }
  }

  // 3. Add some Missed/Rejected calls for today to make metrics look real
  const missedLeads = leadsData.slice(5, 8);
  for (const data of missedLeads) {
      const lead = await prisma.lead.findFirst({ where: { phone: data.phone } });
      if (lead) {
          await prisma.callLog.create({
              data: {
                  lead_id: lead.id,
                  telecaller_id: telecallerId,
                  duration_seconds: 0,
                  status: 'MISSED',
                  created_at: new Date()
              }
          });
      }
  }

  console.log("Seeding successful!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
