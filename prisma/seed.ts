// Geliştirme ortamı için örnek veri. Çalıştır: npm run db:seed
// Üretimde çalıştırma.
import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

export const TEST_USER = {
  email: 'test@kilya.app',
  password: 'Test1234!',
};

async function main() {
  const passwordHash = await argon2.hash(TEST_USER.password);

  const user = await prisma.user.upsert({
    where: { email: TEST_USER.email },
    update: { passwordHash },
    create: {
      email: TEST_USER.email,
      passwordHash,
      displayName: 'Test Kullanıcı',
      birthYear: 1998,
      heightCm: 170,
      weightKg: 65,
    },
  });

  console.log(`Seed tamam: ${user.email} (${user.id})`);
  // Recommendation kayıtları Aşama 9'da model eklenince buraya gelecek.
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
