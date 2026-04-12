import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  const boPasswordHash = await bcrypt.hash('owner123', 10);

  // Create Super Admin
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

  // Create Mock Business Owner
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

  console.log({ admin, owner });
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
