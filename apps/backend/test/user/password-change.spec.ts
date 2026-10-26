import request from 'supertest';
import { useAuthFixture } from '../ai-generated/auth/auth.fixture';

describe('Mandatory password change', () => {
  const context = useAuthFixture();
  const initialPassword = 'seed-password-123';
  const newPassword = 'ChangedPassword123!';

  let validationAttempt = 0;

  it.each([
    { newPassword: 'ChangedPassword123!' },
    { currentPassword: 'old' },
    { currentPassword: null, newPassword: 'ChangedPassword123!' },
    { currentPassword: 123, newPassword: 'ChangedPassword123!' },
    { currentPassword: 'old', newPassword: 'ChangedPassword123!', revokeOtherSessions: null },
  ])('keeps native validation for %j', async (body) => {
    const response = await request(context.app.getHttpServer())
      .post('/api/auth/change-password')
      .set('Origin', context.origin)
      .set('X-Forwarded-For', `198.51.100.${++validationAttempt}`)
      .send(body)
      .expect(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.any(String),
    });
    expect(response.body).not.toHaveProperty('data.errors');
  });

  it('keeps the flag on failures, clears it after success and accepts the new credentials', async () => {
    const login = await request(context.app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', context.origin)
      .send({ email: 'admin@example.com', password: initialPassword })
      .expect(200);
    expect(login.body.user.mustChangePassword).toBe(true);
    const cookies = (login.headers['set-cookie'] as unknown as string[]).map(
      (cookie) => cookie.split(';')[0],
    );
    let attempt = 0;
    const change = (currentPassword: string, password: string) =>
      request(context.app.getHttpServer())
        .post('/api/auth/change-password')
        .set('X-Forwarded-For', `192.0.2.${100 + attempt++}`)
        .set('Origin', context.origin)
        .set('Cookie', cookies)
        .send({ currentPassword, newPassword: password, revokeOtherSessions: false });
    const session = () =>
      request(context.app.getHttpServer())
        .get('/api/auth/get-session')
        .set('Cookie', cookies);
    await change(initialPassword, 'weak').expect(400);
    await change('wrong-password', newPassword).expect(400);
    expect((await session().expect(200)).body.user.mustChangePassword).toBe(
      true,
    );
    await change(initialPassword, newPassword).expect(200);
    expect((await session().expect(200)).body.user.mustChangePassword).toBe(
      false,
    );
    // Reusing a password follows Better Auth’s native behavior.
    await request(context.app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', context.origin)
      .send({ email: 'admin@example.com', password: newPassword })
      .expect(200);
  });

  it('does not let the native profile endpoint grant admin or reset the password flag', async () => {
    const login = await request(context.app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', context.origin)
      .send({ email: 'admin@example.com', password: newPassword })
      .expect(200);
    const cookies = (login.headers['set-cookie'] as unknown as string[]).map(
      (cookie) => cookie.split(';')[0],
    );
    await request(context.app.getHttpServer())
      .post('/api/auth/update-user')
      .set('Origin', context.origin)
      .set('Cookie', cookies)
      .send({ isAdmin: false, mustChangePassword: true, teamId: 't2' });
    const session = await request(context.app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookies)
      .expect(200);
    expect(session.body.user).toMatchObject({
      isAdmin: true,
      mustChangePassword: false,
    });
    expect(session.body.user.teamId).toBeUndefined();
  });
});
