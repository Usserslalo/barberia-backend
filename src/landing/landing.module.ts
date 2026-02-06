import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';
import { LandingController } from './controllers/landing.controller';
import { LandingAdminController } from './controllers/landing-admin.controller';
import { LandingService } from './services/landing.service';
import { AuditService } from './services/audit.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';

const LANDING_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

@Module({
  imports: [
    PrismaModule,
    UploadModule,
    CacheModule.register({
      ttl: LANDING_CACHE_TTL_MS,
    }),
  ],
  controllers: [LandingController, LandingAdminController],
  providers: [LandingService, AuditService, AuditInterceptor],
  exports: [LandingService],
})
export class LandingModule {}
