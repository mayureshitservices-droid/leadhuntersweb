import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.findFirst({
    where: { role: 'BUSINESS_OWNER' }
  });

  if (!owner) {
    console.error("No Business Owner found. Please create one first.");
    return;
  }

  console.log(`Seeding leads for owner: ${owner.name} (${owner.id})`);

  const leads = [
    {
      name: "Aditya Sharma",
      phone: "9820012345",
      business_owner_id: owner.id,
      additional_data: {
        "CIBIL Score": 785,
        "City": "Mumbai",
        "Loan Interest": "Home Loan",
        "Estimated Income": "12 LPA"
      }
    },
    {
      name: "Priya Patel",
      phone: "9123456789",
      business_owner_id: owner.id,
      additional_data: {
        "Business Type": "Retail",
        "Rating": "A+",
        "GST Verified": "Yes",
        "Founded": "2015"
      }
    },
    {
      name: "Vikram Singh",
      phone: "8877665544",
      business_owner_id: owner.id,
      additional_data: {
        "Car Model": "Swift Dzire",
        "Year": 2022,
        "Insurance Expiry": "2026-12-01",
        "Priority": "High"
      }
    },
    {
      name: "Sneha Reddy",
      phone: "7766554433",
      business_owner_id: owner.id,
      additional_data: {
        "Occupation": "Doctor",
        "Hospital": "Apollo",
        "CIBIL": 810
      }
    }
  ];

  for (const lead of leads) {
    await prisma.lead.upsert({
      where: {
        business_owner_id_phone: {
          business_owner_id: lead.business_owner_id,
          phone: lead.phone
        }
      },
      update: {
        additional_data: lead.additional_data,
        name: lead.name
      },
      create: lead
    });
  }

  console.log("Seeding complete! 4 leads with dynamic data added/updated.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
