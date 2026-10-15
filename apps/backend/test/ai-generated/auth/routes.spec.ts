import request from 'supertest';
import { useAuthFixture } from './auth.fixture';
describe('Native Better Auth: routes', () => {
  const context = useAuthFixture();
  const { origin } = context;

  it('exposes native routes, with signup disabled and origin checks', async () => {
    await request(context.app.getHttpServer())
      .get('/api/auth/ok')
      .expect(200)
      .expect({ ok: true });
    await request(context.app.getHttpServer())
      .get('/api/auth/get-session')
      .expect(200)
      .expect('null');
    await request(context.app.getHttpServer())
      .post('/api/auth/login')
      .send({})
      .expect(404);
    await request(context.app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', 'https://evil.example')
      .send({ email: 'admin@example.com', password: 'seed-password-123' })
      .expect(403);
    const signup = await request(context.app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', origin)
      .send({
        name: 'New',
        lastname: 'User',
        email: 'new@example.com',
        password: 'password-123',
      });
    expect(signup.status).toBe(400);
  });

  it('does not expose the removed JWT plugin endpoints', async () => {
    await request(context.app.getHttpServer())
      .get('/api/auth/token')
      .expect(404);
    await request(context.app.getHttpServer())
      .get('/api/auth/jwks')
      .expect(404);
  });
});
