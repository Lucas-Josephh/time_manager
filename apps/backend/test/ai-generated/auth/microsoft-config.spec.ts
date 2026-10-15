import { ConfigService } from '@nestjs/config';
import { createAuth } from '../../../src/lib/auth';
import { PrismaService } from '../../../src/prisma/prisma.service';

const tenantId = '11111111-2222-3333-4444-555555555555';
const origin = 'http://localhost:3000';
const settings = {
  BETTER_AUTH_SECRET: 'test-secret-with-at-least-32-characters',
  BETTER_AUTH_URL: 'http://localhost:3001',
  FRONTEND_URL: origin,
  MICROSOFT_CLIENT_ID: 'test-client',
  MICROSOFT_CLIENT_SECRET: 'test-secret',
  MICROSOFT_TENANT_ID: tenantId,
};

describe('Microsoft configuration', () => {
  it('requires a complete configuration and a specific organization', () => {
    for (const overrides of [
      { MICROSOFT_CLIENT_SECRET: '' },
      { MICROSOFT_TENANT_ID: 'common' },
      { MICROSOFT_TENANT_ID: 'organizations' },
      { MICROSOFT_TENANT_ID: 'consumers' },
      { MICROSOFT_TENANT_ID: ' COMMON ' },
    ]) {
      expect(() =>
        createAuth(
          {} as PrismaService,
          new ConfigService({ ...settings, ...overrides }),
        ),
      ).toThrow();
    }
  });
});
