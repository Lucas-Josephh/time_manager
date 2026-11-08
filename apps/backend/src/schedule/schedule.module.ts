import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationModule } from '../organization/organization.module';
import { ScheduleController } from './controllers/schedule.controller';
import { ScheduleAssignmentController } from './controllers/schedule-assignment.controller';
import { ScheduleUsersController } from './controllers/schedule-users.controller';
import { ScheduleService } from './services/schedule.service';
import { ScheduleAuthorizationService } from './services/schedule-authorization.service';
import { ScheduleAssignmentService } from './services/schedule-assignment.service';
import { ScheduleAssignmentAuthorizationService } from './services/schedule-assignment-authorization.service';
import { ScheduleAssignmentPolicyService } from './services/schedule-assignment-policy.service';

@Module({
  imports: [PrismaModule, AuthModule, OrganizationModule],
  providers: [
    ScheduleAssignmentAuthorizationService,
    ScheduleAssignmentService,
    ScheduleService,
    ScheduleAuthorizationService,
    ScheduleAssignmentPolicyService,
  ],
  controllers: [
    ScheduleController,
    ScheduleAssignmentController,
    ScheduleUsersController,
  ],
  exports: [ScheduleAssignmentPolicyService],
})
export class ScheduleModule {}
