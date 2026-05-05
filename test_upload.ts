import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  try {
    const owner = await prisma.user.findFirst({ where: { role: 'BUSINESS_OWNER' } });
    if (!owner) {
        console.log("No owner found");
        return;
    }

    const testLead = {
      business_owner_id: owner.id,
      name: 'Test Json Date',
      phone: '1234567890',
      additional_data: {
        someDate: new Date()
      }
    };

    console.log("Trying to insert:", testLead);
    await prisma.lead.create({
      data: testLead
    });
    console.log("Inserted successfully!");
    
    await prisma.lead.deleteMany({ where: { name: 'Test Json Date' } });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}
test();

