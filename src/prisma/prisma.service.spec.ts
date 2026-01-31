import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    // Prisma 7 requiere DATABASE_URL para construir el adapter; en tests usamos una URL por defecto si no está definida.
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/auth_boilerplate_test';
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
