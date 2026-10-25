import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../support/http-test-app';

describe('Organization HTTP API', () => {
  let app: INestApplication;
  const prisma = { user: { findUnique: jest.fn() }, $transaction: async (callback: (tx: object) => unknown) => typeof callback === 'function' ? callback({ organization: prisma.organization }) : Promise.all(callback), organization: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() } };
  const organization = { id: 'department-it', name: 'IT' };

  beforeAll(async () => {
    app = await createHttpTestApp(prisma);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.organization.count.mockResolvedValue(0);
    prisma.user.findUnique.mockResolvedValue({ isAdmin: true });
    prisma.organization.findUnique.mockResolvedValue(organization);
  });

  it('lists organizations and removes undeclared fields', async () => {
    prisma.organization.count.mockResolvedValue(1);
    prisma.organization.findMany.mockResolvedValue([
      { ...organization, internal: 'private' },
    ]);
    await request(app.getHttpServer())
      .get('/api/organizations')
      .expect(200)
      .expect({
        success: true,
        message: 'request_successful',
        data: { items: [organization], meta: { total: 1, page: 1, limit: 10, totalPages: 1 } },
      });
    expect(prisma.organization.findMany).toHaveBeenCalledWith({
      where: {},
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: 0, take: 10,
    });
  });

  it('trims the name search and combines it with the other filters', async () => {
    prisma.organization.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/organizations?name=%20TeCh%20&parentId=root&managerId=%20manager%20')
      .expect(200);
    expect(prisma.organization.findMany).toHaveBeenCalledWith({
      where: {
        name: { contains: 'TeCh', mode: 'insensitive' },
        parentId: 'root',
        managerId: 'manager',
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: 0, take: 10,
    });
  });

  it('returns an empty list', async () => {
    prisma.organization.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/organizations')
      .expect(200)
      .expect({ success: true, message: 'request_successful', data: { items: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } } });
  });

  it('looks up and serializes a organization', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      ...organization,
      internal: 'private',
    });
    await request(app.getHttpServer())
      .get(`/api/organizations/${organization.id}`)
      .expect(200)
      .expect({
        success: true,
        message: 'request_successful',
        data: organization,
      });
    expect(prisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: organization.id },
    });
  });

  it('returns a standard 404 for an absent organization', async () => {
    prisma.organization.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get('/api/organizations/missing')
      .expect(404)
      .expect({ success: false, message: 'not_found', data: {} });
  });

  it.each(['list', 'detail'])('hides database errors on %s', async (route) => {
    prisma.organization[
      route === 'list' ? 'findMany' : 'findUnique'
    ].mockRejectedValue(new Error('private database credentials'));
    await request(app.getHttpServer())
      .get(
        route === 'list'
          ? '/api/organizations'
          : `/api/organizations/${organization.id}`,
      )
      .expect(500)
      .expect({ success: false, message: 'internal_server_error', data: {} });
  });
  it('creates an organization with the documented envelope', async () => {
    prisma.organization.create.mockResolvedValue(organization);
    await request(app.getHttpServer()).post('/api/organizations')
      .send({ name: ' IT ' }).expect(201)
      .expect({ success: true, message: 'organization_created', data: organization });
    expect(prisma.organization.create).toHaveBeenCalledWith({ data: { name: 'IT' } });
  });

  it('rejects an empty name before writing', async () => {
    await request(app.getHttpServer()).post('/api/organizations').send({ name: '  ' }).expect(400);
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });

  it('rejects a null name in a partial update', async () => {
    await request(app.getHttpServer()).patch('/api/organizations/a').send({ name: null }).expect(400);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('deletes an organization', async () => {
    prisma.organization.delete.mockResolvedValue(organization);
    await request(app.getHttpServer()).delete(`/api/organizations/${organization.id}`).expect(200)
      .expect({ success: true, message: 'organization_deleted', data: organization });
  });

  it('updates an organization and preserves omitted fields', async () => {
    prisma.organization.findUnique.mockResolvedValue(organization);
    prisma.organization.update.mockResolvedValue({ ...organization, name: 'Engineering' });
    await request(app.getHttpServer()).patch(`/api/organizations/${organization.id}`)
      .send({ name: 'Engineering' }).expect(200)
      .expect({ success: true, message: 'organization_updated', data: { ...organization, name: 'Engineering' } });
    expect(prisma.organization.update).toHaveBeenCalledWith({ where: { id: organization.id }, data: { name: 'Engineering' } });
  });

});
