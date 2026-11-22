import { uniqueValidationRequest } from './common/validation/validation-request.context';
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

  // Route parameters are available when DTO validation runs.
  // AsyncLocalStorage keeps a separate context for each request.
  app.use((
    request: { method: string; params: Record<string, unknown> },
    _response: unknown,
    next: () => void,
  ) => uniqueValidationRequest.run(request, next));

  // Register the auth route using better-auth's toNodeHandler
  app.use('/api/auth', toNodeHandler(app.get(AuthService).auth));
  app.enableShutdownHooks();

  // Documentation of controllers using Swagger
  const config = new DocumentBuilder()
    .setTitle('Tempo API')
    .setDescription("Documentation des endpoints de l'API de Tempo.")
    .setVersion('0.0.0')
    .build();

  SwaggerModule.setup(
    'api/docs',
    app,
    () => SwaggerModule.createDocument(app, config),
    {
      jsonDocumentUrl: 'api/docs-json',
      yamlDocumentUrl: 'api/docs-yaml',
      customSiteTitle: 'Tempo — API',
    },
  );
}
