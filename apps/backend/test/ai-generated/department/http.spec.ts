import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from '../support/http-test-app';

describe('Department HTTP API', () => {
  let app: INestApplication;
  const prisma = { department: { findMany: jest.fn(), findUnique: jest.fn() } };
  const department = { id: 'department-it', name: 'IT' };

  beforeAll(async () => {
    app = await createHttpTestApp(prisma);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('lists departments and removes undeclared fields', async () => {
    prisma.department.findMany.mockResolvedValue([
      { ...department, internal: 'private' },
    ]);
    await request(app.getHttpServer())
      .get('/api/departments')
      .expect(200)
      .expect({
        success: true,
        message: 'request_successful',
        data: [department],
      });
    expect(prisma.department.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
  });

  it('returns an empty list', async () => {
    prisma.department.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/departments')
      .expect(200)
      .expect({ success: true, message: 'request_successful', data: [] });
  });

  it('looks up and serializes a department', async () => {
    prisma.department.findUnique.mockResolvedValue({
      ...department,
      internal: 'private',
    });
    await request(app.getHttpServer())
      .get(`/api/departments/${department.id}`)
      .expect(200)
      .expect({
        success: true,
        message: 'request_successful',
        data: department,
      });
    expect(prisma.department.findUnique).toHaveBeenCalledWith({
      where: { id: department.id },
    });
  });

  it('returns a standard 404 for an absent department', async () => {
    prisma.department.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get('/api/departments/missing')
      .expect(404)
      .expect({ success: false, message: 'department_not_found', data: {} });
  });

  it.each(['list', 'detail'])('hides database errors on %s', async (route) => {
    prisma.department[
      route === 'list' ? 'findMany' : 'findUnique'
    ].mockRejectedValue(new Error('private database credentials'));
    await request(app.getHttpServer())
      .get(
        route === 'list'
          ? '/api/departments'
          : `/api/departments/${department.id}`,
      )
      .expect(500)
      .expect({ success: false, message: 'internal_server_error', data: {} });
  });
});
