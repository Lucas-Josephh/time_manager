import { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createAuth } from '../../src/lib/auth';
import { PrismaService } from '../../src/prisma/prisma.service';

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

describe('Microsoft authentication', () => {
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

  it('automatically links Microsoft to an existing administrator-provisioned user only', async () => {
    const options = createAuth(
      {} as PrismaService,
      new ConfigService(settings),
    ).options;
    options.database = memoryAdapter({
      user: [],
      account: [],
      session: [],
      verification: [],
    });
    options.logger = { disabled: true };
    options.rateLimit = { enabled: false };
    const auth = betterAuth(options);
    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.createUser(
      {
        name: 'Authorized',
        lastname: 'User',
        email: 'authorized@example.com',
        emailVerified: false,
      },
      { method: 'email-password' },
    );
    const provider = ctx.socialProviders.find(
      (provider) => provider.id === 'microsoft',
    )!;
    // Mock only Microsoft's external response; exercise Better Auth's real callback and storage.
    provider.validateAuthorizationCode = async () => ({
      accessToken: 'mock-access-token',
    });
    let email = 'unauthorized@example.com';
    provider.getUserInfo = async () => ({
      user: { name: 'Microsoft User', email, emailVerified: false },
      data: { oid: 'microsoft-object-id' },
    });

    async function call(path: string, body?: object, cookie = '') {
      return auth.handler(
        new Request(`http://localhost:3001/api/auth/${path}`, {
          method: body ? 'POST' : 'GET',
          headers: { origin, 'content-type': 'application/json', cookie },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      );
    }
    function cookies(response: Response) {
      return response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
    }
    async function oauth(path = 'sign-in/social', cookie = '') {
      const start = await call(
        path,
        {
          provider: 'microsoft',
          callbackURL: origin,
          errorCallbackURL: `${origin}/?error=microsoft`,
          disableRedirect: true,
          requestSignUp: true,
        },
        cookie,
      );
      expect(start.status).toBe(200);
      const url = new URL((await start.json()).url);
      expect(url.pathname).toBe(`/${tenantId}/oauth2/v2.0/authorize`);
      expect(url.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3001/api/auth/callback/microsoft',
      );
      return call(
        `callback/microsoft?code=mock-code&state=${encodeURIComponent(url.searchParams.get('state')!)}`,
        undefined,
        cookies(start),
      );
    }

    const unknown = await oauth();
    expect(unknown.headers.get('location')).toContain('error=');
    expect(await ctx.internalAdapter.findUserByEmail(email)).toBeNull();

    email = user.email;
    expect(await ctx.internalAdapter.findAccounts(user.id)).toHaveLength(0);
    expect(
      (
        await call('link-social', {
          provider: 'microsoft',
          callbackURL: origin,
        })
      ).status,
    ).toBe(401);

    const linked = await oauth();
    expect(linked.headers.get('location')).toBe(origin);
    expect(await ctx.internalAdapter.findAccounts(user.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerId: 'microsoft',
          accountId: 'microsoft-object-id',
          userId: user.id,
        }),
      ]),
    );
    const firstSession = await call('get-session', undefined, cookies(linked));
    expect((await firstSession.json()).user.id).toBe(user.id);
    await call('sign-out', {}, cookies(linked));
    const microsoftLogin = await oauth();
    expect(microsoftLogin.headers.get('location')).toBe(origin);
    const sessionResponse = await call(
      'get-session',
      undefined,
      cookies(microsoftLogin),
    );
    expect((await sessionResponse.json()).user).toMatchObject({
      id: user.id,
      name: 'Authorized',
      lastname: 'User',
      isAdmin: false,
    });
    expect(await ctx.internalAdapter.findAccounts(user.id)).toHaveLength(1);
  });
});
