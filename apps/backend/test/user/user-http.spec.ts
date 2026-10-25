import { mockFindUniqueOrThrow } from '../support/mock-find-unique-or-throw';
import { APIError } from 'better-auth/api';
import request from 'supertest';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { createHttpTestApp } from '../ai-generated/support/http-test-app';
import * as auth from '../../src/lib/auth';
import { Prisma } from '../../src/generated/prisma/client';

describe('User administration HTTP contract', () => {
  let app: INestApplication;
  let authenticated = true;
  let mustChangePassword = false;
  const user = {
    id: 'u1',
    name: 'Alice Martin',
    firstname: 'Alice',
    lastname: 'Martin',
    email: 'alice@example.com',
    phone: null,
    isAdmin: false,
    mustChangePassword: true,
    organizationId: 'o1',
    teamId: null,
  };
  const prisma = {
    $transaction: jest.fn(),
    team: { findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn() },
    organization: { findMany: jest.fn() },
    user: {
      findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  beforeAll(async () => {
    app = await createHttpTestApp(prisma, async () => {
      if (!authenticated) throw new UnauthorizedException();
      return { user: { id: 'admin', mustChangePassword } };
    });
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    prisma.team.findUnique.mockResolvedValue(null);
    authenticated = true;
    mustChangePassword = false;
    prisma.user.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.id === 'admin' ? { isAdmin: true } : user),
    );
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.findMany.mockResolvedValue([
      { ...user, accounts: [{ password: 'secret' }], token: 'secret' },
    ]);
    prisma.user.count.mockResolvedValue(1);
    prisma.user.update.mockResolvedValue(user);
    prisma.user.delete.mockResolvedValue(user);
    prisma.$transaction.mockImplementation((operation) =>
      typeof operation === 'function'
        ? operation(prisma)
        : Promise.all(operation),
    );
  });

  it.each(['get', 'post', 'patch', 'delete'] as const)(
    'requires a session for %s',
    async (method) => {
      authenticated = false;
      await request(app.getHttpServer())
        [method](
          method === 'patch' || method === 'delete'
            ? '/api/users/u1'
            : '/api/users',
        )
        .send({})
        .expect(401);
      expect(prisma.user.update).not.toHaveBeenCalled();
    },
  );
  it.each(['get', 'post', 'patch', 'delete'] as const)(
    'requires an administrator for %s',
    async (method) => {
      prisma.user.findUnique.mockResolvedValue({ isAdmin: false });
      await request(app.getHttpServer())
        [method](
          method === 'patch' || method === 'delete'
            ? '/api/users/u1'
            : '/api/users',
        )
        .send({})
        .expect(403);
    },
  );
  it('blocks business access until the temporary password is changed', async () => {
    mustChangePassword = true;
    const response = await request(app.getHttpServer())
      .get('/api/users')
      .expect(403);
    expect(response.body.message).toBe('password_change_required');
  });
  it('also blocks team routes while a password change is pending', async () => {
    mustChangePassword = true;
    await request(app.getHttpServer()).get('/api/team').expect(403);
    authenticated = false;
    await request(app.getHttpServer()).get('/api/team').expect(401);
  });
  it('filters actual fields and serializes the paginated result', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/users?page=2&limit=5&firstname=Alice')
      .expect(200);
    expect(response.body.data).toEqual({
      items: [user],
      meta: { total: 1, page: 2, limit: 5, totalPages: 1 },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        where: { firstname: { contains: 'Alice', mode: 'insensitive' } },
      }),
    );
  });
  it.each(['page=-1', 'page=1.5', 'limit=101', 'limit=abc', 'username=alice'])(
    'rejects invalid query %s',
    async (query) => {
      await request(app.getHttpServer()).get(`/api/users?${query}`).expect(400);
    },
  );
  it.each([
    { teamId: 't2' },
    { organizationId: 'o2' },
    { mustChangePassword: false },
    { name: 'Untrusted display name' },
    { firstname: null },
    { firstname: ' ' },
    { isAdmin: null },
  ])('rejects forbidden or invalid profile fields %j', async (body) => {
    await request(app.getHttpServer())
      .patch('/api/users/u1')
      .send(body)
      .expect(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it('creates an initial team membership through Team in the provisioning transaction', async () => {
    const signup = jest.fn().mockResolvedValue({ user: { id: 'u1' } });
    jest.spyOn(auth, 'createAuth').mockReturnValue({
      api: { signUpEmail: signup },
    } as unknown as ReturnType<typeof auth.createAuth>);
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    prisma.team.findUnique.mockResolvedValue({
      id: 't1',
      organizationId: 'o1',
    });
    prisma.organization.findMany.mockResolvedValue([]);
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(
        where.id === 'admin' ? { isAdmin: true } : { ...user, teamId: 't1' },
      ),
    );
    const response = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        firstname: 'Alice',
        lastname: 'Martin',
        email: 'alice@example.com',
        password: 'Temporary123!',
        teamId: ' t1 ',
      })
      .expect(201);
    expect(response.body.data).toMatchObject({
      id: 'u1',
      teamId: 't1',
      organizationId: 'o1',
    });
    expect(signup).toHaveBeenCalledWith({
      body: {
        email: 'alice@example.com',
        password: 'Temporary123!',
        name: 'Alice Martin',
        firstname: 'Alice',
        lastname: 'Martin',
        isAdmin: false,
        mustChangePassword: true,
        teamId: 't1',
        organizationId: 'o1',
      },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('rejects duplicate email in the DTO before provisioning', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'existing' });
    const createAuth = jest.spyOn(auth, 'createAuth');
    const response = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        firstname: 'Alice',
        lastname: 'Martin',
        email: ' ALICE@example.com ',
        password: 'Temporary123!',
      })
      .expect(400);
    expect(response.body).toEqual({
      success: false,
      message: 'validation_failed',
      data: { errors: [{ field: 'email', messages: ['already_exists'] }] },
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'alice@example.com' },
      select: { id: true },
    });
    expect(createAuth).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reports a duplicate that appeared after DTO validation instead of a synthetic-user 404', async () => {
    jest.spyOn(auth, 'createAuth').mockReturnValue({
      api: {
        signUpEmail: jest.fn().mockResolvedValue({ user: { id: 'synthetic' } }),
      },
    } as unknown as ReturnType<typeof auth.createAuth>);
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    prisma.user.findUnique.mockImplementation(async ({ where }) =>
      where.id === 'admin' ? { isAdmin: true } : null,
    );
    const response = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        firstname: 'Alice',
        lastname: 'Martin',
        email: 'alice@example.com',
        password: 'Temporary123!',
      })
      .expect(400);
    expect(response.body.data.errors).toEqual([
      { field: 'email', messages: ['already_exists'] },
    ]);
  });

  it('maps a concurrent email conflict after the provisioning transaction has rolled back', async () => {
    prisma.$transaction.mockRejectedValue(
      new APIError('UNPROCESSABLE_ENTITY', {
        code: 'FAILED_TO_CREATE_USER',
        message: 'Failed to create user',
      }),
    );
    const response = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        firstname: 'Alice',
        lastname: 'Martin',
        email: 'alice@example.com',
        password: 'Temporary123!',
      })
      .expect(400);
    expect(response.body.data.errors).toEqual([
      { field: 'email', messages: ['already_exists'] },
    ]);
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { email: 'alice@example.com' },
    });
  });

  it('rejects a nonexistent team on creation', async () => {
    await request(app.getHttpServer())
      .post('/api/users')
      .send({
        firstname: 'Alice',
        lastname: 'Martin',
        email: 'alice@example.com',
        password: 'Temporary123!',
        teamId: 't1',
      })
      .expect(400);
  });
  it('persists every supported patch field and checks email uniqueness excluding the current user', async () => {
    await request(app.getHttpServer())
      .patch('/api/users/u1')
      .send({
        email: ' NEW@example.com ',
        phone: null,
        firstname: ' Alice ',
        isAdmin: true,
      })
      .expect(200);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ email: 'new@example.com' }, { id: { not: 'u1' } }] },
      select: { id: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        name: 'Alice Martin',
        firstname: 'Alice',
        lastname: undefined,
        email: 'new@example.com',
        phone: null,
        isAdmin: true,
        emailVerified: false,
      },
    });
  });
  it.each([
    [{ firstname: ' Jean Pierre ' }, 'Jean Pierre Martin'],
    [{ lastname: ' Du Pont ' }, 'Alice Du Pont'],
    [{ firstname: ' Jean ', lastname: ' Dupont ' }, 'Jean Dupont'],
  ])(
    'derives the display name from a partial administrative update %j',
    async (body, name) => {
      await request(app.getHttpServer())
        .patch('/api/users/u1')
        .send(body)
        .expect(200);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name }) }),
      );
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'Serializable',
      });
    },
  );

  it('rejects a display name provided during account creation', async () => {
    await request(app.getHttpServer())
      .post('/api/users')
      .send({
        firstname: 'Alice',
        lastname: 'Martin',
        email: 'new@example.com',
        password: 'Temporary123!',
        name: 'Untrusted',
      })
      .expect(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses the common not-found response', async () => {
    prisma.user.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.id === 'admin' ? { isAdmin: true } : null),
    );
    const response = await request(app.getHttpServer())
      .patch('/api/users/missing')
      .send({ firstname: 'Alice' })
      .expect(404);
    expect(response.body).toEqual({
      success: false,
      message: 'not_found',
      data: {},
    });
  });
  it('preserves database conflicts instead of translating them into 404', async () => {
    prisma.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '7.10.0',
      }),
    );
    const response = await request(app.getHttpServer())
      .patch('/api/users/u1')
      .send({ email: 'new@example.com' })
      .expect(409);
    expect(response.body.message).toBe('already_exists');
  });
});
