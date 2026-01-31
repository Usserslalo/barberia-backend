import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Servicio Prisma para NestJS compatible con Prisma 7.
 * En Prisma 7 el cliente requiere un driver adapter (no existe datasourceUrl en el constructor).
 * Usamos @prisma/adapter-pg con el driver pg para PostgreSQL.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL no está definida. Configura la variable de entorno antes de iniciar la aplicación.',
      );
    }
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
