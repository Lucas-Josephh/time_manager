import { ReferenceExistsConstraint } from './common/decorator/reference.decorator';
import { validationOptions } from './common/validation/validation.config';
import { AuthModule } from './auth/auth.module';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { OrganizationModule } from './organization/organization.module';
import { TeamModule } from './team/team.module';

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
    ReferenceExistsConstraint,
    {
      provide: APP_PIPE,
      useFactory: () => new ValidationPipe(validationOptions),
    },
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
