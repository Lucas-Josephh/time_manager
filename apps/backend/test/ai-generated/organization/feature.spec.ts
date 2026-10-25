import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { AuthService } from '../../../src/auth/auth.service';
import { Prisma } from '../../../src/generated/prisma/client';
import { createHttpTestApp } from '../support/http-test-app';

describe('Organization CRUD contracts', () => {
  let app: INestApplication;
  const organization = {
    id: 'org-engineering', name: 'Engineering',
    parentId: null, managerId: null,
    createdAt: '2026-10-16T10:00:00.000Z', updatedAt: '2026-10-16T10:00:00.000Z',
  };
  const delegate = {
    count: jest.fn(), create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(),
    update: jest.fn(), delete: jest.fn(),
  };
  const prisma = {
    organization: delegate,
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const dbError = (code: string) => new Prisma.PrismaClientKnownRequestError('Private SQL details', {
    code, clientVersion: '7.10.0', meta: { modelName: 'Organization' },
  });

  beforeAll(async () => { app = await createHttpTestApp(prisma); });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.resetAllMocks();
    delegate.findUnique.mockResolvedValue(organization);
    delegate.create.mockResolvedValue(organization);
    delegate.update.mockResolvedValue(organization);
    delegate.delete.mockResolvedValue(organization);
    delegate.findMany.mockResolvedValue([organization]);
    delegate.count.mockResolvedValue(1);
    prisma.user.findUnique.mockResolvedValue({ id: 'manager', isAdmin: true });
    prisma.$transaction.mockImplementation(async (callback) => typeof callback === 'function' ? callback({ organization: delegate, user: prisma.user }) : Promise.all(callback));
  });
  afterEach(() => { jest.restoreAllMocks(); });

  it.each([
    ['get', '/api/organizations'], ['get', '/api/organizations/org-engineering'],
    ['post', '/api/organizations'], ['patch', '/api/organizations/org-engineering'],
    ['delete', '/api/organizations/org-engineering'],
  ] as const)('requires authentication for %s %s', async (method, url) => {
    jest.spyOn(app.get(AuthService), 'getSession').mockRejectedValue(new UnauthorizedException());
    await request(app.getHttpServer())[method](url).send({ name: 'Engineering' }).expect(401);
    for (const mock of Object.values(delegate)) expect(mock).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('combines list filters without exposing internal fields', async () => {
    delegate.findMany.mockResolvedValue([{ ...organization, users: [{ email: 'private@example.com' }], secret: true, description: 'Unsupported' }]);
    const response = await request(app.getHttpServer()).get('/api/organizations')
      .query({ name: 'eng', parentId: 'root', managerId: 'manager' }).expect(200);
    expect(response.body.data).toEqual({ items: [organization], meta: { total: 1, page: 1, limit: 10, totalPages: 1 } });
    expect(delegate.findMany).toHaveBeenCalledWith({
      where: { name: { contains: 'eng', mode: 'insensitive' }, parentId: 'root', managerId: 'manager' },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: 0, take: 10,
    });
  });

  it.each([
    {}, { name: null }, { name: 42 }, { name: '   ' }, { name: 'x'.repeat(256) },
    { name: 'Valid', description: 'Unsupported' },
    { name: 'Valid', parentId: '' }, { name: 'Valid', managerId: 42 },
    { name: 'Valid', unexpected: true },
  ])('rejects invalid creation data %#', async (body) => {
    const response = await request(app.getHttpServer()).post('/api/organizations').send(body).expect(400);
    expect(response.body).toMatchObject({ success: false, message: 'validation_failed' });
    expect(delegate.create).not.toHaveBeenCalled();
  });

  it.each(['parentId', 'managerId'])('rejects a missing %s reference', async (field) => {
    delegate.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockImplementation(async ({ where }) => where.id === 'missing' ? null : { id: where.id, isAdmin: true });
    const response = await request(app.getHttpServer()).post('/api/organizations')
      .send({ name: 'Engineering', [field]: 'missing' }).expect(400);
    expect(response.body.data.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field, messages: expect.arrayContaining(['reference_not_found']) }),
    ]));
    expect(delegate.create).not.toHaveBeenCalled();
  });

  it('creates with parent and manager and serializes nullable fields and dates', async () => {
    const body = { name: ' Engineering ', parentId: 'root', managerId: 'manager' };
    const result = { ...organization, ...body, name: 'Engineering' };
    delegate.create.mockResolvedValue({ ...result, users: [{ email: 'private@example.com' }] });
    await request(app.getHttpServer()).post('/api/organizations').send(body).expect(201)
      .expect({ success: true, message: 'organization_created', data: result });
    expect(delegate.create).toHaveBeenCalledWith({ data: { ...body, name: 'Engineering' } });
  });

  it('clears optional fields without changing the name', async () => {
    const body = { parentId: null, managerId: null };
    await request(app.getHttpServer()).patch(`/api/organizations/${organization.id}`).send(body).expect(200);
    expect(delegate.update).toHaveBeenCalledWith({ where: { id: organization.id }, data: body });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('rejects the removed description field on updates', async () => {
    const response = await request(app.getHttpServer()).patch(`/api/organizations/${organization.id}`)
      .send({ description: null }).expect(400);
    expect(response.body.data.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'description', messages: ['validation_unknown_field'] }),
    ]));
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('checks the update target before validating the DTO', async () => {
    delegate.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer()).patch('/api/organizations/missing')
      .send({ name: 42, unexpected: true }).expect(404)
      .expect({ success: false, message: 'not_found', data: {} });
    expect(delegate.findUnique).toHaveBeenCalledTimes(1);
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('rejects updates of an absent organization', async () => {
    delegate.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer()).patch('/api/organizations/missing').send({ name: 'New' }).expect(404)
      .expect({ success: false, message: 'not_found', data: {} });
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('rejects a self parent through the HTTP API', async () => {
    await request(app.getHttpServer()).patch(`/api/organizations/${organization.id}`)
      .send({ parentId: organization.id }).expect(400)
      .expect({ success: false, message: 'validation_failed', data: { errors: [{ field: 'parentId', messages: ['organization_cycle'] }] } });
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('rejects a deep descendant as parent', async () => {
    delegate.findUnique.mockImplementation(async ({ where }) => ({
      id: where.id,
      parentId: where.id === 'grandchild' ? 'child' : where.id === 'child' ? organization.id : null,
    }));
    await request(app.getHttpServer()).patch(`/api/organizations/${organization.id}`)
      .send({ parentId: 'grandchild' }).expect(400);
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('allows reparenting below another branch', async () => {
    delegate.findUnique.mockImplementation(async ({ where }) => ({
      id: where.id, parentId: where.id === 'other' ? 'root' : null,
    }));
    await request(app.getHttpServer()).patch(`/api/organizations/${organization.id}`)
      .send({ parentId: 'other' }).expect(200);
    expect(delegate.update).toHaveBeenCalledWith({ where: { id: organization.id }, data: { parentId: 'other' } });
  });

  it.each([
    ['P2003', 409, 'reference_conflict'],
    ['P2025', 404, 'not_found'],
  ] as const)('maps deletion failure %s', async (code, status, message) => {
    delegate.delete.mockRejectedValue(dbError(code));
    await request(app.getHttpServer()).delete(`/api/organizations/${organization.id}`).expect(status)
      .expect({ success: false, message, data: {} });
  });

  it('reports serialization conflicts without exposing database details', async () => {
    prisma.$transaction.mockRejectedValue(dbError('P2034'));
    await request(app.getHttpServer()).patch(`/api/organizations/${organization.id}`).send({ name: 'New' })
      .expect(409).expect({ success: false, message: 'concurrent_modification', data: {} });
  });

  it.each(['post', 'patch', 'delete'] as const)('hides unexpected database failures on %s', async (method) => {
    delegate.create.mockRejectedValue(new Error('private credentials'));
    delegate.update.mockRejectedValue(new Error('private credentials'));
    delegate.delete.mockRejectedValue(new Error('private credentials'));
    const url = method === 'post' ? '/api/organizations' : `/api/organizations/${organization.id}`;
    await request(app.getHttpServer())[method](url).send({ name: 'New' }).expect(500)
      .expect({ success: false, message: 'internal_server_error', data: {} });
  });
});
