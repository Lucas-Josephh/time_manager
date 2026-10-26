import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/client';
import { useAuthFixture } from './auth.fixture';
describe('Native Better Auth: client', () => {
  const context = useAuthFixture();

  const { origin } = context;
  it('supports the standard client signIn, getSession and signOut calls', async () => {
    let cookie = '';
    const client = createAuthClient({
      baseURL: 'http://localhost:3001',
      plugins: [
        inferAdditionalFields({
          user: {
            firstname: { type: 'string', required: true },
            lastname: { type: 'string', required: true },
          },
        }),
      ],
      fetchOptions: {
        customFetchImpl: async (input, init) => {
          const headers = new Headers(init?.headers);
          headers.set('origin', origin);
          headers.set('x-forwarded-for', '192.0.2.30');
          if (cookie) headers.set('cookie', cookie);
          const response = await context.auth.handler(
            new Request(input, { ...init, headers }),
          );
          const updates = response.headers.getSetCookie();
          if (updates.length)
            cookie = updates.map((c) => c.split(';')[0]).join('; ');
          return response;
        },
      },
    });
    const login = await client.signIn.email({
      email: 'admin@example.com',
      password: 'seed-password-123',
    });
    expect(login.error).toBeNull();
    expect((await client.getSession()).data?.user.email).toBe(
      'admin@example.com',
    );
    expect((await client.getSession()).data?.user).toMatchObject({
      name: 'Admin Time Manager',
      firstname: 'Admin',
      lastname: 'Time Manager',
    });
    expect(
      (await client.updateUser({ firstname: 'Client', lastname: 'Tester' }))
        .error,
    ).toBeNull();
    expect((await client.getSession()).data?.user).toMatchObject({
      name: 'Client Tester',
      firstname: 'Client',
      lastname: 'Tester',
    });
    const invalidPassword = await client.changePassword({
      currentPassword: 'wrong-password',
      newPassword: 'ChangedPassword123!',
    });
    expect(invalidPassword.data).toBeNull();
    expect(invalidPassword.error).toMatchObject({
      code: 'INVALID_PASSWORD',
      message: expect.any(String),
    });
    expect((await client.signOut()).error).toBeNull();
    expect((await client.getSession()).data).toBeNull();
  });
});
