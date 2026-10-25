import request from 'supertest';
import { hashPassword } from 'better-auth/crypto';
import { useAuthFixture } from '../ai-generated/auth/auth.fixture';

describe('Native Better Auth profile contract', () => {
  const context = useAuthFixture();
  let cookies: string[];
  let attempt = 0;
  beforeAll(async () => {
    const auth = await context.auth.$context;
    const member = await auth.internalAdapter.createUser(
      {
        name: 'Member Tester',
        firstname: 'Member',
        lastname: 'Tester',
        email: 'member@example.com',
        isAdmin: false,
      },
      { method: 'email-password' },
    );
    await auth.internalAdapter.createAccount({
      userId: member.id,
      accountId: member.id,
      providerId: 'credential',
      password: await hashPassword('Temporary123!'),
    });
    const login = await request(context.app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', context.origin)
      .send({ email: 'member@example.com', password: 'Temporary123!' })
      .expect(200);
    cookies = (login.headers['set-cookie'] as unknown as string[]).map(
      (cookie) => cookie.split(';')[0],
    );
  });

  const update = (body: object) =>
    request(context.app.getHttpServer())
      .post('/api/auth/update-user')
      .set('Origin', context.origin)
      .set('Cookie', cookies)
      .set('X-Forwarded-For', `192.0.2.${100 + attempt++}`)
      .send(body);
  const session = () =>
    request(context.app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookies);

  it('updates names and lets a non-admin update only their own profile', async () => {
    await update({
      firstname: 'Alice',
      lastname: 'Martin',
      phone: '+33612345678',
    }).expect(200);
    const { body } = await session().expect(200);
    expect(body.user).toMatchObject({
      name: 'Alice Martin',
      firstname: 'Alice',
      lastname: 'Martin',
      phone: '+33612345678',
      email: 'member@example.com',
      isAdmin: false,
    });
    const auth = await context.auth.$context;
    expect(
      (await auth.internalAdapter.findUserByEmail('admin@example.com'))?.user,
    ).toMatchObject({
      name: 'Admin Time Manager',
      firstname: 'Admin',
      lastname: 'Time Manager',
    });
  });

  it('preserves omitted fields during partial updates', async () => {
    await update({ firstname: 'Bob' }).expect(200);
    expect((await session().expect(200)).body.user).toMatchObject({
      name: 'Bob Martin',
      firstname: 'Bob',
      lastname: 'Martin',
      phone: '+33612345678',
    });
  });

  it('preserves explicit null to clear the optional phone number', async () => {
    await update({ phone: null }).expect(200);
    expect((await session().expect(200)).body.user).toMatchObject({
      phone: null,
      name: 'Bob Martin',
      firstname: 'Bob',
      lastname: 'Martin',
    });
  });

  it('recomputes the display name when only the last name changes', async () => {
    await update({ lastname: 'Dupont' }).expect(200);
    expect((await session().expect(200)).body.user).toMatchObject({
      name: 'Bob Dupont',
      firstname: 'Bob',
      lastname: 'Dupont',
    });
    await update({ lastname: 'Martin' }).expect(200);
  });

  it('accepts native image updates and ignores unknown fields', async () => {
    await update({
      image: 'https://example.com/avatar.png',
      extra: 'ignored',
    }).expect(200, { status: true });
    expect((await session().expect(200)).body.user).toMatchObject({
      image: 'https://example.com/avatar.png',
      isAdmin: false,
      mustChangePassword: true,
    });
  });

  it.each([
    { isAdmin: true },
    { teamId: 'other-team' },
    { organizationId: 'other-org' },
  ])('keeps native protection for %j', async (fields) => {
    const response = await update(fields).expect(400);
    expect(response.body).toMatchObject({
      code: 'FIELD_NOT_ALLOWED',
      message: expect.any(String),
    });
    expect(response.body).not.toHaveProperty('data.errors');
  });

  it('preserves the native email-update error', async () => {
    const response = await update({ email: 'other@example.com' }).expect(400);
    expect(response.body).toMatchObject({
      code: 'EMAIL_CAN_NOT_BE_UPDATED',
      message: expect.any(String),
    });
    expect(response.body).not.toHaveProperty('data.errors');
  });

  it('retains native authentication for a valid request without a session', async () => {
    await request(context.app.getHttpServer())
      .post('/api/auth/update-user')
      .set('Origin', context.origin)
      .send({ firstname: 'Alice' })
      .expect(401);
  });

  it('rejects non-object bodies and empty updates', async () => {
    await update([]).expect(400);
    await update({}).expect(400);
  });
});
