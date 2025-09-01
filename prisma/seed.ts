import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = 'Password@123';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email: 'test@example.com',
      passwordHash,
      emailVerified: true,
    },
  });

  console.log('Test user created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
