import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function test() {
  try {
    const email = 'admin@leadhunters.com';
    const password = 'admin123';
    console.log('Querying user...');
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('User not found');
      return;
    }
    console.log('Found user:', user);
    console.log('Comparing passwords...');
    const isMatch = await bcrypt.compare(password, user.password_hash);
    console.log('Password match:', isMatch);
  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
