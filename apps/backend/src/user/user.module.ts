import { UserAuthorizationService } from './services/user-authorization.service';
import { UserProvisioningService } from './services/user-provisioning.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TeamModule } from '../team/team.module';
import { AuthModule } from '../auth/auth.module';
import { UserController } from './controllers/user.controller';
import { UserService } from './services/user.service';

@Module({
  imports: [PrismaModule, AuthModule, TeamModule],
  controllers: [UserController],
  providers: [UserService, UserAuthorizationService, UserProvisioningService],
})
export class UserModule {}
