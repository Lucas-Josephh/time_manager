import { CanManageTeamsGuard } from './guards/can-manage-teams.guard';
import { AuthModule } from '../auth/auth.module';
import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [PrismaModule, AuthModule, OrganizationModule],
  controllers: [TeamController],
  providers: [TeamService, CanManageTeamsGuard],
  exports: [TeamService],
})
export class TeamModule {}
