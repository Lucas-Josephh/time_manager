import request from 'supertest';
import { useAuthFixture } from './auth.fixture';
describe('Native Better Auth: rate-limit', () => {
  const context = useAuthFixture();
  const { origin } = context;

  it('retains native rate limiting', async () => {
    for (let i = 0; i < 3; i++) {
      await request(context.app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .set('Origin', origin)
        .set('X-Forwarded-For', '192.0.2.20')
        .send({ email: 'admin@example.com', password: 'wrong' })
        .expect(401);
    }
    await request(context.app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', origin)
      .set('X-Forwarded-For', '192.0.2.20')
      .send({ email: 'admin@example.com', password: 'wrong' })
      .expect(429);
  });
});
