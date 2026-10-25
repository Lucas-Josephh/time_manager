import { CanManageTeamsGuard } from './guards/can-manage-teams.guard';
import { AuthModule } from '../auth/auth.module';
import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TeamController],
  providers: [TeamService, CanManageTeamsGuard],
  exports: [TeamService],
})
export class TeamModule {}
