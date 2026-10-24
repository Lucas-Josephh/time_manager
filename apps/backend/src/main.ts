import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { useContainer } from 'class-validator';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  useContainer(app.select(AppModule), {
    fallbackOnErrors: true,
  });
  const config = new DocumentBuilder()
    .setTitle('Time Manager API')
    .setDescription(
      "Documentation de l'API Time Manager avec NestJS et Better Auth",
    )
    .setVersion('1.0')
    .addBearerAuth() // Utile si tu sécurises tes routes avec des tokens plus tard
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  configureApp(app);
  await app.listen(3001, '0.0.0.0');
}

void bootstrap();
