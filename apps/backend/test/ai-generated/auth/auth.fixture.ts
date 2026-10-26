import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { hashPassword } from 'better-auth/crypto';
import { AppModule } from '../../../src/app.module';
import { AuthService } from '../../../src/auth/auth.service';
import { configureApp } from '../../../src/configure-app';
import { createAuth } from '../../../src/lib/auth';
import { PrismaService } from '../../../src/prisma/prisma.service';

export function useAuthFixture(): {
  readonly app: INestApplication;
  readonly auth: ReturnType<typeof createAuth>;
  origin: string;
} {
  let app: INestApplication;
  let auth: ReturnType<typeof createAuth>;

  const origin = 'http://localhost:3000';
  beforeAll(async () => {
    process.env.BETTER_AUTH_SECRET = 'test-secret-with-at-least-32-characters';
    process.env.BETTER_AUTH_URL = 'http://localhost:3001';
    process.env.FRONTEND_URL = origin;
    const options = createAuth(
      {} as PrismaService,
      new ConfigService(process.env),
    ).options;
    options.logger = { disabled: true };
    options.database = memoryAdapter({
      user: [],
      session: [],
      account: [],
      verification: [],
    });
    auth = betterAuth(options);
    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.createUser(
      {
        name: 'Admin Time Manager',
        firstname: 'Admin',
        lastname: 'Time Manager',
        isAdmin: true,
        email: 'admin@example.com',
        emailVerified: true,
      },
      { method: 'email-password' },
    );
    await ctx.internalAdapter.createAccount({
      userId: user.id,
      accountId: user.id,
      providerId: 'credential',
      password: await hashPassword('seed-password-123'),
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(AuthService)
      .useValue({ auth })
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  return {
    get app() {
      return app;
    },
    get auth() {
      return auth;
    },
    origin,
  };
}
