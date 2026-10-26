import request from 'supertest';
import { useAuthFixture } from './auth.fixture';
describe('Native Better Auth: session', () => {
  const context = useAuthFixture();
  const { origin } = context;

  it('validates credentials and creates the native cookie session', async () => {
    await request(context.app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', origin)
      .send({ email: 'invalid' })
      .expect(400);
    await request(context.app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', origin)
      .send({ email: 'admin@example.com', password: 'wrong' })
      .expect(401);
    const response = await request(context.app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', origin)
      .set('X-Forwarded-For', '192.0.2.10')
      .send({ email: 'admin@example.com', password: 'seed-password-123' })
      .expect(200);
    expect(response.body.user).toMatchObject({
      name: 'Admin Time Manager',
      firstname: 'Admin',
      lastname: 'Time Manager',
      isAdmin: true,
    });
    expect(response.body.user.password).toBeUndefined();
    const setCookies = response.headers['set-cookie'] as unknown as string[];
    expect(
      setCookies.some((c) => /HttpOnly/i.test(c) && /SameSite=Lax/i.test(c)),
    ).toBe(true);
    const cookies = setCookies.map((c) => c.split(';')[0]);
    const session = await request(context.app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookies)
      .expect(200);
    expect(session.body.user.email).toBe('admin@example.com');
  });

  it('revokes the session and clears cookies on sign-out', async () => {
    const login = await request(context.app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', origin)
      .set('X-Forwarded-For', '192.0.2.50')
      .send({ email: 'admin@example.com', password: 'seed-password-123' })
      .expect(200);
    const cookies = (login.headers['set-cookie'] as unknown as string[]).map(
      (c) => c.split(';')[0],
    );
    const response = await request(context.app.getHttpServer())
      .post('/api/auth/sign-out')
      .set('Origin', origin)
      .set('Cookie', cookies)
      .send({})
      .expect(200);
    expect(response.body.success).toBe(true);
    expect(
      (response.headers['set-cookie'] as unknown as string[]).some((c) =>
        /Max-Age=0/i.test(c),
      ),
    ).toBe(true);
    await request(context.app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookies)
      .expect(200)
      .expect('null');
  });

  it('rejects an expired session even when its cookie is still present', async () => {
    const login = await request(context.app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', origin)
      .set('X-Forwarded-For', '192.0.2.40')
      .send({ email: 'admin@example.com', password: 'seed-password-123' })
      .expect(200);
    const expiredCookies = (
      login.headers['set-cookie'] as unknown as string[]
    ).map((c) => c.split(';')[0]);
    const ctx = await context.auth.$context;
    await ctx.internalAdapter.updateSession(login.body.token as string, {
      expiresAt: new Date(Date.now() - 1000),
    });
    await request(context.app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', expiredCookies)
      .expect(200)
      .expect('null');
  });
});
