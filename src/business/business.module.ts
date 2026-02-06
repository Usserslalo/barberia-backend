import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessService } from './business.service';
import { CategoriesController } from './controllers/categories.controller';
import { WorkScheduleController } from './controllers/work-schedule.controller';
import { ScheduleExceptionsController } from './controllers/schedule-exceptions.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    CategoriesController,
    WorkScheduleController,
    ScheduleExceptionsController,
  ],
  providers: [BusinessService],
  exports: [BusinessService],
})
export class BusinessModule {}
