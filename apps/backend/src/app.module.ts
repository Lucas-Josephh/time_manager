import { ValidOrganizationParentConstraint } from './common/decorator/valid-organization-parent.decorator';
import { AuthModule } from './auth/auth.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { OrganizationModule } from './organization/organization.module';
import { TeamModule } from './team/team.module';
import { ReferenceExistsConstraint } from './common/decorator/reference.decorator';
import { UniqueConstraint } from './common/decorator/unique.decorator';
import { RequestValidationPipe } from './common/validation/request-validation.pipe';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(__dirname, '../.env'),
        resolve(__dirname, '../../../.env'),
      ],
    }),
    PrismaModule,
    AuthModule,
    OrganizationModule,
    TeamModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_PIPE, useClass: RequestValidationPipe },
    ReferenceExistsConstraint,
    UniqueConstraint,
    ValidOrganizationParentConstraint,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
