import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Esto lo hace disponible en toda la app sin importarlo de nuevo
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Exportamos para que otros servicios lo usen
})
export class PrismaModule {}