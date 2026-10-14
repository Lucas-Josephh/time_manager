import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { useContainer } from 'class-validator';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  useContainer(app.select(AppModule), {
    fallbackOnErrors: true,
  });

  configureApp(app);
  await app.listen(3001, '0.0.0.0');
}

void bootstrap();
