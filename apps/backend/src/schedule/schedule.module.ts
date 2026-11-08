import { ScheduleAssignmentPolicyService } from './services/schedule-assignment-policy.service';
import { Module } from '@nestjs/common';
import { ScheduleService } from './services/schedule.service';
import { ScheduleController } from './controllers/schedule.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ScheduleAuthorizationService } from './services/schedule-authorization.service';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [ScheduleService, ScheduleAuthorizationService, ScheduleAssignmentPolicyService],
  controllers: [ScheduleController],
  exports: [ScheduleAssignmentPolicyService],
})
export class ScheduleModule {}
