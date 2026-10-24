import { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createAuth } from '../../src/lib/auth';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Better Auth provisioning fields', () => {
  const config = new ConfigService({
    BETTER_AUTH_URL: 'http://localhost:3001',
    FRONTEND_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'test-secret-with-at-least-32-characters',
  });

  it('persists every field in the initial user insertion without a profile update', async () => {
    const rows: Record<string, Record<string, unknown>[]> = {
      user: [],
      session: [],
      account: [],
      verification: [],
    };
    const beforeCreate = jest.fn(async () => undefined);
    const beforeUpdate = jest.fn(async () => undefined);
    const options = createAuth({} as PrismaService, config, {
      provisionUsers: true,
    }).options;
    const auth = betterAuth({
      ...options,
      database: memoryAdapter(rows),
      databaseHooks: {
        user: {
          create: { before: beforeCreate },
          update: { before: beforeUpdate },
        },
      },
    });
    const { user } = await auth.api.signUpEmail({
      body: {
        name: 'Ignored client display name',
        firstname: 'Alice',
        lastname: 'Martin',
        email: 'alice@example.com',
        password: 'Temporary123!',
        phone: '+33612345678',
        isAdmin: true,
        mustChangePassword: true,
        teamId: 't1',
        organizationId: 'o1',
      },
    });
    const expected = {
      name: 'Alice Martin',
      firstname: 'Alice',
      lastname: 'Martin',
      phone: '+33612345678',
      isAdmin: true,
      mustChangePassword: true,
      teamId: 't1',
      organizationId: 'o1',
    };
    expect(beforeCreate).toHaveBeenCalledWith(
      expect.objectContaining(expected),
      expect.anything(),
    );
    expect(rows.user).toHaveLength(1);
    expect(rows.user[0]).toMatchObject(expected);
    expect(user).toMatchObject(expected);
    expect(rows.account).toHaveLength(1);
    expect(rows.account[0].password).not.toBe('Temporary123!');
    expect(beforeUpdate).not.toHaveBeenCalled();
  });

  it('keeps privileged input disabled on the public auth instance', () => {
    const fields = createAuth({} as PrismaService, config).options.user!
      .additionalFields!;
    for (const name of [
      'isAdmin',
      'mustChangePassword',
      'teamId',
      'organizationId',
    ]) {
      expect(fields[name].input).toBe(false);
    }
  });
});
