import { Module } from '@nestjs/common';
import { ScheduleService } from './services/schedule.service';
import { ScheduleController } from './controllers/schedule.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ScheduleAuthorizationService } from './services/schedule-authorization.service';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [ScheduleService, ScheduleAuthorizationService],
  controllers: [ScheduleController],
})
export class ScheduleModule {}
