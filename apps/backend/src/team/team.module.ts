import { TeamAuthorizationService } from './services/team-authorization.service';
import { TeamMembersService } from './services/team-members.service';
import { TeamMembersController } from './controllers/team-members.controller';
import { AuthModule } from '../auth/auth.module';
import { Module } from '@nestjs/common';
import { TeamController } from './controllers/team.controller';
import { TeamService } from './services/team.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [PrismaModule, AuthModule, OrganizationModule],
  controllers: [TeamController, TeamMembersController],
  providers: [TeamService, TeamAuthorizationService, TeamMembersService],
  exports: [TeamService],
})
export class TeamModule {}
