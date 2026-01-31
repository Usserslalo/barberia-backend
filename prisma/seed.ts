import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const SALT_ROUNDS = 10;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no está definida. Ejecuta el seed con .env configurado.');
}
const adapter = new PrismaPg({ connectionString });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter }) as any;

const ADMIN_PASSWORD = 'Admin#123';
const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, SALT_ROUNDS);

async function main() {
  console.log('🌱 Iniciando seed genérico...');

  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'ADMIN',
      isVerified: true,
    },
  });

  console.log('✅ Usuario ADMIN creado:', admin.email);
  console.log('🏁 Seed completado. Credenciales: admin@example.com / ' + ADMIN_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
