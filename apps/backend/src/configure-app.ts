import { ModuleRef } from '@nestjs/core';
import { useContainer } from 'class-validator';
import { toNodeHandler } from 'better-auth/node';
import { AuthService } from './auth/auth.service';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureApp(app: INestApplication): void {
  // Allows @Reference to receive PrismaService from Nest.
  const moduleRef = app.get(ModuleRef);
  useContainer(
    { get: (token) => moduleRef.get(token, { strict: false }) },
    { fallbackOnErrors: true },
  );

  // Set the global prefix for all routes to 'api' and enable CORS with the frontend URL from the configuration
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: app.get(ConfigService).getOrThrow<string>('FRONTEND_URL'),
    credentials: true,
  });

  // Register the auth route using better-auth's toNodeHandler
  app.use('/api/auth', toNodeHandler(app.get(AuthService).auth));
  app.enableShutdownHooks();

  // Documentation of controllers using Swagger
  const config = new DocumentBuilder()
    .setTitle('Time Manager API')
    .setDescription('Documentation des endpoints de l\'API Time Manager.')
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
