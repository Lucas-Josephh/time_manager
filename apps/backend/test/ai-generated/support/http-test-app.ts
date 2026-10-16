import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { AuthService } from '../../../src/auth/auth.service';
import { configureApp } from '../../../src/configure-app';
import { PrismaService } from '../../../src/prisma/prisma.service';

export async function createHttpTestApp(prisma: object) {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(AuthService)
    .useValue({ auth: { handler: jest.fn() }, getSession: jest.fn() })
    .overrideProvider(ConfigService)
    .useValue(new ConfigService({ FRONTEND_URL: 'http://localhost:3000' }))
    .compile();
  const app = module.createNestApplication();
  app.useLogger(false);
  configureApp(app);
  await app.init();
  return app;
}
