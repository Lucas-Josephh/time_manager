import { OrganizationHierarchyService } from './services/organization-hierarchy.service';
import { OrganizationAuthorizationService } from './services/organization-authorization.service';
import { AuthModule } from '../auth/auth.module';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationService } from './services/organization.service';
import { OrganizationController } from './controllers/organization.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [OrganizationService, OrganizationAuthorizationService, OrganizationHierarchyService],
  controllers: [OrganizationController],
  exports: [OrganizationService, OrganizationHierarchyService],
})
export class OrganizationModule {}
