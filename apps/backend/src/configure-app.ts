import { toNodeHandler } from 'better-auth/node';
import { AuthService } from './auth/auth.service';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { validationExceptionFactory } from './common/validation/validation-exception.factory';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import { ModuleRef } from '@nestjs/core';

export function configureApp(app: INestApplication): void {
  const moduleRef = app.get(ModuleRef);
  useContainer(
    { get: (token) => moduleRef.get(token, { strict: false }) },
    { fallbackOnErrors: true },
  );
  // Regroupe les routes Nest sous /api et autorise les cookies du frontend.
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.enableCors({
    origin: app.get(ConfigService).getOrThrow<string>('FRONTEND_URL'),
    credentials: true,
  });
  // Enregistre Better Auth avant les parseurs Nest pour préserver le flux brut.
  app.use('/api/auth', toNodeHandler(app.get(AuthService).auth));
  app.enableShutdownHooks();

  // Documente les contrôleurs NestJS.
  const config = new DocumentBuilder()
    .setTitle('Time Manager API')
    .setDescription('Documentation des endpoints de l’API Time Manager.')
    .setVersion('0.0.0')
    .build();

  SwaggerModule.setup(
    'api/docs',
    app,
    () => SwaggerModule.createDocument(app, config),
    {
      jsonDocumentUrl: 'api/docs-json',
      yamlDocumentUrl: 'api/docs-yaml',
      customSiteTitle: 'Time Manager — API',
    },
  );
}
